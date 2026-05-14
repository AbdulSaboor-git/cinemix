"use client";
import Link from "next/link";
import {
  getEnglishName,
  translateCountry,
  translateGenre,
} from "@/lib/translate";
import { Film } from "@/types/kinopoisk";
import { useState } from "react";
import { FilmPosterFallback } from "./posterFallback";

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

/** Pick the best available numeric rating from a Film object.
 *  Priority: IMDb → Kinopoisk → generic `rating` → critics → rf critics → good-review % */
function resolveRating(film: Film): number | string | null {
  const candidates = [
    film.ratingImdb,
    film.ratingKinopoisk,
    film.rating,
    film.ratingFilmCritics,
    film.ratingRfCritics,
  ];

  for (const r of candidates) {
    if (r === undefined || r === null) continue;

    // Coerce to number if it's a numeric string
    const num = typeof r === "string" ? parseFloat(r) : r;
    if (!isNaN(num) && num > 0) return num;
  }

  if (film.ratingGoodReview && film.ratingGoodReview > 0) {
    return `${Math.round(film.ratingGoodReview)}%`;
  }

  return null;
}

/** Format the resolved rating value for display */
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
  const id = film.kinopoiskId ?? film.filmId;
  const name = getEnglishName(film.nameRu, film.nameEn, film.nameOriginal);
  const rating = resolveRating(film);
  const year = film.year || film.startYear;
  const isScroll = variant === "scroll";
  const [imgError, setImgError] = useState(false);

  return (
    <Link href={`/film/${id}`} className="group block shrink-0 no-underline">
      <div
        className={`film-card pb-1 cursor-pointer relative ${
          isScroll ? `min-h-fit ${SCROLL_SIZE_CLASSES[size]}` : "w-full"
        }`}
      >
        {/* Poster */}
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
                ${
                  index < 9
                    ? "text-[clamp(28px,7vw,52px)]"
                    : "text-[clamp(20px,4vw,38px)]"
                }`}
            >
              {index + 1}
            </div>
          )}

          {/* Play icon on hover — hidden on touch devices */}
          <div className="absolute inset-0 items-center justify-center pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-200 hidden sm:flex">
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-[rgba(229,9,20,0.9)] flex items-center justify-center shadow-[0_0_24px_var(--accent-glow)]">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
            </div>
          </div>
        </div>

        {/* Info below */}
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
                {translateGenre(film.genres[0].genre)}
              </span>
            )}
            <div className="hidden sm:inline">
              {film.countries?.[0] && (
                <span className="hidden sm:inline tag tag-dim text-[10px]! py-px! px-1.75">
                  {translateCountry(film.countries[0].country)}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}
