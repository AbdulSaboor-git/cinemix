"use client";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { searchFilms } from "@/lib/kinopoisk";
import { Film } from "@/types/kinopoisk";
import { getEnglishName, translateCountry } from "@/lib/translate";
import { useSearchSuggestions } from "@/hooks/useSearchSuggestions";
import { useAutoTranslate } from "@/hooks/useTranslate";
import FilmCard from "@/components/FilmCard";
import Pagination from "@/components/Pagination";
import Link from "next/link";
import Image from "next/image";

export default function SearchClient({
  q,
  page: pg,
}: {
  q?: string;
  page?: string;
}) {
  const query = q || "";
  const page = Math.max(1, parseInt(pg || "1"));
  const [films, setFilms] = useState<Film[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState(query);
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const autoTranslate = useAutoTranslate();
  const {
    suggestions,
    sugLoading,
    sugVisible,
    selectedIdx,
    setSugVisible,
    fetchSuggestions,
    clearSuggestions,
    handleKeyNav,
  } = useSearchSuggestions();

  useEffect(() => {
    setSearch(query);
  }, [query]);

  useEffect(() => {
    if (!query) return;
    setLoading(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
    searchFilms(query, page)
      .then((d) => {
        setFilms(d.items ?? []);
        setTotalPages(d.totalPages ?? 1);
        setTotal(d.total ?? 0);
      })
      .catch(() => setFilms([]))
      .finally(() => setLoading(false));
  }, [query, page]);

  const handleChange = (val: string) => {
    setSearch(val);
    if (val !== query) fetchSuggestions(val, 5);
    else clearSuggestions();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedIdx >= 0 && suggestions[selectedIdx]) {
      const film = suggestions[selectedIdx];
      router.push(`/film/${film.kinopoiskId ?? film.filmId}`);
    } else if (search.trim()) {
      router.push(`/search?q=${encodeURIComponent(search.trim())}`);
    }
    clearSuggestions();
  };

  return (
    <div className="min-h-screen pb-20">
      <div className="px-4 sm:px-[var(--page-x)] pt-8 sm:pt-10 pb-6 sm:pb-8">
        {/* Search box */}
        <form onSubmit={handleSubmit} className="mb-6 sm:mb-8">
          <div className="relative w-full max-w-[600px]">
            <input
              ref={inputRef}
              value={search}
              onChange={(e) => handleChange(e.target.value)}
              onKeyDown={(e) => handleKeyNav(e, suggestions.length)}
              onFocus={() => suggestions.length > 0 && setSugVisible(true)}
              onBlur={() => setTimeout(() => setSugVisible(false), 300)}
              placeholder="Search films, series, actors…"
              className="input text-[15px] sm:text-[16px] py-3 px-10 sm:py-3.5 rounded-xl sm:rounded-[14px] w-full"
              autoFocus={!query}
            />
            <svg
              className={`absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none transition-opacity ${sugLoading ? "opacity-100" : "opacity-40"}`}
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
            {search && (
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  clearSuggestions();
                  inputRef.current?.focus();
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 bg-transparent border-none cursor-pointer text-[var(--text-muted)] p-1 hover:text-[var(--text)] transition-colors min-w-[32px] min-h-[32px] flex items-center justify-center"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            )}

            {/* Suggestions dropdown */}
            {sugVisible && suggestions.length > 0 && (
              <div className="absolute top-[calc(100%+6px)] sm:top-[calc(100%+8px)] left-0 right-0 bg-[rgba(17,17,17,0.98)] backdrop-blur-[20px] border border-[var(--border)] rounded-[10px] sm:rounded-[12px] overflow-hidden z-50 shadow-[0_16px_48px_rgba(0,0,0,0.6)] slide-down">
                {suggestions.map((film, i) => {
                  const id = film.kinopoiskId ?? film.filmId;
                  const name = getEnglishName(
                    film.nameRu,
                    film.nameEn,
                    film.nameOriginal,
                    autoTranslate,
                  );
                  const rating =
                    film.ratingKinopoisk ?? film.ratingImdb ?? film.rating;
                  return (
                    <Link
                      key={id}
                      href={`/film/${id}`}
                      className="no-underline"
                      onClick={() => clearSuggestions()}
                    >
                      <div
                        className={`flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-[9px] sm:py-[10px] cursor-pointer transition-colors duration-100 hover:bg-[var(--bg-elevated)]
                        ${i === selectedIdx ? "bg-[var(--bg-elevated)]" : ""}
                        ${i < suggestions.length - 1 ? "border-b border-[var(--border)]" : ""}`}
                      >
                        <div className="w-8 sm:w-9 h-[48px] sm:h-[54px] rounded-[5px] sm:rounded-[6px] overflow-hidden flex-shrink-0 bg-[var(--surface)] relative">
                          {(film.posterUrlPreview || film.posterUrl) && (
                            <Image
                              src={film.posterUrlPreview || film.posterUrl!}
                              alt={name}
                              fill
                              className="object-cover"
                              sizes="36px"
                            />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] sm:text-[14px] font-semibold text-[var(--text)] truncate">
                            {name}
                          </p>
                          <div className="flex gap-2 mt-[2px] flex-wrap">
                            {film.year && (
                              <span className="text-[11px] text-[var(--text-muted)]">
                                {film.year}
                              </span>
                            )}
                            {film.genres?.[0] && (
                              <span className="text-[11px] text-[var(--text-muted)] capitalize">
                                {film.genres[0].genre}
                              </span>
                            )}
                            {film.countries?.[0] && (
                              <span className="hidden sm:inline text-[11px] text-[var(--text-muted)]">
                                {translateCountry(film.countries[0].country, autoTranslate)}
                              </span>
                            )}
                          </div>
                        </div>
                        {rating && (
                          <span className="text-[12px] sm:text-[13px] text-[#f5c518] font-bold font-display flex-shrink-0">
                            {typeof rating === "number"
                              ? rating.toFixed(1)
                              : rating}
                          </span>
                        )}
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </form>

        {/* Query header */}
        {query && (
          <div>
            <p className="text-[11px] text-[var(--text-muted)] uppercase tracking-[2px] mb-2">
              Results for
            </p>
            <h1
              className="font-display tracking-[1px] sm:tracking-[2px]"
              style={{ fontSize: "clamp(28px, 5vw, 56px)" }}
            >
              &ldquo;{query}&rdquo;
            </h1>
            {total > 0 && !loading && (
              <p className="text-[var(--text-dim)] mt-2 text-[13px] sm:text-[14px]">
                {total.toLocaleString()} result{total !== 1 ? "s" : ""} found
              </p>
            )}
          </div>
        )}
      </div>

      {/* Results */}
      <div className="px-4 sm:px-[var(--page-x)]">
        {!query ? (
          <div className="flex flex-col items-center justify-center min-h-[40vh] gap-3 sm:gap-4 text-[var(--text-dim)] px-4 text-center">
            <svg
              width="52"
              height="52"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--text-muted)"
              strokeWidth="1.5"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
            <p className="text-[16px] sm:text-[18px]">
              Type to start searching
            </p>
            <p className="text-[12px] sm:text-[13px] text-[var(--text-muted)]">
              Search for films, TV series, actors and more
            </p>
          </div>
        ) : loading ? (
          <div className="film-grid">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="skeleton aspect-[2/3] rounded-[12px]" />
            ))}
          </div>
        ) : films.length === 0 ? (
          <div className="flex flex-col items-center py-16 sm:py-24 gap-3 sm:gap-4 text-center text-[var(--text-dim)] px-4">
            <p className="text-[17px] sm:text-[20px] font-medium">
              No results for &ldquo;{query}&rdquo;
            </p>
            <p className="text-[13px] sm:text-[14px] text-[var(--text-muted)]">
              Try a different search term or explore by genre
            </p>
            <Link
              href="/explore"
              className="text-[var(--accent)] text-[13px] sm:text-[14px] mt-1 hover:underline"
            >
              Explore all →
            </Link>
          </div>
        ) : (
          <div className="film-grid">
            {films.map((film) => {
              const id = film.kinopoiskId ?? film.filmId;
              return <FilmCard key={id} film={film} />;
            })}
          </div>
        )}
      </div>

      {query && (
        <Pagination
          page={page}
          totalPages={totalPages}
          buildHref={(p) => `/search?q=${encodeURIComponent(query)}&page=${p}`}
        />
      )}
    </div>
  );
}
