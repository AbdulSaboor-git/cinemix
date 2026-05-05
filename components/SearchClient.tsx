"use client";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { searchFilms } from "@/lib/kinopoisk";
import { Film } from "@/types/kinopoisk";
import FilmCard from "@/components/FilmCard";
import Pagination from "@/components/Pagination";

export default function SearchClient({ q, page: pg }: { q?: string; page?: string }) {
  const query = q || "";
  const page  = Math.max(1, parseInt(pg || "1"));
  const [films,      setFilms]      = useState<Film[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [total,      setTotal]      = useState(0);
  const [loading,    setLoading]    = useState(false);
  const [search,     setSearch]     = useState(query);
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setSearch(query); }, [query]);

  useEffect(() => {
    if (!query) return;
    setLoading(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
    searchFilms(query, page)
      .then(d => {
        setFilms(d.items ?? []);
        setTotalPages(d.totalPages ?? 1);
        setTotal(d.total ?? 0);
      })
      .catch(() => setFilms([]))
      .finally(() => setLoading(false));
  }, [query, page]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (search.trim()) router.push(`/search?q=${encodeURIComponent(search.trim())}`);
  };

  return (
    <div style={{ paddingTop: "32px", paddingBottom: "80px", minHeight: "100vh" }}>
      <div style={{ padding: "0 clamp(16px,4vw,48px)", marginBottom: "40px" }}>
        {/* Search box */}
        <form onSubmit={handleSubmit} style={{ marginBottom: "32px" }}>
          <div style={{ position: "relative", maxWidth: "600px" }}>
            <input
              ref={inputRef}
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search films, series, actors…"
              className="input"
              autoFocus={!query}
              style={{ fontSize: "16px", padding: "14px 20px 14px 48px", borderRadius: "12px" }}
            />
            <svg style={{ position: "absolute", left: "16px", top: "50%", transform: "translateY(-50%)", opacity: 0.4, pointerEvents: "none" }}
              width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
            {search && (
              <button type="button" onClick={() => { setSearch(""); inputRef.current?.focus(); }}
                style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: "4px" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            )}
          </div>
        </form>

        {/* Query header */}
        {query && (
          <div>
            <p style={{ fontSize: "12px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "1.5px", marginBottom: 6 }}>
              Results for
            </p>
            <h1 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(32px,5vw,52px)", letterSpacing: "2px" }}>
              &ldquo;{query}&rdquo;
            </h1>
            {total > 0 && !loading && (
              <p style={{ color: "var(--text-dim)", marginTop: 8, fontSize: "14px" }}>
                {total.toLocaleString()} result{total !== 1 ? "s" : ""} found
              </p>
            )}
          </div>
        )}
      </div>

      {/* Results */}
      <div style={{ padding: "0 clamp(16px,4vw,48px)" }}>
        {!query ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "40vh", gap: 16, color: "var(--text-dim)" }}>
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
            <p style={{ fontSize: "18px" }}>Type to start searching</p>
          </div>
        ) : loading ? (
          <div className="film-grid">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="skeleton" style={{ aspectRatio: "2/3", borderRadius: 12 }} />
            ))}
          </div>
        ) : films.length === 0 ? (
          <div style={{ textAlign: "center", padding: "80px 0", color: "var(--text-dim)" }}>
            <p style={{ fontSize: "20px", marginBottom: 8 }}>No results found</p>
            <p style={{ fontSize: "14px", color: "var(--text-muted)" }}>Try a different search term</p>
          </div>
        ) : (
          <div className="film-grid">
            {films.map((film, i) => (
              <FilmCard key={film.kinopoiskId ?? film.filmId ?? i} film={film} />
            ))}
          </div>
        )}
      </div>

      {query && (
        <Pagination
          page={page}
          totalPages={totalPages}
          buildHref={p => `/search?q=${encodeURIComponent(query)}&page=${p}`}
        />
      )}
    </div>
  );
}
