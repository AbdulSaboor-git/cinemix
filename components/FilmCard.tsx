"use client";
import { useState } from "react";
import Link from "next/link";
import { getEnglishName, translateCountry, translateGenre } from "@/lib/translate";
import { Film } from "@/types/kinopoisk";

interface FilmCardProps {
  film: Film;
  /** "grid" = fills container (for film-grid), "scroll" = fixed width in scroll rows */
  variant?: "grid" | "scroll";
  size?: "sm" | "md" | "lg";
  index?: number;
}

const SCROLL_WIDTHS = { sm: 140, md: 180, lg: 220 };
const SCROLL_HEIGHTS = { sm: 210, md: 270, lg: 330 };

export default function FilmCard({ film, variant = "grid", size = "md", index }: FilmCardProps) {
  const [imgError, setImgError] = useState(false);
  const [hovered,  setHovered]  = useState(false);

  const id     = film.kinopoiskId ?? film.filmId;
  const name   = getEnglishName(film.nameRu, film.nameEn, film.nameOriginal);
  const rating = (film.rating) ?? (film.ratingKinopoisk?.toFixed(1)) ?? (film.ratingImdb?.toFixed(1)) ?? undefined;
  const year   = film.year || film.startYear;

  const isScroll = variant === "scroll";
  const sw = SCROLL_WIDTHS[size];
  const sh = SCROLL_HEIGHTS[size];

  const cardStyle: React.CSSProperties = isScroll
    ? { width: sw, flexShrink: 0, cursor: "pointer", position: "relative" }
    : { width: "100%", cursor: "pointer", position: "relative" };

  const posterStyle: React.CSSProperties = isScroll
    ? {
        width: sw, height: sh,
        borderRadius: "var(--radius-lg)", overflow: "hidden",
        position: "relative", background: "var(--bg-card)",
        border: `1px solid ${hovered ? "rgba(229,9,20,0.35)" : "var(--border)"}`,
        boxShadow: hovered
          ? "0 16px 48px rgba(0,0,0,0.7), 0 0 0 1px rgba(229,9,20,0.2)"
          : "0 4px 16px rgba(0,0,0,0.4)",
        transition: "all 0.25s ease",
      }
    : {
        width: "100%", aspectRatio: "2/3",
        borderRadius: "var(--radius-lg)", overflow: "hidden",
        position: "relative", background: "var(--bg-card)",
        border: `1px solid ${hovered ? "rgba(229,9,20,0.35)" : "var(--border)"}`,
        boxShadow: hovered
          ? "0 16px 48px rgba(0,0,0,0.7), 0 0 0 1px rgba(229,9,20,0.2)"
          : "0 4px 16px rgba(0,0,0,0.4)",
        transition: "all 0.25s ease",
      };

  return (
    <Link href={`/film/${id}`} style={{ textDecoration: "none" }}>
      <div
        className="film-card"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={cardStyle}
      >
        {/* Poster */}
        <div style={posterStyle}>
          {!imgError ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={film.posterUrlPreview || film.posterUrl}
              alt={name}
              onError={() => setImgError(true)}
              style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
            />
          ) : (
            <div style={{
              width: "100%", height: "100%",
              display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center",
              gap: 8, padding: 12, textAlign: "center",
              background: "linear-gradient(135deg, #1a1a2e, #16213e)",
            }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.5">
                <rect x="2" y="2" width="20" height="20" rx="2"/>
                <path d="M7 2v20M17 2v20M2 12h20M2 7h5M2 17h5M17 7h5M17 17h5"/>
              </svg>
              <span style={{ fontSize: "10px", color: "var(--text-dim)", fontWeight: 500, lineHeight: 1.3 }}>{name}</span>
            </div>
          )}

          {/* Gradient overlay */}
          <div className="card-overlay" style={{ opacity: hovered ? 1 : 0.45 }} />

          {/* Rating badge */}
          {rating && (
            <div style={{
              position: "absolute", top: 8, right: 8,
              background: "rgba(0,0,0,0.82)", backdropFilter: "blur(8px)",
              border: "1px solid rgba(245,197,24,0.3)",
              borderRadius: "6px", padding: "3px 7px",
              display: "flex", alignItems: "center", gap: "4px",
            }}>
              <svg width="9" height="9" viewBox="0 0 24 24" fill="#f5c518">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
              </svg>
              <span style={{ fontSize: "11px", fontWeight: 700, color: "#f5c518", fontFamily: "var(--font-display)", letterSpacing: "0.5px" }}>
                {rating}
              </span>
            </div>
          )}

          {/* Rank number */}
          {index !== undefined && (
            <div style={{
              position: "absolute", bottom: 4, left: 8,
              fontFamily: "var(--font-display)",
              fontSize: index < 9 ? "clamp(36px,8vw,52px)" : "clamp(26px,5vw,38px)",
              lineHeight: 1, color: "white",
              textShadow: "0 2px 12px rgba(0,0,0,0.9), -2px 0 0 rgba(0,0,0,0.5)",
              opacity: 0.95,
            }}>{index + 1}</div>
          )}

          {/* Play icon on hover */}
          <div style={{
            position: "absolute", inset: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
            opacity: hovered ? 1 : 0, transition: "opacity 0.2s ease",
            pointerEvents: "none",
          }}>
            <div style={{
              width: 44, height: 44, borderRadius: "50%",
              background: "rgba(229,9,20,0.9)",
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 0 24px var(--accent-glow)",
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
                <polygon points="5 3 19 12 5 21 5 3"/>
              </svg>
            </div>
          </div>
        </div>

        {/* Info below */}
        <div style={{ marginTop: 10, padding: "0 2px" }}>
          <p style={{
            fontSize: "13px", fontWeight: 600,
            color: hovered ? "white" : "var(--text)",
            transition: "color 0.2s",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            lineHeight: 1.3,
          }}>{name}</p>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4, flexWrap: "wrap" }}>
            {year && <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>{year}</span>}
            {film.genres?.[0] && (
              <span className="tag tag-dim" style={{ fontSize: "10px", padding: "1px 7px" }}>
                {translateGenre(film.genres[0].genre)}
              </span>
            )}
            {film.countries?.[0] && (
              <span className="tag tag-dim" style={{ fontSize: "10px", padding: "1px 7px" }}>
                {translateCountry(film.countries[0].country)}
              </span>
            )}
            {film.ratingAgeLimits && (
              <span className="tag tag-accent" style={{ fontSize: "10px", padding: "1px 7px" }}>
                {film.ratingAgeLimits.replace("age", "")}+
              </span>
            )}
            {film.ratingMpaa && (
              <span className="tag tag-dim" style={{ fontSize: "10px", padding: "1px 7px" }}>
                {film.ratingMpaa}
              </span>
             )
            }
          </div>
        </div>
      </div>
    </Link>
  );
}
