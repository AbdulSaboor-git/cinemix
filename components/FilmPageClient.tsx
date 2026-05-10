"use client";
import { useEffect, useState } from "react";
import Image from "next/image";
import {
  getFilm,
  getFilmStaff,
  getRelatedFilms,
  getFilmFacts,
  getFilmBoxOffice,
  getFilmSeasons,
  getSimilarFilms,
  getFilmReviews,
} from "@/lib/kinopoisk";
import {
  Film,
  Staff,
  Fact,
  BoxOfficeItem,
  Season,
  SimilarFilm,
  Review,
} from "@/types/kinopoisk";
import {
  getEnglishName,
  translateGenre,
  translateCountry,
} from "@/lib/translate";
import { useTranslate, useTranslateHtml } from "@/hooks/useTranslate";
import PlayerSection from "@/components/PlayerSection";
import ActorCard from "@/components/ActorCard";
import FilmCard from "@/components/FilmCard";
import Link from "next/link";

// ─── Responsive helpers (inline, no extra CSS file needed) ───────────────────
// We use a single 768px breakpoint via a hook, and clamp()/flex-wrap elsewhere.

function useIsMobile() {
  const [mobile, setMobile] = useState<boolean>(false);
  useEffect(() => {
    const check = () => setMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check, { passive: true });
    return () => window.removeEventListener("resize", check);
  }, []);
  return mobile;
}

// ─── Page entry ───────────────────────────────────────────────────────────────

export default function FilmPageClient({ filmId }: { filmId: string }) {
  const id = parseInt(filmId);
  const [film, setFilm] = useState<Film | null>(null);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [related, setRelated] = useState<Film[]>([]);
  const [facts, setFacts] = useState<Fact[]>([]);
  const [boxOffice, setBoxOffice] = useState<BoxOfficeItem[]>([]);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [similars, setSimilars] = useState<SimilarFilm[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(!isNaN(id));
  const [error, setError] = useState(isNaN(id));

  useEffect(() => {
    if (isNaN(id)) return;
    let mounted = true;
    setLoading(true);
    setError(false);
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
        setRelated(r);
        setLoading(false);

        // Background loads
        getFilmFacts(id)
          .then((d) => mounted && setFacts(d.items || []))
          .catch(() => {});
        getFilmBoxOffice(id)
          .then((d) => mounted && setBoxOffice(d.items || []))
          .catch(() => {});
        getSimilarFilms(id)
          .then((d) => mounted && setSimilars(d.items || []))
          .catch(() => {});
        getFilmReviews(id)
          .then((d) => mounted && setReviews(d.items || []))
          .catch(() => {});
        if (f.serial || f.type === "TV_SERIES" || f.type === "MINI_SERIES") {
          getFilmSeasons(id)
            .then((d) => mounted && setSeasons(d.items || []))
            .catch(() => {});
        }
      })
      .catch(() => {
        if (mounted) {
          setError(true);
          setLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [id]);

  if (loading) return <LoadingSkeleton />;
  if (error || !film) return <ErrorState />;

  return (
    <FilmDetail
      film={film}
      staff={staff}
      related={related}
      filmId={id}
      facts={facts}
      boxOffice={boxOffice}
      seasons={seasons}
      similars={similars}
      reviews={reviews}
    />
  );
}

// ─── Main detail view ─────────────────────────────────────────────────────────

function FilmDetail({
  film,
  staff,
  related,
  filmId,
  facts,
  boxOffice,
  seasons,
  similars,
  reviews,
}: {
  film: Film;
  staff: Staff[];
  related: Film[];
  filmId: number;
  facts: Fact[];
  boxOffice: BoxOfficeItem[];
  seasons: Season[];
  similars: SimilarFilm[];
  reviews: Review[];
}) {
  const isMobile = useIsMobile();

  const name = getEnglishName(film.nameRu, film.nameEn, film.nameOriginal);
  const description = useTranslate(film.description);
  const slogan = useTranslate(film.slogan);

  const [reviewsExpanded, setReviewsExpanded] = useState(false);
  const [factsExpanded, setFactsExpanded] = useState(false);
  const [showSpoilers, setShowSpoilers] = useState(false);
  const [activeTab, setActiveTab] = useState<"facts" | "bloopers">("facts");

  const directors = staff
    .filter((s) => s.professionKey === "DIRECTOR")
    .slice(0, 3);
  const actors = staff.filter((s) => s.professionKey === "ACTOR").slice(0, 20);
  const writers = staff.filter((s) => s.professionKey === "WRITER").slice(0, 3);
  const producers = staff
    .filter((s) => s.professionKey === "PRODUCER")
    .slice(0, 3);
  const composers = staff
    .filter((s) => s.professionKey === "COMPOSER")
    .slice(0, 2);

  const directorNames = directors
    .map((d) => d.nameEn || d.nameRu || "")
    .filter(Boolean)
    .join(", ");
  const writerNames = writers
    .map((w) => w.nameEn || w.nameRu || "")
    .filter(Boolean)
    .join(", ");
  const producerNames = producers
    .map((p) => p.nameEn || p.nameRu || "")
    .filter(Boolean)
    .join(", ");
  const composerNames = composers
    .map((c) => c.nameEn || c.nameRu || "")
    .filter(Boolean)
    .join(", ");

  const displayYear = film.serial
    ? `${film.startYear || film.year}${film.endYear ? ` – ${film.endYear}` : film.completed === false ? " – present" : ""}`
    : String(film.year || "");

  const budget = boxOffice.find((b) => b.type === "BUDGET");
  const usaGross = boxOffice.find((b) => b.type === "USA");
  const worldGross = boxOffice.find((b) => b.type === "WORLD");

  const factItems = facts.filter((f) => f.type === "FACT");
  const blooperItems = facts.filter((f) => f.type === "BLOOPER");
  const activeFactItems = activeTab === "facts" ? factItems : blooperItems;
  const visibleFacts = factsExpanded
    ? activeFactItems
    : activeFactItems.slice(0, 4);

  const visibleReviews = reviewsExpanded ? reviews : reviews.slice(0, 2);

  const ratings = [
    film.ratingKinopoisk && {
      label: "Kinopoisk",
      value: film.ratingKinopoisk,
      votes: film.ratingKinopoiskVoteCount,
      color: "#e50914",
    },
    film.ratingImdb && {
      label: "IMDb",
      value: film.ratingImdb,
      votes: film.ratingImdbVoteCount,
      color: "#f5c518",
    },
    film.ratingFilmCritics && {
      label: "Critics",
      value: film.ratingFilmCritics,
      votes: film.ratingFilmCriticsVoteCount,
      color: "#4a9eff",
    },
  ].filter(Boolean) as {
    label: string;
    value: number;
    votes?: number;
    color: string;
  }[];

  // ── Poster column: full-width on mobile, 260px sidebar on desktop
  const posterCol = (
    <div style={{ width: isMobile ? "100%" : 260, flexShrink: 0 }}>
      {/* Poster */}
      <div
        style={{
          borderRadius: "var(--radius-lg)",
          overflow: "hidden",
          border: "1px solid var(--border)",
          boxShadow: "0 8px 40px rgba(0,0,0,0.6)",
          // On mobile show a smaller centered poster
          maxWidth: isMobile ? 200 : "100%",
          margin: isMobile ? "0 auto 20px" : undefined,
          position: "relative",
          aspectRatio: "2/3",
        }}
      >
        {film.posterUrl && (
          <Image
            src={film.posterUrl}
            alt={name}
            fill
            style={{ objectFit: "cover" }}
            sizes={isMobile ? "200px" : "260px"}
            priority
          />
        )}
      </div>

      {/* Ratings */}
      <div
        style={{
          marginTop: 20,
          display: "flex",
          flexDirection: isMobile ? "row" : "column",
          flexWrap: "wrap",
          gap: 10,
        }}
      >
        {ratings.map((r) => (
          <RatingBadge
            key={r.label}
            label={r.label}
            value={r.value}
            votes={isMobile ? undefined : r.votes}
            color={r.color}
            compact={isMobile}
          />
        ))}
        {film.ratingAwait && film.ratingAwait > 0 && !isMobile && (
          <div
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius)",
              padding: "10px 14px",
            }}
          >
            <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
              Anticipation
            </span>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                marginTop: 4,
              }}
            >
              <div
                style={{
                  flex: 1,
                  height: 3,
                  background: "var(--surface)",
                  borderRadius: 99,
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: `${film.ratingAwait}%`,
                    background: "#a855f7",
                    borderRadius: 99,
                  }}
                />
              </div>
              <span
                style={{
                  fontSize: "13px",
                  color: "#a855f7",
                  fontWeight: 700,
                  fontFamily: "var(--font-display)",
                }}
              >
                {film.ratingAwait.toFixed(0)}%
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Box office — sidebar only */}
      {!isMobile && (budget || usaGross || worldGross) && (
        <div
          style={{
            marginTop: 20,
            background: "var(--bg-card)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius)",
            padding: "14px 16px",
          }}
        >
          <p
            style={{
              fontSize: "11px",
              color: "var(--text-muted)",
              textTransform: "uppercase",
              letterSpacing: "1px",
              marginBottom: 10,
            }}
          >
            Box Office
          </p>
          {budget && <BoxRow label="Budget" item={budget} />}
          {usaGross && <BoxRow label="USA Gross" item={usaGross} />}
          {worldGross && <BoxRow label="Worldwide" item={worldGross} />}
        </div>
      )}

      {/* IMAX / 3D tags */}
      <div
        style={{
          marginTop: 16,
          display: "flex",
          flexWrap: "wrap",
          gap: 8,
          justifyContent: isMobile ? "center" : "flex-start",
        }}
      >
        {film.hasImax && (
          <span className="tag tag-dim" style={{ fontSize: "11px" }}>
            IMAX
          </span>
        )}
        {film.has3D && (
          <span className="tag tag-dim" style={{ fontSize: "11px" }}>
            3D
          </span>
        )}
      </div>
    </div>
  );

  // ── Info column
  const infoCol = (
    <div style={{ flex: 1, minWidth: 0 }}>
      <h1
        style={{
          fontFamily: "var(--font-display)",
          fontSize: isMobile ? "clamp(26px,7vw,38px)" : "clamp(32px,5vw,52px)",
          lineHeight: 1.05,
          letterSpacing: "1px",
          color: "white",
          marginBottom: 8,
        }}
      >
        {name}
      </h1>

      {film.nameRu && film.nameRu !== name && (
        <p
          style={{
            fontSize: "14px",
            color: "var(--text-muted)",
            marginBottom: 12,
            fontStyle: "italic",
          }}
        >
          {film.nameRu}
        </p>
      )}
      {film.nameOriginal &&
        film.nameOriginal !== name &&
        film.nameOriginal !== film.nameRu && (
          <p
            style={{
              fontSize: "12px",
              color: "var(--text-muted)",
              marginBottom: 12,
              fontStyle: "italic",
            }}
          >
            {film.nameOriginal}
          </p>
        )}

      {/* Meta tags */}
      <div
        style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}
      >
        {displayYear && <MetaTag>{displayYear}</MetaTag>}
        {film.filmLength && (
          <MetaTag>
            {Math.floor(film.filmLength / 60)}h {film.filmLength % 60}m
          </MetaTag>
        )}
        {film.ratingAgeLimits && (
          <MetaTag accent>{film.ratingAgeLimits.replace("age", "")}+</MetaTag>
        )}
        {film.ratingMpaa && <MetaTag>{film.ratingMpaa.toUpperCase()}</MetaTag>}
        {film.countries?.slice(0, 3).map((c) => (
          <Link
            key={c.country}
            href={`/explore?countries=${encodeURIComponent(c.country)}`}
            style={{ textDecoration: "none" }}
          >
            <MetaTag clickable>{translateCountry(c.country)}</MetaTag>
          </Link>
        ))}
        {film.type && film.type !== "FILM" && (
          <MetaTag accent>
            {film.type === "TV_SERIES"
              ? "TV Series"
              : film.type === "TV_SHOW"
                ? "TV Show"
                : film.type === "MINI_SERIES"
                  ? "Mini Series"
                  : film.type}
          </MetaTag>
        )}
        {film.productionStatus &&
          film.productionStatus !== "FILMING_COMPLETED" && (
            <MetaTag accent>{film.productionStatus.replace(/_/g, " ")}</MetaTag>
          )}
      </div>

      {/* Genres */}
      <div
        style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 20 }}
      >
        {film.genres?.map((g) => (
          <Link
            key={g.genre}
            href={`/explore?type=ALL`}
            style={{ textDecoration: "none" }}
          >
            <span
              className="tag tag-accent"
              style={{ cursor: "pointer", textTransform: "capitalize" }}
            >
              {translateGenre(g.genre)}
            </span>
          </Link>
        ))}
      </div>

      {/* Box office on mobile — inline instead of sidebar */}
      {isMobile && (budget || usaGross || worldGross) && (
        <div
          style={{
            background: "var(--bg-card)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius)",
            padding: "12px 14px",
            marginBottom: 20,
          }}
        >
          <p
            style={{
              fontSize: "11px",
              color: "var(--text-muted)",
              textTransform: "uppercase",
              letterSpacing: "1px",
              marginBottom: 8,
            }}
          >
            Box Office
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0 24px" }}>
            {budget && <BoxRow label="Budget" item={budget} />}
            {usaGross && <BoxRow label="USA Gross" item={usaGross} />}
            {worldGross && <BoxRow label="Worldwide" item={worldGross} />}
          </div>
        </div>
      )}

      {/* Slogan */}
      {slogan && (
        <p
          style={{
            fontStyle: "italic",
            color: "var(--text-dim)",
            borderLeft: "3px solid var(--accent)",
            paddingLeft: 16,
            marginBottom: 24,
            fontSize: "15px",
          }}
        >
          &ldquo;{slogan}&rdquo;
        </p>
      )}

      {/* Editor annotation */}
      {film.editorAnnotation && (
        <div
          style={{
            background: "var(--accent-dim)",
            border: "1px solid rgba(229,9,20,0.2)",
            borderRadius: "var(--radius)",
            padding: "12px 16px",
            marginBottom: 20,
          }}
        >
          <EditorAnnotation text={film.editorAnnotation} />
        </div>
      )}

      {/* Description */}
      {description && (
        <div style={{ marginBottom: 24 }}>
          <h3
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "14px",
              letterSpacing: "1.5px",
              marginBottom: 10,
              color: "var(--text-dim)",
              textTransform: "uppercase",
            }}
          >
            Synopsis
          </h3>
          <p
            style={{
              fontSize: "15px",
              lineHeight: 1.8,
              color: "rgba(240,240,240,0.82)",
            }}
          >
            {description}
          </p>
        </div>
      )}

      {/* Crew */}
      {directorNames && <InfoRow label="Director" value={directorNames} />}
      {writerNames && <InfoRow label="Writers" value={writerNames} />}
      {producerNames && <InfoRow label="Producers" value={producerNames} />}
      {composerNames && <InfoRow label="Music" value={composerNames} />}
      {film.imdbId && <InfoRow label="IMDb ID" value={film.imdbId} />}
    </div>
  );

  return (
    <div style={{ minHeight: "100vh" }}>
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
          padding: "clamp(20px,4vw,48px) clamp(16px,4vw,24px)",
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
      <PlayerSection filmId={filmId} film={film} />

      <div
        style={{
          maxWidth: "1200px",
          margin: "0 auto",
          padding: "clamp(20px,4vw,48px) clamp(16px,4vw,24px)",
        }}
      >
        {/* ── Hero: poster + info ── */}
        <div
          style={{
            display: "flex",
            flexDirection: isMobile ? "column" : "row",
            gap: "clamp(20px,4vw,48px)",
            alignItems: isMobile ? "stretch" : "flex-start",
          }}
        >
          {posterCol}
          {infoCol}
        </div>

        {/* ── Seasons ── */}
        {seasons.length > 0 && (
          <SeasonsSection seasons={seasons} isMobile={isMobile} />
        )}

        {/* ── Cast ── */}
        {actors.length > 0 && (
          <div style={{ marginTop: 48 }}>
            <SectionHeader>CAST</SectionHeader>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: `repeat(auto-fill, minmax(${isMobile ? "90px" : "120px"}, 1fr))`,
                gap: isMobile ? 10 : 16,
              }}
            >
              {actors.map((actor) => (
                <ActorCard key={actor.staffId} actor={actor} />
              ))}
            </div>
          </div>
        )}

        {/* ── Facts & Bloopers ── */}
        {facts.length > 0 && (
          <div style={{ marginTop: 48 }}>
            <div
              style={{
                display: "flex",
                alignItems: isMobile ? "flex-start" : "center",
                justifyContent: "space-between",
                flexDirection: isMobile ? "column" : "row",
                gap: 12,
                marginBottom: 20,
              }}
            >
              <SectionHeader>TRIVIA</SectionHeader>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {factItems.length > 0 && (
                  <TabBtn
                    active={activeTab === "facts"}
                    onClick={() => setActiveTab("facts")}
                  >
                    Facts ({factItems.length})
                  </TabBtn>
                )}
                {blooperItems.length > 0 && (
                  <TabBtn
                    active={activeTab === "bloopers"}
                    onClick={() => setActiveTab("bloopers")}
                  >
                    Bloopers ({blooperItems.length})
                  </TabBtn>
                )}
                <button
                  onClick={() => setShowSpoilers((v) => !v)}
                  style={{
                    padding: "6px 12px",
                    borderRadius: 8,
                    fontSize: "12px",
                    cursor: "pointer",
                    background: "none",
                    color: showSpoilers ? "var(--accent)" : "var(--text-muted)",
                    border: `1px solid ${showSpoilers ? "var(--accent)" : "var(--border)"}`,
                  }}
                >
                  {showSpoilers ? "🙈 Hide Spoilers" : "👁 Show Spoilers"}
                </button>
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {visibleFacts.map((fact, i) =>
                !fact.spoiler || showSpoilers ? (
                  <FactCard key={i} fact={fact} />
                ) : null,
              )}
            </div>
            {activeFactItems.length > 4 && (
              <ExpandBtn onClick={() => setFactsExpanded((v) => !v)}>
                {factsExpanded
                  ? "Show less"
                  : `Show all ${activeFactItems.length} ${activeTab}`}
              </ExpandBtn>
            )}
          </div>
        )}

        {/* ── Reviews ── */}
        {reviews.length > 0 && (
          <div style={{ marginTop: 48 }}>
            <SectionHeader>AUDIENCE REVIEWS</SectionHeader>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {visibleReviews.map((review, i) => (
                <ReviewCard key={review.kinopoiskId ?? i} review={review} />
              ))}
            </div>
            {reviews.length > 2 && (
              <ExpandBtn onClick={() => setReviewsExpanded((v) => !v)}>
                {reviewsExpanded
                  ? "Show less"
                  : `Show all ${reviews.length} reviews`}
              </ExpandBtn>
            )}
          </div>
        )}

        {/* ── Similar films ── */}
        {similars.length > 0 && (
          <div style={{ marginTop: 48 }}>
            <SectionHeader>YOU MAY ALSO LIKE</SectionHeader>
            {/* Horizontal scroll row — auto-adjusts on any width */}
            <div
              style={{
                display: "flex",
                gap: 12,
                overflowX: "auto",
                paddingBottom: 8,
              }}
              className="scroll-row"
            >
              {similars.slice(0, 12).map((sf) => {
                const sfId = sf.filmId;
                const sfName = getEnglishName(sf.nameRu, sf.nameEn);
                return (
                  <Link
                    key={sfId}
                    href={`/film/${sfId}`}
                    style={{ textDecoration: "none", flexShrink: 0 }}
                  >
                    <div
                      style={{ width: isMobile ? 110 : 140, cursor: "pointer" }}
                    >
                      <div
                        style={{
                          borderRadius: 10,
                          overflow: "hidden",
                          border: "1px solid var(--border)",
                          background: "var(--bg-card)",
                          position: "relative",
                          aspectRatio: "2/3",
                        }}
                      >
                        {(sf.posterUrlPreview || sf.posterUrl) && (
                          <Image
                            src={sf.posterUrlPreview || sf.posterUrl!}
                            alt={sfName}
                            fill
                            style={{ objectFit: "cover" }}
                            sizes={isMobile ? "110px" : "140px"}
                          />
                        )}
                      </div>
                      <p
                        style={{
                          fontSize: "12px",
                          fontWeight: 600,
                          color: "var(--text)",
                          marginTop: 6,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {sfName}
                      </p>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Sequels & Prequels ── */}
        {related.length > 0 && (
          <div style={{ marginTop: 48 }}>
            <SectionHeader>SEQUELS & PREQUELS</SectionHeader>
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
              {related.map((rf) => (
                <FilmCard
                  key={rf.kinopoiskId ?? rf.filmId}
                  film={rf}
                  variant="scroll"
                  size="sm"
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── EditorAnnotation: translate Russian annotation ───────────────────────────

function EditorAnnotation({ text }: { text: string }) {
  const translated = useTranslate(text);
  return (
    <p
      style={{
        fontSize: "13px",
        color: "var(--text-dim)",
        fontStyle: "italic",
      }}
    >
      ✏️ {translated}
    </p>
  );
}

// ─── FactCard: strips HTML, translates Russian ────────────────────────────────

function FactCard({ fact }: { fact: Fact }) {
  // useTranslateHtml strips HTML and translates Cyrillic — no XSS
  const text = useTranslateHtml(fact.text);
  return (
    <div
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius)",
        padding: "14px 18px",
        fontSize: "14px",
        lineHeight: 1.7,
        color: "var(--text-dim)",
        borderLeft: `3px solid ${fact.spoiler ? "var(--accent)" : "var(--border-hover)"}`,
      }}
    >
      {fact.spoiler && (
        <span
          style={{
            fontSize: "10px",
            color: "var(--accent)",
            fontWeight: 700,
            display: "block",
            marginBottom: 4,
          }}
        >
          ⚠️ SPOILER
        </span>
      )}
      <span>{text}</span>
    </div>
  );
}

// ─── ReviewCard: strips HTML, translates Russian ──────────────────────────────

function ReviewCard({ review }: { review: Review }) {
  const [expanded, setExpanded] = useState(false);
  const isPositive = review.type === "POSITIVE";
  const isNegative = review.type === "NEGATIVE";
  const color = isPositive
    ? "#22c55e"
    : isNegative
      ? "var(--accent)"
      : "var(--text-muted)";

  // Strip HTML + translate both title and body
  const title = useTranslateHtml(review.title);
  const body = useTranslateHtml(review.description);
  const MAX = 300;
  const displayText = expanded
    ? body
    : body.slice(0, MAX) + (body.length > MAX ? "…" : "");

  return (
    <div
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius)",
        padding: "18px 20px",
        borderLeft: `3px solid ${color}`,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 12,
          marginBottom: 10,
        }}
      >
        <div style={{ minWidth: 0 }}>
          <p
            style={{ fontSize: "14px", fontWeight: 700, color: "var(--text)" }}
          >
            {review.author}
          </p>
          {title && (
            <p
              style={{
                fontSize: "13px",
                color: "var(--text-dim)",
                marginTop: 2,
                fontStyle: "italic",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {title}
            </p>
          )}
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-end",
            gap: 4,
            flexShrink: 0,
          }}
        >
          <span
            style={{
              fontSize: "11px",
              fontWeight: 700,
              color,
              background: `${color}22`,
              borderRadius: 4,
              padding: "2px 8px",
              textTransform: "uppercase",
            }}
          >
            {isPositive ? "👍 Good" : isNegative ? "👎 Bad" : "Neutral"}
          </span>
          {review.positiveRating + review.negativeRating > 0 && (
            <span style={{ fontSize: "10px", color: "var(--text-muted)" }}>
              {review.positiveRating}↑ {review.negativeRating}↓
            </span>
          )}
        </div>
      </div>
      <p
        style={{ fontSize: "13px", lineHeight: 1.7, color: "var(--text-dim)" }}
      >
        {displayText}
      </p>
      {body.length > MAX && (
        <button
          onClick={() => setExpanded((v) => !v)}
          style={{
            marginTop: 8,
            fontSize: "12px",
            color: "var(--accent)",
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: 0,
          }}
        >
          {expanded ? "Read less" : "Read more"}
        </button>
      )}
      <p style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: 8 }}>
        {new Date(review.date).toLocaleDateString("en-US", {
          year: "numeric",
          month: "short",
          day: "numeric",
        })}
      </p>
    </div>
  );
}

// ─── SeasonsSection ───────────────────────────────────────────────────────────

function SeasonsSection({
  seasons,
  isMobile,
}: {
  seasons: Season[];
  isMobile: boolean;
}) {
  const [activeSeason, setActiveSeason] = useState(0);
  const season = seasons[activeSeason];
  return (
    <div style={{ marginTop: 48 }}>
      <SectionHeader>SEASONS & EPISODES</SectionHeader>
      <div
        style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 20 }}
      >
        {seasons.map((s, i) => (
          <TabBtn
            key={i}
            active={activeSeason === i}
            onClick={() => setActiveSeason(i)}
          >
            S{s.number}
            <span style={{ marginLeft: 4, opacity: 0.7, fontSize: "10px" }}>
              ({s.episodes.length})
            </span>
          </TabBtn>
        ))}
      </div>
      {season && (
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {season.episodes.map((ep, i) => {
            const epName = getEnglishName(ep.nameRu, ep.nameEn);
            return (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: isMobile ? 10 : 16,
                  padding: isMobile ? "10px 12px" : "12px 16px",
                  borderRadius: 8,
                  border: "1px solid var(--border)",
                  background: "var(--bg-card)",
                }}
              >
                <span
                  style={{
                    fontFamily: "var(--font-display)",
                    fontSize: isMobile ? "16px" : "20px",
                    color: "var(--text-muted)",
                    width: isMobile ? 28 : 40,
                    flexShrink: 0,
                  }}
                >
                  {ep.episodeNumber}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p
                    style={{
                      fontSize: isMobile ? "13px" : "14px",
                      fontWeight: 600,
                      color: "var(--text)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {epName || `Episode ${ep.episodeNumber}`}
                  </p>
                  {ep.releaseDate && (
                    <p
                      style={{
                        fontSize: "11px",
                        color: "var(--text-muted)",
                        marginTop: 2,
                      }}
                    >
                      {new Date(ep.releaseDate).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Small reusable components ────────────────────────────────────────────────

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <h2
      style={{
        fontFamily: "var(--font-display)",
        fontSize: "clamp(18px,3vw,28px)",
        letterSpacing: "1.5px",
        marginBottom: 20,
      }}
    >
      {children}
    </h2>
  );
}

function TabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "6px 14px",
        borderRadius: 8,
        fontSize: "12px",
        fontWeight: 600,
        cursor: "pointer",
        transition: "all 0.18s",
        background: active ? "var(--accent)" : "var(--bg-elevated)",
        color: active ? "white" : "var(--text-dim)",
        border: `1px solid ${active ? "var(--accent)" : "var(--border)"}`,
      }}
    >
      {children}
    </button>
  );
}

function ExpandBtn({
  onClick,
  children,
}: {
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        marginTop: 12,
        fontSize: "13px",
        color: "var(--accent)",
        background: "none",
        border: "1px solid rgba(229,9,20,0.3)",
        borderRadius: 8,
        padding: "8px 16px",
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}

function BoxRow({ label, item }: { label: string; item: BoxOfficeItem }) {
  const formatted = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: item.currencyCode || "USD",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(item.amount);
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 6,
        minWidth: 140,
      }}
    >
      <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
        {label}
      </span>
      <span
        style={{
          fontSize: "13px",
          fontWeight: 700,
          color: "var(--text)",
          fontFamily: "var(--font-display)",
        }}
      >
        {formatted}
      </span>
    </div>
  );
}

function RatingBadge({
  label,
  value,
  votes,
  color,
  compact = false,
}: {
  label: string;
  value: number;
  votes?: number;
  color: string;
  compact?: boolean;
}) {
  const pct = Math.round((value / 10) * 100);
  if (compact) {
    // Small pill on mobile
    return (
      <div
        style={{
          background: "var(--bg-card)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius)",
          padding: "8px 12px",
          display: "flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        <svg width="10" height="10" viewBox="0 0 24 24" fill={color}>
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
        <span
          style={{
            fontSize: "12px",
            fontWeight: 700,
            color,
            fontFamily: "var(--font-display)",
          }}
        >
          {value.toFixed(1)}
        </span>
        <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
          {label}
        </span>
      </div>
    );
  }
  return (
    <div
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius)",
        padding: "14px 16px",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 8,
        }}
      >
        <span
          style={{
            fontSize: "12px",
            color: "var(--text-muted)",
            fontWeight: 500,
          }}
        >
          {label}
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill={color}>
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
          </svg>
          <span
            style={{
              fontWeight: 700,
              color,
              fontFamily: "var(--font-display)",
              fontSize: "20px",
            }}
          >
            {value.toFixed(1)}
          </span>
        </div>
      </div>
      <div
        style={{
          height: 3,
          background: "var(--surface)",
          borderRadius: "99px",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${pct}%`,
            background: color,
            borderRadius: "99px",
            transition: "width 1s ease",
          }}
        />
      </div>
      {votes !== undefined && (
        <p
          style={{
            fontSize: "10px",
            color: "var(--text-muted)",
            marginTop: 5,
            textAlign: "right",
          }}
        >
          {votes.toLocaleString()} votes
        </p>
      )}
    </div>
  );
}

function MetaTag({
  children,
  accent,
  clickable,
}: {
  children: React.ReactNode;
  accent?: boolean;
  clickable?: boolean;
}) {
  return (
    <span
      className={accent ? "tag tag-accent" : "tag tag-dim"}
      style={{ cursor: clickable ? "pointer" : "default" }}
    >
      {children}
    </span>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        display: "flex",
        gap: 12,
        marginBottom: 10,
        alignItems: "flex-start",
      }}
    >
      <span
        style={{
          fontSize: "12px",
          color: "var(--text-muted)",
          width: 82,
          flexShrink: 0,
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.5px",
          paddingTop: 2,
        }}
      >
        {label}
      </span>
      <span
        style={{ fontSize: "14px", color: "var(--text-dim)", lineHeight: 1.5 }}
      >
        {value}
      </span>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div style={{ minHeight: "100vh", paddingBottom: 48 }}>
      <div
        className="skeleton"
        style={{ width: "100%", paddingTop: "min(56.25%, 75vh)" }}
      />
      <div
        style={{ maxWidth: "1200px", margin: "0 auto", padding: "48px 24px" }}
      >
        <div style={{ display: "flex", flexWrap: "wrap", gap: 48 }}>
          <div
            className="skeleton"
            style={{
              width: 260,
              aspectRatio: "2/3",
              borderRadius: 12,
              flexShrink: 0,
            }}
          />
          <div
            style={{
              flex: 1,
              minWidth: 240,
              display: "flex",
              flexDirection: "column",
              gap: 16,
            }}
          >
            <div
              className="skeleton"
              style={{ height: 48, width: "70%", borderRadius: 8 }}
            />
            <div
              className="skeleton"
              style={{ height: 20, width: "40%", borderRadius: 8 }}
            />
            <div
              className="skeleton"
              style={{ height: 100, borderRadius: 8, marginTop: 16 }}
            />
            <div className="skeleton" style={{ height: 60, borderRadius: 8 }} />
          </div>
        </div>
      </div>
    </div>
  );
}

function ErrorState() {
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
      <svg
        width="64"
        height="64"
        viewBox="0 0 24 24"
        fill="none"
        stroke="var(--accent)"
        strokeWidth="1.5"
      >
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
      <p
        style={{
          fontSize: "22px",
          fontFamily: "var(--font-display)",
          letterSpacing: "1px",
        }}
      >
        Film not found
      </p>
      <p style={{ fontSize: "14px", color: "var(--text-muted)" }}>
        The requested film could not be loaded.
      </p>
      <Link
        href="/"
        style={{ color: "var(--accent)", fontSize: "14px", marginTop: 8 }}
      >
        ← Back to home
      </Link>
    </div>
  );
}
