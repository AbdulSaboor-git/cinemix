"use client";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { searchFilms } from "@/lib/kinopoisk";
import { Film } from "@/types/kinopoisk";
import { getEnglishName } from "@/lib/translate";
import FilmCard from "@/components/FilmCard";
import Pagination from "@/components/Pagination";
import Link from "next/link";

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
  const [suggestions, setSuggestions] = useState<Film[]>([]);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
  const router = useRouter();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (val.trim().length < 2) {
      setSuggestions([]);
      return;
    }

    // Compute dropdown position from input rect
    if (inputRef.current) {
      const rect = inputRef.current.getBoundingClientRect();
      setDropdownStyle({
        position: "fixed",
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width,
        zIndex: 99999,
      });
    }

    debounceRef.current = setTimeout(async () => {
      try {
        const res = await searchFilms(val.trim(), 1);
        setSuggestions(res.items.slice(0, 5));
      } catch {
        setSuggestions([]);
      }
    }, 300);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (search.trim()) {
      setSuggestions([]);
      router.push(`/search?q=${encodeURIComponent(search.trim())}`);
    }
  };

  return (
    <div
      style={{ paddingTop: "32px", paddingBottom: "80px", minHeight: "100vh" }}
    >
      {/* Suggestions rendered at root level, outside everything */}
      {suggestions.length > 0 && (
        <div
          style={{
            ...dropdownStyle,
            background: "#1a1a1a",
            border: "1px solid #444",
            borderRadius: "10px",
            overflow: "hidden",
            boxShadow: "0 8px 32px rgba(0,0,0,0.8)",
          }}
        >
          {suggestions.map((film, i) => {
            const name = getEnglishName(
              film.nameRu,
              film.nameEn,
              film.nameOriginal,
            );
            const id = film.kinopoiskId ?? film.filmId;
            return (
              <a
                key={id ?? i}
                href={`/film/${id}`}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "10px 14px",
                  borderBottom:
                    i < suggestions.length - 1 ? "1px solid #333" : "none",
                  color: "#fff",
                  textDecoration: "none",
                  background: "#1a1a1a",
                  cursor: "pointer",
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.background = "#2a2a2a")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.background = "#1a1a1a")
                }
              >
                {(film.posterUrlPreview || film.posterUrl) && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={film.posterUrlPreview || film.posterUrl}
                    alt={name}
                    style={{
                      width: 30,
                      height: 45,
                      objectFit: "cover",
                      borderRadius: 4,
                      flexShrink: 0,
                    }}
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                    }}
                  />
                )}
                <span style={{ fontSize: "14px" }}>
                  {name} {film.year ? `(${film.year})` : ""}
                </span>
              </a>
            );
          })}
        </div>
      )}

      <div style={{ padding: "0 clamp(16px,4vw,48px)", marginBottom: "40px" }}>
        <form onSubmit={handleSubmit} style={{ marginBottom: "32px" }}>
          <div style={{ maxWidth: "640px" }}>
            <input
              ref={inputRef}
              value={search}
              onChange={(e) => handleChange(e.target.value)}
              placeholder="Search films, series, actors…"
              className="input"
              autoFocus={!query}
              style={{
                fontSize: "16px",
                padding: "14px 20px",
                borderRadius: "12px",
                width: "100%",
              }}
            />
          </div>
        </form>

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
            <p style={{ fontSize: "18px" }}>Type to start searching</p>
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
            <Link
              href="/browse"
              style={{
                color: "var(--accent)",
                fontSize: "14px",
                display: "inline-block",
                marginTop: 12,
              }}
            >
              Browse all →
            </Link>
          </div>
        ) : (
          <div className="film-grid">
            {films.map((film, i) => (
              <FilmCard
                key={film.kinopoiskId ?? film.filmId ?? i}
                film={film}
              />
            ))}
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
