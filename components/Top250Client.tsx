"use client";
import { useEffect, useState } from "react";
import { getTopFilms } from "@/lib/kinopoisk";
import { getEnglishName, translateGenre } from "@/lib/translate";
import { Film } from "@/types/kinopoisk";
import Pagination from "@/components/Pagination";
import Link from "next/link";
import Image from "next/image";

export default function Top250Client({ page: pg }: { page?: string }) {
  const page = Math.max(1, parseInt(pg || "1"));
  const [films, setFilms] = useState<Film[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
    getTopFilms("TOP_250_BEST_FILMS", page)
      .then((d) => {
        const items = d.items ?? [];
        setFilms(items);
        // FIX: don't override totalPages with a guess — use what the API returns.
        // Only fall back to a calculation if the API genuinely omits it.
        const tp =
          d.totalPages && d.totalPages > 1
            ? d.totalPages
            : Math.ceil(250 / (items.length || 20));
        setTotalPages(tp);
      })
      .catch(() => setFilms([]))
      .finally(() => setLoading(false));
  }, [page]);

  // Global rank across pages
  const getGlobalRank = (localIndex: number) =>
    (page - 1) * films.length + localIndex + 1;

  return (
    <div
      style={{ paddingTop: "32px", paddingBottom: "80px", minHeight: "100vh" }}
    >
      {/* Header */}
      <div style={{ padding: "0 clamp(16px,4vw,48px)", marginBottom: "40px" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginBottom: 8,
          }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="#f5c518">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
          </svg>
          <span
            style={{
              fontSize: "13px",
              color: "#f5c518",
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "1px",
            }}
          >
            Audience Rating
          </span>
        </div>
        <h1
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "clamp(48px, 8vw, 72px)",
            letterSpacing: "3px",
            lineHeight: 1,
          }}
        >
          TOP 250
        </h1>
        <p
          style={{ color: "var(--text-dim)", marginTop: 10, fontSize: "15px" }}
        >
          The greatest films of all time, ranked by audience rating
        </p>
      </div>

      {/* List */}
      <div style={{ padding: "0 clamp(16px,4vw,48px)" }}>
        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {Array.from({ length: 20 }).map((_, i) => (
              <div
                key={i}
                className="skeleton"
                style={{ height: 80, borderRadius: 10 }}
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
            Failed to load. Please try again.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
            {films.map((film, i) => {
              const rank = getGlobalRank(i);
              const name = getEnglishName(
                film.nameRu,
                film.nameEn,
                film.nameOriginal,
              );
              const rating =
                film.ratingKinopoisk?.toFixed(1) ??
                film.rating ??
                film.ratingImdb?.toFixed(1) ??
                undefined;
              const id = film.kinopoiskId ?? film.filmId;
              return (
                <Link
                  key={id ?? i}
                  href={`/film/${id}`}
                  style={{ textDecoration: "none" }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 16,
                      padding: "14px 16px",
                      borderRadius: "10px",
                      border: "1px solid transparent",
                      transition: "all 0.18s ease",
                      cursor: "pointer",
                    }}
                    onMouseEnter={(e) => {
                      const el = e.currentTarget as HTMLElement;
                      el.style.background = "var(--bg-card)";
                      el.style.borderColor = "var(--border)";
                      el.style.transform = "translateX(4px)";
                    }}
                    onMouseLeave={(e) => {
                      const el = e.currentTarget as HTMLElement;
                      el.style.background = "transparent";
                      el.style.borderColor = "transparent";
                      el.style.transform = "translateX(0)";
                    }}
                  >
                    {/* Rank */}
                    <div
                      style={{
                        minWidth: 48,
                        textAlign: "right",
                        flexShrink: 0,
                        fontFamily: "var(--font-display)",
                        fontSize:
                          rank <= 10 ? "30px" : rank <= 50 ? "22px" : "18px",
                        color:
                          rank <= 3
                            ? "#f5c518"
                            : rank <= 10
                              ? "rgba(245,197,24,0.55)"
                              : "var(--text-muted)",
                        lineHeight: 1,
                      }}
                    >
                      {rank}
                    </div>

                    {/* Poster thumbnail */}
                    <div
                      style={{
                        width: 44,
                        height: 66,
                        borderRadius: "6px",
                        overflow: "hidden",
                        flexShrink: 0,
                        background: "var(--surface)",
                        position: "relative",
                      }}
                    >
                      {(film.posterUrlPreview || film.posterUrl) && (
                        <Image
                          src={film.posterUrlPreview || film.posterUrl!}
                          alt={name}
                          fill
                          style={{ objectFit: "cover" }}
                          sizes="44px"
                        />
                      )}
                    </div>

                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p
                        style={{
                          fontSize: "15px",
                          fontWeight: 600,
                          color: "var(--text)",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          marginBottom: 4,
                        }}
                      >
                        {name}
                      </p>
                      <div
                        style={{
                          display: "flex",
                          gap: 8,
                          alignItems: "center",
                          flexWrap: "wrap",
                        }}
                      >
                        {film.year && (
                          <span
                            style={{
                              fontSize: "12px",
                              color: "var(--text-muted)",
                            }}
                          >
                            {film.year}
                          </span>
                        )}
                        {film.genres?.slice(0, 2).map((g) => (
                          <span
                            key={g.genre}
                            style={{
                              fontSize: "11px",
                              color: "var(--text-dim)",
                            }}
                          >
                            {translateGenre(g.genre)}
                          </span>
                        ))}
                        {film.filmLength && (
                          <span
                            style={{
                              color: "var(--text-dim)",
                              fontSize: "14px",
                            }}
                          >
                            {film.filmLength.toString().split(":")[0]}h{" "}
                            {film.filmLength.toString().split(":")[1]}m
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Rating */}
                    {rating && (
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 5,
                          flexShrink: 0,
                        }}
                      >
                        <svg
                          width="13"
                          height="13"
                          viewBox="0 0 24 24"
                          fill="#f5c518"
                        >
                          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                        </svg>
                        <span
                          style={{
                            fontWeight: 700,
                            color: "#f5c518",
                            fontFamily: "var(--font-display)",
                            fontSize: "20px",
                          }}
                        >
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
