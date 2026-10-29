"use client";
import React, {
  useEffect,
  useState,
  useMemo,
  useRef,
  useCallback,
  useTransition,
  memo,
} from "react";
import {
  Star,
  Trophy,
  Film as FilmIcon,
  Tv,
  Heart,
  Clock,
  CheckCircle2,
} from "lucide-react";
import { getTopFilms } from "@/lib/kinopoisk";
import { translateGenre, translateCountry } from "@/lib/translate";
import { useAutoTranslate, useFilmTitle } from "@/hooks/useTranslate";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { useListStatus } from "@/hooks/useListStatus";
import { hasApiKeys } from "@/lib/preferences";
import { getList, toggleFavorite, toggleWatchLater } from "@/lib/userLists";
import { useToast } from "@/lib/toast";
import { Film } from "@/types/kinopoisk";
import {
  useHydratedFilm,
  useFilmLongPress,
  FilmLongPressPortal,
} from "@/components/FilmCard";
import Pagination from "@/components/Pagination";
import PageContainer from "@/components/ui/PageContainer";
import PageHeader from "@/components/ui/PageHeader";
import TabBar from "@/components/ui/TabBar";
import TabPill from "@/components/ui/TabPill";
import PosterImage from "@/components/ui/PosterImage";
import EmptyState from "@/components/ui/EmptyState";
import NoKeyBanner from "@/components/ui/NoKeyBanner";
import { useRouter } from "next/navigation";

const PAGE_SIZE = 20;

type TopCollection = "TOP_250_MOVIES" | "TOP_250_TV_SHOWS";

// ── Module-level cache for 0ms re-visits, tab switches, and pagination ──
interface Top250Snapshot {
  timestamp: number;
  items: Film[];
  total: number;
  totalPages: number;
}

const SNAPSHOT_TTL_MS = 10 * 60 * 1000; // 10 minutes
const top250Cache = new Map<string, Top250Snapshot>();

function getCacheKey(type: TopCollection, page: number): string {
  return `${type}:${page}`;
}

function getValidSnapshot(
  type: TopCollection,
  page: number,
): Top250Snapshot | null {
  const entry = top250Cache.get(getCacheKey(type, page));
  if (!entry) return null;
  if (Date.now() - entry.timestamp > SNAPSHOT_TTL_MS) {
    top250Cache.delete(getCacheKey(type, page));
    return null;
  }
  return entry;
}

function readWatchedSet(): Set<number> {
  if (typeof window === "undefined") return new Set();
  try {
    return new Set(getList("history").map((e) => e.film_id));
  } catch {
    return new Set();
  }
}

const Top250Row = memo(function Top250Row({
  film: rawFilm,
  rank,
  autoTranslate,
  isWatched,
  onNavigate,
  onToastSuccess,
  onToastInfo,
}: {
  film: Film;
  rank: number;
  autoTranslate: boolean;
  isWatched: boolean;
  onNavigate: (id: number) => void;
  onToastSuccess: (msg: string) => void;
  onToastInfo: (msg: string) => void;
}) {
  const rowRef = useRef<HTMLDivElement>(null);
  const posterWrapRef = useRef<HTMLDivElement>(null);
  const film = useHydratedFilm(rawFilm, rowRef);
  const name = useFilmTitle(film, autoTranslate);
  const id = film.kinopoiskId ?? film.filmId ?? 0;
  const { isFav, isWL } = useListStatus(id);

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

  const rankSize =
    rank <= 10
      ? "text-[18px] sm:text-[26px]"
      : rank <= 50
        ? "text-[16px] sm:text-[21px]"
        : "text-[14px] sm:text-[17px]";
  const rankColor =
    rank <= 3
      ? "text-[#f5c518]"
      : rank <= 10
        ? "text-[rgba(245,197,24,0.65)]"
        : "text-[var(--text-muted)]";

  const filmEntry = useMemo(
    () => ({
      film_id: id,
      film_name: name,
      poster_url: film.posterUrlPreview || film.posterUrl || null,
      year: film.year ?? null,
      rating: film.ratingKinopoisk ?? film.ratingImdb ?? null,
    }),
    [
      id,
      name,
      film.posterUrlPreview,
      film.posterUrl,
      film.year,
      film.ratingKinopoisk,
      film.ratingImdb,
    ],
  );

  return (
    <>
      <div
        ref={rowRef}
        onClick={() => onNavigate(id)}
        className={`cursor-pointer flex items-center gap-2.5 sm:gap-4 md:gap-5 px-2.5 sm:px-4 py-2.5 sm:py-3 rounded-[10px] border border-white/5 transition-all duration-[180ms] hover:bg-[var(--bg-card)] hover:border-[var(--border)] active:bg-[var(--bg-card)] group w-full max-w-full overflow-hidden select-none [-webkit-touch-callout:none] ${
          popupOpen ? "opacity-0 scale-[0.98] pointer-events-none" : ""
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
        {/* Rank */}
        <div
          className={`w-6 sm:w-9 text-right flex-shrink-0 font-display leading-none ${rankSize} ${rankColor}`}
        >
          {rank}
        </div>

        {/* Poster */}
        <div className="no-underline flex-shrink-0">
          <div
            ref={posterWrapRef}
            className="w-[38px] sm:w-[46px] h-[56px] sm:h-[68px] rounded-[6px] overflow-hidden bg-[var(--surface)] relative"
          >
            <PosterImage
              src={film.posterUrlPreview || film.posterUrl}
              alt={name}
              title={name}
              size="sm"
              fallbackType="mini"
              priority={rank <= 8}
            />
          </div>
        </div>

        {/* Info — strictly constrained min-w-0 flex-1 overflow-hidden so mobile titles never overflow */}
        <div className="flex-1 min-w-0 overflow-hidden">
          <div className="flex items-center gap-1.5 min-w-0">
            <div className="no-underline block min-w-0 flex-1 overflow-hidden">
              <p className="text-[13px] sm:text-[14px] md:text-[15px] font-semibold text-[var(--text)] truncate block m-0 mb-[2px] sm:mb-1 group-hover:text-white transition-colors">
                {name}
              </p>
            </div>
            {isWatched && (
              <span className="flex-shrink-0 inline-flex items-center gap-1 text-[9px] sm:text-[10px] font-semibold text-[#4ade80] bg-[rgba(34,197,94,0.12)] border border-[rgba(34,197,94,0.3)] rounded px-1.5 py-[1px]">
                <CheckCircle2 size={9} />
                <span className="hidden xs:inline">Watched</span>
              </span>
            )}
          </div>
          <div className="flex gap-1.5 sm:gap-2 items-center min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">
            {film.year && (
              <span className="text-[11px] sm:text-[12px] text-[var(--text-muted)] flex-shrink-0">
                {film.year}
              </span>
            )}
            {film.countries?.[0] && (
              <span className="hidden md:inline text-[11px] text-[var(--text-muted)] truncate">
                · {translateCountry(film.countries[0].country, autoTranslate)}
              </span>
            )}
            {film.genres?.slice(0, 2).map((g) => (
              <span
                key={g.genre}
                className="text-[11px] text-[var(--text-dim)] capitalize truncate"
              >
                · {translateGenre(g.genre, autoTranslate)}
              </span>
            ))}
          </div>
        </div>

        {/* Rating & Quick Actions */}
        <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0 pl-1">
          {film.ratingImdb && (
            <div className="flex items-center gap-[3px] sm:gap-[5px]">
              <Star size={11} fill="#f5c518" stroke="#f5c518" />
              <span className="text-[#f5c518] font-display text-[14px] sm:text-[18px] md:text-[20px]">
                {film.ratingImdb.toFixed(1)}
              </span>
            </div>
          )}

          <div className="hidden sm:flex items-center gap-1 ml-1">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                const added = toggleFavorite(filmEntry);
                onToastSuccess(
                  added ? "Added to Favorites" : "Removed from Favorites",
                );
              }}
              title={isFav ? "In Favorites" : "Add to Favorites"}
              className={`w-8 h-8 rounded-full border flex items-center justify-center cursor-pointer transition-all ${
                isFav
                  ? "bg-[var(--accent-dim)] border-[var(--accent)] text-[var(--accent)]"
                  : "bg-[var(--bg-elevated)] border-[var(--border)] text-[var(--text-muted)] hover:text-white"
              }`}
            >
              <Heart
                size={13}
                fill={isFav ? "var(--accent)" : "none"}
                stroke={isFav ? "var(--accent)" : "currentColor"}
              />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                const added = toggleWatchLater(filmEntry);
                onToastInfo(
                  added ? "Saved to Watch Later" : "Removed from Watch Later",
                );
              }}
              title={isWL ? "In Watch Later" : "Save to Watch Later"}
              className={`w-8 h-8 rounded-full border flex items-center justify-center cursor-pointer transition-all ${
                isWL
                  ? "bg-[rgba(96,165,250,0.14)] border-[#60a5fa] text-[#60a5fa]"
                  : "bg-[var(--bg-elevated)] border-[var(--border)] text-[var(--text-muted)] hover:text-white"
              }`}
            >
              <Clock size={13} />
            </button>
          </div>
        </div>
      </div>

      {/* Only mount portal when long-press is active so 20 portals aren't evaluated on initial open */}
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

export default function Top250Client({
  page: pg,
  type: tp,
}: {
  page?: string;
  type?: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [, startTransition] = useTransition();

  const propPage = Math.max(1, parseInt(pg || "1", 10));
  const propType: TopCollection =
    tp === "TOP_250_TV_SHOWS" ? "TOP_250_TV_SHOWS" : "TOP_250_MOVIES";

  // Optimistic state so tab switches and pagination respond in 0ms
  const [activeState, setActiveState] = useState<{
    page: number;
    collectionType: TopCollection;
  }>({ page: propPage, collectionType: propType });

  useEffect(() => {
    setActiveState({ page: propPage, collectionType: propType });
  }, [propPage, propType]);

  const { page, collectionType } = activeState;
  const initialCached = getValidSnapshot(collectionType, page);

  const [noKey, setNoKey] = useState(false);
  const [films, setFilms] = useState<Film[]>(() => initialCached?.items ?? []);
  const [totalPages, setTotalPages] = useState(
    () => initialCached?.totalPages ?? 1,
  );
  const [total, setTotal] = useState(() => initialCached?.total ?? 250);
  const [loading, setLoading] = useState<boolean>(() => !initialCached);
  const [hideWatched, setHideWatched] = useState(false);
  const [watchedIds, setWatchedIds] = useState<Set<number>>(readWatchedSet);

  // Progressive 2-frame mount for cold loads so mobile transition stays at 60fps
  const [renderLimit, setRenderLimit] = useState<number>(() =>
    initialCached ? PAGE_SIZE : 10,
  );

  const isFirstMountRef = useRef(true);
  const autoTranslate = useAutoTranslate();

  useDocumentTitle(
    collectionType === "TOP_250_TV_SHOWS"
      ? "Top 250 TV Series"
      : "Top 250 Movies",
  );

  useEffect(() => {
    const syncHistory = () => {
      setWatchedIds(readWatchedSet());
    };
    window.addEventListener("cinemix-session-change", syncHistory);
    return () =>
      window.removeEventListener("cinemix-session-change", syncHistory);
  }, []);

  useEffect(() => {
    if (!hasApiKeys()) {
      setNoKey(true);
      setLoading(false);
      return;
    }

    // Only scroll to top when user actually changes page or tab, not on initial mount
    if (isFirstMountRef.current) {
      isFirstMountRef.current = false;
    } else {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }

    const cached = getValidSnapshot(collectionType, page);
    if (cached) {
      setFilms(cached.items);
      setTotal(cached.total);
      setTotalPages(cached.totalPages);
      setRenderLimit(PAGE_SIZE);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    getTopFilms(collectionType, page)
      .then((d) => {
        if (cancelled) return;
        const items = d.items ?? [];
        const resolvedTotal = d.total || 250;
        const resolvedPages =
          d.totalPages && d.totalPages > 1
            ? d.totalPages
            : Math.ceil(resolvedTotal / PAGE_SIZE);

        top250Cache.set(getCacheKey(collectionType, page), {
          timestamp: Date.now(),
          items,
          total: resolvedTotal,
          totalPages: resolvedPages,
        });

        setFilms(items);
        setTotal(resolvedTotal);
        setTotalPages(resolvedPages);
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
  }, [page, collectionType]);

  // Expand from 10 rows to 20 rows on the very next animation frame after initial paint
  useEffect(() => {
    if (loading || renderLimit >= films.length) return;
    const raf = requestAnimationFrame(() => {
      setRenderLimit(PAGE_SIZE);
    });
    return () => cancelAnimationFrame(raf);
  }, [loading, films.length, renderLimit]);

  // Silently prefetch the opposite tab (Page 1) and next page after initial idle
  useEffect(() => {
    if (loading || noKey || films.length === 0) return;

    const timer = setTimeout(() => {
      const otherTab: TopCollection =
        collectionType === "TOP_250_MOVIES"
          ? "TOP_250_TV_SHOWS"
          : "TOP_250_MOVIES";

      if (!getValidSnapshot(otherTab, 1)) {
        getTopFilms(otherTab, 1)
          .then((d) => {
            const items = d.items ?? [];
            const resolvedTotal = d.total || 250;
            const resolvedPages =
              d.totalPages && d.totalPages > 1
                ? d.totalPages
                : Math.ceil(resolvedTotal / PAGE_SIZE);
            top250Cache.set(getCacheKey(otherTab, 1), {
              timestamp: Date.now(),
              items,
              total: resolvedTotal,
              totalPages: resolvedPages,
            });
          })
          .catch(() => {});
      }

      if (page < totalPages && !getValidSnapshot(collectionType, page + 1)) {
        getTopFilms(collectionType, page + 1)
          .then((d) => {
            const items = d.items ?? [];
            const resolvedTotal = d.total || 250;
            const resolvedPages =
              d.totalPages && d.totalPages > 1
                ? d.totalPages
                : Math.ceil(resolvedTotal / PAGE_SIZE);
            top250Cache.set(getCacheKey(collectionType, page + 1), {
              timestamp: Date.now(),
              items,
              total: resolvedTotal,
              totalPages: resolvedPages,
            });
          })
          .catch(() => {});
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [loading, noKey, films.length, collectionType, page, totalPages]);

  const handleNavigateFilm = useCallback(
    (id: number) => {
      router.push(`/film/${id}`);
    },
    [router],
  );

  const handleToastSuccess = useCallback(
    (msg: string) => {
      toast.success(msg);
    },
    [toast],
  );

  const handleToastInfo = useCallback(
    (msg: string) => {
      toast.info(msg);
    },
    [toast],
  );

  // Intercept internal /top250 links in TabBar & Pagination for 0ms optimistic switching
  const handleOptimisticNavClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (
        e.defaultPrevented ||
        e.button !== 0 ||
        e.metaKey ||
        e.ctrlKey ||
        e.shiftKey
      ) {
        return;
      }
      const anchor = (e.target as HTMLElement).closest("a");
      if (!anchor) return;
      const href = anchor.getAttribute("href");
      if (!href || !href.startsWith("/top250")) return;

      e.preventDefault();
      const url = new URL(href, window.location.origin);
      const nextType: TopCollection =
        url.searchParams.get("type") === "TOP_250_TV_SHOWS"
          ? "TOP_250_TV_SHOWS"
          : "TOP_250_MOVIES";
      const nextPage = Math.max(
        1,
        parseInt(url.searchParams.get("page") || "1", 10),
      );

      setActiveState({ page: nextPage, collectionType: nextType });
      startTransition(() => {
        router.push(href);
      });
    },
    [router],
  );

  const visibleFilms = useMemo(() => {
    if (!hideWatched) return films;
    return films.filter((f) => !watchedIds.has(f.kinopoiskId ?? f.filmId ?? 0));
  }, [films, hideWatched, watchedIds]);

  const buildPageHref = useCallback(
    (p: number) =>
      `/top250?type=${encodeURIComponent(collectionType)}&page=${p}`,
    [collectionType],
  );

  if (noKey) return <NoKeyBanner />;

  const getGlobalRank = (localIndex: number) =>
    (page - 1) * PAGE_SIZE + localIndex + 1;

  const slicedFilms =
    renderLimit < films.length ? films.slice(0, renderLimit) : films;

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Audience Rating"
        eyebrowIcon={<Star size={14} fill="#f5c518" stroke="#f5c518" />}
        eyebrowColor="#f5c518"
        title="TOP 250"
        subtitle={
          collectionType === "TOP_250_TV_SHOWS"
            ? "The highest-rated television series of all time, ranked by audience score."
            : "The greatest films of all time, ranked by audience score."
        }
      />

      <div onClickCapture={handleOptimisticNavClick}>
        <TabBar className="mb-5 sm:mb-6">
          <TabPill
            active={collectionType === "TOP_250_MOVIES"}
            href="/top250?type=TOP_250_MOVIES"
          >
            <FilmIcon size={13} />
            Top 250 Movies
          </TabPill>
          <TabPill
            active={collectionType === "TOP_250_TV_SHOWS"}
            href="/top250?type=TOP_250_TV_SHOWS"
          >
            <Tv size={13} />
            Top 250 Series
          </TabPill>
        </TabBar>
      </div>

      {loading && films.length === 0 ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: PAGE_SIZE }).map((_, i) => (
            <div
              key={i}
              className="skeleton h-[68px] sm:h-[76px] rounded-[10px]"
            />
          ))}
        </div>
      ) : !loading && visibleFilms.length === 0 ? (
        <EmptyState
          icon={<Trophy size={36} />}
          title={
            hideWatched
              ? "All Titles on This Page Watched!"
              : "Failed to Load Top 250"
          }
          description={
            hideWatched
              ? "Move to the next page or disable 'Hide Watched' to view all ranked titles."
              : "Please check your API key quota or try again in a moment."
          }
          actionLabel="Explore Films"
          actionHref="/explore"
        />
      ) : (
        <div
          className={`flex flex-col gap-[3px] transition-opacity duration-150 ${
            loading ? "opacity-55 pointer-events-none" : "opacity-100"
          }`}
        >
          {slicedFilms.map((film, i) => {
            const fid = film.kinopoiskId ?? film.filmId ?? 0;
            const isWatched = watchedIds.has(fid);
            if (hideWatched && isWatched) {
              return null;
            }
            return (
              <Top250Row
                key={fid || i}
                film={film}
                rank={getGlobalRank(i)}
                autoTranslate={autoTranslate}
                isWatched={isWatched}
                onNavigate={handleNavigateFilm}
                onToastSuccess={handleToastSuccess}
                onToastInfo={handleToastInfo}
              />
            );
          })}
        </div>
      )}

      <div onClickCapture={handleOptimisticNavClick}>
        <Pagination
          page={page}
          totalPages={totalPages}
          buildHref={buildPageHref}
        />
      </div>
    </PageContainer>
  );
}
