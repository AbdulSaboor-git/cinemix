"use client";
import { Film } from "@/types/kinopoisk";
import Link from "next/link";
import {
  getEnglishName,
  translateCountry,
  translateGenre,
} from "@/lib/translate";

export default function HeroBanner({ film }: { film: Film }) {
  const name = getEnglishName(film.nameRu, film.nameEn, film.nameOriginal);
  const desc = film.shortDescription || film.description?.slice(0, 220) || "";
  const id = film.kinopoiskId ?? film.filmId;
  const rating =
    film.rating ??
    film.ratingKinopoisk?.toFixed(1) ??
    film.ratingImdb?.toFixed(1) ??
    undefined;
  console.log(film);
  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "clamp(500px, 90vh, 800px)",
        overflow: "hidden",
      }}
    >
      {/* Background image */}
      {(film.coverUrl || film.posterUrl) && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={film.coverUrl || film.posterUrl}
          alt={name}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            objectPosition: "center 20%",
          }}
        />
      )}

      {/* Gradients */}
      <div
        className="hero-gradient-left"
        style={{ position: "absolute", inset: 0 }}
      />
      <div
        className="hero-gradient-bottom"
        style={{ position: "absolute", inset: 0 }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(to bottom, rgba(0,0,0,0.4) 0%, transparent 25%)",
        }}
      />

      {/* Content */}
      <div
        style={{
          position: "absolute",
          bottom: "12%",
          left: "clamp(16px, 4vw, 48px)",
          right: "clamp(16px, 4vw, 48px)",
          maxWidth: "600px",
        }}
      >
        {/* Type badge */}
        {film.type && (
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              background: "var(--accent)",
              borderRadius: "4px",
              padding: "4px 12px",
              marginBottom: "14px",
              fontSize: "11px",
              fontWeight: 700,
              letterSpacing: "1px",
              textTransform: "uppercase",
            }}
          >
            {film.type === "FILM"
              ? "🎬 Film"
              : film.type === "TV_SERIES"
                ? "📺 Series"
                : "🎭 Show"}
          </div>
        )}

        <h1
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "clamp(36px, 6vw, 76px)",
            lineHeight: 1,
            letterSpacing: "2px",
            color: "white",
            textShadow: "0 4px 24px rgba(0,0,0,0.5)",
            marginBottom: "14px",
          }}
        >
          {name}
        </h1>

        {/* Meta row */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "14px",
            flexWrap: "wrap",
            marginBottom: "14px",
          }}
        >
          {rating && (
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="#f5c518">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
              <span
                style={{
                  fontWeight: 500,
                  color: "#f5c518",
                  fontFamily: "var(--font-display)",
                  fontSize: "18px",
                }}
              >
                {rating}
              </span>
            </div>
          )}
          {film.year && (
            <span style={{ color: "var(--text-dim)", fontSize: "14px" }}>
              {film.year}
            </span>
          )}
          {film.filmLength && (
            <span style={{ color: "var(--text-dim)", fontSize: "14px" }}>
              {film.filmLength.toString().split(":")[0]}h{" "}
              {film.filmLength.toString().split(":")[1]}m
            </span>
          )}
          {film.ratingAgeLimits && (
            <span
              style={{
                border: "1px solid rgba(255,255,255,0.28)",
                borderRadius: "4px",
                padding: "2px 7px",
                fontSize: "12px",
                color: "var(--text-dim)",
              }}
            >
              {film.ratingAgeLimits.replace("age", "")}+
            </span>
          )}
          {film.ratingMpaa && (
            <span
              style={{
                border: "1px solid rgba(255,255,255,0.28)",
                borderRadius: "4px",
                padding: "2px 7px",
                fontSize: "12px",
                color: "var(--text-dim)",
              }}
            >
              {film.ratingMpaa}
            </span>
          )}
        </div>

        {/* Genres and Countries */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 8,
            marginBottom: "18px",
          }}
        >
          {film.genres?.slice(0, 4).map((g) => (
            <span
              key={g.genre}
              className="tag tag-dim"
              style={{ fontSize: "12px" }}
            >
              {translateGenre(g.genre)}
            </span>
          ))}
          {film.countries?.slice(0, 4).map((c) => (
            <span
              key={c.country}
              className="tag tag-dim"
              style={{ fontSize: "12px" }}
            >
              {translateCountry(c.country)}
            </span>
          ))}
        </div>

        {/* Description */}
        {desc && (
          <p
            style={{
              fontSize: "clamp(13px, 1.5vw, 15px)",
              lineHeight: 1.7,
              color: "rgba(240,240,240,0.75)",
              marginBottom: "26px",
              display: "-webkit-box",
              WebkitLineClamp: 3,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {desc}
          </p>
        )}

        {/* Buttons */}
        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
          <Link href={`/film/${id}`} style={{ textDecoration: "none" }}>
            <button
              className="btn btn-primary"
              style={{ fontSize: "15px", padding: "14px 28px" }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
              Watch Now
            </button>
          </Link>
          <Link href={`/film/${id}`} style={{ textDecoration: "none" }}>
            <button
              className="btn btn-secondary"
              style={{ fontSize: "15px", padding: "14px 28px" }}
            >
              <svg
                width="16"
                height="16"
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
  );
}
