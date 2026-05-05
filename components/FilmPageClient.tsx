"use client";
import { useEffect, useState } from "react";
import { getFilm, getFilmStaff, getRelatedFilms } from "@/lib/kinopoisk";
import { Film, Staff } from "@/types/kinopoisk";
import { getEnglishName, translateGenre, translateCountry } from "@/lib/translate";
import { useTranslate } from "@/hooks/useTranslate";
import PlayerSection from "@/components/PlayerSection";
import ActorCard from "@/components/ActorCard";
import FilmCard from "@/components/FilmCard";
import Link from "next/link";

export default function FilmPageClient({ filmId }: { filmId: string }) {
  const id = parseInt(filmId);
  const [film,    setFilm]    = useState<Film | null>(null);
  const [staff,   setStaff]   = useState<Staff[]>([]);
  const [related, setRelated] = useState<Film[]>([]);
  const [loading, setLoading] = useState(!isNaN(id));
  const [error,   setError]   = useState(isNaN(id));

  console.log(film)

  useEffect(() => {
    if (isNaN(id)) return;

    let mounted = true;

    Promise.resolve().then(() => {
      if (mounted) {
        setLoading(true);
        setError(false);
      }
    });

    window.scrollTo({ top: 0 });

    Promise.all([
      getFilm(id),
      getFilmStaff(id).catch(() => [] as Staff[]),
      getRelatedFilms(id).catch(() => [] as Film[]),
    ])
      .then(([f, s, r]) => {
        if (!mounted) return;
        setFilm(f);
        setStaff(s);
        // Normalize related films (they use filmId not kinopoiskId)
        setRelated(r.map(rf => ({ ...rf, kinopoiskId: rf.kinopoiskId ?? rf.filmId ?? 0 })));
      })
      .catch(() => {
        if (mounted) setError(true);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [id]);

  if (loading) return <LoadingSkeleton />;
  if (error || !film) return <ErrorState />;

  return <FilmDetail film={film} staff={staff} related={related} filmId={id} />;
}

function FilmDetail({ film, staff, related, filmId }: { film: Film; staff: Staff[]; related: Film[]; filmId: number }) {
  const name        = getEnglishName(film.nameRu, film.nameEn, film.nameOriginal);
  const description = useTranslate(film.description);
  const slogan      = useTranslate(film.slogan);

  const directors = staff.filter(s => s.professionKey === "DIRECTOR").slice(0, 3);
  const actors    = staff.filter(s => s.professionKey === "ACTOR").slice(0, 16);
  const writers   = staff.filter(s => s.professionKey === "WRITER").slice(0, 3);
  const producers = staff.filter(s => s.professionKey === "PRODUCER").slice(0, 3);

  const directorNames = directors.map(d => d.nameEn || d.nameRu || "").filter(Boolean).join(", ");
  const writerNames   = writers.map(w => w.nameEn || w.nameRu || "").filter(Boolean).join(", ");
  const producerNames = producers.map(p => p.nameEn || p.nameRu || "").filter(Boolean).join(", ");

  const displayYear = film.serial
    ? `${film.startYear || film.year}${film.endYear ? ` – ${film.endYear}` : film.completed === false ? " – present" : ""}`
    : String(film.year || "");

  return (
    <div style={{ minHeight: "100vh" }}>
      <PlayerSection filmId={filmId} film={film} />

      <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "clamp(24px,4vw,48px) clamp(16px,4vw,24px)" }}>
        <div className="film-detail-grid" style={{ display: "grid", gridTemplateColumns: "260px 1fr", gap: "clamp(24px,4vw,48px)" }}>

          {/* Left: Poster + Ratings */}
          <div className="film-poster-col">
            <div style={{ borderRadius: "var(--radius-lg)", overflow: "hidden", border: "1px solid var(--border)", boxShadow: "0 8px 40px rgba(0,0,0,0.6)" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={film.posterUrl} alt={name} style={{ width: "100%", display: "block" }}
                onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
            </div>
            <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 10 }}>
              {film.ratingKinopoisk && <RatingBadge label="Kinopoisk" value={film.ratingKinopoisk} color="#e50914" />}
              {film.ratingImdb      && <RatingBadge label="IMDb"       value={film.ratingImdb}       color="#f5c518" />}
            </div>
          </div>

          {/* Right: Film info */}
          <div>
            <h1 style={{
              fontFamily: "var(--font-display)",
              fontSize: "clamp(32px, 5vw, 52px)",
              lineHeight: 1.05, letterSpacing: "1px",
              color: "white", marginBottom: 8,
            }}>{name}</h1>

            {/* Original name subtitle if different */}
            {film.nameRu && film.nameRu !== name && (
              <p style={{ fontSize: "14px", color: "var(--text-muted)", marginBottom: 16, fontStyle: "italic" }}>{film.nameRu}</p>
            )}

            {/* Meta tags */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 20 }}>
              {displayYear && <MetaTag>{displayYear}</MetaTag>}
              {film.filmLength && <MetaTag>{Math.floor(film.filmLength / 60)}h {film.filmLength % 60}m</MetaTag>}
              {film.ratingAgeLimits && <MetaTag accent>{film.ratingAgeLimits.replace("age", "")}+</MetaTag>}
              {film.ratingMpaa && <MetaTag >{film.ratingMpaa}</MetaTag>}
              {film.countries?.slice(0, 3).map(c => <MetaTag key={c.country}>{translateCountry(c.country)}</MetaTag>)}
              {film.type && film.type !== "FILM" && (
                <MetaTag accent>{film.type === "TV_SERIES" ? "TV Series" : film.type === "TV_SHOW" ? "TV Show" : film.type}</MetaTag>
              )}
            </div>

            {/* Genres */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 24 }}>
              {film.genres?.map(g => (
                <Link key={g.genre} href={`/browse?type=ALL`} style={{ textDecoration: "none" }}>
                  <span className="tag tag-accent" style={{ cursor: "pointer", textTransform: "capitalize" }}>
                    {translateGenre(g.genre)}
                  </span>
                </Link>
              ))}
            </div>

            {/* Slogan */}
            {slogan && (
              <p style={{
                fontStyle: "italic", color: "var(--text-dim)",
                borderLeft: "3px solid var(--accent)", paddingLeft: 16,
                marginBottom: 24, fontSize: "15px",
              }}>&ldquo;{slogan}&rdquo;</p>
            )}

            {/* Description */}
            {description && (
              <div style={{ marginBottom: 28 }}>
                <h3 style={{
                  fontFamily: "var(--font-display)", fontSize: "16px",
                  letterSpacing: "1.5px", marginBottom: 10, color: "var(--text-dim)",
                  textTransform: "uppercase",
                }}>About</h3>
                <p style={{ fontSize: "15px", lineHeight: 1.8, color: "rgba(240,240,240,0.82)" }}>{description}</p>
              </div>
            )}

            {/* Info rows */}
            {directorNames && <InfoRow label="Director" value={directorNames} />}
            {writerNames   && <InfoRow label="Writers"  value={writerNames} />}
            {producerNames && <InfoRow label="Producers" value={producerNames} />}
          </div>
        </div>

        {/* Cast */}
        {actors.length > 0 && (
          <div style={{ marginTop: 48 }}>
            <h2 style={{
              fontFamily: "var(--font-display)", fontSize: "clamp(20px,3vw,28px)",
              letterSpacing: "1.5px", marginBottom: 24,
            }}>CAST</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: 16 }}>
              {actors.map((actor, i) => <ActorCard key={actor.staffId ?? i} actor={actor} />)}
            </div>
          </div>
        )}

        {/* Related films */}
        {related.length > 0 && (
          <div style={{ marginTop: 48 }}>
            <h2 style={{
              fontFamily: "var(--font-display)", fontSize: "clamp(20px,3vw,28px)",
              letterSpacing: "1.5px", marginBottom: 24,
            }}>SEQUELS & PREQUELS</h2>
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
              {related.map((rf, i) => <FilmCard key={rf.kinopoiskId ?? i} film={rf} variant="scroll" size="sm" />)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function RatingBadge({ label, value, color }: { label: string; value: number; color: string }) {
  const pct = Math.round((value / 10) * 100);
  return (
    <div style={{
      background: "var(--bg-card)", border: "1px solid var(--border)",
      borderRadius: "var(--radius)", padding: "14px 16px",
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <span style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: 500 }}>{label}</span>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill={color}>
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
          </svg>
          <span style={{ fontWeight: 700, color, fontFamily: "var(--font-display)", fontSize: "20px" }}>
            {value.toFixed(1)}
          </span>
        </div>
      </div>
      <div style={{ height: 3, background: "var(--surface)", borderRadius: "99px", overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: "99px", transition: "width 1s ease" }} />
      </div>
    </div>
  );
}

function MetaTag({ children, accent }: { children: React.ReactNode; accent?: boolean }) {
  return (
    <span className={accent ? "tag tag-accent" : "tag tag-dim"}>{children}</span>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", gap: 12, marginBottom: 10, alignItems: "flex-start" }}>
      <span style={{
        fontSize: "12px", color: "var(--text-muted)", width: 82,
        flexShrink: 0, fontWeight: 600, textTransform: "uppercase",
        letterSpacing: "0.5px", paddingTop: 2,
      }}>{label}</span>
      <span style={{ fontSize: "14px", color: "var(--text-dim)", lineHeight: 1.5 }}>{value}</span>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div style={{ minHeight: "100vh", paddingBottom: 48 }}>
      <div className="skeleton" style={{ width: "100%", paddingTop: "min(56.25%, 75vh)" }} />
      <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "48px 24px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", gap: 48 }}>
          <div className="skeleton" style={{ aspectRatio: "2/3", borderRadius: 12 }} />
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div className="skeleton" style={{ height: 48, width: "70%", borderRadius: 8 }} />
            <div className="skeleton" style={{ height: 20, width: "40%", borderRadius: 8 }} />
            <div className="skeleton" style={{ height: 100, width: "100%", borderRadius: 8, marginTop: 16 }} />
            <div className="skeleton" style={{ height: 60, width: "100%", borderRadius: 8 }} />
          </div>
        </div>
      </div>
    </div>
  );
}

function ErrorState() {
  return (
    <div style={{ minHeight: "80vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16 }}>
      <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.5">
        <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>
      <p style={{ fontSize: "22px", fontFamily: "var(--font-display)", letterSpacing: "1px" }}>Film not found</p>
      <p style={{ fontSize: "14px", color: "var(--text-muted)" }}>The requested film could not be loaded.</p>
      <Link href="/" style={{ color: "var(--accent)", fontSize: "14px", marginTop: 8 }}>← Back to home</Link>
    </div>
  );
}
