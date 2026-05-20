"use client";
import { useEffect, useState } from "react";
import { getTopFilms } from "@/lib/kinopoisk";
import { getEnglishName, translateGenre } from "@/lib/translate";
import { useAutoTranslate } from "@/hooks/useTranslate";
import { Film } from "@/types/kinopoisk";
import Pagination from "@/components/Pagination";
import Link from "next/link";
import Image from "next/image";

export default function Top240Client({ page: pg }: { page?: string }) {
  const page = Math.max(1, parseInt(pg || "1"));
  const [films, setFilms] = useState<Film[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const autoTranslate = useAutoTranslate();

  useEffect(() => {
    setLoading(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
    getTopFilms("TOP_250_BEST_FILMS", page)
      .then((d) => {
        const items = d.items ?? [];
        setFilms(items);
        const tp =
          d.totalPages && d.totalPages > 1
            ? d.totalPages
            : Math.ceil(240 / (items.length || 20));
        setTotalPages(tp);
      })
      .catch(() => setFilms([]))
      .finally(() => setLoading(false));
  }, [page]);

  const getGlobalRank = (localIndex: number) =>
    (page - 1) * films.length + localIndex + 1;

  return (
    <div className="min-h-screen pb-20">
      {/* Header */}
      <div className="px-4 sm:px-[var(--page-x)] pt-8 sm:pt-10 pb-8 sm:pb-10">
        <div className="flex items-center gap-2 mb-3">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="#f5c518">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
          </svg>
          <span className="text-[11px] sm:text-[12px] text-[#f5c518] font-semibold uppercase tracking-[1.5px]">
            Audience Rating
          </span>
        </div>
        <h1
          className="font-display leading-none tracking-[2px] sm:tracking-[3px]"
          style={{ fontSize: "clamp(40px, 8vw, 80px)" }}
        >
          TOP 240
        </h1>
        <p className="text-[var(--text-dim)] mt-2 sm:mt-3 text-[13px] sm:text-[15px]">
          The greatest films of all time, ranked by audience rating
        </p>
      </div>

      {/* List */}
      <div className="px-4 sm:px-[var(--page-x)]">
        {loading ? (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 20 }).map((_, i) => (
              <div
                key={i}
                className="skeleton h-[68px] sm:h-[76px] rounded-[10px]"
              />
            ))}
          </div>
        ) : films.length === 0 ? (
          <div className="text-center py-24 text-[var(--text-dim)]">
            Failed to load. Please try again.
          </div>
        ) : (
          <div className="flex flex-col gap-[2px] sm:gap-[3px]">
            {films.slice(0, 240).map((film, i) => {
              const rank = getGlobalRank(i);
              const name = getEnglishName(
                film.nameRu,
                film.nameEn,
                film.nameOriginal,
                autoTranslate,
              );
              const rating =
                film.ratingKinopoisk?.toFixed(1) ??
                film.rating ??
                film.ratingImdb?.toFixed(1) ??
                undefined;
              const id = film.kinopoiskId ?? film.filmId;

              const rankSize =
                rank <= 10
                  ? "text-[22px] sm:text-[28px]"
                  : rank <= 50
                    ? "text-[18px] sm:text-[22px]"
                    : "text-[15px] sm:text-[18px]";
              const rankColor =
                rank <= 3
                  ? "text-[#f5c518]"
                  : rank <= 10
                    ? "text-[rgba(245,197,24,0.5)]"
                    : "text-[var(--text-muted)]";

              return (
                <Link
                  key={id ?? i}
                  href={`/film/${id}`}
                  className="no-underline group"
                >
                  <div className="flex items-center gap-2 sm:gap-4 md:gap-5 px-2 sm:px-4 py-[10px] sm:py-3 rounded-[10px] border border-white/5 transition-all duration-[180ms] cursor-pointer hover:bg-[var(--bg-card)] hover:border-[var(--border)] active:bg-[var(--bg-card)] sm:group-hover:translate-x-1">
                    {/* Rank */}
                    <div
                      className={`w-7 sm:w-10 text-right flex-shrink-0 font-display leading-none ${rankSize} ${rankColor}`}
                    >
                      {rank}
                    </div>

                    {/* Poster */}
                    <div className="w-[34px] sm:w-[42px] h-[51px] sm:h-[63px] rounded-[5px] sm:rounded-[6px] overflow-hidden flex-shrink-0 bg-[var(--surface)] relative">
                      {(film.posterUrlPreview || film.posterUrl) && (
                        <Image
                          src={film.posterUrlPreview || film.posterUrl!}
                          alt={name}
                          fill
                          className="object-cover"
                          sizes="42px"
                        />
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] sm:text-[14px] md:text-[15px] font-semibold text-[var(--text)] overflow-hidden text-ellipsis whitespace-nowrap mb-[2px] sm:mb-1 group-hover:text-white transition-colors">
                        {name}
                      </p>
                      <div className="flex gap-2 items-center flex-wrap">
                        {film.year && (
                          <span className="text-[11px] sm:text-[12px] text-[var(--text-muted)]">
                            {film.year}
                          </span>
                        )}
                        {film.genres?.slice(0, 2).map((g) => (
                          <span
                            key={g.genre}
                            className="hidden sm:inline text-[11px] text-[var(--text-dim)] capitalize"
                          >
                            {translateGenre(g.genre, autoTranslate)}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Rating */}
                    {rating && (
                      <div className="flex items-center gap-[4px] sm:gap-[5px] flex-shrink-0">
                        <svg
                          width="11"
                          height="11"
                          viewBox="0 0 24 24"
                          fill="#f5c518"
                        >
                          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                        </svg>
                        <span className="text-[#f5c518] font-display text-[15px] sm:text-[18px] md:text-[20px]">
                          {rating}
                        </span>
                      </div>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      <Pagination
        page={page}
        totalPages={totalPages}
        buildHref={(p) => `/top250?page=${p}`}
      />
    </div>
  );
}
