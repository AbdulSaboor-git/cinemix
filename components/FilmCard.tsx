"use client";
import Link from "next/link";
import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import {
  Heart,
  Clock,
  Star,
  Play,
  Info,
  Check,
  ShieldAlert,
} from "lucide-react";
import { translateCountry, translateGenre } from "@/lib/translate";
import { useAutoTranslate, useFilmTitle } from "@/hooks/useTranslate";
import { useListStatus } from "@/hooks/useListStatus";
import { Film } from "@/types/kinopoisk";
import {
  hydrateFilmWithCache,
  queueFilmMetaHydration,
  getCachedFilmMeta,
} from "@/lib/kinopoisk";
import { getQuickCertBadge } from "@/lib/parentalGuide";
import { toggleFavorite, toggleWatchLater } from "@/lib/userLists";
import { lockScroll, unlockScroll } from "@/lib/scrollLock";
import { useToast } from "@/lib/toast";
import PosterImage from "@/components/ui/PosterImage";
import ParentalGuideModal from "@/components/ParentalGuideModal";

interface FilmCardProps {
  film: Film;
  variant?: "grid" | "scroll";
  size?: "sm" | "md" | "lg";
  index?: number;
  priority?: boolean;
  onQuickPeek?: (film: Film) => void;
}

const SCROLL_SIZE_CLASSES = {
  sm: "w-[110px] h-[165px] sm:w-[140px] sm:h-[210px]",
  md: "w-[126px] h-[189px] sm:w-[175px] sm:h-[263px]",
  lg: "w-[156px] h-[234px] sm:w-[220px] sm:h-[330px]",
};

const POPUP_WIDTH = 256;
const POPUP_HEIGHT = 384;
const LONG_PRESS_MS = 430;
const MOVE_THRESHOLD_PX = 10;
const EXIT_ANIMATION_MS = 230;

export function resolveRating(film: Film): number | string | null {
  const candidates = [
    film.ratingImdb,
    film.ratingKinopoisk,
    film.rating,
    film.ratingFilmCritics,
    film.ratingRfCritics,
  ];
  for (const r of candidates) {
    if (r === undefined || r === null) continue;
    const str = String(r).trim();
    if (str.endsWith("%")) continue;
    const num = typeof r === "string" ? parseFloat(r) : r;
    if (!isNaN(num) && num > 0 && num <= 10) return num;
  }
  if (film.ratingAwait && film.ratingAwait > 0) {
    return `${Math.round(film.ratingAwait)}%`;
  }
  if (film.ratingGoodReview && film.ratingGoodReview > 0) {
    return `${Math.round(film.ratingGoodReview)}%`;
  }
  return null;
}

export function formatRating(r: number | string): string {
  if (typeof r === "number") return r.toFixed(1);
  return String(r);
}

/**
 * Hook that provides live-hydrated Film metadata (year, genres, countries, rating, MPAA/age limits)
 * and automatically queues background hydration when a partial card enters the viewport.
 */
export function useHydratedFilm(
  rawFilm: Film,
  observeRef?: React.RefObject<HTMLElement | null>,
  requireFullDetail = false,
): Film {
  const id = rawFilm.kinopoiskId ?? rawFilm.filmId ?? 0;
  const [metaTick, setMetaTick] = useState(0);

  const hydrated = useMemo(
    () => hydrateFilmWithCache(rawFilm),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rawFilm, metaTick],
  );

  // Listen for live metadata updates from background hydration
  useEffect(() => {
    if (!id) return;
    const onMetaUpdated = (e: Event) => {
      const detail = (e as CustomEvent<{ filmId?: number }>).detail;
      if (!detail?.filmId || detail.filmId === id) {
        setMetaTick((t) => t + 1);
      }
    };
    window.addEventListener("cinemix-meta-updated", onMetaUpdated);
    return () =>
      window.removeEventListener("cinemix-meta-updated", onMetaUpdated);
  }, [id]);

  const isAlreadyEnriched = Boolean(id > 0 && getCachedFilmMeta(id)?.enriched);
  const hasRating = resolveRating(hydrated) !== null;
  const hasCert = Boolean(hydrated.ratingAgeLimits || hydrated.ratingMpaa);
  const hasDuration = Boolean(
    (hydrated.filmLength && hydrated.filmLength > 0) ||
    (hydrated.duration && hydrated.duration > 0),
  );

  // If this card is missing year, genres, rating, or (on Premieres) age rating/duration, hydrate when near viewport
  const needsHydration =
    id > 0 &&
    !isAlreadyEnriched &&
    (!hydrated.year ||
      !hydrated.genres ||
      hydrated.genres.length === 0 ||
      !hasRating ||
      (requireFullDetail && (!hasCert || !hasDuration)));

  useEffect(() => {
    if (!needsHydration || !id) return;
    const el = observeRef?.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      queueFilmMetaHydration(id);
      return;
    }
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          queueFilmMetaHydration(id);
          obs.disconnect();
        }
      },
      { rootMargin: "240px" },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [needsHydration, id, observeRef]);

  return hydrated;
}

/**
 * Reusable Long-Press gesture controller + centered Quick-Peek portal state.
 * Can be attached to any card or row across Home, Explore, Premieres, Top 250, and Lists.
 */
export function useFilmLongPress(
  filmId: number,
  targetRef: React.RefObject<HTMLElement | null>,
) {
  const [popupOpen, setPopupOpen] = useState(false);
  const [popupEntered, setPopupEntered] = useState(false);
  const [originDelta, setOriginDelta] = useState<{
    x: number;
    y: number;
    scale: number;
  }>({ x: 0, y: 0, scale: 0.65 });

  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const historyPushedRef = useRef(false);
  const didLongPress = useRef(false);
  const pointerMoved = useRef(false);
  const startPos = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const animateClose = useCallback(() => {
    setPopupEntered(false);
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => {
      setPopupOpen(false);
      closeTimer.current = null;
    }, EXIT_ANIMATION_MS);
  }, []);

  const openPopup = useCallback(() => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }

    // Ensure full metadata (including MPAA/age certification) is hydrated immediately on long-press
    if (filmId > 0) {
      queueFilmMetaHydration(filmId, true);
    }

    const targetEl = targetRef.current;
    if (targetEl && typeof window !== "undefined") {
      const rect = targetEl.getBoundingClientRect();
      const cardCenterX = rect.left + rect.width / 2;
      const cardCenterY = rect.top + rect.height / 2;
      const viewportCenterX = window.innerWidth / 2;
      const viewportCenterY = window.innerHeight * 0.43;

      setOriginDelta({
        x: cardCenterX - viewportCenterX,
        y: cardCenterY - viewportCenterY,
        scale: Math.max(0.45, Math.min(0.85, rect.width / POPUP_WIDTH)),
      });
    }

    if (typeof window !== "undefined" && !historyPushedRef.current) {
      const currentState =
        typeof window.history.state === "object" &&
        window.history.state !== null
          ? window.history.state
          : {};
      window.history.pushState(
        { ...currentState, filmCardPopup: true, filmId },
        "",
        window.location.href,
      );
      historyPushedRef.current = true;
    }

    setPopupOpen(true);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setPopupEntered(true);
      });
    });
  }, [filmId, targetRef]);

  const closePopup = useCallback(() => {
    animateClose();
    if (
      typeof window !== "undefined" &&
      historyPushedRef.current &&
      window.history.state?.filmCardPopup
    ) {
      historyPushedRef.current = false;
      const cleaned = { ...window.history.state };
      delete cleaned.filmCardPopup;
      window.history.replaceState(cleaned, "", window.location.href);
    }
  }, [animateClose]);

  useEffect(() => {
    if (!popupOpen) return;
    const handlePopState = () => {
      historyPushedRef.current = false;
      animateClose();
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [popupOpen, animateClose]);

  useEffect(() => {
    return () => {
      if (longPressTimer.current) clearTimeout(longPressTimer.current);
      if (closeTimer.current) clearTimeout(closeTimer.current);
    };
  }, []);

  useEffect(() => {
    if (!popupOpen) return;
    lockScroll();
    return () => unlockScroll();
  }, [popupOpen]);

  const clearTimer = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (popupOpen) return;
      didLongPress.current = false;
      pointerMoved.current = false;
      const touch = e.touches[0];
      if (touch) {
        startPos.current = { x: touch.clientX, y: touch.clientY };
      }
      clearTimer();
      longPressTimer.current = setTimeout(() => {
        if (pointerMoved.current) return;
        didLongPress.current = true;
        if (typeof navigator !== "undefined" && navigator.vibrate) {
          navigator.vibrate(35);
        }
        openPopup();
      }, LONG_PRESS_MS);
    },
    [popupOpen, clearTimer, openPopup],
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      const touch = e.touches[0];
      if (touch) {
        const dx = touch.clientX - startPos.current.x;
        const dy = touch.clientY - startPos.current.y;
        if (Math.hypot(dx, dy) < MOVE_THRESHOLD_PX) return;
      }
      pointerMoved.current = true;
      clearTimer();
    },
    [clearTimer],
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (popupOpen || e.button !== 0) return;
      const target = e.target as HTMLElement | null;
      if (target?.closest("button")) return;
      didLongPress.current = false;
      pointerMoved.current = false;
      startPos.current = { x: e.clientX, y: e.clientY };
      clearTimer();
      longPressTimer.current = setTimeout(() => {
        if (pointerMoved.current) return;
        didLongPress.current = true;
        openPopup();
      }, LONG_PRESS_MS);
    },
    [popupOpen, clearTimer, openPopup],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!longPressTimer.current) return;
      const dx = e.clientX - startPos.current.x;
      const dy = e.clientY - startPos.current.y;
      if (Math.hypot(dx, dy) >= MOVE_THRESHOLD_PX) {
        pointerMoved.current = true;
        clearTimer();
      }
    },
    [clearTimer],
  );

  const handleClickCapture = useCallback(
    (e: React.MouseEvent) => {
      if (didLongPress.current || popupOpen) {
        e.preventDefault();
        e.stopPropagation();
        didLongPress.current = false;
      }
    },
    [popupOpen],
  );

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
  }, []);

  return {
    popupOpen,
    popupEntered,
    originDelta,
    closePopup,
    setPopupOpen,
    setPopupEntered,
    historyPushedRef,
    bindLongPress: {
      onTouchStart: handleTouchStart,
      onTouchMove: handleTouchMove,
      onTouchEnd: clearTimer,
      onTouchCancel: clearTimer,
      onMouseDown: handleMouseDown,
      onMouseMove: handleMouseMove,
      onMouseUp: clearTimer,
      onMouseLeave: clearTimer,
      onClickCapture: handleClickCapture,
      onContextMenu: handleContextMenu,
    },
  };
}

/**
 * Shared Long-Press Centered Quick-Peek & Action Portal.
 * Shows the MPAA / Age Certification badge on the top-left corner (clickable for Parental Guide)
 * instead of Favorite/Watch Later tags, since their status is shown in the action buttons below.
 */
export function FilmLongPressPortal({
  film,
  popupOpen,
  popupEntered,
  originDelta,
  closePopup,
  setPopupOpen,
  setPopupEntered,
  historyPushedRef,
}: {
  film: Film;
  popupOpen: boolean;
  popupEntered: boolean;
  originDelta: { x: number; y: number; scale: number };
  closePopup: () => void;
  setPopupOpen: (v: boolean) => void;
  setPopupEntered: (v: boolean) => void;
  historyPushedRef: React.MutableRefObject<boolean>;
}) {
  const autoTranslate = useAutoTranslate();
  const hydrated = useHydratedFilm(film);
  const id = hydrated.kinopoiskId ?? hydrated.filmId ?? 0;
  const name = useFilmTitle(hydrated, autoTranslate);
  const rating = resolveRating(hydrated);
  const year = hydrated.year || hydrated.startYear;
  const certBadge = getQuickCertBadge(hydrated);

  const { isFav, isWL, mounted } = useListStatus(id);
  const { toast } = useToast();
  // const [parentalOpen, setParentalOpen] = useState(false);

  const posterUrl = hydrated.posterUrlPreview || hydrated.posterUrl || null;
  const hiResPosterUrl =
    hydrated.posterUrl || hydrated.posterUrlPreview || undefined;
  const entryYear = hydrated.year ?? hydrated.startYear ?? null;
  const entryRating = hydrated.ratingKinopoisk ?? hydrated.ratingImdb ?? null;

  const primaryGenre = hydrated.genres?.[0]
    ? translateGenre(hydrated.genres[0].genre, autoTranslate)
    : null;
  const primaryCountry = hydrated.countries?.[0]
    ? translateCountry(hydrated.countries[0].country, autoTranslate)
    : null;

  const handleFav = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const added = toggleFavorite({
        film_id: id,
        film_name: name,
        poster_url: posterUrl,
        year: entryYear,
        rating: entryRating,
      });
      if (typeof navigator !== "undefined" && navigator.vibrate) {
        navigator.vibrate(20);
      }
      toast.success(added ? "Added to Favorites" : "Removed from Favorites");
    },
    [id, name, posterUrl, entryYear, entryRating, toast],
  );

  const handleWL = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const added = toggleWatchLater({
        film_id: id,
        film_name: name,
        poster_url: posterUrl,
        year: entryYear,
        rating: entryRating,
      });
      if (typeof navigator !== "undefined" && navigator.vibrate) {
        navigator.vibrate(20);
      }
      toast.info(added ? "Saved to Watch Later" : "Removed from Watch Later");
    },
    [id, name, posterUrl, entryYear, entryRating, toast],
  );

  if (!mounted || typeof document === "undefined") return null;

  return (
    <>
      {popupOpen &&
        createPortal(
          <div
            className="fixed inset-0 z-[9998] flex flex-col items-center justify-center px-6 select-none"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              closePopup();
            }}
            onContextMenu={(e) => e.preventDefault()}
          >
            {/* Full-screen blurred glass backdrop */}
            <div
              className={`absolute inset-0 transition-all duration-300 ease-out ${
                popupEntered
                  ? "bg-black/78 backdrop-blur-xl opacity-100"
                  : "bg-black/0 backdrop-blur-none opacity-0"
              }`}
              style={{
                backgroundImage: popupEntered
                  ? "radial-gradient(circle at 50% 42%, rgba(229, 9, 20, 0.16), transparent 62%)"
                  : "none",
              }}
            />

            {/* Centered wrapper for card + positioned controls */}
            <div
              className="relative z-10 flex flex-col items-center"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Expanded Center Popup Card */}
              <div
                style={{
                  width: `${POPUP_WIDTH}px`,
                  height: `${POPUP_HEIGHT}px`,
                  transform: popupEntered
                    ? "translate3d(0px, 0px, 0px) scale(1)"
                    : `translate3d(${originDelta.x}px, ${originDelta.y}px, 0px) scale(${originDelta.scale})`,
                  transition:
                    "transform 360ms cubic-bezier(0.22, 1, 0.36, 1), opacity 220ms ease-out, box-shadow 360ms ease-out",
                  opacity: popupEntered ? 1 : 0.2,
                }}
                className="relative rounded-[20px] overflow-hidden bg-[var(--bg-card)] border border-white/15 shadow-[0_28px_70px_rgba(0,0,0,0.85),0_0_0_1px_rgba(229,9,20,0.28)]"
              >
                <PosterImage
                  src={hiResPosterUrl}
                  alt={name}
                  title={name}
                  size="lg"
                  priority
                />

                {/* Multi-stop cinematic vignette */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/30 to-black/15 pointer-events-none" />

                {/* Top-Left MPAA / Age Certification Badge (Requirement 4) */}
                <div className="absolute top-3 left-3 z-10">
                  <div
                    className={`rounded-lg px-2.5 py-1 backdrop-blur-md border flex items-center gap-1.5 shadow-lg transition-transform ${
                      certBadge?.isMature
                        ? "bg-[rgba(229,9,20,0.88)] border-white/25 text-white"
                        : "bg-black/80 border-white/25 text-white"
                    }`}
                  >
                    <ShieldAlert size={11} className="shrink-0" />
                    <span className="text-[11px] font-bold tracking-[0.5px]">
                      {certBadge ? certBadge.label : "PG Guide"}
                    </span>
                  </div>
                </div>

                {/* Top-Right Rating Badge */}
                {rating !== null && (
                  <div className="absolute top-3 right-3 z-10 bg-black/80 backdrop-blur-md border border-[rgba(245,197,24,0.4)] rounded-lg px-2.5 py-1 flex items-center gap-1.5 shadow-lg">
                    <Star size={12} fill="#f5c518" stroke="#f5c518" />
                    <span className="text-[12px] font-semibold text-[#f5c518] font-display tracking-[0.5px]">
                      {formatRating(rating)}
                    </span>
                  </div>
                )}

                {/* Bottom Metadata Inside Expanded Poster */}
                <div
                  style={{
                    transitionTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)",
                    transitionDelay: popupEntered ? "80ms" : "0ms",
                  }}
                  className={`absolute bottom-0 inset-x-0 p-4 z-10 transition-all duration-300 ${
                    popupEntered
                      ? "opacity-100 translate-y-0"
                      : "opacity-0 translate-y-3"
                  }`}
                >
                  <p className="text-[16px] font-bold text-white leading-[1.25] line-clamp-2 drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)] m-0">
                    {name}
                  </p>
                  <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                    {year && (
                      <span className="text-[11px] font-medium text-white/85 bg-white/10 backdrop-blur-sm px-2 py-0.5 rounded-md border border-white/10">
                        {year}
                      </span>
                    )}
                    {primaryGenre && (
                      <span className="text-[11px] font-medium text-white/85 bg-white/10 backdrop-blur-sm px-2 py-0.5 rounded-md border border-white/10 capitalize">
                        {primaryGenre}
                      </span>
                    )}
                    {primaryCountry && (
                      <span className="text-[11px] font-medium text-white/75 bg-white/10 backdrop-blur-sm px-2 py-0.5 rounded-md border border-white/10">
                        {primaryCountry}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* ── Floating Action Controls Below Popup Card ── */}
              <div className="mt-4 w-[256px] flex flex-col gap-2.5">
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={handleFav}
                    style={{
                      transitionTimingFunction:
                        "cubic-bezier(0.22, 1, 0.36, 1)",
                      transitionDelay: popupEntered ? "100ms" : "0ms",
                    }}
                    className={`flex items-center justify-center gap-2 py-3 px-3 rounded-2xl border backdrop-blur-xl font-semibold text-[12px] active:scale-95 transition-all duration-300 cursor-pointer ${
                      popupEntered
                        ? "opacity-100 translate-y-0 scale-100"
                        : "opacity-0 -translate-y-3 scale-90"
                    } ${
                      isFav
                        ? "bg-[rgba(229,9,20,0.28)] border-[rgba(229,9,20,0.75)] text-white shadow-[0_8px_24px_rgba(229,9,20,0.3)]"
                        : "bg-[rgba(24,24,28,0.85)] border-white/15 text-white/90"
                    }`}
                  >
                    <Heart
                      size={16}
                      fill={isFav ? "var(--accent)" : "none"}
                      stroke={isFav ? "var(--accent)" : "currentColor"}
                      strokeWidth={2.2}
                      className="shrink-0"
                    />
                    <span className="truncate">
                      {isFav ? "In Favorites" : "Favorite"}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={handleWL}
                    style={{
                      transitionTimingFunction:
                        "cubic-bezier(0.22, 1, 0.36, 1)",
                      transitionDelay: popupEntered ? "140ms" : "0ms",
                    }}
                    className={`flex items-center justify-center gap-2 py-3 px-3 rounded-2xl border backdrop-blur-xl font-semibold text-[12px] active:scale-95 transition-all duration-300 cursor-pointer ${
                      popupEntered
                        ? "opacity-100 translate-y-0 scale-100"
                        : "opacity-0 -translate-y-3 scale-90"
                    } ${
                      isWL
                        ? "bg-[rgba(96,165,250,0.28)] border-[rgba(96,165,250,0.75)] text-[#93c5fd] shadow-[0_8px_24px_rgba(96,165,250,0.28)]"
                        : "bg-[rgba(24,24,28,0.85)] border-white/15 text-white/90"
                    }`}
                  >
                    <Clock
                      size={16}
                      stroke={isWL ? "#60a5fa" : "currentColor"}
                      strokeWidth={2.2}
                      className="shrink-0"
                    />
                    <span className="truncate">
                      {isWL ? "In Watchlist" : "Watch Later"}
                    </span>
                  </button>
                </div>

                {/* Bottom Full-Width Primary Action: Open / Watch Film */}
                <Link
                  href={`/film/${id}`}
                  onClick={() => {
                    if (
                      typeof window !== "undefined" &&
                      historyPushedRef.current &&
                      window.history.state?.filmCardPopup
                    ) {
                      historyPushedRef.current = false;
                      const cleaned = { ...window.history.state };
                      delete cleaned.filmCardPopup;
                      window.history.replaceState(
                        cleaned,
                        "",
                        window.location.href,
                      );
                    }
                    setPopupEntered(false);
                    setPopupOpen(false);
                  }}
                  style={{
                    transitionTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)",
                    transitionDelay: popupEntered ? "180ms" : "0ms",
                  }}
                  className={`flex items-center justify-center gap-2 w-full py-3 px-4 rounded-2xl bg-[var(--accent,#e50914)] text-white font-semibold text-[13px] no-underline shadow-[0_10px_28px_rgba(229,9,20,0.45)] border border-white/15 active:scale-95 transition-all duration-300 ${
                    popupEntered
                      ? "opacity-100 translate-y-0 scale-100"
                      : "opacity-0 -translate-y-3 scale-90"
                  }`}
                >
                  <Play size={15} fill="white" stroke="white" />
                  <span>Details & Watch</span>
                </Link>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {/* {parentalOpen && (
        <ParentalGuideModal
          open={parentalOpen}
          onClose={() => setParentalOpen(false)}
          film={hydrated}
        />
      )} */}
    </>
  );
}

export default function FilmCard({
  film: rawFilm,
  variant = "grid",
  size = "md",
  index,
  priority = false,
  onQuickPeek,
}: FilmCardProps) {
  const autoTranslate = useAutoTranslate();
  const cardRef = useRef<HTMLDivElement>(null);
  const posterRef = useRef<HTMLDivElement>(null);

  // Live self-hydrating film metadata (fixes missing year/genres/rating on For You, Watch Later, Similar cards)
  const film = useHydratedFilm(rawFilm, cardRef);

  const id = film.kinopoiskId ?? film.filmId ?? 0;
  const name = useFilmTitle(film, autoTranslate);
  const rating = resolveRating(film);
  const year = film.year || film.startYear;
  const isScroll = variant === "scroll";

  const { isFav, isWL, isWatched, mounted } = useListStatus(id);
  const { toast } = useToast();

  const {
    popupOpen,
    popupEntered,
    originDelta,
    closePopup,
    setPopupOpen,
    setPopupEntered,
    historyPushedRef,
    bindLongPress,
  } = useFilmLongPress(id, posterRef);

  const posterUrl = film.posterUrlPreview || film.posterUrl || null;
  const entryYear = film.year ?? film.startYear ?? null;
  const entryRating = film.ratingKinopoisk ?? film.ratingImdb ?? null;

  const handleFav = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const added = toggleFavorite({
        film_id: id,
        film_name: name,
        poster_url: posterUrl,
        year: entryYear,
        rating: entryRating,
      });
      if (typeof navigator !== "undefined" && navigator.vibrate) {
        navigator.vibrate(20);
      }
      toast.success(added ? "Added to Favorites" : "Removed from Favorites");
    },
    [id, name, posterUrl, entryYear, entryRating, toast],
  );

  const handleWL = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const added = toggleWatchLater({
        film_id: id,
        film_name: name,
        poster_url: posterUrl,
        year: entryYear,
        rating: entryRating,
      });
      if (typeof navigator !== "undefined" && navigator.vibrate) {
        navigator.vibrate(20);
      }
      toast.info(added ? "Saved to Watch Later" : "Removed from Watch Later");
    },
    [id, name, posterUrl, entryYear, entryRating, toast],
  );

  const handleQuickPeekClick = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      onQuickPeek?.(film);
    },
    [film, onQuickPeek],
  );

  const primaryGenre = film.genres?.[0]
    ? translateGenre(film.genres[0].genre, autoTranslate)
    : null;
  const primaryCountry = film.countries?.[0]
    ? translateCountry(film.countries[0].country, autoTranslate)
    : null;

  const upcomingDateLabel = (() => {
    if (!film.premiereRu) return null;
    const rawDate = film.premiereRu.slice(0, 10);
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    if (rawDate <= todayStr) return null;
    const parsed = new Date(`${rawDate}T00:00:00`);
    if (isNaN(parsed.getTime())) return null;
    const sameYear = parsed.getFullYear() === now.getFullYear();
    return parsed.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      ...(sameYear ? {} : { year: "numeric" }),
    });
  })();

  return (
    <>
      <Link
        href={`/film/${id}`}
        className="group block shrink-0 no-underline select-none [-webkit-touch-callout:none]"
        onClickCapture={bindLongPress.onClickCapture}
        onContextMenu={bindLongPress.onContextMenu}
      >
        <div
          ref={cardRef}
          className={`film-card pb-1 cursor-pointer relative transition-all duration-300 ${
            isScroll ? `min-h-fit ${SCROLL_SIZE_CLASSES[size]}` : "w-full"
          } ${popupOpen ? "opacity-0 scale-95 pointer-events-none" : ""}`}
          onTouchStart={bindLongPress.onTouchStart}
          onTouchEnd={bindLongPress.onTouchEnd}
          onTouchCancel={bindLongPress.onTouchCancel}
          onTouchMove={bindLongPress.onTouchMove}
          onMouseDown={bindLongPress.onMouseDown}
          onMouseMove={bindLongPress.onMouseMove}
          onMouseUp={bindLongPress.onMouseUp}
          onMouseLeave={bindLongPress.onMouseLeave}
          onContextMenu={bindLongPress.onContextMenu}
        >
          {/* ── Poster ── */}
          <div
            ref={posterRef}
            className={`rounded-[var(--radius-lg)] overflow-hidden relative bg-[var(--bg-card)] transition-all duration-200 border border-[var(--border)] md:group-hover:border-[rgba(229,9,20,0.35)] shadow-[0_4px_16px_rgba(0,0,0,0.4)] md:group-hover:shadow-[0_16px_48px_rgba(0,0,0,0.7),0_0_0_1px_rgba(229,9,20,0.2)] ${
              isScroll ? `${SCROLL_SIZE_CLASSES[size]}` : "w-full aspect-[2/3]"
            }`}
          >
            <PosterImage
              src={film.posterUrlPreview || film.posterUrl}
              alt={name}
              title={name}
              size="sm"
              priority={priority || (index !== undefined && index < 6)}
            />

            {/* Gradient overlay */}
            <div className="card-overlay opacity-[0.45] group-hover:opacity-100" />

            {/* Rating badge */}
            {rating !== null && (
              <div className="absolute top-1.5 right-1.5 sm:top-2 sm:right-2 bg-[rgba(0,0,0,0.82)] backdrop-blur-[8px] border border-[rgba(245,197,24,0.3)] rounded-[5px] px-[6px] py-[2px] sm:px-[7px] sm:py-[3px] flex items-center gap-[3px] sm:gap-1">
                <Star
                  size={8}
                  fill="#f5c518"
                  stroke="#f5c518"
                  className="sm:w-[9px] sm:h-[9px]"
                />
                <span className="text-[10px] sm:text-[11px] text-[#f5c518] font-display tracking-[0.5px]">
                  {formatRating(rating)}
                </span>
              </div>
            )}

            {/* Rank number (only shown when index is explicitly passed, e.g. Top 250 row on Home) */}
            {index !== undefined && (
              <div
                className={`absolute bottom-1 left-1.5 sm:left-2 font-display leading-none text-white opacity-95 [text-shadow:0_2px_12px_rgba(0,0,0,0.9),-2px_0_0_rgba(0,0,0,0.5)] ${
                  index < 9
                    ? "text-[clamp(28px,7vw,52px)]"
                    : "text-[clamp(20px,4vw,38px)]"
                }`}
              >
                {index + 1}
              </div>
            )}

            {/* ── Desktop hover action buttons ── */}
            {mounted && (
              <div className="absolute bottom-2 left-0 right-0 px-2 hidden sm:flex items-center justify-center gap-[5px] opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none group-hover:pointer-events-auto">
                <button
                  type="button"
                  onClick={handleFav}
                  title={
                    isFav
                      ? "In Favorites (click to remove)"
                      : "Add to Favorites"
                  }
                  className={`flex items-center gap-[4px] rounded-[6px] px-[7px] py-[5px] text-[10px] font-semibold backdrop-blur-[8px] border transition-all duration-150 cursor-pointer ${
                    isFav
                      ? "bg-[rgba(229,9,20,0.28)] border-[rgba(229,9,20,0.65)] text-[var(--accent)]"
                      : "bg-[rgba(0,0,0,0.68)] border-[rgba(255,255,255,0.16)] text-white hover:bg-[rgba(229,9,20,0.2)] hover:border-[rgba(229,9,20,0.5)] hover:text-[var(--accent)]"
                  }`}
                >
                  <Heart
                    size={13}
                    fill={isFav ? "var(--accent)" : "none"}
                    stroke={isFav ? "var(--accent)" : "currentColor"}
                    strokeWidth={2.2}
                  />
                </button>
                <button
                  type="button"
                  onClick={handleWL}
                  title={
                    isWL
                      ? "In Watch Later (click to remove)"
                      : "Save to Watch Later"
                  }
                  className={`flex items-center gap-[4px] rounded-[6px] px-[7px] py-[5px] text-[10px] font-semibold backdrop-blur-[8px] border transition-all duration-150 cursor-pointer ${
                    isWL
                      ? "bg-[rgba(96,165,250,0.25)] border-[rgba(96,165,250,0.55)] text-[#60a5fa]"
                      : "bg-[rgba(0,0,0,0.68)] border-[rgba(255,255,255,0.16)] text-white hover:bg-[rgba(96,165,250,0.15)] hover:border-[rgba(96,165,250,0.4)] hover:text-[#60a5fa]"
                  }`}
                >
                  <Clock
                    size={13}
                    stroke={isWL ? "#60a5fa" : "currentColor"}
                    strokeWidth={2.2}
                  />
                </button>
                {onQuickPeek && (
                  <button
                    type="button"
                    onClick={handleQuickPeekClick}
                    title="Quick Peek Preview"
                    className="flex items-center gap-[4px] rounded-[6px] px-[7px] py-[5px] text-[10px] font-semibold backdrop-blur-[8px] border bg-[rgba(0,0,0,0.68)] border-[rgba(255,255,255,0.16)] text-white hover:bg-[rgba(255,255,255,0.18)] hover:border-white/40 transition-all duration-150 cursor-pointer"
                  >
                    <Info size={13} strokeWidth={2.2} />
                  </button>
                )}
              </div>
            )}

            {/* ── Play icon on hover (desktop) ── */}
            {!(isFav || isWL) && (
              <div className="absolute inset-0 items-center justify-center pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-200 hidden sm:flex pb-8">
                <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-[rgba(229,9,20,0.9)] flex items-center justify-center shadow-[0_0_24px_var(--accent-glow)]">
                  <Play
                    size={14}
                    fill="white"
                    stroke="white"
                    className="ml-0.5"
                  />
                </div>
              </div>
            )}

            {/* ── Active state badges on normal grid card ── */}
            {mounted && (isFav || isWL || isWatched) && (
              <div className="absolute top-1.5 left-1.5 sm:top-2 sm:left-2 flex flex-col gap-[4px]">
                {isFav && (
                  <div
                    title="In Favorites"
                    className="w-[22px] h-[22px] rounded-[5px] bg-[rgba(229,9,20,0.88)] backdrop-blur-[6px] flex items-center justify-center"
                  >
                    <Heart size={11} fill="white" stroke="white" />
                  </div>
                )}
                {isWL && (
                  <div
                    title="In Watch Later"
                    className="w-[22px] h-[22px] rounded-[5px] bg-[rgba(96,165,250,0.88)] backdrop-blur-[6px] flex items-center justify-center"
                  >
                    <Clock size={11} stroke="white" strokeWidth={2.5} />
                  </div>
                )}
                {isWatched && !isFav && !isWL && (
                  <div
                    title="Watched"
                    className="w-[22px] h-[22px] rounded-[5px] bg-[rgba(34,197,94,0.85)] backdrop-blur-[6px] flex items-center justify-center"
                  >
                    <Check size={11} stroke="white" strokeWidth={2.8} />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── Info below poster ── */}
          <div className="mt-[7px] sm:mt-[9px] px-[2px]">
            <p className="text-[12px] sm:text-[13px] font-semibold overflow-hidden text-ellipsis whitespace-nowrap leading-[1.3] transition-colors duration-200 text-[var(--text)] group-hover:text-white m-0">
              {name}
            </p>
            <div className="flex items-center gap-[5px] sm:gap-[6px] mt-1 flex-wrap min-h-[18px]">
              {upcomingDateLabel ? (
                <span className="text-[10px] sm:text-[11px] font-semibold text-[#f5c518]">
                  {upcomingDateLabel}
                </span>
              ) : (
                year && (
                  <span className="text-[10px] sm:text-[11px] text-[var(--text-muted)]">
                    {year}
                  </span>
                )
              )}
              {primaryGenre && (
                <span className="tag tag-dim !text-[9px] sm:!text-[10px] !py-[1px] !px-[6px] sm:!px-[7px] capitalize">
                  {primaryGenre}
                </span>
              )}
              {primaryCountry && (
                <span className="hidden sm:inline tag tag-dim !text-[10px] !py-[1px] !px-[7px]">
                  {primaryCountry}
                </span>
              )}
            </div>
          </div>
        </div>
      </Link>

      {/* ── Long-Press Centered Quick-Peek Portal ── */}
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
    </>
  );
}
