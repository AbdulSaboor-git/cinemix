"use client";
import Link from "next/link";
import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { Heart, Clock, Star, Play, X } from "lucide-react";
import { translateCountry, translateGenre } from "@/lib/translate";
import { useAutoTranslate, useFilmTitle } from "@/hooks/useTranslate";
import { Film } from "@/types/kinopoisk";
import { toggleFavorite, toggleWatchLater, isInList } from "@/lib/userLists";
import { useToast } from "@/lib/toast";
import PosterImage from "@/components/ui/PosterImage";

interface FilmCardProps {
  film: Film;
  variant?: "grid" | "scroll";
  size?: "sm" | "md" | "lg";
  index?: number;
}

interface OriginOffset {
  x: number;
  y: number;
  scale: number;
}

const SCROLL_SIZE_CLASSES = {
  sm: "w-[110px] h-[165px] sm:w-[140px] sm:h-[210px]",
  md: "w-[130px] h-[195px] sm:w-[175px] sm:h-[263px]",
  lg: "w-[160px] h-[240px] sm:w-[220px] sm:h-[330px]",
};

const POPUP_WIDTH = 230;

function resolveRating(film: Film): number | string | null {
  const candidates = [
    film.ratingKinopoisk,
    film.ratingImdb,
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

function formatRating(r: number | string): string {
  if (typeof r === "number") return r.toFixed(1);
  return String(r);
}

export default function FilmCard({
  film,
  variant = "grid",
  size = "md",
  index,
}: FilmCardProps) {
  const autoTranslate = useAutoTranslate();
  const id = film.kinopoiskId ?? film.filmId ?? 0;
  const name = useFilmTitle(film, autoTranslate);
  const rating = resolveRating(film);
  const year = film.year || film.startYear;
  const isScroll = variant === "scroll";

  const [isFav, setIsFav] = useState(false);
  const [isWL, setIsWL] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (!id) return;
    setIsFav(isInList("favorites", id));
    setIsWL(isInList("watchlater", id));
  }, [id]);

  const { toast } = useToast();

  // ── Mobile Peek & Pop State ──
  const [mobileMenuMounted, setMobileMenuMounted] = useState(false);
  const [mobileMenuActive, setMobileMenuActive] = useState(false);
  const [isPressing, setIsPressing] = useState(false);
  const [originOffset, setOriginOffset] = useState<OriginOffset>({
    x: 0,
    y: 0,
    scale: 0.75,
  });

  const posterRef = useRef<HTMLDivElement>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pressFeedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didLongPress = useRef(false);
  const touchMoved = useRef(false);
  const touchStartPos = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const clearTimers = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    if (pressFeedbackTimer.current) {
      clearTimeout(pressFeedbackTimer.current);
      pressFeedbackTimer.current = null;
    }
  }, []);

  const openMobileMenu = useCallback(() => {
    if (posterRef.current && typeof window !== "undefined") {
      const rect = posterRef.current.getBoundingClientRect();
      const cardCenterX = rect.left + rect.width / 2;
      const cardCenterY = rect.top + rect.height / 2;
      const viewportCenterX = window.innerWidth / 2;
      // Target sits slightly above true vertical center to leave room for bottom action buttons
      const viewportCenterY = window.innerHeight / 2 - 44;

      setOriginOffset({
        x: cardCenterX - viewportCenterX,
        y: cardCenterY - viewportCenterY,
        scale: Math.max(0.4, rect.width / POPUP_WIDTH),
      });
    }

    setIsPressing(false);
    setMobileMenuMounted(true);
    if (navigator.vibrate) navigator.vibrate(35);

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setMobileMenuActive(true);
      });
    });
  }, []);

  const closeMobileMenu = useCallback(() => {
    setMobileMenuActive(false);
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => {
      setMobileMenuMounted(false);
    }, 280);
  }, []);

  useEffect(() => {
    if (!mobileMenuMounted) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [mobileMenuMounted]);

  useEffect(() => {
    return () => {
      clearTimers();
      if (closeTimer.current) clearTimeout(closeTimer.current);
    };
  }, [clearTimers]);

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (window.innerWidth >= 640) return; // Desktop uses hover
      didLongPress.current = false;
      touchMoved.current = false;
      const touch = e.touches[0];
      touchStartPos.current = { x: touch.clientX, y: touch.clientY };

      // Subtle tactile squeeze right before long-press fires
      pressFeedbackTimer.current = setTimeout(() => {
        if (!touchMoved.current) setIsPressing(true);
      }, 110);

      longPressTimer.current = setTimeout(() => {
        if (touchMoved.current) return;
        didLongPress.current = true;
        openMobileMenu();
      }, 440);
    },
    [openMobileMenu],
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      const touch = e.touches[0];
      const dx = Math.abs(touch.clientX - touchStartPos.current.x);
      const dy = Math.abs(touch.clientY - touchStartPos.current.y);
      if (dx > 8 || dy > 8) {
        touchMoved.current = true;
        setIsPressing(false);
        clearTimers();
      }
    },
    [clearTimers],
  );

  const handleTouchEnd = useCallback(() => {
    setIsPressing(false);
    clearTimers();
  }, [clearTimers]);

  const posterUrl = film.posterUrlPreview || film.posterUrl || null;
  const highResPosterUrl = film.posterUrl || film.posterUrlPreview || null;
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
      setIsFav(added);
      if (navigator.vibrate) navigator.vibrate(20);
      toast.success(added ? "Added to Favorites" : "Removed from Favorites");
      if (mobileMenuMounted) closeMobileMenu();
    },
    [
      id,
      name,
      posterUrl,
      entryYear,
      entryRating,
      toast,
      mobileMenuMounted,
      closeMobileMenu,
    ],
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
      setIsWL(added);
      if (navigator.vibrate) navigator.vibrate(20);
      toast.info(added ? "Saved to Watch Later" : "Removed from Watch Later");
      if (mobileMenuMounted) closeMobileMenu();
    },
    [
      id,
      name,
      posterUrl,
      entryYear,
      entryRating,
      toast,
      mobileMenuMounted,
      closeMobileMenu,
    ],
  );

  const handleLinkClick = useCallback(
    (e: React.MouseEvent) => {
      if (didLongPress.current || mobileMenuMounted) {
        e.preventDefault();
        didLongPress.current = false;
      }
    },
    [mobileMenuMounted],
  );

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
  }, []);

  return (
    <>
      <Link
        href={`/film/${id}`}
        className="group block shrink-0 no-underline select-none [-webkit-touch-callout:none]"
        onClick={handleLinkClick}
        onContextMenu={handleContextMenu}
      >
        <div
          className={`film-card pb-1 cursor-pointer relative transition-transform duration-200 ease-out ${
            isScroll ? `min-h-fit ${SCROLL_SIZE_CLASSES[size]}` : "w-full"
          } ${isPressing ? "scale-[0.94]" : "scale-100"} ${
            mobileMenuMounted ? "opacity-0" : "opacity-100"
          }`}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={handleTouchEnd}
          onTouchMove={handleTouchMove}
          onContextMenu={handleContextMenu}
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

            {/* Rank number */}
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
              <div className="absolute bottom-2 left-0 right-0 px-2 hidden sm:flex items-center justify-center gap-[6px] opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none group-hover:pointer-events-auto">
                <button
                  type="button"
                  onClick={handleFav}
                  title={isFav ? "Remove from Favorites" : "Add to Favorites"}
                  className={`flex items-center gap-[5px] rounded-[6px] px-[8px] py-[5px] text-[10px] font-semibold backdrop-blur-[8px] border transition-all duration-150 cursor-pointer ${
                    isFav
                      ? "bg-[rgba(229,9,20,0.25)] border-[rgba(229,9,20,0.6)] text-[var(--accent)]"
                      : "bg-[rgba(0,0,0,0.65)] border-[rgba(255,255,255,0.15)] text-white hover:bg-[rgba(229,9,20,0.2)] hover:border-[rgba(229,9,20,0.5)] hover:text-[var(--accent)]"
                  }`}
                >
                  <Heart
                    size={14}
                    fill={isFav ? "var(--accent)" : "none"}
                    stroke={isFav ? "var(--accent)" : "currentColor"}
                    strokeWidth={2.2}
                  />
                </button>
                <button
                  type="button"
                  onClick={handleWL}
                  title={isWL ? "Remove from Watch Later" : "Watch Later"}
                  className={`flex items-center gap-[5px] rounded-[6px] px-[8px] py-[5px] text-[10px] font-semibold backdrop-blur-[8px] border transition-all duration-150 cursor-pointer ${
                    isWL
                      ? "bg-[rgba(96,165,250,0.2)] border-[rgba(96,165,250,0.5)] text-[#60a5fa]"
                      : "bg-[rgba(0,0,0,0.65)] border-[rgba(255,255,255,0.15)] text-white hover:bg-[rgba(96,165,250,0.15)] hover:border-[rgba(96,165,250,0.4)] hover:text-[#60a5fa]"
                  }`}
                >
                  <Clock
                    size={14}
                    stroke={isWL ? "#60a5fa" : "currentColor"}
                    strokeWidth={2.2}
                  />
                </button>
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

            {/* ── Active state badges ── */}
            {mounted && (isFav || isWL) && (
              <div className="absolute top-1.5 left-1.5 sm:top-2 sm:left-2 flex flex-col gap-[4px]">
                {isFav && (
                  <div className="w-[22px] h-[22px] rounded-[5px] bg-[rgba(229,9,20,0.85)] backdrop-blur-[6px] flex items-center justify-center">
                    <Heart size={11} fill="white" stroke="white" />
                  </div>
                )}
                {isWL && (
                  <div className="w-[22px] h-[22px] rounded-[5px] bg-[rgba(96,165,250,0.85)] backdrop-blur-[6px] flex items-center justify-center">
                    <Clock size={11} stroke="white" strokeWidth={2.5} />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── Info below poster ── */}
          <div className="mt-[8px] sm:mt-[10px] px-[2px]">
            <p className="text-[12px] sm:text-[13px] font-semibold overflow-hidden text-ellipsis whitespace-nowrap leading-[1.3] transition-colors duration-200 text-[var(--text)] group-hover:text-white">
              {name}
            </p>
            <div className="flex items-center gap-[5px] sm:gap-[6px] mt-1 flex-wrap">
              {year && (
                <span className="text-[10px] sm:text-[11px] text-[var(--text-muted)]">
                  {year}
                </span>
              )}
              {film.genres?.[0] && (
                <span className="tag tag-dim !text-[9px] sm:!text-[10px] !py-[1px] !px-[6px] sm:!px-[7px]">
                  {translateGenre(film.genres[0].genre, autoTranslate)}
                </span>
              )}
              {film.countries?.[0] && (
                <span className="hidden sm:inline tag tag-dim !text-[10px] !py-[1px] !px-[7px]">
                  {translateCountry(film.countries[0].country, autoTranslate)}
                </span>
              )}
            </div>
          </div>
        </div>
      </Link>

      {/* ── Mobile Full-Screen Peek & Pop Portal ── */}
      {mounted &&
        mobileMenuMounted &&
        createPortal(
          <div
            className="fixed inset-0 z-[9999] flex flex-col items-center justify-center px-6 sm:hidden select-none"
            onClick={(e) => {
              e.stopPropagation();
              closeMobileMenu();
            }}
            onContextMenu={handleContextMenu}
          >
            {/* Blurred Backdrop */}
            <div
              className={`absolute inset-0 bg-black/75 backdrop-blur-xl transition-opacity duration-300 ease-out ${
                mobileMenuActive ? "opacity-100" : "opacity-0"
              }`}
            />

            {/* Content Wrapper */}
            <div
              className="relative z-10 flex flex-col items-center w-full max-w-[270px]"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Popped-Out Card (Animates from exact grid/scroll slot to center) */}
              <div
                style={{
                  width: `${POPUP_WIDTH}px`,
                  transform: mobileMenuActive
                    ? "translate3d(0px, 0px, 0) scale(1)"
                    : `translate3d(${originOffset.x}px, ${originOffset.y}px, 0) scale(${originOffset.scale})`,
                  transition:
                    "transform 380ms cubic-bezier(0.32, 0.72, 0, 1), box-shadow 380ms ease",
                }}
                className="aspect-[2/3] rounded-[18px] overflow-hidden relative bg-[var(--bg-card)] border border-white/15 shadow-[0_28px_70px_rgba(0,0,0,0.9),0_0_40px_rgba(229,9,20,0.18)]"
              >
                <PosterImage
                  src={highResPosterUrl || undefined}
                  alt={name}
                  title={name}
                />

                {/* Bottom vignette inside popped poster for metadata */}
                <div className="absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-black/95 via-black/55 to-transparent pointer-events-none" />

                {/* Rating Badge on Popped Card */}
                {rating !== null && (
                  <div className="absolute top-3 right-3 bg-black/80 backdrop-blur-md border border-[#f5c518]/40 rounded-lg px-2.5 py-1 flex items-center gap-1 shadow-lg">
                    <Star size={12} fill="#f5c518" stroke="#f5c518" />
                    <span className="text-xs font-bold text-[#f5c518] font-display tracking-wide">
                      {formatRating(rating)}
                    </span>
                  </div>
                )}

                {/* Title & Metadata inside Popped Card bottom */}
                <div
                  className={`absolute bottom-3 inset-x-3.5 transition-all duration-300 delay-75 ${
                    mobileMenuActive
                      ? "opacity-100 translate-y-0"
                      : "opacity-0 translate-y-2"
                  }`}
                >
                  <h3 className="text-[15px] font-bold text-white leading-snug line-clamp-2 drop-shadow-sm">
                    {name}
                  </h3>
                  <div className="flex items-center gap-2 mt-1 text-[11px] text-white/70 font-medium">
                    {year && <span>{year}</span>}
                    {year && film.genres?.[0] && <span>•</span>}
                    {film.genres?.[0] && (
                      <span className="text-white/90">
                        {translateGenre(film.genres[0].genre, autoTranslate)}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* ── Floating Action Buttons Panel ── */}
              <div
                style={{
                  transition:
                    "opacity 260ms ease, transform 360ms cubic-bezier(0.32, 0.72, 0, 1)",
                  transitionDelay: mobileMenuActive ? "60ms" : "0ms",
                }}
                className={`w-full mt-4 flex flex-col gap-2.5 ${
                  mobileMenuActive
                    ? "opacity-100 translate-y-0 scale-100"
                    : "opacity-0 -translate-y-4 scale-90 pointer-events-none"
                }`}
              >
                {/* Row 1: Favorite & Watch Later Pills */}
                <div className="grid grid-cols-2 gap-2.5 w-full">
                  <button
                    type="button"
                    onClick={handleFav}
                    className={`flex items-center justify-center gap-2 py-3 px-3 rounded-2xl backdrop-blur-xl border text-xs font-semibold transition-all active:scale-95 ${
                      isFav
                        ? "bg-[rgba(229,9,20,0.28)] border-[rgba(229,9,20,0.65)] text-white shadow-[0_0_24px_rgba(229,9,20,0.3)]"
                        : "bg-white/10 border-white/15 text-white/90"
                    }`}
                  >
                    <Heart
                      size={16}
                      fill={isFav ? "var(--accent)" : "none"}
                      stroke={isFav ? "var(--accent)" : "currentColor"}
                      strokeWidth={2.2}
                    />
                    <span>{isFav ? "Favorited" : "Favorite"}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleWL}
                    className={`flex items-center justify-center gap-2 py-3 px-3 rounded-2xl backdrop-blur-xl border text-xs font-semibold transition-all active:scale-95 ${
                      isWL
                        ? "bg-[rgba(96,165,250,0.28)] border-[rgba(96,165,250,0.65)] text-[#93c5fd] shadow-[0_0_24px_rgba(96,165,250,0.25)]"
                        : "bg-white/10 border-white/15 text-white/90"
                    }`}
                  >
                    <Clock
                      size={16}
                      stroke={isWL ? "#60a5fa" : "currentColor"}
                      strokeWidth={2.2}
                    />
                    <span>{isWL ? "Saved" : "Watch Later"}</span>
                  </button>
                </div>

                {/* Row 2: Open Film Details / Watch CTA */}
                <Link
                  href={`/film/${id}`}
                  onClick={() => closeMobileMenu()}
                  className="w-full py-3 rounded-2xl bg-[var(--accent,#e50914)] text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-[0_8px_24px_rgba(229,9,20,0.4)] active:scale-95 transition-transform no-underline"
                >
                  <Play size={14} fill="white" stroke="white" />
                  <span>Watch Now</span>
                </Link>

                {/* Row 3: Dismiss Button */}
                <button
                  type="button"
                  onClick={closeMobileMenu}
                  className="mx-auto mt-1 w-10 h-10 rounded-full bg-white/10 border border-white/15 backdrop-blur-xl flex items-center justify-center text-white/70 active:scale-90 transition-transform"
                  aria-label="Close preview"
                >
                  <X size={16} strokeWidth={2.4} />
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
