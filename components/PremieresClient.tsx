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
} from "lucide-react";
import {
  getPremieres,
  getCachedPremieres,
  isRussianDomesticFilm,
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
import { hasApiKeys, getPreferences } from "@/lib/preferences";
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

const NOW = new Date();
const CUR_YEAR = NOW.getFullYear();
const CUR_MONTH_IDX = NOW.getMonth();

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

// ── Module-level cache for instant 0ms month/year switching ──
interface PremieresSnapshot {
  timestamp: number;
  items: Film[];
}

const SNAPSHOT_TTL_MS = 10 * 60 * 1000; // 10 minutes
const premieresCache = new Map<string, PremieresSnapshot>();

function getCacheKey(year: number, monthStr: string): string {
  return `${year}:${monthStr}`;
}

function getValidPremieresSnapshot(
  year: number,
  monthIdx: number,
): PremieresSnapshot | null {
  const monthStr = MONTHS[monthIdx];
  const key = getCacheKey(year, monthStr);
  const existing = premieresCache.get(key);
  if (existing) {
    if (Date.now() - existing.timestamp < SNAPSHOT_TTL_MS) {
      return existing;
    }
    premieresCache.delete(key);
  }

  // Fallback to synchronous API cache (e.g. if HomeClient already fetched this month's premieres)
  const syncCached = getCachedPremieres(year, monthStr);
  if (syncCached && syncCached.items) {
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
}: {
  year?: string;
  month?: string;
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
  const initialCache = getValidPremieresSnapshot(initYear, resolvedMonthIdx);

  const [noKey, setNoKey] = useState(false);
  const [year, setYear] = useState(initYear);
  const [monthIdx, setMonthIdx] = useState(resolvedMonthIdx);
  const [films, setFilms] = useState<Film[]>(() => initialCache?.items ?? []);
  const [loading, setLoading] = useState<boolean>(() => !initialCache);
  const [sortBy, setSortBy] = useState<"DATE" | "RATING">("DATE");
  const [parentalModalFilm, setParentalModalFilm] = useState<Film | null>(null);

  const didMountRef = useRef(false);

  useDocumentTitle(`Premieres — ${MONTH_FULL[monthIdx]} ${year}`);

  useEffect(() => {
    if (!hasApiKeys()) {
      setNoKey(true);
      setLoading(false);
      return;
    }

    const monthStr = MONTHS[monthIdx];
    const cached = getValidPremieresSnapshot(year, monthIdx);
    if (cached) {
      setFilms(cached.items);
      setLoading(false);
    } else {
      let cancelled = false;
      setLoading(true);
      getPremieres(year, monthStr, "high")
        .then((d) => {
          if (cancelled) return;
          const list = d.items ?? [];
          premieresCache.set(getCacheKey(year, monthStr), {
            timestamp: Date.now(),
            items: list,
          });
          setFilms(list);
        })
        .catch(() => {
          if (!cancelled) setFilms([]);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });

      return () => {
        cancelled = true;
      };
    }
  }, [year, monthIdx]);

  useEffect(() => {
    const targetMonth = MONTHS[monthIdx];
    if (
      didMountRef.current &&
      (String(year) !== yearParam ||
        targetMonth !== (monthParam || "").toUpperCase())
    ) {
      startTransition(() => {
        router.replace(`/premieres?year=${year}&month=${targetMonth}`, {
          scroll: false,
        });
      });
    }
    didMountRef.current = true;
  }, [year, monthIdx, router, yearParam, monthParam]);

  // Silently prefetch adjacent months (next & prev) in low priority after idle
  useEffect(() => {
    if (loading || noKey) return;
    const timer = setTimeout(() => {
      const nextM = monthIdx === 11 ? 0 : monthIdx + 1;
      const nextY = monthIdx === 11 ? year + 1 : year;
      if (!getValidPremieresSnapshot(nextY, nextM)) {
        getPremieres(nextY, MONTHS[nextM], "low")
          .then((d) => {
            premieresCache.set(getCacheKey(nextY, MONTHS[nextM]), {
              timestamp: Date.now(),
              items: d.items ?? [],
            });
          })
          .catch(() => {});
      }

      const prevM = monthIdx === 0 ? 11 : monthIdx - 1;
      const prevY = monthIdx === 0 ? year - 1 : year;
      if (!getValidPremieresSnapshot(prevY, prevM)) {
        getPremieres(prevY, MONTHS[prevM], "low")
          .then((d) => {
            premieresCache.set(getCacheKey(prevY, MONTHS[prevM]), {
              timestamp: Date.now(),
              items: d.items ?? [],
            });
          })
          .catch(() => {});
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [loading, noKey, year, monthIdx]);

  // Regional curation & sorting
  const displayedFilms = useMemo(() => {
    const regionMode =
      typeof window !== "undefined"
        ? (getPreferences().contentRegionMode ?? "GLOBAL_FIRST")
        : "GLOBAL_FIRST";
    const base =
      regionMode === "GLOBAL_FIRST"
        ? films.filter((f) => !isRussianDomesticFilm(f))
        : films;
    const pool = base.length > 0 ? base : films;

    return [...pool].sort((a, b) => {
      if (sortBy === "RATING") {
        const ha = hydrateFilmWithCache(a);
        const hb = hydrateFilmWithCache(b);
        const rA = ha.ratingImdb ?? ha.ratingKinopoisk ?? 0;
        const rB = hb.ratingImdb ?? hb.ratingKinopoisk ?? 0;
        return rB - rA;
      }
      const dA = a.premiereRu ? new Date(a.premiereRu).getTime() || 0 : 0;
      const dB = b.premiereRu ? new Date(b.premiereRu).getTime() || 0 : 0;
      return dA - dB;
    });
  }, [films, sortBy]);

  const handleCloseParentalGuide = useCallback(() => {
    setParentalModalFilm(null);
  }, []);

  const handleOpenParentalGuide = useCallback((film: Film) => {
    setParentalModalFilm(film);
  }, []);

  if (noKey) return <NoKeyBanner />;

  const switchDate = (nextY: number, nextM: number) => {
    if (nextY === year && nextM === monthIdx) return;
    const snap = getValidPremieresSnapshot(nextY, nextM);
    if (snap) {
      setFilms(snap.items);
      setLoading(false);
    } else {
      setLoading(true);
    }
    setYear(nextY);
    setMonthIdx(nextM);
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
        eyebrow="Calendar"
        eyebrowIcon={<Calendar size={14} stroke="var(--accent)" />}
        title="PREMIERES"
        subtitle={
          <>
            <span className="font-semibold text-[var(--text)]">
              {MONTH_FULL[monthIdx]} {year}
            </span>
            {!loading && (
              <span className="text-[var(--text-muted)] ml-2">
                · {displayedFilms.length} premiere
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
          title="No Premieres Found"
          description="Try selecting a different month or year."
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
  onOpenParentalGuide,
}: {
  film: Film;
  index: number;
  autoTranslate: boolean;
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

  const safePremiereDate = formatDateSafe(film.premiereRu, {
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
              year={film.year}
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

            {genresText && (
              <p className="text-[11px] sm:text-[12px] leading-snug text-[var(--text-muted)] capitalize truncate m-0">
                {genresText}
              </p>
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
            {safePremiereDate ? (
              <span className="text-[11px] sm:text-[12px] leading-none text-[var(--accent)] font-semibold whitespace-nowrap truncate">
                {safePremiereDate}
              </span>
            ) : (
              <span />
            )}

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
