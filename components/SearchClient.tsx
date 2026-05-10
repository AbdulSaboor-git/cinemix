"use client";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { searchFilms } from "@/lib/kinopoisk";
import { Film } from "@/types/kinopoisk";
import { getEnglishName, translateCountry } from "@/lib/translate";
import { useSearchSuggestions } from "@/hooks/useSearchSuggestions";
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
    <div
      style={{ paddingTop: "32px", paddingBottom: "80px", minHeight: "100vh" }}
    >
      <div style={{ padding: "0 clamp(16px,4vw,48px)", marginBottom: "40px" }}>
        {/* Search box */}
        <form onSubmit={handleSubmit} style={{ marginBottom: "32px" }}>
          <div style={{ position: "relative", maxWidth: "640px" }}>
            <input
              ref={inputRef}
              value={search}
              onChange={(e) => handleChange(e.target.value)}
              onKeyDown={(e) => handleKeyNav(e, suggestions.length)}
              onFocus={() => suggestions.length > 0 && setSugVisible(true)}
              // FIX: 300ms gives touchpad taps time to fire onClick before blur hides the list
              onBlur={() => setTimeout(() => setSugVisible(false), 300)}
              placeholder="Search films, series, actors…"
              className="input"
              autoFocus={!query}
              style={{
                fontSize: "16px",
                padding: "14px 20px 14px 48px",
                borderRadius: "12px",
              }}
            />
            <svg
              style={{
                position: "absolute",
                left: "16px",
                top: "50%",
                transform: "translateY(-50%)",
                opacity: sugLoading ? 1 : 0.4,
                pointerEvents: "none",
              }}
              width="18"
              height="18"
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
                style={{
                  position: "absolute",
                  right: "12px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--text-muted)",
                  padding: "4px",
                }}
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
              <div
                style={{
                  position: "absolute",
                  top: "calc(100% + 8px)",
                  left: 0,
                  right: 0,
                  background: "rgba(17,17,17,0.98)",
                  backdropFilter: "blur(20px)",
                  border: "1px solid var(--border)",
                  borderRadius: "12px",
                  overflow: "hidden",
                  zIndex: 50,
                  boxShadow: "0 16px 48px rgba(0,0,0,0.6)",
                  animation: "slideDown 0.15s ease",
                }}
              >
                {suggestions.map((film, i) => {
                  // FIX: stable key — never fall back to index
                  const id = film.kinopoiskId ?? film.filmId;
                  const name = getEnglishName(
                    film.nameRu,
                    film.nameEn,
                    film.nameOriginal,
                  );
                  const rating =
                    film.ratingKinopoisk ?? film.ratingImdb ?? film.rating;
                  return (
                    <Link
                      key={id}
                      href={`/film/${id}`}
                      style={{ textDecoration: "none" }}
                      onClick={() => clearSuggestions()}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 12,
                          padding: "10px 14px",
                          background:
                            i === selectedIdx
                              ? "var(--bg-elevated)"
                              : "transparent",
                          borderBottom:
                            i < suggestions.length - 1
                              ? "1px solid var(--border)"
                              : "none",
                          cursor: "pointer",
                        }}
                        onMouseEnter={(e) =>
                          ((e.currentTarget as HTMLElement).style.background =
                            "var(--bg-elevated)")
                        }
                        onMouseLeave={(e) =>
                          ((e.currentTarget as HTMLElement).style.background =
                            i === selectedIdx
                              ? "var(--bg-elevated)"
                              : "transparent")
                        }
                      >
                        <div
                          style={{
                            width: 36,
                            height: 54,
                            borderRadius: 6,
                            overflow: "hidden",
                            flexShrink: 0,
                            background: "var(--surface)",
                            position: "relative",
                          }}
                        >
                          {/* FIX: next/image instead of <img> */}
                          {(film.posterUrlPreview || film.posterUrl) && (
                            <Image
                              src={film.posterUrlPreview || film.posterUrl!}
                              alt={name}
                              fill
                              style={{ objectFit: "cover" }}
                              sizes="36px"
                            />
                          )}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p
                            style={{
                              fontSize: "14px",
                              fontWeight: 600,
                              color: "var(--text)",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {name}
                          </p>
                          <div
                            style={{ display: "flex", gap: 8, marginTop: 2 }}
                          >
                            {film.year && (
                              <span
                                style={{
                                  fontSize: "11px",
                                  color: "var(--text-muted)",
                                }}
                              >
                                {film.year}
                              </span>
                            )}
                            {film.genres?.[0] && (
                              <span
                                style={{
                                  fontSize: "11px",
                                  color: "var(--text-muted)",
                                  textTransform: "capitalize",
                                }}
                              >
                                {film.genres[0].genre}
                              </span>
                            )}
                            {film.countries?.[0] && (
                              <span
                                style={{
                                  fontSize: "11px",
                                  color: "var(--text-muted)",
                                }}
                              >
                                {translateCountry(film.countries[0].country)}
                              </span>
                            )}
                          </div>
                        </div>
                        {rating && (
                          <span
                            style={{
                              fontSize: "13px",
                              color: "#f5c518",
                              fontWeight: 700,
                              fontFamily: "var(--font-display)",
                            }}
                          >
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
            <p
              style={{
                fontSize: "12px",
                color: "var(--text-muted)",
                textTransform: "uppercase",
                letterSpacing: "1.5px",
                marginBottom: 6,
              }}
            >
              Results for
            </p>
            <h1
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "clamp(32px,5vw,52px)",
                letterSpacing: "2px",
              }}
            >
              &ldquo;{query}&rdquo;
            </h1>
            {total > 0 && !loading && (
              <p
                style={{
                  color: "var(--text-dim)",
                  marginTop: 8,
                  fontSize: "14px",
                }}
              >
                {total.toLocaleString()} result{total !== 1 ? "s" : ""} found
              </p>
            )}
          </div>
        )}
      </div>

      {/* Results */}
      <div style={{ padding: "0 clamp(16px,4vw,48px)" }}>
        {!query ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              minHeight: "40vh",
              gap: 16,
              color: "var(--text-dim)",
            }}
          >
            <svg
              width="64"
              height="64"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--text-muted)"
              strokeWidth="1.5"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
            <p style={{ fontSize: "18px" }}>Type to start searching</p>
            <p style={{ fontSize: "13px", color: "var(--text-muted)" }}>
              Search for films, TV series, actors and more
            </p>
          </div>
        ) : loading ? (
          <div className="film-grid">
            {Array.from({ length: 12 }).map((_, i) => (
              <div
                key={i}
                className="skeleton"
                style={{ aspectRatio: "2/3", borderRadius: 12 }}
              />
            ))}
          </div>
        ) : films.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: "80px 0",
              color: "var(--text-dim)",
            }}
          >
            <p style={{ fontSize: "20px", marginBottom: 8 }}>
              No results for &ldquo;{query}&rdquo;
            </p>
            <p style={{ fontSize: "14px", color: "var(--text-muted)" }}>
              Try a different search term or explore by genre
            </p>
            <Link
              href="/explore"
              style={{
                color: "var(--accent)",
                fontSize: "14px",
                display: "inline-block",
                marginTop: 12,
              }}
            >
              explore all →
            </Link>
          </div>
        ) : (
          <div className="film-grid">
            {films.map((film) => {
              const id = film.kinopoiskId ?? film.filmId;
              // FIX: stable key, never index
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
