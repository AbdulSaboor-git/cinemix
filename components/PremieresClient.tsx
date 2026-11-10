"use client";
import {
  useEffect,
  useState,
  useCallback,
  useMemo,
  useRef,
  useTransition,
  memo,
} from "react";
import { useRouter } from "next/navigation";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Star,
  ShieldAlert,
  ArrowUpDown,
  Globe,
  Tv,
  Sparkles,
} from "lucide-react";
import {
  getPremieres,
  getCachedPremieres,
  getDigitalReleases,
  getCachedDigitalReleases,
  isRussianDomesticFilm,
  isEligibleForGlobalReleaseMonth,
  hydrateFilmWithCache,
} from "@/lib/kinopoisk";
import { Film } from "@/types/kinopoisk";
import {
  translateGenre,
  translateCountry,
  formatDateSafe,
} from "@/lib/translate";
import { useAutoTranslate, useFilmTitle } from "@/hooks/useTranslate";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import {
  hasApiKeys,
  hasVerifiedApiKey,
} from "@/lib/preferences";
import { getQuickCertBadge } from "@/lib/parentalGuide";
import {
  useHydratedFilm,
  useFilmLongPress,
  FilmLongPressPortal,
} from "@/components/FilmCard";
import ParentalGuideModal from "@/components/ParentalGuideModal";
import PageContainer from "@/components/ui/PageContainer";
import PageHeader from "@/components/ui/PageHeader";
import TabBar from "@/components/ui/TabBar";
import TabPill from "@/components/ui/TabPill";
import PosterImage from "@/components/ui/PosterImage";
import EmptyState from "@/components/ui/EmptyState";
import NoKeyBanner from "@/components/ui/NoKeyBanner";

const MONTHS = [
  "JANUARY",
  "FEBRUARY",
  "MARCH",
  "APRIL",
  "MAY",
  "JUNE",
  "JULY",
  "AUGUST",
  "SEPTEMBER",
  "OCTOBER",
  "NOVEMBER",
  "DECEMBER",
];
const MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];
const MONTH_FULL = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const MEDIA_TYPES = [
  { id: "ALL", label: "All Titles" },
  { id: "FILM", label: "Movies" },
  { id: "TV_SERIES", label: "TV Series" },
  { id: "MINI_SERIES", label: "Mini Series" },
] as const;

type ReleaseModeTab = "global" | "digital";
type MediaTypeOption = (typeof MEDIA_TYPES)[number]["id"];

const NOW = new Date();
const CUR_YEAR = NOW.getFullYear();
const CUR_MONTH_IDX = NOW.getMonth();

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

// ── Module-level cache for instant 0ms month/year/tab switching ──
interface PremieresSnapshot {
  timestamp: number;
  items: Film[];
}

const SNAPSHOT_TTL_MS = 10 * 60 * 1000; // 10 minutes
const premieresCache = new Map<string, PremieresSnapshot>();

function getCacheKey(
  tab: ReleaseModeTab,
  year: number,
  monthStr: string,
): string {
  return `${tab}:${year}:${monthStr}`;
}

if (typeof window !== "undefined") {
  window.addEventListener("cinemix-cache-clear", () => {
    premieresCache.clear();
  });
}

function getValidPremieresSnapshot(
  tab: ReleaseModeTab,
  year: number,
  monthIdx: number,
): PremieresSnapshot | null {
  if (!hasVerifiedApiKey()) return null;
  const monthStr = MONTHS[monthIdx];
  const key = getCacheKey(tab, year, monthStr);
  const existing = premieresCache.get(key);
  if (existing) {
    if (
      existing.items.length > 0 &&
      Date.now() - existing.timestamp < SNAPSHOT_TTL_MS
    ) {
      return existing;
    }
    premieresCache.delete(key);
  }

  const syncCached =
    tab === "digital"
      ? getCachedDigitalReleases(year, monthStr)
      : getCachedPremieres(year, monthStr);
  if (syncCached && syncCached.items && syncCached.items.length > 0) {
    const snap: PremieresSnapshot = {
      timestamp: Date.now(),
      items: syncCached.items,
    };
    premieresCache.set(key, snap);
    return snap;
  }

  return null;
}

export default function PremieresClient({
  year: yearParam,
  month: monthParam,
  sort: sortParam,
  tab: tabParam,
  type: typeParam,
}: {
  year?: string;
  month?: string;
  sort?: string;
  tab?: string;
  type?: string;
}) {
  const router = useRouter();
  const autoTranslate = useAutoTranslate();
  const [, startTransition] = useTransition();

  const initYear = yearParam ? parseInt(yearParam, 10) : CUR_YEAR;
  const initMonthIdx = monthParam
    ? MONTHS.indexOf(monthParam.toUpperCase())
    : CUR_MONTH_IDX;

  const resolvedMonthIdx = clamp(
    initMonthIdx < 0 ? CUR_MONTH_IDX : initMonthIdx,
    0,
    11,
  );

  const initTab: ReleaseModeTab =
    tabParam?.toLowerCase() === "digital" ? "digital" : "global";
  const initMediaType: MediaTypeOption =
    typeParam === "FILM" ||
    typeParam === "TV_SERIES" ||
    typeParam === "MINI_SERIES"
      ? typeParam
      : "ALL";

  const [noKey, setNoKey] = useState(false);
  const [activeTab, setActiveTab] = useState<ReleaseModeTab>(initTab);
  const [mediaType, setMediaType] = useState<MediaTypeOption>(initMediaType);
  const [year, setYear] = useState(initYear);
  const [monthIdx, setMonthIdx] = useState(resolvedMonthIdx);
  const [films, setFilms] = useState<Film[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [sortBy, setSortBy] = useState<"DATE" | "RATING">(() => {
    if (sortParam === "RATING" || sortParam === "DATE") return sortParam;
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("cinemix_premieres_sort");
      if (saved === "RATING" || saved === "DATE") return saved;
    }
    return "DATE";
  });

  // Sync URL prop changes when navigating from Home ("Recent Digital Releases" -> /premieres?tab=digital)
  useEffect(() => {
    if (tabParam?.toLowerCase() === "digital") {
      setActiveTab("digital");
    } else if (tabParam?.toLowerCase() === "global") {
      setActiveTab("global");
    }
  }, [tabParam]);

  // Restore saved sort & date from storage on client mount if not explicitly set in URL
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!sortParam) {
      const savedSort = localStorage.getItem("cinemix_premieres_sort");
      if (savedSort === "RATING" || savedSort === "DATE") {
        setSortBy(savedSort);
      }
    }
    if (!yearParam && !monthParam) {
      try {
        const savedDate = sessionStorage.getItem("cinemix_premieres_date");
        if (savedDate) {
          const parsed = JSON.parse(savedDate) as { y?: number; m?: number };
          if (typeof parsed.y === "number" && typeof parsed.m === "number") {
            setYear(parsed.y);
            setMonthIdx(clamp(parsed.m, 0, 11));
          }
        }
      } catch {
        // ignore
      }
    }
  }, [yearParam, monthParam, sortParam]);

  const [parentalModalFilm, setParentalModalFilm] = useState<Film | null>(null);
  const didMountRef = useRef(false);

  useDocumentTitle(
    `${activeTab === "digital" ? "Digital Releases" : "Global Releases"} — ${MONTH_FULL[monthIdx]} ${year}`,
  );

  const [keyEpoch, setKeyEpoch] = useState(0);

  useEffect(() => {
    const syncKeyState = () => {
      if (!hasApiKeys()) {
        premieresCache.clear();
        setNoKey(true);
        setFilms([]);
        setLoading(false);
      } else {
        setNoKey((prev) => {
          if (prev) setKeyEpoch((e) => e + 1);
          return false;
        });
      }
    };
    window.addEventListener("cinemix-session-change", syncKeyState);
    window.addEventListener("storage", syncKeyState);
    return () => {
      window.removeEventListener("cinemix-session-change", syncKeyState);
      window.removeEventListener("storage", syncKeyState);
    };
  }, []);

  useEffect(() => {
    if (!hasApiKeys()) {
      premieresCache.clear();
      setNoKey(true);
      setFilms([]);
      setLoading(false);
      return;
    }
    setNoKey(false);

    const monthStr = MONTHS[monthIdx];
    const cached = getValidPremieresSnapshot(activeTab, year, monthIdx);
    if (cached) {
      setFilms(cached.items);
      setLoading(false);
    } else {
      let cancelled = false;
      setLoading(true);
      const fetcher =
        activeTab === "digital"
          ? getDigitalReleases(year, monthStr, "high")
          : getPremieres(year, monthStr, "high");

      fetcher
        .then((d) => {
          if (cancelled) return;
          const list = d.items ?? [];
          if (list.length > 0) {
            premieresCache.set(getCacheKey(activeTab, year, monthStr), {
              timestamp: Date.now(),
              items: list,
            });
          }
          setFilms(list);
        })
        .catch(() => {
          if (!cancelled) {
            if (!hasApiKeys()) {
              premieresCache.clear();
              setNoKey(true);
            }
            setFilms([]);
          }
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });

      return () => {
        cancelled = true;
      };
    }
  }, [activeTab, year, monthIdx, keyEpoch]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("cinemix_premieres_sort", sortBy);
        sessionStorage.setItem(
          "cinemix_premieres_date",
          JSON.stringify({ y: year, m: monthIdx }),
        );
      } catch {
        // ignore
      }
    }
    const targetMonth = MONTHS[monthIdx];
    const sortQs = sortBy === "RATING" ? "&sort=RATING" : "";
    const tabQs = activeTab === "digital" ? "&tab=digital" : "";
    const typeQs = mediaType !== "ALL" ? `&type=${mediaType}` : "";
    if (didMountRef.current) {
      startTransition(() => {
        router.replace(
          `/premieres?year=${year}&month=${targetMonth}${tabQs}${typeQs}${sortQs}`,
          { scroll: false },
        );
      });
    }
    didMountRef.current = true;
  }, [
    activeTab,
    mediaType,
    year,
    monthIdx,
    sortBy,
    router,
  ]);

  // Silently prefetch adjacent months (next & prev) in low priority after idle
  useEffect(() => {
    if (loading || noKey) return;
    const timer = setTimeout(() => {
      const nextM = monthIdx === 11 ? 0 : monthIdx + 1;
      const nextY = monthIdx === 11 ? year + 1 : year;
      if (!getValidPremieresSnapshot(activeTab, nextY, nextM)) {
        const fn =
          activeTab === "digital" ? getDigitalReleases : getPremieres;
        fn(nextY, MONTHS[nextM], "low")
          .then((d) => {
            if (d.items && d.items.length > 0) {
              premieresCache.set(
                getCacheKey(activeTab, nextY, MONTHS[nextM]),
                {
                  timestamp: Date.now(),
                  items: d.items,
                },
              );
            }
          })
          .catch(() => {});
      }

      const prevM = monthIdx === 0 ? 11 : monthIdx - 1;
      const prevY = monthIdx === 0 ? year - 1 : year;
      if (!getValidPremieresSnapshot(activeTab, prevY, prevM)) {
        const fn =
          activeTab === "digital" ? getDigitalReleases : getPremieres;
        fn(prevY, MONTHS[prevM], "low")
          .then((d) => {
            if (d.items && d.items.length > 0) {
              premieresCache.set(
                getCacheKey(activeTab, prevY, MONTHS[prevM]),
                {
                  timestamp: Date.now(),
                  items: d.items,
                },
              );
            }
          })
          .catch(() => {});
      }
    }, 450);

    return () => clearTimeout(timer);
  }, [activeTab, loading, noKey, year, monthIdx]);

  // Strict Global Curation, Old Re-release Elimination, Media Type Filtering & Sorting
  const displayedFilms = useMemo(() => {
    const cleanPool = films.filter((f) => {
      if (isRussianDomesticFilm(f)) return false;
      if (activeTab === "global") {
        if (!isEligibleForGlobalReleaseMonth(f, year, monthIdx + 1)) {
          return false;
        }
      } else {
        const yr = f.year ?? f.startYear;
        if (yr && (yr < year - 1 || yr > year + 1)) return false;
      }

      if (mediaType !== "ALL") {
        const isSeries =
          f.serial === true ||
          f.type === "TV_SERIES" ||
          f.type === "MINI_SERIES";
        if (mediaType === "FILM") {
          if (isSeries) return false;
        } else if (mediaType === "MINI_SERIES") {
          if (f.type !== "MINI_SERIES") return false;
        } else if (mediaType === "TV_SERIES") {
          if (f.type !== "TV_SERIES" && !f.serial) return false;
        }
      }

      return true;
    });

    return [...cleanPool].sort((a, b) => {
      if (sortBy === "RATING") {
        const ha = hydrateFilmWithCache(a);
        const hb = hydrateFilmWithCache(b);
        const rA = ha.ratingImdb ?? ha.ratingKinopoisk ?? 0;
        const rB = hb.ratingImdb ?? hb.ratingKinopoisk ?? 0;
        return rB - rA;
      }
      const dateStrA =
        activeTab === "digital"
          ? a.digitalReleaseDate || a.releaseDate || a.premiereRu
          : a.releaseDate || a.premiereRu;
      const dateStrB =
        activeTab === "digital"
          ? b.digitalReleaseDate || b.releaseDate || b.premiereRu
          : b.releaseDate || b.premiereRu;
      const dA = dateStrA ? new Date(dateStrA).getTime() || 0 : 0;
      const dB = dateStrB ? new Date(dateStrB).getTime() || 0 : 0;
      return dA - dB;
    });
  }, [films, sortBy, activeTab, mediaType, year, monthIdx]);

  const handleCloseParentalGuide = useCallback(() => {
    setParentalModalFilm(null);
  }, []);

  const handleOpenParentalGuide = useCallback((film: Film) => {
    setParentalModalFilm(film);
  }, []);

  if (noKey) return <NoKeyBanner />;

  const switchDate = (nextY: number, nextM: number) => {
    if (nextY === year && nextM === monthIdx) return;
    const snap = getValidPremieresSnapshot(activeTab, nextY, nextM);
    if (snap) {
      setFilms(snap.items);
      setLoading(false);
    } else {
      setLoading(true);
    }
    setYear(nextY);
    setMonthIdx(nextM);
  };

  const switchTab = (nextTab: ReleaseModeTab) => {
    if (nextTab === activeTab) return;
    const snap = getValidPremieresSnapshot(nextTab, year, monthIdx);
    if (snap) {
      setFilms(snap.items);
      setLoading(false);
    } else {
      setLoading(true);
    }
    setActiveTab(nextTab);
  };

  const prevMonth = () => {
    if (monthIdx === 0) {
      switchDate(year - 1, 11);
    } else {
      switchDate(year, monthIdx - 1);
    }
  };
  const nextMonth = () => {
    if (monthIdx === 11) {
      switchDate(year + 1, 0);
    } else {
      switchDate(year, monthIdx + 1);
    }
  };

  const isCurrent = year === CUR_YEAR && monthIdx === CUR_MONTH_IDX;

  return (
    <PageContainer>
      <PageHeader
        eyebrow={
          activeTab === "digital" ? "HD & Streaming Calendar" : "Global Release Calendar"
        }
        eyebrowIcon={
          activeTab === "digital" ? (
            <Sparkles size={14} stroke="var(--accent)" />
          ) : (
            <Globe size={14} stroke="var(--accent)" />
          )
        }
        title={activeTab === "digital" ? "DIGITAL RELEASES" : "GLOBAL RELEASES"}
        subtitle={
          <>
            <span className="font-semibold text-[var(--text)]">
              {MONTH_FULL[monthIdx]} {year}
            </span>
            {!loading && (
              <span className="text-[var(--text-muted)] ml-2">
                · {displayedFilms.length}{" "}
                {activeTab === "digital" ? "digital release" : "release"}
                {displayedFilms.length !== 1 ? "s" : ""}
              </span>
            )}
          </>
        }
        rightSlot={
          <div className="inline-flex items-center gap-1.5">
            <ArrowUpDown size={18} />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as "DATE" | "RATING")}
              className="select text-[12px] py-1.5 px-3 rounded-[8px]"
            >
              <option value="DATE">Release Date</option>
              <option value="RATING">Rating</option>
            </select>
          </div>
        }
      />

      {/* ── Mode Switcher (Global Releases vs Digital Releases) + Media Type Filter ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 mb-4">
        <div className="inline-flex items-center p-1 rounded-[11px] bg-[var(--bg-card)] border border-[var(--border)] self-start">
          <button
            type="button"
            onClick={() => switchTab("global")}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-[8px] text-[12px] font-semibold cursor-pointer transition-all border-none ${
              activeTab === "global"
                ? "bg-[var(--accent)] text-white shadow-sm"
                : "bg-transparent text-[var(--text-dim)] hover:text-white"
            }`}
          >
            <Globe size={13} />
            <span>Global Releases</span>
          </button>
          <button
            type="button"
            onClick={() => switchTab("digital")}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-[8px] text-[12px] font-semibold cursor-pointer transition-all border-none ${
              activeTab === "digital"
                ? "bg-[var(--accent)] text-white shadow-sm"
                : "bg-transparent text-[var(--text-dim)] hover:text-white"
            }`}
          >
            <Sparkles size={13} />
            <span>Digital &amp; HD Releases</span>
          </button>
        </div>

        <TabBar className="sm:w-auto">
          {MEDIA_TYPES.map((mt) => (
            <TabPill
              key={mt.id}
              active={mediaType === mt.id}
              onClick={() => setMediaType(mt.id)}
              className="!px-3 !py-1.5 !text-[11px] sm:!text-[12px]"
            >
              {mt.label}
            </TabPill>
          ))}
        </TabBar>
      </div>

      {/* Month / Year Navigator */}
      <div className="flex flex-col gap-3 mb-5 sm:mb-6">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={prevMonth}
            className="flex-shrink-0 w-8 h-8 sm:w-9 sm:h-9 rounded-full border border-[var(--border)] bg-[var(--bg-elevated)] flex items-center justify-center cursor-pointer hover:border-[var(--border-hover)] active:scale-95 transition-all text-[var(--text)]"
            aria-label="Previous month"
          >
            <ChevronLeft size={14} strokeWidth={2.5} />
          </button>

          <TabBar className="flex-1">
            {MONTH_LABELS.map((lbl, i) => (
              <TabPill
                key={lbl}
                active={monthIdx === i}
                onClick={() => switchDate(year, i)}
                className="!px-3 !py-1.5 !text-[11px] sm:!text-[12px]"
              >
                {lbl}
              </TabPill>
            ))}
          </TabBar>

          <button
            type="button"
            onClick={nextMonth}
            className="flex-shrink-0 w-8 h-8 sm:w-9 sm:h-9 rounded-full border border-[var(--border)] bg-[var(--bg-elevated)] flex items-center justify-center cursor-pointer hover:border-[var(--border-hover)] active:scale-95 transition-all text-[var(--text)]"
            aria-label="Next month"
          >
            <ChevronRight size={14} strokeWidth={2.5} />
          </button>
        </div>

        {/* Year row */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => switchDate(year - 1, monthIdx)}
              className="w-7 h-7 rounded-full border border-[var(--border)] bg-[var(--bg-elevated)] flex items-center justify-center cursor-pointer hover:border-[var(--border-hover)] active:scale-95 transition-all text-[12px] text-[var(--text)]"
              aria-label="Previous year"
            >
              −
            </button>
            <span className="font-display text-[18px] tracking-[1px] text-[var(--text)] min-w-[50px] text-center">
              {year}
            </span>
            <button
              type="button"
              onClick={() => switchDate(year + 1, monthIdx)}
              className="w-7 h-7 rounded-full border border-[var(--border)] bg-[var(--bg-elevated)] flex items-center justify-center cursor-pointer hover:border-[var(--border-hover)] active:scale-95 transition-all text-[12px] text-[var(--text)]"
              aria-label="Next year"
            >
              +
            </button>
          </div>

          {!isCurrent && (
            <button
              type="button"
              onClick={() => switchDate(CUR_YEAR, CUR_MONTH_IDX)}
              className="text-[11px] text-[var(--accent)] bg-transparent border border-[rgba(229,9,20,0.3)] rounded-[8px] px-3 py-[5px] cursor-pointer hover:border-[var(--accent)] transition-colors"
            >
              This month
            </button>
          )}
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div
          className="grid gap-3.5 sm:gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 fade-in"
          role="status"
        >
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="skeleton h-[128px] rounded-[12px]" />
          ))}
        </div>
      ) : displayedFilms.length === 0 ? (
        <EmptyState
          icon={<Calendar size={36} />}
          title={
            activeTab === "digital"
              ? "No Digital Releases Found"
              : "No Releases Found"
          }
          description="Try selecting a different month, year, or media type."
        />
      ) : (
        <div className="grid gap-3.5 sm:gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 fade-in">
          {displayedFilms.map((film, i) => {
            const fid = film.kinopoiskId ?? film.filmId ?? i;
            return (
              <div
                className="cursor-pointer"
                onClick={() => router.push(`/film/${fid}`)}
                key={fid}
              >
                <PremiereCard
                  film={film}
                  index={i}
                  autoTranslate={autoTranslate}
                  isDigitalMode={activeTab === "digital"}
                  onOpenParentalGuide={handleOpenParentalGuide}
                />
              </div>
            );
          })}
        </div>
      )}

      {parentalModalFilm && (
        <ParentalGuideModal
          open={Boolean(parentalModalFilm)}
          onClose={handleCloseParentalGuide}
          film={parentalModalFilm}
        />
      )}
    </PageContainer>
  );
}

export const PremiereCard = memo(function PremiereCard({
  film: rawFilm,
  index,
  autoTranslate,
  isDigitalMode = false,
  onOpenParentalGuide,
}: {
  film: Film;
  index: number;
  autoTranslate: boolean;
  isDigitalMode?: boolean;
  onOpenParentalGuide: (film: Film) => void;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const posterWrapRef = useRef<HTMLDivElement>(null);

  // Only hydrate top 6 visible cards in background; others use passive cache to prevent 20-request bursts
  const film = useHydratedFilm(rawFilm, cardRef, false, index >= 6);
  const name = useFilmTitle(film, autoTranslate);
  const id = film.kinopoiskId ?? film.filmId ?? 0;

  const {
    popupOpen,
    popupEntered,
    originDelta,
    closePopup,
    setPopupOpen,
    setPopupEntered,
    historyPushedRef,
    bindLongPress,
  } = useFilmLongPress(id, posterWrapRef);

  const effectiveReleaseDateStr = isDigitalMode
    ? film.digitalReleaseDate || film.releaseDate || film.premiereRu
    : rawFilm.releaseDate || film.releaseDate || film.premiereRu;

  const safeReleaseDate = formatDateSafe(effectiveReleaseDateStr, {
    month: "short",
    day: "numeric",
  });
  const durationMins = film.filmLength ?? film.duration;
  const ageCert = getQuickCertBadge(film);
  const displayRating =
    film.ratingImdb ??
    film.ratingKinopoisk ??
    (typeof film.rating === "number" && film.rating > 0 && film.rating <= 10
      ? film.rating
      : undefined);
  const awaitRating =
    !displayRating && film.ratingAwait && film.ratingAwait > 0
      ? `${Math.round(film.ratingAwait)}%`
      : null;

  const isSeries =
    film.serial === true ||
    film.type === "TV_SERIES" ||
    film.type === "MINI_SERIES";
  const seriesTypeLabel =
    film.type === "MINI_SERIES"
      ? "Mini-Series"
      : isSeries
        ? "Series"
        : null;

  const genresText = useMemo(() => {
    if (!film.genres || film.genres.length === 0) return "";
    return film.genres
      .slice(0, 2)
      .map((g) => translateGenre(g.genre, autoTranslate))
      .join(" · ");
  }, [film.genres, autoTranslate]);

  const countriesText = useMemo(() => {
    if (!film.countries || film.countries.length === 0) return "";
    return film.countries
      .slice(0, 2)
      .map((c) => translateCountry(c.country, autoTranslate))
      .join(", ");
  }, [film.countries, autoTranslate]);

  const formattedDuration =
    durationMins !== undefined && durationMins > 0
      ? durationMins >= 60
        ? `${Math.floor(durationMins / 60)}h ${durationMins % 60}m`
        : `${durationMins}m`
      : null;

  return (
    <>
      <div
        ref={cardRef}
        className={`flex items-stretch gap-2.5 sm:gap-3.5 bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-lg)] p-2.5 sm:p-3 hover:border-[rgba(229,9,20,0.3)] active:bg-[var(--bg-elevated)] transition-all duration-200 h-full w-full min-w-0 group select-none [-webkit-touch-callout:none] ${
          popupOpen ? "opacity-0 scale-95 pointer-events-none" : ""
        }`}
        onTouchStart={bindLongPress.onTouchStart}
        onTouchMove={bindLongPress.onTouchMove}
        onTouchEnd={bindLongPress.onTouchEnd}
        onTouchCancel={bindLongPress.onTouchCancel}
        onMouseDown={bindLongPress.onMouseDown}
        onMouseMove={bindLongPress.onMouseMove}
        onMouseUp={bindLongPress.onMouseUp}
        onMouseLeave={bindLongPress.onMouseLeave}
        onClickCapture={bindLongPress.onClickCapture}
        onContextMenu={bindLongPress.onContextMenu}
      >
        {/* Poster */}
        <div className="no-underline shrink-0 self-start">
          <div
            ref={posterWrapRef}
            className="w-[70px] xs:w-[76px] sm:w-[84px] rounded-[8px] overflow-hidden aspect-[2/3] relative bg-[var(--surface)] shadow-sm ring-1 ring-white/5"
          >
            <PosterImage
              src={film.posterUrlPreview || film.posterUrl}
              alt={name}
              title={name}
              filmId={id}
              imdbId={film.imdbId}
              year={film.year ?? film.startYear}
              size="sm"
              fallbackType="mini"
              priority={index < 6}
            />
          </div>
        </div>

        {/* Info Column */}
        <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5 gap-2">
          <div className="flex flex-col gap-1 sm:gap-1.5 min-w-0">
            <div className="flex items-start justify-between gap-1.5 sm:gap-2 min-w-0">
              <div className="no-underline min-w-0 flex-1">
                <p className="font-semibold text-[var(--text)] text-[13px] sm:text-[14px] leading-[1.3] m-0 group-hover:text-white transition-colors line-clamp-2 break-words">
                  {name}
                </p>
              </div>

              {ageCert && (
                <button
                  type="button"
                  onTouchStart={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onOpenParentalGuide(film);
                  }}
                  title="View Parental Guide"
                  aria-label={`Parental Guide: ${ageCert.label}`}
                  className={`shrink-0 text-[10px] sm:text-[11px] leading-none font-bold rounded-[5px] px-1.5 py-1 min-h-[22px] border cursor-pointer inline-flex items-center gap-1 transition-colors ${
                    ageCert.isMature
                      ? "bg-[rgba(229,9,20,0.15)] border-[rgba(229,9,20,0.45)] text-[var(--accent)] hover:bg-[rgba(229,9,20,0.25)]"
                      : "bg-[var(--bg-elevated)] border-[var(--border-hover)] text-[var(--text)] hover:border-white"
                  }`}
                >
                  <ShieldAlert size={10} className="shrink-0" />
                  <span>{ageCert.label}</span>
                </button>
              )}
            </div>

            {(seriesTypeLabel || genresText) && (
              <div className="flex items-center gap-1.5 min-w-0">
                {seriesTypeLabel && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.4px] px-1.5 py-0.5 rounded bg-[rgba(245,197,24,0.14)] text-[#f5c518] border border-[rgba(245,197,24,0.28)] shrink-0">
                    <Tv size={9} />
                    {seriesTypeLabel}
                  </span>
                )}
                {genresText && (
                  <p className="text-[11px] sm:text-[12px] leading-snug text-[var(--text-muted)] capitalize truncate m-0">
                    {genresText}
                  </p>
                )}
              </div>
            )}

            {(countriesText || formattedDuration) && (
              <div className="flex items-center flex-wrap gap-x-1.5 gap-y-0.5 text-[11px] leading-snug text-[var(--text-muted)] min-w-0">
                {countriesText && (
                  <span className="truncate max-w-full">{countriesText}</span>
                )}
                {countriesText && formattedDuration && (
                  <span className="opacity-50 select-none" aria-hidden="true">
                    ·
                  </span>
                )}
                {formattedDuration && (
                  <span className="shrink-0 whitespace-nowrap">
                    {formattedDuration}
                  </span>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between gap-2 pt-1.5 mt-auto border-t border-white/[0.05] min-w-0">
            <div className="flex items-center gap-1.5 min-w-0 truncate">
              {safeReleaseDate ? (
                <span className="text-[11px] sm:text-[12px] leading-none text-[var(--accent)] font-semibold whitespace-nowrap truncate">
                  {safeReleaseDate}
                </span>
              ) : (
                <span className="text-[11px] leading-none text-[var(--text-muted)]">
                  {film.year ?? film.startYear ?? ""}
                </span>
              )}
              {isDigitalMode && (
                <span className="text-[9px] font-bold uppercase tracking-[0.4px] px-1.5 py-[2px] rounded bg-white/[0.06] text-[var(--text-dim)] border border-white/[0.08] shrink-0">
                  Digital
                </span>
              )}
            </div>

            {displayRating !== undefined && displayRating > 0 ? (
              <span className="inline-flex items-center gap-1 text-[11px] sm:text-[12px] leading-none text-[#f5c518] font-bold font-display whitespace-nowrap shrink-0 ml-auto">
                <Star
                  size={11}
                  fill="#f5c518"
                  stroke="#f5c518"
                  className="shrink-0"
                />
                {displayRating.toFixed(1)}
              </span>
            ) : awaitRating ? (
              <span className="inline-flex items-center gap-1 text-[11px] leading-none text-[#f5c518] font-bold font-display whitespace-nowrap shrink-0 ml-auto">
                <Star
                  size={10}
                  fill="#f5c518"
                  stroke="#f5c518"
                  className="shrink-0"
                />
                {awaitRating}
              </span>
            ) : null}
          </div>
        </div>
      </div>

      {popupOpen && (
        <FilmLongPressPortal
          film={film}
          popupOpen={popupOpen}
          popupEntered={popupEntered}
          originDelta={originDelta}
          closePopup={closePopup}
          setPopupOpen={setPopupOpen}
          setPopupEntered={setPopupEntered}
          historyPushedRef={historyPushedRef}
        />
      )}
    </>
  );
});
