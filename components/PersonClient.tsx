"use client";
import { useEffect, useState } from "react";
import { getPerson } from "@/lib/kinopoisk";
import { PersonDetail, PersonFilm } from "@/types/kinopoisk";
import Link from "next/link";

const PROF_LABELS: Record<string, string> = {
  ACTOR: "Actor", DIRECTOR: "Director", WRITER: "Writer",
  PRODUCER: "Producer", COMPOSER: "Composer", EDITOR: "Editor",
  OPERATOR: "Cinematographer", DESIGN: "Production Design",
  VOICE_DIRECTOR: "Voice Director", UNKNOWN: "",
};

const PROF_ORDER = ["ACTOR", "DIRECTOR", "WRITER", "PRODUCER", "COMPOSER", "OPERATOR", "DESIGN", "EDITOR", "VOICE_DIRECTOR"];

export default function PersonClient({ personId }: { personId: string }) {
  const id = parseInt(personId);
  const [person, setPerson] = useState<PersonDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [activeProf, setActiveProf] = useState<string>("ALL");
  const [showSpoilers, setShowSpoilers] = useState(false);

  useEffect(() => {
    if (isNaN(id)) { setError(true); setLoading(false); return; }
    setLoading(true);
    getPerson(id)
      .then(p => setPerson(p))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <LoadingSkeleton />;
  if (error || !person) return (
    <div style={{ minHeight: "80vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16 }}>
      <p style={{ fontSize: "22px", fontFamily: "var(--font-display)" }}>Person not found</p>
      <Link href="/" style={{ color: "var(--accent)" }}>← Back to home</Link>
    </div>
  );

  const name = person.nameEn || person.nameRu || "Unknown";
  const allFilms = person.films || [];

  // BUG FIX: The original code filtered with `&& f.general` which hides most films.
  // `general` flag just means it's a notable credit — we show ALL films and let user filter.
  // Sort by rating desc, then group by profession key
  const sortFilms = (films: PersonFilm[]) =>
    [...films].sort((a, b) => (parseFloat(b.rating || "0") || 0) - (parseFloat(a.rating || "0") || 0));

  // Build available profession tabs from actual data
  const profGroups: Record<string, PersonFilm[]> = {};
  for (const film of allFilms) {
    const key = film.professionKey || "UNKNOWN";
    if (!profGroups[key]) profGroups[key] = [];
    profGroups[key].push(film);
  }

  const availableProfs = PROF_ORDER.filter(p => profGroups[p]?.length > 0);
  const otherProfs = Object.keys(profGroups).filter(p => !PROF_ORDER.includes(p) && profGroups[p].length > 0);

  const displayedFilms = activeProf === "ALL"
    ? sortFilms(allFilms)
    : sortFilms(profGroups[activeProf] || []);

  const profession = person.profession ||
    (availableProfs[0] ? PROF_LABELS[availableProfs[0]] : "");

  return (
    <div style={{ minHeight: "100vh", paddingBottom: 80 }}>
      {/* Hero */}
      <div style={{
        background: "linear-gradient(to bottom, var(--bg-card), var(--bg))",
        borderBottom: "1px solid var(--border)",
        padding: "40px clamp(16px,4vw,48px) 40px",
        marginBottom: 40,
      }}>
        <button onClick={() => window.history.back()}
          style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer", fontSize: "13px", marginBottom: 24, padding: 0 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M15 18l-6-6 6-6" /></svg>
          Back
        </button>

        <div style={{ display: "flex", gap: "clamp(20px,4vw,40px)", alignItems: "flex-start", flexWrap: "wrap" }}>
          {/* Photo */}
          <div style={{
            width: "clamp(120px,20vw,200px)", flexShrink: 0,
            borderRadius: "var(--radius-lg)", overflow: "hidden",
            border: "1px solid var(--border)",
            boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
          }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={person.posterUrl || ""}
              alt={name}
              style={{ width: "100%", aspectRatio: "2/3", objectFit: "cover", display: "block", background: "var(--surface)" }}
              onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
          </div>

          {/* Info */}
          <div style={{ flex: 1, minWidth: 0 }}>
            {profession && (
              <p style={{ fontSize: "12px", color: "var(--accent)", textTransform: "uppercase", letterSpacing: "1.5px", fontWeight: 600, marginBottom: 8 }}>
                {profession}
              </p>
            )}
            <h1 style={{
              fontFamily: "var(--font-display)",
              fontSize: "clamp(36px,6vw,64px)",
              letterSpacing: "2px", lineHeight: 1,
              marginBottom: 16,
            }}>{name}</h1>
            {person.nameRu && person.nameRu !== name && (
              <p style={{ fontSize: "14px", color: "var(--text-muted)", marginBottom: 16, fontStyle: "italic" }}>{person.nameRu}</p>
            )}

            <div style={{ display: "flex", gap: 24, flexWrap: "wrap", marginBottom: 16 }}>
              {person.sex && person.sex !== "UNKNOWN" && (
                <InfoItem label="Gender" value={person.sex === "MALE" ? "Male" : "Female"} />
              )}
              {person.birthday && (
                <InfoItem label="Born" value={new Date(person.birthday).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })} />
              )}
              {person.birthplace && <InfoItem label="From" value={person.birthplace} />}
              {person.age && !person.death && <InfoItem label="Age" value={String(person.age)} />}
              {person.death && (
                <InfoItem label="Died" value={new Date(person.death).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })} />
              )}
              {person.deathplace && <InfoItem label="Died in" value={person.deathplace} />}
              {person.hasAwards !== undefined && person.hasAwards > 0 && (
                <InfoItem label="Awards" value={`${person.hasAwards}`} />
              )}
              <InfoItem label="Total Credits" value={String(allFilms.length)} />
            </div>

            {/* Spouses */}
            {person.spouses && person.spouses.length > 0 && (
              <div style={{ marginTop: 8 }}>
                <p style={{ fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 6 }}>Relationships</p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {person.spouses.map((s, i) => (
                    <span key={i} style={{
                      fontSize: "12px", color: "var(--text-dim)",
                      background: "var(--bg-card)", border: "1px solid var(--border)",
                      borderRadius: "6px", padding: "4px 10px",
                    }}>
                      {s.name || "Unknown"}{s.divorced ? " (divorced)" : ""}
                      {s.children ? ` · ${s.children} child${s.children !== 1 ? "ren" : ""}` : ""}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Facts */}
            {person.facts && person.facts.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <p style={{ fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 6 }}>
                  Facts
                </p>
                <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: 6 }}>
                  {person.facts.slice(0, 3).map((fact, i) => (
                    <li key={i} style={{
                      fontSize: "13px", color: "var(--text-dim)",
                      lineHeight: 1.6,
                      paddingLeft: 12,
                      borderLeft: "2px solid var(--accent)",
                    }}
                      dangerouslySetInnerHTML={{ __html: fact }}
                    />
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Filmography */}
      <div style={{ padding: "0 clamp(16px,4vw,48px)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 24 }}>
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(22px,3vw,30px)", letterSpacing: "1.5px" }}>
            FILMOGRAPHY
          </h2>
          <span style={{ fontSize: "13px", color: "var(--text-muted)" }}>
            {displayedFilms.length} credit{displayedFilms.length !== 1 ? "s" : ""}
          </span>
        </div>

        {/* Profession tabs */}
        <div style={{ display: "flex", gap: 6, marginBottom: 28, flexWrap: "wrap" }}>
          <ProfTab
            label={`All (${allFilms.length})`}
            active={activeProf === "ALL"}
            onClick={() => setActiveProf("ALL")}
          />
          {availableProfs.map(p => (
            <ProfTab
              key={p}
              label={`${PROF_LABELS[p] || p} (${profGroups[p].length})`}
              active={activeProf === p}
              onClick={() => setActiveProf(p)}
            />
          ))}
          {otherProfs.map(p => (
            <ProfTab
              key={p}
              label={`${PROF_LABELS[p] || p} (${profGroups[p].length})`}
              active={activeProf === p}
              onClick={() => setActiveProf(p)}
            />
          ))}
        </div>

        {displayedFilms.length === 0 ? (
          <p style={{ color: "var(--text-muted)", fontSize: "15px" }}>No credits in this category.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
            {displayedFilms.map((film, i) => (
              <FilmEntry key={`${film.filmId}-${i}`} film={film} showSpoilers={showSpoilers} />
            ))}
          </div>
        )}

        {/* Spoiler toggle (for facts section if ever added here) */}
        <button
          onClick={() => setShowSpoilers(v => !v)}
          style={{
            marginTop: 24, fontSize: "12px", color: "var(--text-muted)",
            background: "none", border: "none", cursor: "pointer", padding: 0,
            textDecoration: "underline",
          }}
        >
          {showSpoilers ? "Hide character spoilers" : "Show character spoilers"}
        </button>
      </div>
    </div>
  );
}

function ProfTab({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "8px 16px", borderRadius: "8px", fontSize: "13px", fontWeight: 600,
        cursor: "pointer", fontFamily: "var(--font-body)", transition: "all var(--transition)",
        background: active ? "var(--accent)" : "var(--bg-elevated)",
        color: active ? "white" : "var(--text-dim)",
        border: `1px solid ${active ? "var(--accent)" : "var(--border)"}`,
      }}
    >
      {label}
    </button>
  );
}

function FilmEntry({ film, showSpoilers }: { film: PersonFilm; showSpoilers: boolean }) {
  const name = film.nameEn || film.nameRu || "Unknown";
  const rating = parseFloat(film.rating || "0") || null;
  const profLabel = film.professionKey ? (
    { ACTOR: "Actor", DIRECTOR: "Director", WRITER: "Writer", PRODUCER: "Producer",
      COMPOSER: "Composer", OPERATOR: "DOP", DESIGN: "Prod. Design", EDITOR: "Editor" }[film.professionKey] || film.professionKey
  ) : null;

  return (
    <Link href={`/film/${film.filmId}`} style={{ textDecoration: "none" }}>
      <div
        style={{
          display: "flex", alignItems: "center", gap: 16,
          padding: "14px 16px", borderRadius: "10px",
          border: "1px solid transparent", transition: "all 0.18s ease",
        }}
        onMouseEnter={e => {
          (e.currentTarget as HTMLElement).style.background = "var(--bg-card)";
          (e.currentTarget as HTMLElement).style.borderColor = "var(--border)";
          (e.currentTarget as HTMLElement).style.transform = "translateX(4px)";
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLElement).style.background = "transparent";
          (e.currentTarget as HTMLElement).style.borderColor = "transparent";
          (e.currentTarget as HTMLElement).style.transform = "translateX(0)";
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <p style={{ fontSize: "15px", fontWeight: 600, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {name}
            </p>
            {profLabel && (
              <span style={{
                fontSize: "10px", color: "var(--text-muted)",
                background: "var(--surface)", borderRadius: "4px",
                padding: "2px 6px", flexShrink: 0,
              }}>{profLabel}</span>
            )}
            {!film.general && (
              <span style={{
                fontSize: "10px", color: "var(--text-muted)",
                background: "var(--bg-elevated)", borderRadius: "4px",
                padding: "2px 6px", flexShrink: 0,
              }}>minor</span>
            )}
          </div>
          {film.description && showSpoilers && (
            <p style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: 2, fontStyle: "italic" }}>
              as {film.description}
            </p>
          )}
          {film.description && !showSpoilers && (
            <p style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: 2, fontStyle: "italic" }}>
              {film.description.length > 40 ? film.description.slice(0, 40) + "…" : film.description}
            </p>
          )}
        </div>
        {rating && rating > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="#f5c518">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
            <span style={{ fontFamily: "var(--font-display)", fontSize: "16px", color: "#f5c518", fontWeight: 700 }}>{rating.toFixed(1)}</span>
          </div>
        )}
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" style={{ flexShrink: 0 }}>
          <path d="M9 18l6-6-6-6" />
        </svg>
      </div>
    </Link>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p style={{ fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 2 }}>{label}</p>
      <p style={{ fontSize: "14px", color: "var(--text-dim)", fontWeight: 500 }}>{value}</p>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div style={{ minHeight: "100vh", padding: "40px clamp(16px,4vw,48px)" }}>
      <div className="skeleton" style={{ height: 22, width: 80, borderRadius: 6, marginBottom: 24 }} />
      <div style={{ display: "flex", gap: 40 }}>
        <div className="skeleton" style={{ width: 200, aspectRatio: "2/3", borderRadius: 12, flexShrink: 0 }} />
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="skeleton" style={{ height: 48, width: "60%", borderRadius: 8 }} />
          <div className="skeleton" style={{ height: 20, width: "40%", borderRadius: 8 }} />
          <div style={{ display: "flex", gap: 24, marginTop: 16 }}>
            {[1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: 40, width: 120, borderRadius: 8 }} />)}
          </div>
        </div>
      </div>
    </div>
  );
}
