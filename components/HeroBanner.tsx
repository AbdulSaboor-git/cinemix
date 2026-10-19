"use client";
import Link from "next/link";
import {
  Film as FilmIcon,
  Tv,
  Clapperboard,
  Star,
  Play,
  Info,
} from "lucide-react";
import { Film } from "@/types/kinopoisk";
import { translateCountry, translateGenre } from "@/lib/translate";
import {
  useAutoTranslate,
  useFilmTitle,
  useTranslate,
} from "@/hooks/useTranslate";

export default function HeroBanner({ film }: { film: Film }) {
  const autoTranslate = useAutoTranslate();

  const name = useFilmTitle(film, autoTranslate);
  const rawDesc =
    film.shortDescription || film.description?.slice(0, 220) || "";
  const desc = useTranslate(rawDesc);
  const id = film.kinopoiskId ?? film.filmId;

  const numericRating =
    film.ratingKinopoisk ??
    film.ratingImdb ??
    (typeof film.rating === "number" ? film.rating : undefined);
  const ratingDisplay = numericRating
    ? numericRating.toFixed(1)
    : film.ratingAwait
      ? `${Math.round(film.ratingAwait)}%`
      : undefined;

  return (
    <div className="relative w-full overflow-hidden h-[360px] sm:h-[480px] md:h-[600px] lg:h-[min(88vh,800px)]">
      {/* Background */}
      {(film.coverUrl || film.posterUrl) && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={film.coverUrl || film.posterUrl}
          alt={name}
          fetchPriority="high"
          decoding="async"
          className="absolute inset-0 w-full h-full object-cover object-[center_20%]"
        />
      )}

      {/* Gradient layers */}
      <div className="hero-gradient-left absolute inset-0" />
      <div className="hero-gradient-bottom absolute inset-0" />
      <div className="absolute inset-0 bg-gradient-to-b from-[rgba(0,0,0,0.45)] via-transparent to-transparent" />

      {/* Content */}
      <div className="absolute bottom-0 left-0 right-0 px-4 sm:px-[var(--page-x)] pb-7 sm:pb-[10%]">
        <div className="max-w-[560px]">
          {/* Type badge */}
          {film.type && (
            <div className="inline-flex items-center gap-[5px] bg-[var(--accent)] rounded-[4px] px-2.5 py-[3px] mb-3 text-[10px] sm:text-[11px] font-bold tracking-[1.2px] uppercase text-white">
              {film.type === "FILM" ? (
                <>
                  <FilmIcon size={12} />
                  <span>Film</span>
                </>
              ) : film.type === "TV_SERIES" || film.type === "MINI_SERIES" ? (
                <>
                  <Tv size={12} />
                  <span>Series</span>
                </>
              ) : (
                <>
                  <Clapperboard size={12} />
                  <span>Show</span>
                </>
              )}
            </div>
          )}

          <h1
            className="font-display uppercase leading-[0.95] tracking-[2px] text-white mb-3 sm:mb-4"
            style={{
              fontSize: "clamp(24px, 6vw, 80px)",
              textShadow: "0 4px 24px rgba(0,0,0,0.6)",
            }}
          >
            {name}
          </h1>

          {/* Meta row */}
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap mb-2 sm:mb-3">
            {ratingDisplay && (
              <div className="flex items-center gap-[4px] sm:gap-[5px]">
                <Star size={12} fill="#f5c518" stroke="#f5c518" />
                <span className="font-display text-[#f5c518] text-[15px] sm:text-[18px]">
                  {ratingDisplay}
                </span>
              </div>
            )}
            {film.year && (
              <span className="text-[var(--text-dim)] text-[12px] sm:text-[13px]">
                {film.year}
              </span>
            )}
            {film.filmLength && film.filmLength > 0 && (
              <span className="text-[var(--text-dim)] text-[12px] sm:text-[13px]">
                {Math.floor(film.filmLength / 60)}h {film.filmLength % 60}m
              </span>
            )}
            {film.ratingAgeLimits && (
              <span className="border border-[rgba(255,255,255,0.25)] rounded-[4px] px-2 py-[2px] text-[10px] sm:text-[11px] text-[var(--text-dim)]">
                {film.ratingAgeLimits.replace("age", "")}+
              </span>
            )}
          </div>

          {/* Genres */}
          <div className="hidden sm:flex flex-wrap gap-2 mb-3 sm:mb-4">
            {film.genres?.slice(0, 4).map((g) => (
              <span key={g.genre} className="tag tag-dim">
                {translateGenre(g.genre, autoTranslate)}
              </span>
            ))}
            {film.countries?.slice(0, 3).map((c) => (
              <span key={c.country} className="tag tag-dim">
                {translateCountry(c.country, autoTranslate)}
              </span>
            ))}
          </div>

          {/* Description */}
          {desc && (
            <p className="hidden sm:block text-[13px] md:text-[15px] leading-[1.7] text-[rgba(240,240,240,0.72)] mb-4 sm:mb-6 line-clamp-2 md:line-clamp-3 max-w-[480px]">
              {desc}
            </p>
          )}

          {/* Buttons */}
          <div className="flex gap-2 sm:gap-3 flex-wrap">
            <Link href={`/watch/${id}`} className="no-underline">
              <button
                type="button"
                className="btn btn-primary px-4 sm:px-6 py-2.5 sm:py-3 text-[13px] sm:text-[14px]"
              >
                <Play size={13} fill="white" stroke="white" />
                Watch Now
              </button>
            </Link>
            <Link href={`/film/${id}`} className="no-underline">
              <button
                type="button"
                className="btn btn-secondary px-4 sm:px-6 py-2.5 sm:py-3 text-[13px] sm:text-[14px]"
              >
                <Info size={13} strokeWidth={2} />
                More Info
              </button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
