"use client";
import Link from "next/link";
import { useState, useRef, useEffect, useCallback } from "react";
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
    if (!id) return;
    setIsFav(isInList("favorites", id));
    setIsWL(isInList("watchlater", id));
    setMounted(true);
  }, [id]);

  const { toast } = useToast();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didLongPress = useRef(false);
  const touchMoved = useRef(false);

  const handleTouchStart = useCallback(() => {
    didLongPress.current = false;
    touchMoved.current = false;
    longPressTimer.current = setTimeout(() => {
      if (touchMoved.current) return;
      didLongPress.current = true;
      setMobileMenuOpen(true);
      if (navigator.vibrate) navigator.vibrate(40);
    }, 500);
  }, []);

  const handleTouchMove = useCallback(() => {
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
      setIsFav(added);
      toast.success(added ? "Added to Favorites" : "Removed from Favorites");
      setMobileMenuOpen(false);
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
      setIsWL(added);
      toast.info(added ? "Saved to Watch Later" : "Removed from Watch Later");
      setMobileMenuOpen(false);
    },
    [id, name, posterUrl, entryYear, entryRating, toast],
  );

  const handleLinkClick = useCallback((e: React.MouseEvent) => {
    if (didLongPress.current) {
      e.preventDefault();
      didLongPress.current = false;
    }
  }, []);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
  }, []);

  return (
    <Link
      href={`/film/${id}`}
      className="group block shrink-0 no-underline"
      onClick={handleLinkClick}
      onContextMenu={handleContextMenu}
    >
      <div
        ref={cardRef}
        className={`film-card pb-1 cursor-pointer relative ${
          isScroll ? `min-h-fit ${SCROLL_SIZE_CLASSES[size]}` : "w-full"
        }`}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onTouchMove={handleTouchMove}
        onContextMenu={handleContextMenu}
      >
        {/* ── Poster ── */}
        <div
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
                <Play size={14} fill="white" stroke="white" className="ml-0.5" />
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

          {/* ── Mobile long-press context menu ── */}
          {mobileMenuOpen && (
            <div
              className="absolute inset-0 z-20 p-4 flex items-center justify-center sm:hidden"
              style={{
                background: "rgba(0,0,0,0.65)",
                backdropFilter: "blur(6px)",
              }}
              onTouchStart={(e) => e.stopPropagation()}
            >
              <div className="flex flex-col justify-between h-full items-center gap-2">
                <div className="flex flex-col items-center gap-2">
                  {/* Favorite */}
                  <div className="flex flex-col items-center gap-1">
                    <button
                      type="button"
                      onTouchEnd={handleFav}
                      className={`w-10 h-10 rounded-full flex items-center justify-center border transition-all active:scale-90 ${
                        isFav
                          ? "bg-[rgba(229,9,20,0.3)] border-[rgba(229,9,20,0.6)]"
                          : "bg-[rgba(255,255,255,0.08)] border-[rgba(255,255,255,0.15)]"
                      }`}
                    >
                      <Heart
                        size={14}
                        fill={isFav ? "var(--accent)" : "none"}
                        stroke={isFav ? "var(--accent)" : "currentColor"}
                        strokeWidth={2.2}
                      />
                    </button>
                    <p className="text-[8px] sm:text-[11px] text-[var(--text)]">
                      Favorite
                    </p>
                  </div>

                  {/* Watch Later */}
                  <div className="flex flex-col items-center gap-1">
                    <button
                      type="button"
                      onTouchEnd={handleWL}
                      className={`w-10 h-10 rounded-full flex items-center justify-center border transition-all active:scale-90 ${
                        isWL
                          ? "bg-[rgba(96,165,250,0.25)] border-[rgba(96,165,250,0.5)]"
                          : "bg-[rgba(255,255,255,0.08)] border-[rgba(255,255,255,0.15)]"
                      }`}
                    >
                      <Clock
                        size={14}
                        stroke={isWL ? "#60a5fa" : "currentColor"}
                        strokeWidth={2.2}
                      />
                    </button>
                    <p className="text-[8px] sm:text-[11px] text-[var(--text)]">
                      Watch Later
                    </p>
                  </div>
                </div>

                {/* Close */}
                <button
                  type="button"
                  onTouchEnd={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setMobileMenuOpen(false);
                  }}
                  className="w-8 h-8 rounded-full flex items-center justify-center bg-[rgba(255,255,255,0.06)] border border-[rgba(255,255,255,0.12)] text-[rgba(255,255,255,0.5)] active:scale-90 transition-all"
                >
                  <X size={13} strokeWidth={2.5} />
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
            {film.countries?.[0] && (
              <span className="hidden sm:inline tag tag-dim !text-[10px] !py-[1px] !px-[7px]">
                {translateCountry(film.countries[0].country, autoTranslate)}
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
