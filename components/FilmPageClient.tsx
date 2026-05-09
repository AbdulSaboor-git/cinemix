"use client";
import { useEffect, useState } from "react";
import {
  getFilm, getFilmStaff, getRelatedFilms, getFilmFacts,
  getFilmBoxOffice, getFilmSeasons, getSimilarFilms, getFilmReviews
} from "@/lib/kinopoisk";
import { Film, Staff, Fact, BoxOfficeItem, Season, SimilarFilm, Review } from "@/types/kinopoisk";
import { getEnglishName, translateGenre, translateCountry } from "@/lib/translate";
import { useTranslate } from "@/hooks/useTranslate";
import PlayerSection from "@/components/PlayerSection";
import ActorCard from "@/components/ActorCard";
import FilmCard from "@/components/FilmCard";
import Link from "next/link";

export default function FilmPageClient({ filmId }: { filmId: string }) {
  const id = parseInt(filmId);
  const [film,      setFilm]      = useState<Film | null>(null);
  const [staff,     setStaff]     = useState<Staff[]>([]);
  const [related,   setRelated]   = useState<Film[]>([]);
  const [facts,     setFacts]     = useState<Fact[]>([]);
  const [boxOffice, setBoxOffice] = useState<BoxOfficeItem[]>([]);
  const [seasons,   setSeasons]   = useState<Season[]>([]);
  const [similars,  setSimilars]  = useState<SimilarFilm[]>([]);
  const [reviews,   setReviews]   = useState<Review[]>([]);
  const [loading,   setLoading]   = useState(!isNaN(id));
  const [error,     setError]     = useState(isNaN(id));

  useEffect(() => {
    if (isNaN(id)) return;
    let mounted = true;
    setLoading(true);
    setError(false);
    window.scrollTo({ top: 0 });

    // Core data first
    Promise.all([
      getFilm(id),
      getFilmStaff(id).catch(() => [] as Staff[]),
      getRelatedFilms(id).catch(() => [] as Film[]),
    ]).then(([f, s, r]) => {
      if (!mounted) return;
      setFilm(f);
      setStaff(s);
      setRelated(r);
      setLoading(false);

      // Load extra data in background (non-blocking)
      getFilmFacts(id).then(d => mounted && setFacts(d.items || [])).catch(() => {});
      getFilmBoxOffice(id).then(d => mounted && setBoxOffice(d.items || [])).catch(() => {});
      getSimilarFilms(id).then(d => mounted && setSimilars(d.items || [])).catch(() => {});
      getFilmReviews(id).then(d => mounted && setReviews(d.items || [])).catch(() => {});
      // Load seasons only for serials
      if (f.serial || f.type === "TV_SERIES" || f.type === "MINI_SERIES") {
        getFilmSeasons(id).then(d => mounted && setSeasons(d.items || [])).catch(() => {});
      }
    }).catch(() => {
      if (mounted) { setError(true); setLoading(false); }
    });

    return () => { mounted = false; };
  }, [id]);

  if (loading) return <LoadingSkeleton />;
  if (error || !film) return <ErrorState />;

  return <FilmDetail film={film} staff={staff} related={related} filmId={id}
    facts={facts} boxOffice={boxOffice} seasons={seasons} similars={similars} reviews={reviews} />;
}

function FilmDetail({
  film, staff, related, filmId, facts, boxOffice, seasons, similars, reviews
}: {
  film: Film; staff: Staff[]; related: Film[]; filmId: number;
  facts: Fact[]; boxOffice: BoxOfficeItem[]; seasons: Season[]; similars: SimilarFilm[]; reviews: Review[];
}) {
  const name        = getEnglishName(film.nameRu, film.nameEn, film.nameOriginal);
  const description = useTranslate(film.description);
  const slogan      = useTranslate(film.slogan);
  const [reviewsExpanded, setReviewsExpanded] = useState(false);
  const [factsExpanded, setFactsExpanded]     = useState(false);
  const [showSpoilers, setShowSpoilers]       = useState(false);
  const [activeTab, setActiveTab]             = useState<"facts" | "bloopers">("facts");

  const directors = staff.filter(s => s.professionKey === "DIRECTOR").slice(0, 3);
  const actors    = staff.filter(s => s.professionKey === "ACTOR").slice(0, 20);
  const writers   = staff.filter(s => s.professionKey === "WRITER").slice(0, 3);
  const producers = staff.filter(s => s.professionKey === "PRODUCER").slice(0, 3);
  const composers = staff.filter(s => s.professionKey === "COMPOSER").slice(0, 2);

  const directorNames = directors.map(d => d.nameEn || d.nameRu || "").filter(Boolean).join(", ");
  const writerNames   = writers.map(w => w.nameEn || w.nameRu || "").filter(Boolean).join(", ");
  const producerNames = producers.map(p => p.nameEn || p.nameRu || "").filter(Boolean).join(", ");
  const composerNames = composers.map(c => c.nameEn || c.nameRu || "").filter(Boolean).join(", ");

  const displayYear = film.serial
    ? `${film.startYear || film.year}${film.endYear ? ` – ${film.endYear}` : film.completed === false ? " – present" : ""}`
    : String(film.year || "");

  // Budget & box office
  const budget  = boxOffice.find(b => b.type === "BUDGET");
  const usaGross = boxOffice.find(b => b.type === "USA");
  const worldGross = boxOffice.find(b => b.type === "WORLD");

  // Facts split
  const factItems    = facts.filter(f => f.type === "FACT");
  const blooperItems = facts.filter(f => f.type === "BLOOPER");
  const activeFactItems = activeTab === "facts" ? factItems : blooperItems;
  const visibleFacts = factsExpanded ? activeFactItems : activeFactItems.slice(0, 4);

  // Reviews
  const visibleReviews = reviewsExpanded ? reviews : reviews.slice(0, 2);

  // Ratings
  const ratings = [
    film.ratingKinopoisk && { label: "Kinopoisk", value: film.ratingKinopoisk, votes: film.ratingKinopoiskVoteCount, color: "#e50914" },
    film.ratingImdb      && { label: "IMDb",       value: film.ratingImdb,      votes: film.ratingImdbVoteCount,      color: "#f5c518" },
    film.ratingFilmCritics && { label: "Critics",  value: film.ratingFilmCritics, votes: film.ratingFilmCriticsVoteCount, color: "#4a9eff" },
  ].filter(Boolean) as { label: string; value: number; votes?: number; color: string }[];

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

            {/* All ratings */}
            <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 10 }}>
              {ratings.map(r => (
                <RatingBadge key={r.label} label={r.label} value={r.value} votes={r.votes} color={r.color} />
              ))}
              {film.ratingAwait && film.ratingAwait > 0 && (
                <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "10px 14px" }}>
                  <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>Anticipation</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
                    <div style={{ flex: 1, height: 3, background: "var(--surface)", borderRadius: 99 }}>
                      <div style={{ height: "100%", width: `${film.ratingAwait}%`, background: "#a855f7", borderRadius: 99 }} />
                    </div>
                    <span style={{ fontSize: "13px", color: "#a855f7", fontWeight: 700, fontFamily: "var(--font-display)" }}>
                      {film.ratingAwait.toFixed(0)}%
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Box office */}
            {(budget || usaGross || worldGross) && (
              <div style={{ marginTop: 20, background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "14px 16px" }}>
                <p style={{ fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "1px", marginBottom: 10 }}>
                  Box Office
                </p>
                {budget && <BoxRow label="Budget" item={budget} />}
                {usaGross && <BoxRow label="USA Gross" item={usaGross} />}
                {worldGross && <BoxRow label="Worldwide" item={worldGross} />}
              </div>
            )}

            {/* Tech info */}
            <div style={{ marginTop: 16, display: "flex", flexWrap: "wrap", gap: 8 }}>
              {film.hasImax && <span className="tag tag-dim" style={{ fontSize: "11px" }}>IMAX</span>}
              {film.has3D   && <span className="tag tag-dim" style={{ fontSize: "11px" }}>3D</span>}
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

            {film.nameRu && film.nameRu !== name && (
              <p style={{ fontSize: "14px", color: "var(--text-muted)", marginBottom: 16, fontStyle: "italic" }}>{film.nameRu}</p>
            )}
            {film.nameOriginal && film.nameOriginal !== name && film.nameOriginal !== film.nameRu && (
              <p style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: 12, fontStyle: "italic" }}>{film.nameOriginal}</p>
            )}

            {/* Meta tags */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 20 }}>
              {displayYear && <MetaTag>{displayYear}</MetaTag>}
              {film.filmLength && <MetaTag>{Math.floor(film.filmLength / 60)}h {film.filmLength % 60}m</MetaTag>}
              {film.ratingAgeLimits && <MetaTag accent>{film.ratingAgeLimits.replace("age", "")}+</MetaTag>}
              {film.ratingMpaa && <MetaTag>{film.ratingMpaa.toUpperCase()}</MetaTag>}
              {film.countries?.slice(0, 3).map(c => (
                <Link key={c.country} href={`/browse?countries=${encodeURIComponent(c.country)}`} style={{ textDecoration: "none" }}>
                  <MetaTag clickable>{translateCountry(c.country)}</MetaTag>
                </Link>
              ))}
              {film.type && film.type !== "FILM" && (
                <MetaTag accent>
                  {film.type === "TV_SERIES" ? "TV Series" : film.type === "TV_SHOW" ? "TV Show" : film.type === "MINI_SERIES" ? "Mini Series" : film.type}
                </MetaTag>
              )}
              {film.productionStatus && film.productionStatus !== "FILMING_COMPLETED" && (
                <MetaTag accent>{film.productionStatus.replace(/_/g, " ")}</MetaTag>
              )}
            </div>

            {/* Genres — now clickable to browse */}
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

            {/* Editor annotation */}
            {film.editorAnnotation && (
              <div style={{
                background: "var(--accent-dim)", border: "1px solid rgba(229,9,20,0.2)",
                borderRadius: "var(--radius)", padding: "12px 16px", marginBottom: 20,
              }}>
                <p style={{ fontSize: "13px", color: "var(--text-dim)", fontStyle: "italic" }}>
                  ✏️ {film.editorAnnotation}
                </p>
              </div>
            )}

            {/* Description */}
            {description && (
              <div style={{ marginBottom: 28 }}>
                <h3 style={{
                  fontFamily: "var(--font-display)", fontSize: "16px",
                  letterSpacing: "1.5px", marginBottom: 10, color: "var(--text-dim)",
                  textTransform: "uppercase",
                }}>Synopsis</h3>
                <p style={{ fontSize: "15px", lineHeight: 1.8, color: "rgba(240,240,240,0.82)" }}>{description}</p>
              </div>
            )}

            {/* Crew info */}
            {directorNames && <InfoRow label="Director"  value={directorNames}  />}
            {writerNames   && <InfoRow label="Writers"   value={writerNames}    />}
            {producerNames && <InfoRow label="Producers" value={producerNames}  />}
            {composerNames && <InfoRow label="Music"     value={composerNames}  />}
            {film.imdbId   && <InfoRow label="IMDb ID"   value={film.imdbId}    />}
          </div>
        </div>

        {/* Seasons — for series */}
        {seasons.length > 0 && (
          <SeasonsSection seasons={seasons} />
        )}

        {/* Cast */}
        {actors.length > 0 && (
          <div style={{ marginTop: 48 }}>
            <SectionHeader>CAST</SectionHeader>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: 16 }}>
              {actors.map((actor, i) => <ActorCard key={actor.staffId ?? i} actor={actor} />)}
            </div>
          </div>
        )}

        {/* Facts & Bloopers */}
        {facts.length > 0 && (
          <div style={{ marginTop: 48 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 20 }}>
              <SectionHeader>TRIVIA</SectionHeader>
              <div style={{ display: "flex", gap: 6 }}>
                {factItems.length > 0 && (
                  <button onClick={() => setActiveTab("facts")} style={{
                    padding: "6px 14px", borderRadius: 8, fontSize: "12px", fontWeight: 600,
                    cursor: "pointer", transition: "all 0.18s",
                    background: activeTab === "facts" ? "var(--accent)" : "var(--bg-elevated)",
                    color: activeTab === "facts" ? "white" : "var(--text-dim)",
                    border: `1px solid ${activeTab === "facts" ? "var(--accent)" : "var(--border)"}`,
                  }}>Facts ({factItems.length})</button>
                )}
                {blooperItems.length > 0 && (
                  <button onClick={() => setActiveTab("bloopers")} style={{
                    padding: "6px 14px", borderRadius: 8, fontSize: "12px", fontWeight: 600,
                    cursor: "pointer", transition: "all 0.18s",
                    background: activeTab === "bloopers" ? "var(--accent)" : "var(--bg-elevated)",
                    color: activeTab === "bloopers" ? "white" : "var(--text-dim)",
                    border: `1px solid ${activeTab === "bloopers" ? "var(--accent)" : "var(--border)"}`,
                  }}>Bloopers ({blooperItems.length})</button>
                )}
                <button onClick={() => setShowSpoilers(v => !v)} style={{
                  padding: "6px 14px", borderRadius: 8, fontSize: "12px",
                  cursor: "pointer", background: "none",
                  color: showSpoilers ? "var(--accent)" : "var(--text-muted)",
                  border: `1px solid ${showSpoilers ? "var(--accent)" : "var(--border)"}`,
                }}>
                  {showSpoilers ? "🙈 Hide Spoilers" : "👁 Show Spoilers"}
                </button>
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {visibleFacts.map((fact, i) => (
                (!fact.spoiler || showSpoilers) && (
                  <div key={i} style={{
                    background: "var(--bg-card)", border: "1px solid var(--border)",
                    borderRadius: "var(--radius)", padding: "14px 18px",
                    fontSize: "14px", lineHeight: 1.7, color: "var(--text-dim)",
                    borderLeft: `3px solid ${fact.spoiler ? "var(--accent)" : "var(--border-hover)"}`,
                  }}>
                    {fact.spoiler && <span style={{ fontSize: "10px", color: "var(--accent)", fontWeight: 700, display: "block", marginBottom: 4 }}>⚠️ SPOILER</span>}
                    <span dangerouslySetInnerHTML={{ __html: fact.text }} />
                  </div>
                )
              ))}
            </div>
            {activeFactItems.length > 4 && (
              <button onClick={() => setFactsExpanded(v => !v)} style={{
                marginTop: 12, fontSize: "13px", color: "var(--accent)",
                background: "none", border: "1px solid rgba(229,9,20,0.3)",
                borderRadius: 8, padding: "8px 16px", cursor: "pointer",
              }}>
                {factsExpanded ? "Show less" : `Show all ${activeFactItems.length} ${activeTab}`}
              </button>
            )}
          </div>
        )}

        {/* Reviews */}
        {reviews.length > 0 && (
          <div style={{ marginTop: 48 }}>
            <SectionHeader>AUDIENCE REVIEWS</SectionHeader>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {visibleReviews.map((review, i) => (
                <ReviewCard key={review.kinopoiskId ?? i} review={review} />
              ))}
            </div>
            {reviews.length > 2 && (
              <button onClick={() => setReviewsExpanded(v => !v)} style={{
                marginTop: 12, fontSize: "13px", color: "var(--accent)",
                background: "none", border: "1px solid rgba(229,9,20,0.3)",
                borderRadius: 8, padding: "8px 16px", cursor: "pointer",
              }}>
                {reviewsExpanded ? "Show less" : `Show all ${reviews.length} reviews`}
              </button>
            )}
          </div>
        )}

        {/* Similar films */}
        {similars.length > 0 && (
          <div style={{ marginTop: 48 }}>
            <SectionHeader>YOU MAY ALSO LIKE</SectionHeader>
            <div style={{ display: "flex", gap: 16, overflowX: "auto", paddingBottom: 8 }} className="scroll-row">
              {similars.slice(0, 12).map((sf, i) => (
                <Link key={sf.filmId ?? i} href={`/film/${sf.filmId}`} style={{ textDecoration: "none", flexShrink: 0 }}>
                  <div style={{ width: 140, cursor: "pointer" }}>
                    <div style={{ borderRadius: 10, overflow: "hidden", border: "1px solid var(--border)", background: "var(--bg-card)" }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={sf.posterUrlPreview || sf.posterUrl} alt={sf.nameEn || sf.nameRu || ""}
                        style={{ width: "100%", height: 210, objectFit: "cover", display: "block" }}
                        onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                    </div>
                    <p style={{ fontSize: "12px", fontWeight: 600, color: "var(--text)", marginTop: 8, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {sf.nameEn || sf.nameRu}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Sequels & Prequels */}
        {related.length > 0 && (
          <div style={{ marginTop: 48 }}>
            <SectionHeader>SEQUELS & PREQUELS</SectionHeader>
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
              {related.map((rf, i) => <FilmCard key={rf.kinopoiskId ?? i} film={rf} variant="scroll" size="sm" />)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <h2 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(20px,3vw,28px)", letterSpacing: "1.5px", marginBottom: 24 }}>
      {children}
    </h2>
  );
}

function SeasonsSection({ seasons }: { seasons: Season[] }) {
  const [activeSeason, setActiveSeason] = useState(0);
  const season = seasons[activeSeason];
  return (
    <div style={{ marginTop: 48 }}>
      <SectionHeader>SEASONS & EPISODES</SectionHeader>
      {/* Season tabs */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 20 }}>
        {seasons.map((s, i) => (
          <button key={i} onClick={() => setActiveSeason(i)} style={{
            padding: "8px 16px", borderRadius: 8, fontSize: "13px", fontWeight: 600,
            cursor: "pointer", transition: "all 0.18s",
            background: activeSeason === i ? "var(--accent)" : "var(--bg-elevated)",
            color: activeSeason === i ? "white" : "var(--text-dim)",
            border: `1px solid ${activeSeason === i ? "var(--accent)" : "var(--border)"}`,
          }}>
            Season {s.number}
            <span style={{ marginLeft: 6, opacity: 0.7, fontSize: "11px" }}>({s.episodes.length} ep)</span>
          </button>
        ))}
      </div>
      {season && (
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {season.episodes.map((ep, i) => (
            <div key={i} style={{
              display: "flex", alignItems: "center", gap: 16,
              padding: "12px 16px", borderRadius: 8,
              border: "1px solid var(--border)", background: "var(--bg-card)",
            }}>
              <span style={{ fontFamily: "var(--font-display)", fontSize: "20px", color: "var(--text-muted)", width: 40, flexShrink: 0 }}>
                {ep.episodeNumber}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: "14px", fontWeight: 600, color: "var(--text)" }}>
                  {ep.nameEn || ep.nameRu || `Episode ${ep.episodeNumber}`}
                </p>
                {ep.releaseDate && (
                  <p style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: 2 }}>
                    {new Date(ep.releaseDate).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ReviewCard({ review }: { review: Review }) {
  const [expanded, setExpanded] = useState(false);
  const isPositive = review.type === "POSITIVE";
  const isNegative = review.type === "NEGATIVE";
  const color = isPositive ? "#22c55e" : isNegative ? "var(--accent)" : "var(--text-muted)";
  const text = review.description || "";
  const MAX = 300;

  return (
    <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "18px 20px", borderLeft: `3px solid ${color}` }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 10 }}>
        <div>
          <p style={{ fontSize: "14px", fontWeight: 700, color: "var(--text)" }}>{review.author}</p>
          {review.title && <p style={{ fontSize: "13px", color: "var(--text-dim)", marginTop: 2, fontStyle: "italic" }}>{review.title}</p>}
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, flexShrink: 0 }}>
          <span style={{
            fontSize: "11px", fontWeight: 700, color, background: `${color}22`,
            borderRadius: 4, padding: "2px 8px", textTransform: "uppercase",
          }}>
            {isPositive ? "👍 Good" : isNegative ? "👎 Bad" : "Neutral"}
          </span>
          {review.positiveRating + review.negativeRating > 0 && (
            <span style={{ fontSize: "10px", color: "var(--text-muted)" }}>
              {review.positiveRating}↑ {review.negativeRating}↓
            </span>
          )}
        </div>
      </div>
      <p style={{ fontSize: "13px", lineHeight: 1.7, color: "var(--text-dim)" }}
        dangerouslySetInnerHTML={{ __html: expanded ? text : text.slice(0, MAX) + (text.length > MAX ? "…" : "") }}
      />
      {text.length > MAX && (
        <button onClick={() => setExpanded(v => !v)} style={{
          marginTop: 8, fontSize: "12px", color: "var(--accent)",
          background: "none", border: "none", cursor: "pointer", padding: 0,
        }}>
          {expanded ? "Read less" : "Read more"}
        </button>
      )}
      <p style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: 8 }}>
        {new Date(review.date).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}
      </p>
    </div>
  );
}

function BoxRow({ label, item }: { label: string; item: BoxOfficeItem }) {
  const formatted = new Intl.NumberFormat("en-US", {
    style: "currency", currency: item.currencyCode || "USD",
    notation: "compact", maximumFractionDigits: 1,
  }).format(item.amount);
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
      <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>{label}</span>
      <span style={{ fontSize: "13px", fontWeight: 700, color: "var(--text)", fontFamily: "var(--font-display)" }}>{formatted}</span>
    </div>
  );
}

function RatingBadge({ label, value, votes, color }: { label: string; value: number; votes?: number; color: string }) {
  const pct = Math.round((value / 10) * 100);
  return (
    <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "14px 16px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <span style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: 500 }}>{label}</span>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill={color}>
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
          </svg>
          <span style={{ fontWeight: 700, color, fontFamily: "var(--font-display)", fontSize: "20px" }}>
            {value.toFixed(1)}
          </span>
        </div>
      </div>
      <div style={{ height: 3, background: "var(--surface)", borderRadius: "99px", overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: "99px", transition: "width 1s ease" }} />
      </div>
      {votes !== undefined && (
        <p style={{ fontSize: "10px", color: "var(--text-muted)", marginTop: 5, textAlign: "right" }}>
          {votes.toLocaleString()} votes
        </p>
      )}
    </div>
  );
}

function MetaTag({ children, accent, clickable }: { children: React.ReactNode; accent?: boolean; clickable?: boolean }) {
  return (
    <span className={accent ? "tag tag-accent" : "tag tag-dim"}
      style={{ cursor: clickable ? "pointer" : "default" }}>
      {children}
    </span>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", gap: 12, marginBottom: 10, alignItems: "flex-start" }}>
      <span style={{ fontSize: "12px", color: "var(--text-muted)", width: 82, flexShrink: 0, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", paddingTop: 2 }}>
        {label}
      </span>
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
        <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
      <p style={{ fontSize: "22px", fontFamily: "var(--font-display)", letterSpacing: "1px" }}>Film not found</p>
      <p style={{ fontSize: "14px", color: "var(--text-muted)" }}>The requested film could not be loaded.</p>
      <Link href="/" style={{ color: "var(--accent)", fontSize: "14px", marginTop: 8 }}>← Back to home</Link>
    </div>
  );
}
