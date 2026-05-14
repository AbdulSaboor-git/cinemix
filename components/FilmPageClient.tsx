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
import { FilmPosterFallback } from "./posterFallback";

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

  console.log(film);

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
  const name = getEnglishName(film.nameRu, film.nameEn, film.nameOriginal);
  const description = useTranslate(film.description);
  const slogan = useTranslate(film.slogan);

  const [reviewsExpanded, setReviewsExpanded] = useState(false);
  const [factsExpanded, setFactsExpanded] = useState(false);
  const [showSpoilers, setShowSpoilers] = useState(false);
  const [activeTab, setActiveTab] = useState<"facts" | "bloopers">("facts");
  const [posterError, setPosterError] = useState(false);

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
  const hasBoxOffice = budget || usaGross || worldGross;

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
      color: "accent",
    },
    film.ratingImdb && {
      label: "IMDb",
      value: film.ratingImdb,
      votes: film.ratingImdbVoteCount,
      color: "gold",
    },
    film.ratingFilmCritics && {
      label: "Critics",
      value: film.ratingFilmCritics,
      votes: film.ratingFilmCriticsVoteCount,
      color: "blue",
    },
  ].filter(Boolean) as {
    label: string;
    value: number;
    votes?: number;
    color: "accent" | "gold" | "blue";
  }[];

  return (
    <div className="min-h-screen">
      {/* Back button — desktop only */}
      <button
        onClick={() => window.history.back()}
        className="hidden md:inline-flex items-center gap-[6px] text-[var(--text-muted)] bg-transparent border-none cursor-pointer text-[13px] mb-6 px-4 lg:px-6 py-[6px] font-[var(--font-body)] hover:text-[var(--text)] transition-colors"
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

      <div className="max-w-[1200px] mx-auto px-4 md:px-6 py-6 md:py-10 lg:py-12">
        {/* ── Hero ── */}
        <div className="flex flex-col md:flex-row gap-6 md:gap-10 lg:gap-12 md:items-start">
          {/* Poster column */}
          <div className="w-full md:w-[260px] flex-shrink-0">
            <div className="w-[150px] sm:w-[180px] md:w-full mx-auto md:mx-0 mb-5 md:mb-0">
              <div className="rounded-[var(--radius-lg)] overflow-hidden border border-[var(--border)] shadow-[0_8px_40px_rgba(0,0,0,0.6)] aspect-[2/3] relative">
                {(film.posterUrlPreview || film.posterUrl) && !posterError ? (
                  <Image
                    src={film.posterUrlPreview || film.posterUrl}
                    alt={name}
                    fill
                    className="object-cover"
                    sizes="(max-width:768px) 180px, 260px"
                    priority
                    onError={() => setPosterError(true)}
                  />
                ) : (
                  <FilmPosterFallback title={name} />
                )}
              </div>
            </div>

            {/* Ratings */}
            <div className="flex flex-row flex-wrap md:flex-col gap-[8px] sm:gap-[10px] mt-5 justify-center md:justify-start">
              {ratings.map((r) => (
                <RatingBadge
                  key={r.label}
                  label={r.label}
                  value={r.value}
                  votes={r.votes}
                  color={r.color}
                />
              ))}
              {film.ratingAwait && film.ratingAwait > 0 && (
                <div className="hidden md:block bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius)] p-[10px_14px]">
                  <span className="text-[11px] text-[var(--text-muted)]">
                    Anticipation
                  </span>
                  <div className="flex items-center gap-[6px] mt-1">
                    <div className="flex-1 h-[3px] bg-[var(--surface)] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#a855f7] rounded-full"
                        style={{ width: `${film.ratingAwait}%` }}
                      />
                    </div>
                    <span className="text-[13px] text-[#a855f7] font-bold font-display">
                      {film.ratingAwait.toFixed(0)}%
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Box office — desktop */}
            {hasBoxOffice && (
              <div className="hidden md:block mt-5 bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius)] p-[14px_16px]">
                <p className="text-[11px] text-[var(--text-muted)] uppercase tracking-[1px] mb-[10px]">
                  Box Office
                </p>
                {budget && <BoxRow label="Budget" item={budget} />}
                {usaGross && <BoxRow label="USA Gross" item={usaGross} />}
                {worldGross && <BoxRow label="Worldwide" item={worldGross} />}
              </div>
            )}

            <div className="flex flex-wrap gap-2 mt-4 justify-center md:justify-start">
              {film.hasImax && (
                <span className="tag tag-dim text-[11px]">IMAX</span>
              )}
              {film.has3D && (
                <span className="tag tag-dim text-[11px]">3D</span>
              )}
            </div>
          </div>

          {/* Info column */}
          <div className="flex-1 min-w-0">
            <h1 className="font-display leading-[1.05] tracking-[1px] text-white mb-2 text-[clamp(24px,6vw,52px)]">
              {name}
            </h1>

            {film.nameRu && film.nameRu !== name && (
              <p className="text-[13px] sm:text-[14px] text-[var(--text-muted)] mb-3 italic">
                {film.nameRu}
              </p>
            )}
            {film.nameOriginal &&
              film.nameOriginal !== name &&
              film.nameOriginal !== film.nameRu && (
                <p className="text-[11px] sm:text-[12px] text-[var(--text-muted)] mb-3 italic">
                  {film.nameOriginal}
                </p>
              )}

            <div className="flex flex-wrap gap-[6px] sm:gap-2 mb-4">
              {displayYear && <MetaTag>{displayYear}</MetaTag>}
              {film.filmLength && (
                <MetaTag>
                  {Math.floor(film.filmLength / 60)}h {film.filmLength % 60}m
                </MetaTag>
              )}
              {film.ratingAgeLimits && (
                <MetaTag accent>
                  {film.ratingAgeLimits.replace("age", "")}+
                </MetaTag>
              )}
              {film.ratingMpaa && (
                <MetaTag>{film.ratingMpaa.toUpperCase()}</MetaTag>
              )}
              {film.countries?.slice(0, 3).map((c) => (
                <Link
                  key={c.country}
                  href={`/explore?countries=${encodeURIComponent(c.country)}`}
                  className="no-underline"
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
                  <MetaTag accent>
                    {film.productionStatus.replace(/_/g, " ")}
                  </MetaTag>
                )}
            </div>

            <div className="flex flex-wrap gap-[6px] sm:gap-2 mb-5">
              {film.genres?.map((g) => (
                <Link
                  key={g.genre}
                  href="/explore?type=ALL"
                  className="no-underline"
                >
                  <span className="tag tag-accent cursor-pointer capitalize">
                    {translateGenre(g.genre)}
                  </span>
                </Link>
              ))}
            </div>

            {/* Box office — mobile */}
            {hasBoxOffice && (
              <div className="md:hidden bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius)] p-[12px_14px] mb-5">
                <p className="text-[11px] text-[var(--text-muted)] uppercase tracking-[1px] mb-2">
                  Box Office
                </p>
                <div className="flex flex-wrap gap-x-4 gap-y-1">
                  {budget && <BoxRow label="Budget" item={budget} />}
                  {usaGross && <BoxRow label="USA Gross" item={usaGross} />}
                  {worldGross && <BoxRow label="Worldwide" item={worldGross} />}
                </div>
              </div>
            )}

            {slogan && (
              <p className="italic text-[var(--text-dim)] border-l-[3px] border-[var(--accent)] pl-3 sm:pl-4 mb-6 text-[13px] sm:text-[15px]">
                &ldquo;{slogan}&rdquo;
              </p>
            )}

            {film.editorAnnotation && (
              <div className="bg-[var(--accent-dim)] border border-[rgba(229,9,20,0.2)] rounded-[var(--radius)] p-[10px_14px] sm:p-[12px_16px] mb-5">
                <EditorAnnotation text={film.editorAnnotation} />
              </div>
            )}

            {description && (
              <div className="mb-6">
                <h3 className="font-display text-[13px] sm:text-[14px] tracking-[1.5px] mb-[10px] text-[var(--text-dim)] uppercase">
                  Synopsis
                </h3>
                <p className="text-[14px] sm:text-[15px] leading-[1.8] text-[rgba(240,240,240,0.82)]">
                  {description}
                </p>
              </div>
            )}

            {directorNames && (
              <InfoRow label="Director" value={directorNames} />
            )}
            {writerNames && <InfoRow label="Writers" value={writerNames} />}
            {producerNames && (
              <InfoRow label="Producers" value={producerNames} />
            )}
            {composerNames && <InfoRow label="Music" value={composerNames} />}
            {film.imdbId && <InfoRow label="IMDb ID" value={film.imdbId} />}
          </div>
        </div>

        {/* ── Seasons ── */}
        {seasons.length > 0 && <SeasonsSection seasons={seasons} />}

        {/* ── Cast ── */}
        {actors.length > 0 && (
          <div className="mt-10 md:mt-12">
            <SectionHeader>CAST</SectionHeader>
            <div className="grid gap-[8px] sm:gap-[10px] md:gap-3 grid-cols-[repeat(auto-fill,minmax(90px,1fr))] sm:grid-cols-[repeat(auto-fill,minmax(100px,1fr))]">
              {actors.map((actor) => (
                <ActorCard key={actor.staffId} actor={actor} />
              ))}
            </div>
          </div>
        )}

        {/* ── Trivia ── */}
        {facts.length > 0 && (
          <div className="mt-10 md:mt-12">
            <div className="flex flex-col gap-3 mb-5">
              <SectionHeader>TRIVIA</SectionHeader>
              {/* Tabs row — scrollable on mobile */}
              <div className="flex gap-[6px] overflow-x-auto pb-1 -mx-4 px-4 md:mx-0 md:px-0 scrollbar-none flex-nowrap md:flex-wrap">
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
                  className={`flex-shrink-0 px-3 py-[6px] rounded-[8px] text-[12px] cursor-pointer bg-transparent transition-colors duration-[180ms]
                    ${showSpoilers ? "text-[var(--accent)] border border-[var(--accent)]" : "text-[var(--text-muted)] border border-[var(--border)]"}`}
                >
                  {showSpoilers ? "🙈 Hide Spoilers" : "👁 Show Spoilers"}
                </button>
              </div>
            </div>
            <div className="flex flex-col gap-2">
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
          <div className="mt-10 md:mt-12">
            <SectionHeader>AUDIENCE REVIEWS</SectionHeader>
            <div className="flex flex-col gap-3">
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
          <div className="mt-10 md:mt-12">
            <SectionHeader>YOU MAY ALSO LIKE</SectionHeader>
            <div className="flex gap-3 overflow-x-auto pb-3 -mx-4 px-4 md:mx-0 md:px-0 scrollbar-none">
              {similars.slice(0, 12).map((sf) => {
                const sfId = sf.filmId;
                const sfName = getEnglishName(sf.nameRu, sf.nameEn);
                return (
                  <Link
                    key={sfId}
                    href={`/film/${sfId}`}
                    className="no-underline flex-shrink-0 group"
                  >
                    <div className="w-[100px] sm:w-[110px] md:w-[140px] cursor-pointer">
                      <div className="rounded-[10px] overflow-hidden border border-[var(--border)] group-hover:border-[rgba(229,9,20,0.35)] bg-[var(--bg-card)] aspect-[2/3] relative transition-colors">
                        {(sf.posterUrlPreview || sf.posterUrl) && (
                          <Image
                            src={sf.posterUrlPreview || sf.posterUrl!}
                            alt={sfName}
                            fill
                            className="object-cover"
                            sizes="140px"
                          />
                        )}
                      </div>
                      <p className="text-[11px] sm:text-[12px] font-semibold text-[var(--text)] mt-[6px] overflow-hidden text-ellipsis whitespace-nowrap">
                        {sfName}
                      </p>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Related ── */}
        {related.length > 0 && (
          <div className="mt-10 md:mt-12">
            <SectionHeader>SEQUELS & PREQUELS</SectionHeader>
            <div className="flex gap-3 sm:gap-4 flex-wrap">
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

// ── Sub-components ────────────────────────────────────────────────────────────

function EditorAnnotation({ text }: { text: string }) {
  const translated = useTranslate(text);
  return (
    <p className="text-[13px] text-[var(--text-dim)] italic">✏️ {translated}</p>
  );
}

function FactCard({ fact }: { fact: Fact }) {
  const text = useTranslateHtml(fact.text);
  return (
    <div
      className={`bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius)] p-[12px_14px] sm:p-[14px_18px] text-[13px] sm:text-[14px] leading-[1.7] text-[var(--text-dim)]
      ${fact.spoiler ? "border-l-[3px] border-l-[var(--accent)]" : "border-l-[3px] border-l-[var(--border-hover)]"}`}
    >
      {fact.spoiler && (
        <span className="text-[10px] text-[var(--accent)] font-bold block mb-1">
          ⚠️ SPOILER
        </span>
      )}
      <span>{text}</span>
    </div>
  );
}

function ReviewCard({ review }: { review: Review }) {
  const [expanded, setExpanded] = useState(false);
  const isPositive = review.type === "POSITIVE";
  const isNegative = review.type === "NEGATIVE";
  const title = useTranslateHtml(review.title);
  const body = useTranslateHtml(review.description);
  const MAX = 300;
  const displayText = expanded
    ? body
    : body.slice(0, MAX) + (body.length > MAX ? "…" : "");

  const borderCls = isPositive
    ? "border-l-[#22c55e]"
    : isNegative
      ? "border-l-[var(--accent)]"
      : "border-l-[var(--text-muted)]";
  const badgeCls = isPositive
    ? "text-[#22c55e] bg-[rgba(34,197,94,0.13)]"
    : isNegative
      ? "text-[var(--accent)] bg-[var(--accent-dim)]"
      : "text-[var(--text-muted)] bg-[var(--surface)]";

  return (
    <div
      className={`bg-[var(--bg-card)] border border-[var(--border)] border-l-[3px] rounded-[var(--radius)] p-3 sm:p-4 md:p-[18px_20px] ${borderCls}`}
    >
      <div className="flex items-start justify-between gap-2 sm:gap-3 mb-[10px]">
        <div className="min-w-0">
          <p className="text-[13px] sm:text-[14px] font-bold text-[var(--text)]">
            {review.author}
          </p>
          {title && (
            <p className="text-[12px] sm:text-[13px] text-[var(--text-dim)] mt-[2px] italic overflow-hidden text-ellipsis whitespace-nowrap">
              {title}
            </p>
          )}
        </div>
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          <span
            className={`text-[10px] sm:text-[11px] font-bold uppercase rounded-[4px] px-2 py-[2px] ${badgeCls}`}
          >
            {isPositive ? "👍 Good" : isNegative ? "👎 Bad" : "Neutral"}
          </span>
          {review.positiveRating + review.negativeRating > 0 && (
            <span className="text-[10px] text-[var(--text-muted)]">
              {review.positiveRating}↑ {review.negativeRating}↓
            </span>
          )}
        </div>
      </div>
      <p className="text-[12px] sm:text-[13px] leading-[1.7] text-[var(--text-dim)]">
        {displayText}
      </p>
      {body.length > MAX && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="mt-2 text-[12px] text-[var(--accent)] bg-transparent border-none cursor-pointer p-0 hover:underline"
        >
          {expanded ? "Read less" : "Read more"}
        </button>
      )}
      <p className="text-[11px] text-[var(--text-muted)] mt-2">
        {new Date(review.date).toLocaleDateString("en-US", {
          year: "numeric",
          month: "short",
          day: "numeric",
        })}
      </p>
    </div>
  );
}

function SeasonsSection({ seasons }: { seasons: Season[] }) {
  const [activeSeason, setActiveSeason] = useState(0);
  const season = seasons[activeSeason];
  return (
    <div className="mt-10 md:mt-12">
      <SectionHeader>SEASONS & EPISODES</SectionHeader>
      {/* Season tabs — horizontally scrollable on mobile */}
      <div className="flex gap-[6px] mb-5 overflow-x-auto pb-1 -mx-4 px-4 md:mx-0 md:px-0 scrollbar-none flex-nowrap">
        {seasons.map((s, i) => (
          <TabBtn
            key={i}
            active={activeSeason === i}
            onClick={() => setActiveSeason(i)}
          >
            S{s.number}
            <span className="ml-1 opacity-70 text-[10px]">
              ({s.episodes.length})
            </span>
          </TabBtn>
        ))}
      </div>
      {season && (
        <div className="flex flex-col gap-[2px]">
          {season.episodes.map((ep, i) => {
            const epName = getEnglishName(ep.nameRu, ep.nameEn);
            return (
              <div
                key={i}
                className="flex items-center gap-2 sm:gap-3 md:gap-4 border border-[var(--border)] bg-[var(--bg-card)] rounded-[8px] px-3 md:px-4 py-[10px] md:py-3"
              >
                <span className="font-display text-[var(--text-muted)] flex-shrink-0 text-[15px] md:text-[20px] w-6 md:w-10">
                  {ep.episodeNumber}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-[var(--text)] overflow-hidden text-ellipsis whitespace-nowrap text-[12px] sm:text-[13px] md:text-[14px]">
                    {epName || `Episode ${ep.episodeNumber}`}
                  </p>
                  {ep.releaseDate && (
                    <p className="text-[10px] sm:text-[11px] text-[var(--text-muted)] mt-[2px]">
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

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="font-display font-bold uppercase text-lg sm:text-xl md:text-[clamp(18px,3vw,28px)] tracking-[1.5px] mb-4 sm:mb-5">
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
      className={`flex-shrink-0 px-[12px] sm:px-[14px] py-[6px] rounded-[8px] text-[12px] font-semibold cursor-pointer transition-all duration-[180ms]
        ${
          active
            ? "bg-[var(--accent)] text-white border border-[var(--accent)]"
            : "bg-[var(--bg-elevated)] text-[var(--text-dim)] border border-[var(--border)] hover:border-[var(--border-hover)]"
        }`}
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
      className="mt-3 text-[13px] text-[var(--accent)] bg-transparent border border-[rgba(229,9,20,0.3)] hover:border-[var(--accent)] rounded-[8px] px-4 py-2 cursor-pointer transition-colors min-h-[40px]"
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
    <div className="flex justify-between items-center mb-[6px] min-w-[130px] sm:min-w-[140px]">
      <span className="text-[11px] sm:text-[12px] text-[var(--text-muted)]">
        {label}
      </span>
      <span className="text-[12px] sm:text-[13px] font-bold text-[var(--text)] font-display ml-3">
        {formatted}
      </span>
    </div>
  );
}

const RATING_COLOR = {
  accent: { star: "#e50914", text: "text-[#e50914]", bar: "bg-[#e50914]" },
  gold: { star: "#f5c518", text: "text-[#f5c518]", bar: "bg-[#f5c518]" },
  blue: { star: "#4a9eff", text: "text-[#4a9eff]", bar: "bg-[#4a9eff]" },
} as const;

function RatingBadge({
  label,
  value,
  votes,
  color,
}: {
  label: string;
  value: number;
  votes?: number;
  color: "accent" | "gold" | "blue";
}) {
  const pct = Math.round((value / 10) * 100);
  const c = RATING_COLOR[color];
  return (
    <>
      {/* Mobile compact */}
      <div className="flex md:hidden bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius)] p-[6px_10px] sm:p-[8px_12px] items-center gap-[5px]">
        <svg width="10" height="10" viewBox="0 0 24 24" fill={c.star}>
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
        <span className={`text-[12px] font-bold font-display ${c.text}`}>
          {value.toFixed(1)}
        </span>
        <span className="text-[11px] text-[var(--text-muted)]">{label}</span>
      </div>
      {/* Desktop full */}
      <div className="hidden md:block bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius)] p-[14px_16px]">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[12px] text-[var(--text-muted)] font-medium">
            {label}
          </span>
          <div className="flex items-center gap-[5px]">
            <svg width="12" height="12" viewBox="0 0 24 24" fill={c.star}>
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
            <span className={`font-bold font-display text-[20px] ${c.text}`}>
              {value.toFixed(1)}
            </span>
          </div>
        </div>
        <div className="h-[3px] bg-[var(--surface)] rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-[width] duration-1000 ${c.bar}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        {votes !== undefined && (
          <p className="text-[10px] text-[var(--text-muted)] mt-[5px] text-right">
            {votes.toLocaleString()} votes
          </p>
        )}
      </div>
    </>
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
      className={`${accent ? "tag tag-accent" : "tag tag-dim"} text-[11px] sm:text-[12px] ${clickable ? "cursor-pointer hover:border-[var(--border-hover)]" : ""}`}
    >
      {children}
    </span>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2 sm:gap-3 mb-[10px] items-start">
      <span className="text-[11px] sm:text-[12px] text-[var(--text-muted)] w-[72px] sm:w-[82px] flex-shrink-0 font-semibold uppercase tracking-[0.5px] pt-[2px]">
        {label}
      </span>
      <span className="text-[13px] sm:text-[14px] text-[var(--text-dim)] leading-[1.5]">
        {value}
      </span>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="min-h-screen pb-12">
      <div className="skeleton w-full aspect-video max-h-[75vh]" />
      <div className="max-w-[1200px] mx-auto px-4 md:px-6 py-10">
        <div className="flex flex-col md:flex-row gap-8 md:gap-12">
          <div className="skeleton w-[150px] sm:w-[180px] md:w-[260px] flex-shrink-0 rounded-[12px] aspect-[2/3] mx-auto md:mx-0" />
          <div className="flex-1 min-w-[240px] flex flex-col gap-4">
            <div className="skeleton h-9 sm:h-12 w-[70%] rounded-[8px]" />
            <div className="skeleton h-4 sm:h-5 w-[40%] rounded-[8px]" />
            <div className="skeleton h-[80px] md:h-[100px] rounded-[8px] mt-4" />
            <div className="skeleton h-[60px] rounded-[8px]" />
          </div>
        </div>
      </div>
    </div>
  );
}

function ErrorState() {
  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center gap-4 px-4 text-center">
      <svg
        width="56"
        height="56"
        viewBox="0 0 24 24"
        fill="none"
        stroke="var(--accent)"
        strokeWidth="1.5"
      >
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
      <p className="font-display text-[20px] sm:text-[22px] tracking-[1px]">
        Film not found
      </p>
      <p className="text-[13px] sm:text-[14px] text-[var(--text-muted)]">
        The requested film could not be loaded.
      </p>
      <Link href="/" className="text-[var(--accent)] text-[14px] mt-2">
        ← Back to home
      </Link>
    </div>
  );
}
