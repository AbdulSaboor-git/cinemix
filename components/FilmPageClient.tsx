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
  getFilmAwards,
  getFilmImages,
  getFilmDistributions,
} from "@/lib/kinopoisk";
import {
  Film,
  Staff,
  Fact,
  BoxOfficeItem,
  Season,
  SimilarFilm,
  Review,
  Award,
  ImageItem,
  Distribution,
} from "@/types/kinopoisk";
import {
  getEnglishName,
  translateGenre,
  translateCountry,
} from "@/lib/translate";
import { getPreferences } from "@/lib/preferences";
import {
  useTranslate,
  useTranslateHtml,
  useAutoTranslate,
} from "@/hooks/useTranslate";
import PlayerSection from "@/components/PlayerSection";
import ActorCard from "@/components/ActorCard";
import FilmCard from "@/components/FilmCard";
import Link from "next/link";
import { FilmPosterFallback } from "./posterFallback";
import { toggleFavorite, toggleWatchLater, isInList } from "@/lib/userLists";
import { useToast } from "@/lib/toast";
import BackButton from "./BackButton";

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
  const [awards, setAwards] = useState<Award[]>([]);
  const [images, setImages] = useState<ImageItem[]>([]);
  const [distributions, setDistributions] = useState<Distribution[]>([]);
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
        const fs = getPreferences().filmSections;
        if (fs.cast) setStaff(s);
        setRelated(r);
        setLoading(false);

        if (fs.facts) {
          getFilmFacts(id)
            .then((d) => mounted && setFacts(d.items || []))
            .catch(() => {});
        }
        if (fs.boxOffice) {
          getFilmBoxOffice(id)
            .then((d) => mounted && setBoxOffice(d.items || []))
            .catch(() => {});
        }
        if (fs.similars) {
          getSimilarFilms(id)
            .then((d) => mounted && setSimilars(d.items || []))
            .catch(() => {});
        }
        if (fs.reviews) {
          getFilmReviews(id)
            .then((d) => mounted && setReviews(d.items || []))
            .catch(() => {});
        }
        if (fs.awards) {
          getFilmAwards(id)
            .then((d) => mounted && setAwards(d.items || []))
            .catch(() => {});
        }
        if (fs.gallery) {
          getFilmImages(id, "STILL", 1)
            .then((d) => mounted && setImages(d.items || []))
            .catch(() => {});
        }
        if (fs.distributions) {
          getFilmDistributions(id)
            .then((d) => mounted && setDistributions(d.items || []))
            .catch(() => {});
        }
        if (
          (f.serial || f.type === "TV_SERIES" || f.type === "MINI_SERIES") &&
          fs.cast
        ) {
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
      awards={awards}
      images={images}
      distributions={distributions}
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
  awards,
  images,
  distributions,
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
  awards: Award[];
  images: ImageItem[];
  distributions: Distribution[];
}) {
  const autoTranslate = useAutoTranslate();
  const name = getEnglishName(
    film.nameRu,
    film.nameEn,
    film.nameOriginal,
    autoTranslate,
  );
  const description = useTranslate(film.description);
  const slogan = useTranslate(film.slogan);

  const [reviewsExpanded, setReviewsExpanded] = useState(false);
  const [factsExpanded, setFactsExpanded] = useState(false);
  const [showSpoilers, setShowSpoilers] = useState(false);
  const [activeTab, setActiveTab] = useState<"facts" | "bloopers">("facts");
  const [posterError, setPosterError] = useState(false);
  const [isFav, setIsFav] = useState(false);
  const [isWL, setIsWL] = useState(false);
  const { toast } = useToast();

  // Hydrate fav/WL state client-side
  useEffect(() => {
    setIsFav(isInList("favorites", filmId));
    setIsWL(isInList("watchlater", filmId));
  }, [filmId]);

  const filmEntry = {
    film_id: filmId,
    film_name: film.nameEn || film.nameOriginal || film.nameRu || "Unknown",
    poster_url: film.posterUrlPreview || film.posterUrl || null,
    year: film.year ?? film.startYear ?? null,
    rating: film.ratingKinopoisk ?? film.ratingImdb ?? null,
  };

  const handleFav = () => {
    const added = toggleFavorite(filmEntry);
    setIsFav(added);
    toast.success(added ? "Added to Favorites ❤️" : "Removed from Favorites");
  };

  const handleWL = () => {
    const added = toggleWatchLater(filmEntry);
    setIsWL(added);
    toast.info(added ? "Saved to Watch Later 🕐" : "Removed from Watch Later");
  };

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
      <BackButton desktopOnly={true} />

      {getPreferences().filmSections.videos && (
        <PlayerSection filmId={filmId} film={film} />
      )}

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

            {/* {film.nameRu && film.nameRu !== name && (
              <p className="text-[13px] sm:text-[14px] text-[var(--text-muted)] mb-3 italic">
                {film.nameRu}
              </p>
            )} */}
            {/* {film.nameOriginal &&
              film.nameOriginal !== name &&
              film.nameOriginal !== film.nameRu && (
                <p className="text-[11px] sm:text-[12px] text-[var(--text-muted)] mb-3 italic">
                  {film.nameOriginal}
                </p>
              )} */}

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
                  <MetaTag clickable>
                    {translateCountry(c.country, autoTranslate)}
                  </MetaTag>
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
                  href={`/explore?genres=${encodeURIComponent(g.genre)}`}
                  className="no-underline"
                >
                  <span className="tag tag-accent cursor-pointer capitalize">
                    {translateGenre(g.genre, autoTranslate)}
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

            {/* ── Action buttons ── */}
            <div className="flex flex-wrap gap-[8px] mt-6">
              <button
                onClick={handleFav}
                className={`flex items-center gap-[7px] rounded-[var(--radius)] px-4 py-[9px] text-[12px] sm:text-[13px] font-semibold border cursor-pointer transition-all duration-150
                  ${
                    isFav
                      ? "bg-[rgba(229,9,20,0.15)] border-[rgba(229,9,20,0.5)] text-[var(--accent)] shadow-[0_0_14px_rgba(229,9,20,0.2)]"
                      : "bg-[var(--bg-elevated)] border-[var(--border)] text-[var(--text-dim)] hover:border-[rgba(229,9,20,0.4)] hover:text-[var(--accent)]"
                  }`}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill={isFav ? "var(--accent)" : "none"}
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                </svg>
                {isFav ? "Favorited" : "Add to Favorites"}
              </button>
              <button
                onClick={handleWL}
                className={`flex items-center gap-[7px] rounded-[var(--radius)] px-4 py-[9px] text-[12px] sm:text-[13px] font-semibold border cursor-pointer transition-all duration-150
                  ${
                    isWL
                      ? "bg-[rgba(96,165,250,0.12)] border-[rgba(96,165,250,0.4)] text-[#60a5fa]"
                      : "bg-[var(--bg-elevated)] border-[var(--border)] text-[var(--text-dim)] hover:border-[rgba(96,165,250,0.4)] hover:text-[#60a5fa]"
                  }`}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
                {isWL ? "In Watch Later" : "Watch Later"}
              </button>
            </div>
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

        {/* ── Gallery ── */}
        {images.length > 0 && (
          <GallerySection images={images} filmId={filmId} />
        )}

        {/* ── Awards ── */}
        {awards.length > 0 && <AwardsSection awards={awards} />}

        {/* ── Distributions ── */}
        {distributions.length > 0 && (
          <DistributionsSection distributions={distributions} />
        )}

        {/* ── Similar films ── */}
        {similars.length > 0 && (
          <div className="mt-10 md:mt-12">
            <SectionHeader>YOU MAY ALSO LIKE</SectionHeader>
            <div className="flex gap-3 overflow-x-auto pb-3 -mx-4 px-4 md:mx-0 md:px-0 scrollbar-none">
              {similars.slice(0, 12).map((sf) => {
                const sfId = sf.filmId;
                const sfName = getEnglishName(
                  sf.nameRu,
                  sf.nameEn,
                  undefined,
                  autoTranslate,
                );
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
              {Array.from(
                new Map(
                  related.map((rf) => [rf.kinopoiskId ?? rf.filmId, rf]),
                ).values(),
              ).map((rf) => (
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
  const autoTranslate = useAutoTranslate();
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
            const epName = getEnglishName(
              ep.nameRu,
              ep.nameEn,
              undefined,
              autoTranslate,
            );
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

// ── Where to Watch ────────────────────────────────────────────────────────────

// ── Gallery ───────────────────────────────────────────────────────────────────

function GallerySection({
  images,
  filmId,
}: {
  images: ImageItem[];
  filmId: number;
}) {
  const [lightbox, setLightbox] = useState<number | null>(null);
  const visible = images.slice(0, 12);

  const prev = () =>
    setLightbox((i) => (i !== null ? Math.max(0, i - 1) : null));
  const next = () =>
    setLightbox((i) =>
      i !== null ? Math.min(visible.length - 1, i + 1) : null,
    );

  // Close lightbox on Escape
  useEffect(() => {
    if (lightbox === null) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightbox(null);
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lightbox]);

  // Lock scroll when lightbox open
  useEffect(() => {
    if (lightbox !== null) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [lightbox]);

  return (
    <div className="mt-10 md:mt-12">
      <SectionHeader>GALLERY</SectionHeader>
      <div className="grid gap-[6px] sm:gap-2 grid-cols-3 sm:grid-cols-4 md:grid-cols-6">
        {visible.map((img, i) => (
          <button
            key={i}
            onClick={() => setLightbox(i)}
            className="aspect-video rounded-[6px] sm:rounded-[8px] overflow-hidden relative bg-[var(--surface)] cursor-pointer border-none p-0 hover:opacity-90 transition-opacity"
          >
            <Image
              src={img.previewUrl || img.imageUrl}
              alt={`Still ${i + 1}`}
              fill
              className="object-cover"
              sizes="(max-width: 640px) 33vw, (max-width: 768px) 25vw, 16vw"
            />
          </button>
        ))}
      </div>

      {/* Lightbox */}
      {lightbox !== null && (
        <div
          className="fixed inset-0 z-[9998] flex items-center justify-center"
          style={{
            background: "rgba(0,0,0,0.92)",
            backdropFilter: "blur(8px)",
          }}
          onClick={() => setLightbox(null)}
        >
          {/* Prev */}
          <button
            className="absolute left-3 sm:left-6 top-1/2 -translate-y-1/2 w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-[rgba(255,255,255,0.08)] border border-[rgba(255,255,255,0.15)] flex items-center justify-center cursor-pointer hover:bg-[rgba(255,255,255,0.15)] transition-colors z-10 border-none"
            onClick={(e) => {
              e.stopPropagation();
              prev();
            }}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth="2.5"
            >
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>

          {/* Image */}
          <div
            className="relative max-w-[92vw] max-h-[88vh] w-full flex items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            <Image
              src={visible[lightbox].imageUrl}
              alt={`Still ${lightbox + 1}`}
              width={1280}
              height={720}
              className="object-contain rounded-[8px] max-h-[80vh] w-auto"
              style={{ maxWidth: "92vw" }}
            />
            <div className="absolute bottom-[-28px] left-1/2 -translate-x-1/2 text-[12px] text-[rgba(255,255,255,0.4)]">
              {lightbox + 1} / {visible.length}
            </div>
          </div>

          {/* Next */}
          <button
            className="absolute right-3 sm:right-6 top-1/2 -translate-y-1/2 w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-[rgba(255,255,255,0.08)] border border-[rgba(255,255,255,0.15)] flex items-center justify-center cursor-pointer hover:bg-[rgba(255,255,255,0.15)] transition-colors z-10 border-none"
            onClick={(e) => {
              e.stopPropagation();
              next();
            }}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth="2.5"
            >
              <path d="M9 18l6-6-6-6" />
            </svg>
          </button>

          {/* Close */}
          <button
            className="absolute top-4 right-4 sm:top-6 sm:right-6 w-9 h-9 rounded-full bg-[rgba(255,255,255,0.08)] flex items-center justify-center cursor-pointer hover:bg-[rgba(255,255,255,0.15)] transition-colors border-none"
            onClick={() => setLightbox(null)}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth="2.5"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}

// ── Awards ────────────────────────────────────────────────────────────────────

function AwardsSection({ awards }: { awards: Award[] }) {
  const [expanded, setExpanded] = useState(false);
  const wins = awards.filter((a) => a.win);
  const nominations = awards.filter((a) => !a.win);
  const visible = expanded ? awards : awards.slice(0, 6);

  return (
    <div className="mt-10 md:mt-12">
      <div className="flex items-center gap-3 mb-4 sm:mb-5 flex-wrap">
        <h2 className="font-display font-bold uppercase text-lg sm:text-xl md:text-[clamp(18px,3vw,28px)] tracking-[1.5px] m-0">
          AWARDS
        </h2>
        <div className="flex gap-2">
          {wins.length > 0 && (
            <span className="flex items-center gap-1 text-[11px] font-semibold text-[#f5c518] bg-[rgba(245,197,24,0.12)] border border-[rgba(245,197,24,0.25)] px-2 py-[3px] rounded-[6px]">
              🏆 {wins.length} Win{wins.length !== 1 ? "s" : ""}
            </span>
          )}
          {nominations.length > 0 && (
            <span className="text-[11px] font-semibold text-[var(--text-muted)] bg-[var(--surface)] border border-[var(--border)] px-2 py-[3px] rounded-[6px]">
              {nominations.length} Nomination
              {nominations.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-[6px] sm:gap-2">
        {visible.map((award, i) => (
          <AwardRow key={i} award={award} />
        ))}
      </div>

      {awards.length > 6 && (
        <ExpandBtn onClick={() => setExpanded((v) => !v)}>
          {expanded ? "Show less" : `Show all ${awards.length} awards`}
        </ExpandBtn>
      )}
    </div>
  );
}

function AwardRow({ award }: { award: Award }) {
  const personNames = award.persons
    ?.slice(0, 2)
    .map((p) => p.nameEn || p.nameRu || "")
    .filter(Boolean)
    .join(", ");

  return (
    <div
      className={`flex items-center gap-3 sm:gap-4 bg-[var(--bg-card)] border rounded-[var(--radius)] px-3 sm:px-4 py-[10px] sm:py-3
      ${award.win ? "border-[rgba(245,197,24,0.2)] border-l-[3px] border-l-[#f5c518]" : "border-[var(--border)] border-l-[3px] border-l-[var(--border)]"}`}
    >
      {/* Award icon / image */}
      <div className="w-8 h-8 sm:w-9 sm:h-9 flex-shrink-0 flex items-center justify-center">
        {award.imageUrl ? (
          <Image
            src={award.imageUrl}
            alt={award.name}
            width={32}
            height={32}
            className="object-contain rounded-[4px]"
          />
        ) : (
          <span className="text-[18px] sm:text-[20px]">
            {award.win ? "🏆" : "🎬"}
          </span>
        )}
      </div>
      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[12px] sm:text-[13px] font-bold text-[var(--text)]">
            {award.name}
          </span>
          <span className="text-[10px] sm:text-[11px] text-[var(--text-muted)]">
            {award.year}
          </span>
          {award.win && (
            <span className="text-[9px] sm:text-[10px] font-bold text-[#f5c518] uppercase tracking-[0.5px]">
              WON
            </span>
          )}
        </div>
        <p className="text-[11px] sm:text-[12px] text-[var(--text-muted)] mt-[1px]">
          {award.nominationName}
          {personNames && (
            <span className="ml-1 text-[var(--text-dim)]">— {personNames}</span>
          )}
        </p>
      </div>
    </div>
  );
}

// ── Distributions ─────────────────────────────────────────────────────────────

const DIST_TYPE_LABELS: Record<string, string> = {
  PREMIERE: "World Premiere",
  ALL_RELEASE: "General Release",
  LOCAL: "Local Release",
  WORLD_PREMIERE: "World Premiere",
  COUNTRY_SPECIFIC: "Country Release",
};
const DIST_SUBTYPE_LABELS: Record<string, string> = {
  CINEMA: "Cinema",
  DVD: "DVD",
  DIGITAL: "Digital",
};

function DistributionsSection({
  distributions,
}: {
  distributions: Distribution[];
}) {
  const [expanded, setExpanded] = useState(false);
  // Deduplicate and sort by date
  const sorted = [...distributions]
    .filter((d) => d.date)
    .sort((a, b) => new Date(a.date!).getTime() - new Date(b.date!).getTime());
  const visible = expanded ? sorted : sorted.slice(0, 6);

  if (sorted.length === 0) return null;

  return (
    <div className="mt-10 md:mt-12">
      <SectionHeader>RELEASE DATES</SectionHeader>
      <div className="flex flex-col gap-[4px] sm:gap-[6px]">
        {visible.map((d, i) => {
          const country = d.country?.country
            ? translateCountry(d.country.country, true)
            : "";
          const label = DIST_TYPE_LABELS[d.type] ?? d.type.replace(/_/g, " ");
          const subLabel = d.subType
            ? (DIST_SUBTYPE_LABELS[d.subType] ?? d.subType)
            : null;
          const companies = d.companies?.map((c) => c.name).join(", ");
          return (
            <div
              key={i}
              className="flex items-center gap-3 sm:gap-4 bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius)] px-3 sm:px-4 py-[9px] sm:py-[11px]"
            >
              <div className="flex-shrink-0 w-[90px] sm:w-[105px]">
                <span className="font-display text-[13px] sm:text-[15px] text-[var(--accent)]">
                  {new Date(d.date!).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[12px] sm:text-[13px] font-semibold text-[var(--text)] truncate">
                    {country}
                  </span>
                  {subLabel && (
                    <span className="text-[10px] text-[var(--text-muted)] bg-[var(--surface)] px-[6px] py-[2px] rounded-[4px] flex-shrink-0">
                      {subLabel}
                    </span>
                  )}
                  {d.reRelease && (
                    <span className="text-[10px] text-[var(--text-muted)] bg-[var(--surface)] px-[6px] py-[2px] rounded-[4px] flex-shrink-0">
                      Re-release
                    </span>
                  )}
                </div>
                {companies && (
                  <p className="text-[10px] sm:text-[11px] text-[var(--text-muted)] mt-[1px] truncate">
                    {companies}
                  </p>
                )}
              </div>
              <span className="text-[10px] text-[var(--text-muted)] flex-shrink-0 hidden sm:block">
                {label}
              </span>
            </div>
          );
        })}
      </div>
      {sorted.length > 6 && (
        <ExpandBtn onClick={() => setExpanded((v) => !v)}>
          {expanded ? "Show less" : `Show all ${sorted.length} releases`}
        </ExpandBtn>
      )}
    </div>
  );
}

// ── Section Header ────────────────────────────────────────────────────────────

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
