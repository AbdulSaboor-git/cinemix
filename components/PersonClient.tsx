"use client";
import { useEffect, useState } from "react";
import { getPerson } from "@/lib/kinopoisk";
import { PersonDetail, PersonFilm } from "@/types/kinopoisk";
import Link from "next/link";
import { getEnglishName } from "@/lib/translate";

const PROF_LABELS: Record<string, string> = {
  ACTOR: "Actor",
  DIRECTOR: "Director",
  WRITER: "Writer",
  PRODUCER: "Producer",
  COMPOSER: "Composer",
  EDITOR: "Editor",
  OPERATOR: "Cinematographer",
  DESIGN: "Production Design",
  VOICE_DIRECTOR: "Voice Director",
  UNKNOWN: "",
};

export default function PersonClient({ personId }: { personId: string }) {
  const id = parseInt(personId);
  const [person, setPerson] = useState<PersonDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [tab, setTab] = useState<"actor" | "director" | "all">("actor");

  useEffect(() => {
    if (isNaN(id)) {
      setError(true);
      setLoading(false);
      return;
    }
    setLoading(true);
    getPerson(id)
      .then((p) => setPerson(p))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <LoadingSkeleton />;
  if (error || !person)
    return (
      <div
        style={{
          minHeight: "80vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 16,
        }}
      >
        <p style={{ fontSize: "22px", fontFamily: "var(--font-display)" }}>
          Person not found
        </p>
        <Link href="/" style={{ color: "var(--accent)" }}>
          ← Back to home
        </Link>
      </div>
    );

  const name = person.nameEn || person.nameRu || "Unknown";
  const films = person.films || [];

  const actorFilms = films.filter(
    (f) => f.professionKey === "ACTOR" && f.general,
  );
  const directorFilms = films.filter(
    (f) => f.professionKey === "DIRECTOR" && f.general,
  );

  const tabFilms =
    tab === "actor"
      ? actorFilms
      : tab === "director"
        ? directorFilms
        : films.filter((f) => f.general);
  const sortedFilms = [...tabFilms].sort((a, b) => {
    const rA = parseFloat(a.rating || "0") || 0;
    const rB = parseFloat(b.rating || "0") || 0;
    return rB - rA;
  });

  const profession =
    person.profession ||
    (actorFilms.length > 0
      ? "Actor"
      : directorFilms.length > 0
        ? "Director"
        : "");

  return (
    <div style={{ minHeight: "100vh", paddingBottom: 80 }}>
      {/* Hero section */}
      <div
        style={{
          background: "linear-gradient(to bottom, var(--bg-card), var(--bg))",
          borderBottom: "1px solid var(--border)",
          padding: "40px clamp(16px,4vw,48px) 40px",
          marginBottom: 40,
        }}
      >
        <button
          onClick={() => window.history.back()}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            color: "var(--text-muted)",
            background: "none",
            border: "none",
            cursor: "pointer",
            fontSize: "13px",
            marginBottom: 24,
            padding: 0,
          }}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
          >
            <path d="M15 18l-6-6 6-6" />
          </svg>
          Back
        </button>

        <div
          style={{
            display: "flex",
            gap: "clamp(20px,4vw,40px)",
            alignItems: "flex-start",
            flexWrap: "wrap",
          }}
        >
          {/* Photo */}
          <div
            style={{
              width: "clamp(120px,20vw,200px)",
              flexShrink: 0,
              borderRadius: "var(--radius-lg)",
              overflow: "hidden",
              border: "1px solid var(--border)",
              boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={person.posterUrl || ""}
              alt={name}
              style={{
                width: "100%",
                aspectRatio: "2/3",
                objectFit: "cover",
                display: "block",
                background: "var(--surface)",
              }}
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
                (
                  (e.target as HTMLImageElement).parentElement as HTMLElement
                ).style.display = "flex";
                (
                  (e.target as HTMLImageElement).parentElement as HTMLElement
                ).style.alignItems = "center";
                (
                  (e.target as HTMLImageElement).parentElement as HTMLElement
                ).style.justifyContent = "center";
                (
                  (e.target as HTMLImageElement).parentElement as HTMLElement
                ).style.aspectRatio = "2/3";
              }}
            />
          </div>

          {/* Info */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <p
              style={{
                fontSize: "12px",
                color: "var(--accent)",
                textTransform: "uppercase",
                letterSpacing: "1.5px",
                fontWeight: 600,
                marginBottom: 8,
              }}
            >
              {profession}
            </p>
            <h1
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "clamp(36px,6vw,64px)",
                letterSpacing: "2px",
                lineHeight: 1,
                marginBottom: 16,
              }}
            >
              {name}
            </h1>
            {person.nameRu && person.nameRu !== name && (
              <p
                style={{
                  fontSize: "14px",
                  color: "var(--text-muted)",
                  marginBottom: 16,
                  fontStyle: "italic",
                }}
              >
                {person.nameRu}
              </p>
            )}

            <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
              {person.birthday && (
                <InfoItem
                  label="Born"
                  value={new Date(person.birthday).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                />
              )}
              {person.birthplace && (
                <InfoItem label="From" value={person.birthplace} />
              )}
              {person.age && !person.death && (
                <InfoItem label="Age" value={String(person.age)} />
              )}
              {person.death && (
                <InfoItem
                  label="Died"
                  value={new Date(person.death).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                />
              )}
              <InfoItem label="Films" value={String(films.length)} />
            </div>
          </div>
        </div>
      </div>

      {/* Filmography */}
      <div style={{ padding: "0 clamp(16px,4vw,48px)" }}>
        <h2
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "clamp(22px,3vw,30px)",
            letterSpacing: "1.5px",
            marginBottom: 24,
          }}
        >
          FILMOGRAPHY
        </h2>

        {/* Tabs */}
        {(actorFilms.length > 0 || directorFilms.length > 0) && (
          <div
            style={{
              display: "flex",
              gap: 6,
              marginBottom: 28,
              flexWrap: "wrap",
            }}
          >
            {actorFilms.length > 0 && (
              <button
                onClick={() => setTab("actor")}
                style={{
                  padding: "8px 16px",
                  borderRadius: "8px",
                  fontSize: "13px",
                  fontWeight: 600,
                  cursor: "pointer",
                  fontFamily: "var(--font-body)",
                  transition: "all var(--transition)",
                  background:
                    tab === "actor" ? "var(--accent)" : "var(--bg-elevated)",
                  color: tab === "actor" ? "white" : "var(--text-dim)",
                  border: `1px solid ${tab === "actor" ? "var(--accent)" : "var(--border)"}`,
                }}
              >
                Actor ({actorFilms.length})
              </button>
            )}
            {directorFilms.length > 0 && (
              <button
                onClick={() => setTab("director")}
                style={{
                  padding: "8px 16px",
                  borderRadius: "8px",
                  fontSize: "13px",
                  fontWeight: 600,
                  cursor: "pointer",
                  fontFamily: "var(--font-body)",
                  transition: "all var(--transition)",
                  background:
                    tab === "director" ? "var(--accent)" : "var(--bg-elevated)",
                  color: tab === "director" ? "white" : "var(--text-dim)",
                  border: `1px solid ${tab === "director" ? "var(--accent)" : "var(--border)"}`,
                }}
              >
                Director ({directorFilms.length})
              </button>
            )}
            <button
              onClick={() => setTab("all")}
              style={{
                padding: "8px 16px",
                borderRadius: "8px",
                fontSize: "13px",
                fontWeight: 600,
                cursor: "pointer",
                fontFamily: "var(--font-body)",
                transition: "all var(--transition)",
                background:
                  tab === "all" ? "var(--bg-elevated)" : "transparent",
                color: tab === "all" ? "white" : "var(--text-dim)",
                border: `1px solid ${tab === "all" ? "var(--border)" : "transparent"}`,
              }}
            >
              All
            </button>
          </div>
        )}

        {sortedFilms.length === 0 ? (
          <p style={{ color: "var(--text-muted)", fontSize: "15px" }}>
            No films available.
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
            {sortedFilms.map((film, i) => (
              <FilmEntry key={i} film={film} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function FilmEntry({ film }: { film: PersonFilm }) {
  const name = film.nameEn || film.nameRu || "Unknown";
  const rating = parseFloat(film.rating || "0") || null;

  return (
    <Link href={`/film/${film.filmId}`} style={{ textDecoration: "none" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 16,
          padding: "14px 16px",
          borderRadius: "10px",
          border: "1px solid transparent",
          transition: "all 0.18s ease",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLElement).style.background = "var(--bg-card)";
          (e.currentTarget as HTMLElement).style.borderColor = "var(--border)";
          (e.currentTarget as HTMLElement).style.transform = "translateX(4px)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.background = "transparent";
          (e.currentTarget as HTMLElement).style.borderColor = "transparent";
          (e.currentTarget as HTMLElement).style.transform = "translateX(0)";
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <p
            style={{
              fontSize: "15px",
              fontWeight: 600,
              color: "var(--text)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {name}
          </p>
          {film.description && (
            <p
              style={{
                fontSize: "12px",
                color: "var(--text-muted)",
                marginTop: 2,
                fontStyle: "italic",
              }}
            >
              {film.description}
            </p>
          )}
        </div>
        {rating && rating > 0 && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              flexShrink: 0,
            }}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="#f5c518">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
            <span
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "16px",
                color: "#f5c518",
                fontWeight: 700,
              }}
            >
              {rating.toFixed(1)}
            </span>
          </div>
        )}
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--text-muted)"
          strokeWidth="2"
          style={{ flexShrink: 0 }}
        >
          <path d="M9 18l6-6-6-6" />
        </svg>
      </div>
    </Link>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p
        style={{
          fontSize: "11px",
          color: "var(--text-muted)",
          textTransform: "uppercase",
          letterSpacing: "0.8px",
          marginBottom: 2,
        }}
      >
        {label}
      </p>
      <p
        style={{ fontSize: "14px", color: "var(--text-dim)", fontWeight: 500 }}
      >
        {value}
      </p>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div style={{ minHeight: "100vh", padding: "40px clamp(16px,4vw,48px)" }}>
      <div
        className="skeleton"
        style={{ height: 22, width: 80, borderRadius: 6, marginBottom: 24 }}
      />
      <div style={{ display: "flex", gap: 40 }}>
        <div
          className="skeleton"
          style={{
            width: 200,
            aspectRatio: "2/3",
            borderRadius: 12,
            flexShrink: 0,
          }}
        />
        <div
          style={{ flex: 1, display: "flex", flexDirection: "column", gap: 16 }}
        >
          <div
            className="skeleton"
            style={{ height: 48, width: "60%", borderRadius: 8 }}
          />
          <div
            className="skeleton"
            style={{ height: 20, width: "40%", borderRadius: 8 }}
          />
          <div style={{ display: "flex", gap: 24, marginTop: 16 }}>
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="skeleton"
                style={{ height: 40, width: 120, borderRadius: 8 }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
