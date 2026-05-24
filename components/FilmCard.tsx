"use client";
import Link from "next/link";
import {
  getEnglishName,
  translateCountry,
  translateGenre,
} from "@/lib/translate";
import { useAutoTranslate } from "@/hooks/useTranslate";
import { Film } from "@/types/kinopoisk";
import { useState, useRef, useEffect, useCallback } from "react";
import { FilmPosterFallback } from "./posterFallback";
import { toggleFavorite, toggleWatchLater, isInList } from "@/lib/userLists";
import { useToast } from "@/lib/toast";

interface FilmCardProps {
  film: Film;
  variant?: "grid" | "scroll";
  size?: "sm" | "md" | "lg";
  index?: number;
}

const SCROLL_SIZE_CLASSES = {
  sm: "w-[110px] h-[165px] sm:w-[140px] sm:h-[210px]",
  md: "w-[130px] h-[195px] sm:w-[175px] sm:h-[263px]",
  lg: "w-[160px] h-[240px] sm:w-[220px] sm:h-[330px]",
};

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
    const num = typeof r === "string" ? parseFloat(r) : r;
    if (!isNaN(num) && num > 0) return num;
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

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill={filled ? "var(--accent)" : "none"}
      stroke={filled ? "var(--accent)" : "currentColor"}
      strokeWidth="2.2"
    >
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  );
}

function ClockIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke={filled ? "#60a5fa" : "currentColor"}
      strokeWidth="2.2"
    >
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

export default function FilmCard({
  film,
  variant = "grid",
  size = "md",
  index,
}: FilmCardProps) {
  const autoTranslate = useAutoTranslate();
  const id = film.kinopoiskId ?? film.filmId;
  const name = getEnglishName(
    film.nameRu,
    film.nameEn,
    film.nameOriginal,
    autoTranslate,
  );
  const rating = resolveRating(film);
  const year = film.year || film.startYear;
  const isScroll = variant === "scroll";
  const [imgError, setImgError] = useState(false);

  const [isFav, setIsFav] = useState(false);
  const [isWL, setIsWL] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (!id) return;
    setIsFav(isInList("favorites", id));
    setIsWL(isInList("watchlater", id));
    setMounted(true);
  }, [id]);

  const { toast } = useToast();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didLongPress = useRef(false);
  // FIX: track if a touch moved (scroll) so we don't trigger long-press while scrolling
  const touchMoved = useRef(false);

  const handleTouchStart = useCallback(() => {
    didLongPress.current = false;
    touchMoved.current = false;
    longPressTimer.current = setTimeout(() => {
      if (touchMoved.current) return; // user was scrolling, bail
      didLongPress.current = true;
      setMobileMenuOpen(true);
      if (navigator.vibrate) navigator.vibrate(40);
    }, 500);
  }, []);

  const handleTouchMove = useCallback(() => {
    // FIX: mark as moved so long-press doesn't fire during scroll
    touchMoved.current = true;
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  const cardRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!mobileMenuOpen) return;
    const handler = (e: TouchEvent | MouseEvent) => {
      if (cardRef.current && !cardRef.current.contains(e.target as Node)) {
        setMobileMenuOpen(false);
      }
    };
    document.addEventListener("touchstart", handler);
    document.addEventListener("mousedown", handler);
    return () => {
      document.removeEventListener("touchstart", handler);
      document.removeEventListener("mousedown", handler);
    };
  }, [mobileMenuOpen]);

  const filmEntry = {
    film_id: id!,
    film_name: name,
    poster_url: film.posterUrlPreview || film.posterUrl || null,
    year: film.year ?? film.startYear ?? null,
    rating: film.ratingKinopoisk ?? film.ratingImdb ?? null,
  };

  // FIX: e.preventDefault() in touch handlers suppresses the synthesized onClick
  // so we don't double-fire on mobile
  const handleFav = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const added = toggleFavorite(filmEntry);
      setIsFav(added);
      toast.success(added ? "Added to Favorites ❤️" : "Removed from Favorites");
      setMobileMenuOpen(false);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [isFav, filmEntry],
  );

  const handleWL = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const added = toggleWatchLater(filmEntry);
      setIsWL(added);
      toast.info(
        added ? "Saved to Watch Later 🕐" : "Removed from Watch Later",
      );
      setMobileMenuOpen(false);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [isWL, filmEntry],
  );

  const handleLinkClick = useCallback((e: React.MouseEvent) => {
    if (didLongPress.current) {
      e.preventDefault();
      didLongPress.current = false;
    }
  }, []);

  // FIX: suppress browser native context menu (image save, copy link, etc.)
  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
  }, []);

  return (
    <Link
      href={`/film/${id}`}
      className="group block shrink-0 no-underline"
      onClick={handleLinkClick}
      // FIX: also suppress on the Link wrapper for good measure
      onContextMenu={handleContextMenu}
    >
      <div
        ref={cardRef}
        className={`film-card pb-1 cursor-pointer relative ${
          isScroll ? `min-h-fit ${SCROLL_SIZE_CLASSES[size]}` : "w-full"
        }`}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        // FIX: cancel long-press if finger moves (scrolling)
        onTouchMove={handleTouchMove}
        // FIX: prevent browser context menu on the container too
        onContextMenu={handleContextMenu}
        // FIX: CSS-level text/image selection prevention so browser doesn't
        // intercept the long press for its own selection UI
        style={{ WebkitUserSelect: "none", userSelect: "none" }}
      >
        {/* ── Poster ── */}
        <div
          className={`rounded-[var(--radius-lg)] overflow-hidden relative bg-[var(--bg-card)] transition-all duration-200
            border border-[var(--border)] group-hover:border-[rgba(229,9,20,0.35)]
            shadow-[0_4px_16px_rgba(0,0,0,0.4)] group-hover:shadow-[0_16px_48px_rgba(0,0,0,0.7),0_0_0_1px_rgba(229,9,20,0.2)]
            ${isScroll ? `${SCROLL_SIZE_CLASSES[size]}` : "w-full aspect-[2/3]"}`}
        >
          {(film.posterUrlPreview || film.posterUrl) && !imgError ? (
            <img
              src={film.posterUrlPreview || film.posterUrl}
              alt={name}
              className="w-full h-full object-cover block"
              draggable={false}
              onError={() => setImgError(true)}
            />
          ) : (
            <FilmPosterFallback title={name} />
          )}

          {/* Gradient overlay */}
          <div className="card-overlay opacity-[0.45] group-hover:opacity-100" />

          {/* Rating badge */}
          {rating !== null && (
            <div className="absolute top-1.5 right-1.5 sm:top-2 sm:right-2 bg-[rgba(0,0,0,0.82)] backdrop-blur-[8px] border border-[rgba(245,197,24,0.3)] rounded-[5px] px-[6px] py-[2px] sm:px-[7px] sm:py-[3px] flex items-center gap-[3px] sm:gap-1">
              <svg
                width="8"
                height="8"
                viewBox="0 0 24 24"
                fill="#f5c518"
                className="sm:w-[9px] sm:h-[9px]"
              >
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
              <span className="text-[10px] sm:text-[11px] text-[#f5c518] font-display tracking-[0.5px]">
                {formatRating(rating)}
              </span>
            </div>
          )}

          {/* Rank number */}
          {index !== undefined && (
            <div
              className={`absolute bottom-1 left-1.5 sm:left-2 font-display leading-none text-white opacity-95
                [text-shadow:0_2px_12px_rgba(0,0,0,0.9),-2px_0_0_rgba(0,0,0,0.5)]
                ${index < 9 ? "text-[clamp(28px,7vw,52px)]" : "text-[clamp(20px,4vw,38px)]"}`}
            >
              {index + 1}
            </div>
          )}

          {/* ── Desktop hover action buttons ── */}
          {mounted && (
            <div
              className="absolute bottom-2 left-0 right-0 px-2 hidden sm:flex items-center justify-center gap-[6px]
              opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none group-hover:pointer-events-auto"
            >
              <button
                onClick={handleFav}
                title={isFav ? "Remove from Favorites" : "Add to Favorites"}
                className={`flex items-center gap-[5px] rounded-[6px] px-[8px] py-[5px] text-[10px] font-semibold
                  backdrop-blur-[8px] border transition-all duration-150 cursor-pointer
                  ${
                    isFav
                      ? "bg-[rgba(229,9,20,0.25)] border-[rgba(229,9,20,0.6)] text-[var(--accent)]"
                      : "bg-[rgba(0,0,0,0.65)] border-[rgba(255,255,255,0.15)] text-white hover:bg-[rgba(229,9,20,0.2)] hover:border-[rgba(229,9,20,0.5)] hover:text-[var(--accent)]"
                  }`}
              >
                <HeartIcon filled={isFav} />
              </button>
              <button
                onClick={handleWL}
                title={isWL ? "Remove from Watch Later" : "Watch Later"}
                className={`flex items-center gap-[5px] rounded-[6px] px-[8px] py-[5px] text-[10px] font-semibold
                  backdrop-blur-[8px] border transition-all duration-150 cursor-pointer
                  ${
                    isWL
                      ? "bg-[rgba(96,165,250,0.2)] border-[rgba(96,165,250,0.5)] text-[#60a5fa]"
                      : "bg-[rgba(0,0,0,0.65)] border-[rgba(255,255,255,0.15)] text-white hover:bg-[rgba(96,165,250,0.15)] hover:border-[rgba(96,165,250,0.4)] hover:text-[#60a5fa]"
                  }`}
              >
                <ClockIcon filled={isWL} />
              </button>
            </div>
          )}

          {/* ── Play icon on hover (desktop) ── */}
          {!(isFav || isWL) && (
            <div className="absolute inset-0 items-center justify-center pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-200 hidden sm:flex pb-8">
              <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-[rgba(229,9,20,0.9)] flex items-center justify-center shadow-[0_0_24px_var(--accent-glow)]">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
                  <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
              </div>
            </div>
          )}

          {/* ── Active state badges ── */}
          {mounted && (isFav || isWL) && (
            <div className="absolute top-1.5 left-1.5 sm:top-2 sm:left-2 flex flex-col gap-[4px]">
              {isFav && (
                <div className="w-[22px] h-[22px] rounded-[5px] bg-[rgba(229,9,20,0.85)] backdrop-blur-[6px] flex items-center justify-center">
                  <svg
                    width="11"
                    height="11"
                    viewBox="0 0 24 24"
                    fill="white"
                    stroke="none"
                  >
                    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                  </svg>
                </div>
              )}
              {isWL && (
                <div className="w-[22px] h-[22px] rounded-[5px] bg-[rgba(96,165,250,0.85)] backdrop-blur-[6px] flex items-center justify-center">
                  <svg
                    width="11"
                    height="11"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="white"
                    strokeWidth="2.5"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                </div>
              )}
            </div>
          )}

          {/* ── Mobile long-press context menu ── */}
          {mobileMenuOpen && (
            <div
              className="absolute inset-0 z-20 p-4 flex items-center justify-center sm:hidden"
              style={{
                background: "rgba(0,0,0,0.65)",
                backdropFilter: "blur(6px)",
                WebkitUserSelect: "none",
                userSelect: "none",
              }}
              onTouchStart={(e) => e.stopPropagation()}
            >
              <div className="flex flex-col justify-between h-full items-center gap-2">
                {/* Favorite */}
                <div className="flex flex-col items-center gap-2">
                  <div className="flex flex-col items-center gap-1">
                    <button
                      onTouchEnd={handleFav}
                      className={`w-10 h-10 rounded-full flex items-center justify-center border transition-all active:scale-90
          ${
            isFav
              ? "bg-[rgba(229,9,20,0.3)] border-[rgba(229,9,20,0.6)]"
              : "bg-[rgba(255,255,255,0.08)] border-[rgba(255,255,255,0.15)]"
          }`}
                    >
                      <HeartIcon filled={isFav} />
                    </button>
                    <p className="text-[8px] sm:text-[11px] text-[var(--text)]">
                      Favorite
                    </p>
                  </div>

                  {/* Watch Later */}
                  <div className="flex flex-col items-center gap-1">
                    <button
                      onTouchEnd={handleWL}
                      className={`w-10 h-10 rounded-full flex items-center justify-center border transition-all active:scale-90
          ${
            isWL
              ? "bg-[rgba(96,165,250,0.25)] border-[rgba(96,165,250,0.5)]"
              : "bg-[rgba(255,255,255,0.08)] border-[rgba(255,255,255,0.15)]"
          }`}
                    >
                      <ClockIcon filled={isWL} />
                    </button>
                    <p className="text-[8px] sm:text-[11px] text-[var(--text)]">
                      Watch Later
                    </p>
                  </div>
                </div>

                {/* Close */}
                <button
                  onTouchEnd={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setMobileMenuOpen(false);
                  }}
                  className="w-8 h-8 rounded-full flex items-center justify-center
          bg-[rgba(255,255,255,0.06)] border border-[rgba(255,255,255,0.12)]
          text-[rgba(255,255,255,0.5)] active:scale-90 transition-all"
                >
                  <svg
                    width="13"
                    height="13"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                  >
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
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
            <div className="hidden sm:inline">
              {film.countries?.[0] && (
                <span className="hidden sm:inline tag tag-dim text-[10px]! py-px! px-1.75">
                  {translateCountry(film.countries[0].country, autoTranslate)}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}
