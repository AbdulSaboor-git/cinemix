"use client";
import { Film } from "@/types/kinopoisk";
import Link from "next/link";
import {
  getEnglishName,
  translateCountry,
  translateGenre,
} from "@/lib/translate";
import { useAutoTranslate } from "@/hooks/useTranslate";

export default function HeroBanner({ film }: { film: Film }) {
  const autoTranslate = useAutoTranslate();
  const name = getEnglishName(film.nameRu, film.nameEn, film.nameOriginal, autoTranslate);
  const desc = film.shortDescription || film.description?.slice(0, 200) || "";
  const id = film.kinopoiskId ?? film.filmId;
  const rating =
    film.rating ??
    film.ratingKinopoisk?.toFixed(1) ??
    film.ratingImdb?.toFixed(1) ??
    undefined;

  return (
    <div className="relative w-full overflow-hidden h-[360px] sm:h-[480px] md:h-[600px] lg:h-[min(88vh,800px)]">
      {/* Background */}
      {(film.coverUrl || film.posterUrl) && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={film.coverUrl || film.posterUrl}
          alt={name}
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
              {film.type === "FILM"
                ? "🎬 Film"
                : film.type === "TV_SERIES"
                  ? "📺 Series"
                  : "🎭 Show"}
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
            {rating && (
              <div className="flex items-center gap-[4px] sm:gap-[5px]">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="#f5c518">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                </svg>
                <span className="font-display text-[#f5c518] text-[15px] sm:text-[18px]">
                  {rating}
                </span>
              </div>
            )}
            {film.year && (
              <span className="text-[var(--text-dim)] text-[12px] sm:text-[13px]">
                {film.year}
              </span>
            )}
            {film.filmLength && (
              <span className="text-[var(--text-dim)] text-[12px] sm:text-[13px]">
                {film.filmLength.toString().split(":")[0]}h{" "}
                {film.filmLength.toString().split(":")[1]}m
              </span>
            )}
            {film.ratingAgeLimits && (
              <span className="border border-[rgba(255,255,255,0.25)] rounded-[4px] px-2 py-[2px] text-[10px] sm:text-[11px] text-[var(--text-dim)]">
                {film.ratingAgeLimits.replace("age", "")}+
              </span>
            )}
          </div>

          {/* Genres — hidden on xs, shown sm+ */}
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

          {/* Description — hidden on xs, shown sm+ */}
          {desc && (
            <p className="hidden sm:block text-[13px] md:text-[15px] leading-[1.7] text-[rgba(240,240,240,0.72)] mb-4 sm:mb-6 line-clamp-2 md:line-clamp-3 max-w-[480px]">
              {desc}
            </p>
          )}

          {/* Buttons */}
          <div className="flex gap-2 sm:gap-3 flex-wrap">
            <Link href={`/film/${id}`} className="no-underline">
              <button className="btn btn-primary px-4 sm:px-6 py-2.5 sm:py-3 text-[13px] sm:text-[14px]">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="white">
                  <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
                Watch Now
              </button>
            </Link>
            <Link href={`/film/${id}`} className="no-underline">
              <button className="btn btn-secondary px-4 sm:px-6 py-2.5 sm:py-3 text-[13px] sm:text-[14px]">
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="16" />
                  <line x1="8" y1="12" x2="16" y2="12" />
                </svg>
                More Info
              </button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
