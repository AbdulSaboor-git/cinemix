"use client";
import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Play,
  Film as FilmIcon,
  Heart,
  Clock,
  ChevronLeft,
  ChevronRight,
  X,
  Star,
  CircleAlert,
  EyeOff,
  Eye,
  PenLine,
  TriangleAlert,
  ThumbsUp,
  ThumbsDown,
  Trophy,
  Award as AwardIcon,
} from "lucide-react";
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
  translateGenre,
  translateCountry,
  translateAwardName,
  isRussian,
} from "@/lib/translate";
import { getPreferences, hasApiKeys } from "@/lib/preferences";
import {
  useTranslate,
  useTranslateHtml,
  useAutoTranslate,
  useFilmTitle,
} from "@/hooks/useTranslate";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { lockScroll, unlockScroll } from "@/lib/scrollLock";
import ActorCard from "@/components/ActorCard";
import FilmCard from "@/components/FilmCard";
import BackButton from "@/components/BackButton";
import PageContainer from "@/components/ui/PageContainer";
import SectionHeader from "@/components/ui/SectionHeader";
import TabBar from "@/components/ui/TabBar";
import TabPill from "@/components/ui/TabPill";
import PosterImage from "@/components/ui/PosterImage";
import EmptyState from "@/components/ui/EmptyState";
import NoKeyBanner from "@/components/ui/NoKeyBanner";
import { toggleFavorite, toggleWatchLater, isInList } from "@/lib/userLists";
import { useToast } from "@/lib/toast";

export default function FilmPageClient({ filmId }: { filmId: string }) {
  const id = parseInt(filmId, 10);
  const [noKey, setNoKey] = useState(false);
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
    if (!hasApiKeys()) {
      setNoKey(true);
      setLoading(false);
      return;
    }
    if (isNaN(id)) return;
    let mounted = true;
    setLoading(true);
    setError(false);
    setStaff([]);
    setRelated([]);
    setFacts([]);
    setBoxOffice([]);
    setSeasons([]);
    setSimilars([]);
    setReviews([]);
    setAwards([]);
    setImages([]);
    setDistributions([]);
    window.scrollTo({ top: 0 });

    // Await only getFilm(id) so the main detail view renders immediately
    getFilm(id)
      .then((f) => {
        if (!mounted) return;
        setFilm(f);
        setLoading(false);

        const fs = getPreferences().filmSections;

        if (fs.cast) {
          getFilmStaff(id)
            .then((s) => mounted && setStaff(s || []))
            .catch(() => {});
        }
        if (fs.sequels) {
          getRelatedFilms(id)
            .then((r) => mounted && setRelated(r || []))
            .catch(() => {});
        }
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

  if (noKey) return <NoKeyBanner />;
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

function StaffPersonLink({
  staff,
  autoTranslate,
  isLast,
}: {
  staff: Staff;
  autoTranslate: boolean;
  isLast: boolean;
}) {
  const rawName =
    autoTranslate && staff.nameEn && !isRussian(staff.nameEn)
      ? staff.nameEn
      : staff.nameRu || staff.nameEn || "Unknown";
  const translated = useTranslate(rawName);
  const label = translated || rawName;

  return (
    <>
      <Link
        href={`/person/${staff.staffId}`}
        className="text-[var(--text)] no-underline hover:text-[var(--accent)] hover:underline transition-colors"
      >
        {label}
      </Link>
      {!isLast && <span className="text-[var(--text-muted)]">, </span>}
    </>
  );
}

function StaffInfoRow({
  label,
  list,
  autoTranslate,
}: {
  label: string;
  list: Staff[];
  autoTranslate: boolean;
}) {
  if (!list.length) return null;
  return (
    <div className="flex gap-2 sm:gap-3 mb-[10px] items-start">
      <span className="text-[11px] sm:text-[12px] text-[var(--text-muted)] w-[76px] sm:w-[86px] flex-shrink-0 font-semibold uppercase tracking-[0.5px] pt-[2px]">
        {label}
      </span>
      <span className="text-[13px] sm:text-[14px] text-[var(--text-dim)] leading-[1.5]">
        {list.map((s, i) => (
          <StaffPersonLink
            key={`${s.staffId}-${i}`}
            staff={s}
            autoTranslate={autoTranslate}
            isLast={i === list.length - 1}
          />
        ))}
      </span>
    </div>
  );
}

function SimilarFilmItem({
  sf,
  autoTranslate,
}: {
  sf: SimilarFilm;
  autoTranslate: boolean;
}) {
  const sfName = useFilmTitle(sf, autoTranslate);
  return (
    <Link
      href={`/film/${sf.filmId}`}
      className="no-underline flex-shrink-0 group"
    >
      <div className="w-[110px] sm:w-[130px] md:w-[150px] cursor-pointer">
        <div className="rounded-[10px] overflow-hidden border border-[var(--border)] group-hover:border-[rgba(229,9,20,0.35)] bg-[var(--bg-card)] aspect-[2/3] relative transition-colors">
          <PosterImage
            src={sf.posterUrlPreview || sf.posterUrl}
            alt={sfName}
            title={sfName}
          />
        </div>
        <p className="text-[11px] sm:text-[12px] font-semibold text-[var(--text)] mt-[6px] overflow-hidden text-ellipsis whitespace-nowrap group-hover:text-white">
          {sfName}
        </p>
      </div>
    </Link>
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
  const name = useFilmTitle(film, autoTranslate);
  const description = useTranslate(film.description);
  const slogan = useTranslate(film.slogan);

  const displayYear = film.serial
    ? `${film.startYear || film.year || ""}${film.endYear ? ` – ${film.endYear}` : film.completed === false ? " – present" : ""}`
    : String(film.year || "");

  useDocumentTitle(
    name ? `${name}${displayYear ? ` (${displayYear})` : ""}` : "Film",
  );

  const [reviewsExpanded, setReviewsExpanded] = useState(false);
  const [factsExpanded, setFactsExpanded] = useState(false);
  const [showSpoilers, setShowSpoilers] = useState(false);
  const [activeTab, setActiveTab] = useState<"facts" | "bloopers">("facts");
  const [isFav, setIsFav] = useState(false);
  const [isWL, setIsWL] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    setIsFav(isInList("favorites", filmId));
    setIsWL(isInList("watchlater", filmId));
  }, [filmId]);

  const filmEntry = {
    film_id: filmId,
    film_name: name,
    poster_url: film.posterUrlPreview || film.posterUrl || null,
    year: film.year ?? film.startYear ?? null,
    rating: film.ratingKinopoisk ?? film.ratingImdb ?? null,
  };

  const handleFav = () => {
    const added = toggleFavorite(filmEntry);
    setIsFav(added);
    toast.success(added ? "Added to Favorites" : "Removed from Favorites");
  };

  const handleWL = () => {
    const added = toggleWatchLater(filmEntry);
    setIsWL(added);
    toast.info(added ? "Saved to Watch Later" : "Removed from Watch Later");
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

  const budget = boxOffice.find((b) => b.type === "BUDGET");
  const usaGross = boxOffice.find((b) => b.type === "USA");
  const worldGross = boxOffice.find((b) => b.type === "WORLD");
  const hasBoxOffice = budget || usaGross || worldGross;

  const factItems = facts.filter((f) => f.type === "FACT");
  const blooperItems = facts.filter((f) => f.type === "BLOOPER");
  const activeFactItems = activeTab === "facts" ? factItems : blooperItems;
  // Filter out spoilers BEFORE slicing so non-spoiler facts are never hidden behind leading spoilers
  const filteredFactItems = activeFactItems.filter(
    (f) => !f.spoiler || showSpoilers,
  );
  const visibleFacts = factsExpanded
    ? filteredFactItems
    : filteredFactItems.slice(0, 4);
  const visibleReviews = reviewsExpanded ? reviews : reviews.slice(0, 2);

  const ratings = [
    film.ratingKinopoisk && {
      label: "Kinopoisk",
      value: film.ratingKinopoisk,
      votes: film.ratingKinopoiskVoteCount,
      color: "accent" as const,
    },
    film.ratingImdb && {
      label: "IMDb",
      value: film.ratingImdb,
      votes: film.ratingImdbVoteCount,
      color: "gold" as const,
    },
    film.ratingFilmCritics && {
      label: "Critics",
      value: film.ratingFilmCritics,
      votes: film.ratingFilmCriticsVoteCount,
      color: "blue" as const,
    },
  ].filter(Boolean) as {
    label: string;
    value: number;
    votes?: number;
    color: "accent" | "gold" | "blue";
  }[];

  return (
    <PageContainer>
      <BackButton />

      {/* ── Hero ── */}
      <div className="flex flex-col md:flex-row gap-6 md:gap-10 lg:gap-12 md:items-start">
        {/* Poster column */}
        <div className="w-full md:w-[260px] flex-shrink-0">
          <div className="w-[150px] sm:w-[180px] md:w-full mx-auto md:mx-0 mb-5 md:mb-0">
            <div className="rounded-[var(--radius-lg)] overflow-hidden border border-[var(--border)] shadow-[0_8px_40px_rgba(0,0,0,0.6)] aspect-[2/3] relative">
              <PosterImage
                src={film.posterUrlPreview || film.posterUrl}
                alt={name}
                title={name}
                priority
              />
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
                      style={{ width: `${Math.min(100, film.ratingAwait)}%` }}
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
            {film.has3D && <span className="tag tag-dim text-[11px]">3D</span>}
          </div>
        </div>

        {/* Info column */}
        <div className="flex-1 min-w-0">
          <h1 className="font-display leading-[1.05] tracking-[1px] text-white mb-2 text-[clamp(24px,6vw,52px)]">
            {name}
          </h1>

          <div className="flex flex-wrap gap-[6px] sm:gap-2 mb-4">
            {displayYear && <MetaTag>{displayYear}</MetaTag>}
            {film.filmLength && film.filmLength > 0 && (
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

          {/* ── Primary Action Row (Watch Now, Favorite, Watch Later) ── */}
          <div className="flex flex-wrap items-center gap-2.5 mb-6">
            <Link href={`/watch/${filmId}`} className="no-underline">
              <button
                type="button"
                className="btn btn-primary px-5 sm:px-6 py-[10px] text-[13px] sm:text-[14px]"
              >
                <Play size={14} fill="white" stroke="white" />
                Watch Now
              </button>
            </Link>

            <button
              type="button"
              onClick={handleFav}
              className={`flex items-center gap-[7px] rounded-[var(--radius)] px-4 py-[9px] text-[12px] sm:text-[13px] font-semibold border cursor-pointer transition-all duration-150 ${
                isFav
                  ? "bg-[rgba(229,9,20,0.15)] border-[rgba(229,9,20,0.5)] text-[var(--accent)] shadow-[0_0_14px_rgba(229,9,20,0.2)]"
                  : "bg-[var(--bg-elevated)] border-[var(--border)] text-[var(--text-dim)] hover:border-[rgba(229,9,20,0.4)] hover:text-[var(--accent)]"
              }`}
            >
              <Heart
                size={14}
                fill={isFav ? "var(--accent)" : "none"}
                stroke="currentColor"
                strokeWidth={2}
              />
              {isFav ? "Favorited" : "Add to Favorites"}
            </button>

            <button
              type="button"
              onClick={handleWL}
              className={`flex items-center gap-[7px] rounded-[var(--radius)] px-4 py-[9px] text-[12px] sm:text-[13px] font-semibold border cursor-pointer transition-all duration-150 ${
                isWL
                  ? "bg-[rgba(96,165,250,0.12)] border-[rgba(96,165,250,0.4)] text-[#60a5fa]"
                  : "bg-[var(--bg-elevated)] border-[var(--border)] text-[var(--text-dim)] hover:border-[rgba(96,165,250,0.4)] hover:text-[#60a5fa]"
              }`}
            >
              <Clock size={14} stroke="currentColor" strokeWidth={2} />
              {isWL ? "In Watch Later" : "Watch Later"}
            </button>
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

          <StaffInfoRow
            label="Director"
            list={directors}
            autoTranslate={autoTranslate}
          />
          <StaffInfoRow
            label="Writers"
            list={writers}
            autoTranslate={autoTranslate}
          />
          <StaffInfoRow
            label="Producers"
            list={producers}
            autoTranslate={autoTranslate}
          />
          <StaffInfoRow
            label="Music"
            list={composers}
            autoTranslate={autoTranslate}
          />
          {film.imdbId && <InfoRow label="IMDb ID" value={film.imdbId} />}
        </div>
      </div>

      {/* ── Seasons ── */}
      {seasons.length > 0 && (
        <SeasonsSection seasons={seasons} autoTranslate={autoTranslate} />
      )}

      {/* ── Cast ── */}
      {actors.length > 0 && (
        <div className="mt-10 md:mt-12">
          <SectionHeader title="CAST" count={actors.length} />
          <div className="grid gap-[8px] sm:gap-[10px] md:gap-3 grid-cols-[repeat(auto-fill,minmax(90px,1fr))] sm:grid-cols-[repeat(auto-fill,minmax(105px,1fr))]">
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
            <SectionHeader
              title="TRIVIA"
              count={activeFactItems.length}
              className="mb-0"
            />
            <TabBar>
              {factItems.length > 0 && (
                <TabPill
                  active={activeTab === "facts"}
                  onClick={() => setActiveTab("facts")}
                >
                  Facts ({factItems.length})
                </TabPill>
              )}
              {blooperItems.length > 0 && (
                <TabPill
                  active={activeTab === "bloopers"}
                  onClick={() => setActiveTab("bloopers")}
                >
                  Bloopers ({blooperItems.length})
                </TabPill>
              )}
              <button
                type="button"
                onClick={() => setShowSpoilers((v) => !v)}
                className={`flex-shrink-0 px-3 py-[6px] rounded-[8px] text-[12px] cursor-pointer bg-transparent transition-colors duration-[180ms] inline-flex items-center gap-1.5 ${
                  showSpoilers
                    ? "text-[var(--accent)] border border-[var(--accent)]"
                    : "text-[var(--text-muted)] border border-[var(--border)]"
                }`}
              >
                {showSpoilers ? (
                  <>
                    <EyeOff size={13} />
                    <span>Hide Spoilers</span>
                  </>
                ) : (
                  <>
                    <Eye size={13} />
                    <span>Show Spoilers</span>
                  </>
                )}
              </button>
            </TabBar>
          </div>
          <div className="flex flex-col gap-2">
            {visibleFacts.map((fact, i) => (
              <FactCard key={i} fact={fact} />
            ))}
          </div>
          {filteredFactItems.length > 4 && (
            <ExpandBtn onClick={() => setFactsExpanded((v) => !v)}>
              {factsExpanded
                ? "Show less"
                : `Show all ${filteredFactItems.length} ${activeTab}`}
            </ExpandBtn>
          )}
        </div>
      )}

      {/* ── Reviews ── */}
      {reviews.length > 0 && (
        <div className="mt-10 md:mt-12">
          <SectionHeader title="AUDIENCE REVIEWS" count={reviews.length} />
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
      {images.length > 0 && <GallerySection images={images} />}

      {/* ── Awards ── */}
      {awards.length > 0 && (
        <AwardsSection awards={awards} autoTranslate={autoTranslate} />
      )}

      {/* ── Distributions ── */}
      {distributions.length > 0 && (
        <DistributionsSection
          distributions={distributions}
          autoTranslate={autoTranslate}
        />
      )}

      {/* ── Similar films ── */}
      {similars.length > 0 && (
        <div className="mt-10 md:mt-12">
          <SectionHeader title="YOU MAY ALSO LIKE" count={similars.length} />
          <div className="flex gap-3 overflow-x-auto pb-3 scrollbar-none">
            {similars.slice(0, 12).map((sf) => (
              <SimilarFilmItem
                key={sf.filmId}
                sf={sf}
                autoTranslate={autoTranslate}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── Related ── */}
      {related.length > 0 && (
        <div className="mt-10 md:mt-12">
          <SectionHeader title="SEQUELS & PREQUELS" count={related.length} />
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
    </PageContainer>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function EditorAnnotation({ text }: { text: string }) {
  const translated = useTranslate(text);
  return (
    <p className="text-[13px] text-[var(--text-dim)] italic flex items-start gap-2 m-0">
      <PenLine size={14} className="text-[var(--accent)] flex-shrink-0 mt-1" />
      <span>{translated}</span>
    </p>
  );
}

function FactCard({ fact }: { fact: Fact }) {
  const text = useTranslateHtml(fact.text);
  return (
    <div
      className={`bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius)] p-[12px_14px] sm:p-[14px_18px] text-[13px] sm:text-[14px] leading-[1.7] text-[var(--text-dim)] ${
        fact.spoiler
          ? "border-l-[3px] border-l-[var(--accent)]"
          : "border-l-[3px] border-l-[var(--border-hover)]"
      }`}
    >
      {fact.spoiler && (
        <span className="text-[10px] text-[var(--accent)] font-bold inline-flex items-center gap-1 mb-1">
          <TriangleAlert size={11} />
          SPOILER
        </span>
      )}
      <span className="block">{text}</span>
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
            className={`text-[10px] sm:text-[11px] font-bold uppercase rounded-[4px] px-2 py-[2px] inline-flex items-center gap-1 ${badgeCls}`}
          >
            {isPositive ? (
              <>
                <ThumbsUp size={11} />
                <span>Good</span>
              </>
            ) : isNegative ? (
              <>
                <ThumbsDown size={11} />
                <span>Bad</span>
              </>
            ) : (
              "Neutral"
            )}
          </span>
          {review.positiveRating + review.negativeRating > 0 && (
            <span className="text-[10px] text-[var(--text-muted)]">
              +{review.positiveRating} / −{review.negativeRating}
            </span>
          )}
        </div>
      </div>
      <p className="text-[12px] sm:text-[13px] leading-[1.7] text-[var(--text-dim)]">
        {displayText}
      </p>
      {body.length > MAX && (
        <button
          type="button"
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

function SeasonEpisodeRow({
  epNumber,
  nameRu,
  nameEn,
  synopsis,
  releaseDate,
  autoTranslate,
}: {
  epNumber: number;
  nameRu?: string;
  nameEn?: string;
  synopsis?: string;
  releaseDate?: string;
  autoTranslate: boolean;
}) {
  const epName = useFilmTitle({ nameRu, nameEn }, autoTranslate);
  const translatedSynopsis = useTranslate(synopsis);

  return (
    <div className="flex items-start gap-2 sm:gap-3 md:gap-4 border border-[var(--border)] bg-[var(--bg-card)] rounded-[8px] px-3 md:px-4 py-[10px] md:py-3">
      <span className="font-display text-[var(--text-muted)] flex-shrink-0 text-[15px] md:text-[20px] w-6 md:w-10 pt-0.5">
        {epNumber}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <p className="font-semibold text-[var(--text)] overflow-hidden text-ellipsis whitespace-nowrap text-[12px] sm:text-[13px] md:text-[14px]">
            {epName !== "Unknown" ? epName : `Episode ${epNumber}`}
          </p>
          {releaseDate && (
            <p className="text-[10px] sm:text-[11px] text-[var(--text-muted)]">
              {new Date(releaseDate).toLocaleDateString("en-US", {
                year: "numeric",
                month: "short",
                day: "numeric",
              })}
            </p>
          )}
        </div>
        {translatedSynopsis && (
          <p className="text-[11px] sm:text-[12px] text-[var(--text-muted)] mt-1 leading-relaxed">
            {translatedSynopsis}
          </p>
        )}
      </div>
    </div>
  );
}

function SeasonsSection({
  seasons,
  autoTranslate,
}: {
  seasons: Season[];
  autoTranslate: boolean;
}) {
  const [activeSeason, setActiveSeason] = useState(0);
  const season = seasons[activeSeason];

  return (
    <div className="mt-10 md:mt-12">
      <SectionHeader title="SEASONS & EPISODES" count={seasons.length} />
      <TabBar className="mb-5">
        {seasons.map((s, i) => (
          <TabPill
            key={s.number ?? i}
            active={activeSeason === i}
            onClick={() => setActiveSeason(i)}
          >
            S{s.number}
            <span className="opacity-70 text-[10px]">
              ({s.episodes.length})
            </span>
          </TabPill>
        ))}
      </TabBar>
      {season && (
        <div className="flex flex-col gap-[4px]">
          {season.episodes.map((ep, i) => (
            <SeasonEpisodeRow
              key={`${ep.seasonNumber}-${ep.episodeNumber}-${i}`}
              epNumber={ep.episodeNumber}
              nameRu={ep.nameRu}
              nameEn={ep.nameEn}
              synopsis={ep.synopsis}
              releaseDate={ep.releaseDate}
              autoTranslate={autoTranslate}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function GallerySection({ images }: { images: ImageItem[] }) {
  const [lightbox, setLightbox] = useState<number | null>(null);
  const visible = images.slice(0, 12);

  const prev = () =>
    setLightbox((i) => (i !== null ? Math.max(0, i - 1) : null));
  const next = () =>
    setLightbox((i) =>
      i !== null ? Math.min(visible.length - 1, i + 1) : null,
    );

  useEffect(() => {
    if (lightbox === null) return;
    lockScroll();
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightbox(null);
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
    };
    document.addEventListener("keydown", handler);
    return () => {
      unlockScroll();
      document.removeEventListener("keydown", handler);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lightbox]);

  return (
    <div className="mt-10 md:mt-12">
      <SectionHeader title="GALLERY" count={images.length} />
      <div className="grid gap-[6px] sm:gap-2 grid-cols-3 sm:grid-cols-4 md:grid-cols-6">
        {visible.map((img, i) => (
          <button
            key={i}
            type="button"
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
          className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/90 backdrop-blur-md"
          onClick={() => setLightbox(null)}
        >
          <button
            type="button"
            className="absolute left-3 sm:left-6 top-1/2 -translate-y-1/2 w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-[rgba(255,255,255,0.08)] border border-[rgba(255,255,255,0.15)] flex items-center justify-center cursor-pointer hover:bg-[rgba(255,255,255,0.15)] transition-colors z-10"
            onClick={(e) => {
              e.stopPropagation();
              prev();
            }}
            aria-label="Previous image"
          >
            <ChevronLeft size={18} stroke="white" strokeWidth={2.5} />
          </button>

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

          <button
            type="button"
            className="absolute right-3 sm:right-6 top-1/2 -translate-y-1/2 w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-[rgba(255,255,255,0.08)] border border-[rgba(255,255,255,0.15)] flex items-center justify-center cursor-pointer hover:bg-[rgba(255,255,255,0.15)] transition-colors z-10"
            onClick={(e) => {
              e.stopPropagation();
              next();
            }}
            aria-label="Next image"
          >
            <ChevronRight size={18} stroke="white" strokeWidth={2.5} />
          </button>

          <button
            type="button"
            className="absolute top-4 right-4 sm:top-6 sm:right-6 w-9 h-9 rounded-full bg-[rgba(255,255,255,0.08)] flex items-center justify-center cursor-pointer hover:bg-[rgba(255,255,255,0.15)] transition-colors border-none"
            onClick={() => setLightbox(null)}
            aria-label="Close lightbox"
          >
            <X size={16} stroke="white" strokeWidth={2.5} />
          </button>
        </div>
      )}
    </div>
  );
}

function AwardsSection({
  awards,
  autoTranslate,
}: {
  awards: Award[];
  autoTranslate: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const wins = awards.filter((a) => a.win);
  const nominations = awards.filter((a) => !a.win);
  const visible = expanded ? awards : awards.slice(0, 6);

  return (
    <div className="mt-10 md:mt-12">
      <SectionHeader
        title="AWARDS"
        badges={
          <div className="flex gap-2">
            {wins.length > 0 && (
              <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#f5c518] bg-[rgba(245,197,24,0.12)] border border-[rgba(245,197,24,0.25)] px-2.5 py-[3px] rounded-[6px]">
                <Trophy size={12} />
                {wins.length} Win{wins.length !== 1 ? "s" : ""}
              </span>
            )}
            {nominations.length > 0 && (
              <span className="text-[11px] font-semibold text-[var(--text-muted)] bg-[var(--surface)] border border-[var(--border)] px-2.5 py-[3px] rounded-[6px]">
                {nominations.length} Nomination
                {nominations.length !== 1 ? "s" : ""}
              </span>
            )}
          </div>
        }
      />

      <div className="flex flex-col gap-[6px] sm:gap-2">
        {visible.map((award, i) => (
          <AwardRow key={i} award={award} autoTranslate={autoTranslate} />
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

function AwardRow({
  award,
  autoTranslate,
}: {
  award: Award;
  autoTranslate: boolean;
}) {
  const mappedAwardName = translateAwardName(award.name, autoTranslate);
  const translatedAwardName = useTranslate(mappedAwardName);
  const awardTitle = translatedAwardName || mappedAwardName;

  const translatedNomination = useTranslate(award.nominationName);
  const nominationTitle = translatedNomination || award.nominationName;

  const rawPersons = award.persons
    ?.slice(0, 2)
    .map((p) =>
      autoTranslate && p.nameEn ? p.nameEn : p.nameRu || p.nameEn || "",
    )
    .filter(Boolean)
    .join(", ");
  const translatedPersons = useTranslate(rawPersons);

  return (
    <div
      className={`flex items-center gap-3 sm:gap-4 bg-[var(--bg-card)] border rounded-[var(--radius)] px-3 sm:px-4 py-[10px] sm:py-3 ${
        award.win
          ? "border-[rgba(245,197,24,0.2)] border-l-[3px] border-l-[#f5c518]"
          : "border-[var(--border)] border-l-[3px] border-l-[var(--border)]"
      }`}
    >
      <div className="w-8 h-8 sm:w-9 sm:h-9 flex-shrink-0 flex items-center justify-center">
        {award.imageUrl ? (
          <Image
            src={award.imageUrl}
            alt={awardTitle}
            width={32}
            height={32}
            className="object-contain rounded-[4px]"
          />
        ) : award.win ? (
          <Trophy size={18} stroke="#f5c518" />
        ) : (
          <AwardIcon size={18} stroke="var(--text-muted)" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[12px] sm:text-[13px] font-bold text-[var(--text)]">
            {awardTitle}
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
          {nominationTitle}
          {translatedPersons && (
            <span className="ml-1 text-[var(--text-dim)]">
              — {translatedPersons}
            </span>
          )}
        </p>
      </div>
    </div>
  );
}

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
  BLURAY: "Blu-ray",
};

function DistributionRow({
  d,
  autoTranslate,
}: {
  d: Distribution;
  autoTranslate: boolean;
}) {
  const country = d.country?.country
    ? translateCountry(d.country.country, autoTranslate)
    : "";
  const label = DIST_TYPE_LABELS[d.type] ?? d.type.replace(/_/g, " ");
  const subLabel = d.subType
    ? (DIST_SUBTYPE_LABELS[d.subType] ?? d.subType)
    : null;
  const rawCompanies = d.companies?.map((c) => c.name).join(", ") || "";
  const companies = useTranslate(rawCompanies);

  return (
    <div className="flex items-center gap-3 sm:gap-4 bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius)] px-3 sm:px-4 py-[9px] sm:py-[11px]">
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
}

function DistributionsSection({
  distributions,
  autoTranslate,
}: {
  distributions: Distribution[];
  autoTranslate: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const sorted = [...distributions]
    .filter((d) => d.date)
    .sort((a, b) => new Date(a.date!).getTime() - new Date(b.date!).getTime());
  const visible = expanded ? sorted : sorted.slice(0, 6);

  if (sorted.length === 0) return null;

  return (
    <div className="mt-10 md:mt-12">
      <SectionHeader title="RELEASE DATES" count={sorted.length} />
      <div className="flex flex-col gap-[4px] sm:gap-[6px]">
        {visible.map((d, i) => (
          <DistributionRow key={i} d={d} autoTranslate={autoTranslate} />
        ))}
      </div>
      {sorted.length > 6 && (
        <ExpandBtn onClick={() => setExpanded((v) => !v)}>
          {expanded ? "Show less" : `Show all ${sorted.length} releases`}
        </ExpandBtn>
      )}
    </div>
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
      type="button"
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
        <Star size={10} fill={c.star} stroke={c.star} />
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
            <Star size={12} fill={c.star} stroke={c.star} />
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
      <span className="text-[11px] sm:text-[12px] text-[var(--text-muted)] w-[76px] sm:w-[86px] flex-shrink-0 font-semibold uppercase tracking-[0.5px] pt-[2px]">
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
    <PageContainer>
      <div className="skeleton h-6 w-20 rounded-[6px] mb-6" />
      <div className="flex flex-col md:flex-row gap-8 md:gap-12">
        <div className="skeleton w-[150px] sm:w-[180px] md:w-[260px] flex-shrink-0 rounded-[12px] aspect-[2/3] mx-auto md:mx-0" />
        <div className="flex-1 min-w-[240px] flex flex-col gap-4">
          <div className="skeleton h-9 sm:h-12 w-[70%] rounded-[8px]" />
          <div className="skeleton h-4 sm:h-5 w-[40%] rounded-[8px]" />
          <div className="skeleton h-[80px] md:h-[100px] rounded-[8px] mt-4" />
          <div className="skeleton h-[60px] rounded-[8px]" />
        </div>
      </div>
    </PageContainer>
  );
}

function ErrorState() {
  return (
    <PageContainer className="flex items-center justify-center">
      <EmptyState
        icon={
          <CircleAlert size={48} stroke="var(--accent)" strokeWidth={1.5} />
        }
        title="Film Not Found"
        description="The requested film could not be loaded."
        actionLabel="Back to Home"
        actionHref="/"
      />
    </PageContainer>
  );
}
