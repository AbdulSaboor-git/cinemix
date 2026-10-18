"use client";
import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Server,
  Crop,
  Maximize2,
  Film as FilmIcon,
  Heart,
  Clock,
  Star,
  CircleAlert,
} from "lucide-react";
import {
  getFilm,
  getFilmSeasons,
  getSimilarFilms,
} from "@/lib/kinopoisk";
import { Film, Season, SimilarFilm } from "@/types/kinopoisk";
import { getPlayerById, PlayerProvider } from "@/lib/players";
import { getPreferences, hasApiKeys } from "@/lib/preferences";
import {
  addToHistory,
  toggleFavorite,
  toggleWatchLater,
  isInList,
} from "@/lib/userLists";
import { translateGenre, translateCountry } from "@/lib/translate";
import {
  useAutoTranslate,
  useFilmTitle,
  useTranslate,
} from "@/hooks/useTranslate";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { useToast } from "@/lib/toast";
import BackButton from "@/components/BackButton";
import PlayerSelectModal from "@/components/PlayerSelectModal";
import TrailerModal from "@/components/TrailerModal";
import PageContainer from "@/components/ui/PageContainer";
import SectionHeader from "@/components/ui/SectionHeader";
import TabBar from "@/components/ui/TabBar";
import TabPill from "@/components/ui/TabPill";
import PosterImage from "@/components/ui/PosterImage";
import EmptyState from "@/components/ui/EmptyState";
import NoKeyBanner from "@/components/ui/NoKeyBanner";

const HISTORY_THRESHOLD_S = 10;

function EpisodeRow({
  epNumber,
  nameRu,
  nameEn,
  releaseDate,
  synopsis,
  autoTranslate,
}: {
  epNumber: number;
  nameRu?: string;
  nameEn?: string;
  releaseDate?: string;
  synopsis?: string;
  autoTranslate: boolean;
}) {
  const epTitle = useFilmTitle({ nameRu, nameEn }, autoTranslate);
  const translatedSynopsis = useTranslate(synopsis);

  return (
    <div className="flex items-start gap-3 border border-[var(--border)] bg-[var(--bg-card)] rounded-[8px] px-3 sm:px-4 py-2.5 sm:py-3">
      <span className="font-display text-[var(--text-muted)] flex-shrink-0 text-[15px] sm:text-[18px] w-6 sm:w-8 pt-0.5">
        {epNumber}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <p className="font-semibold text-[var(--text)] text-[12px] sm:text-[13px] truncate">
            {epTitle !== "Unknown" ? epTitle : `Episode ${epNumber}`}
          </p>
          {releaseDate && (
            <span className="text-[10px] sm:text-[11px] text-[var(--text-muted)]">
              {new Date(releaseDate).toLocaleDateString("en-US", {
                year: "numeric",
                month: "short",
                day: "numeric",
              })}
            </span>
          )}
        </div>
        {translatedSynopsis && (
          <p className="text-[11px] sm:text-[12px] text-[var(--text-muted)] mt-1 line-clamp-2">
            {translatedSynopsis}
          </p>
        )}
      </div>
    </div>
  );
}

function SimilarCard({
  item,
  autoTranslate,
}: {
  item: SimilarFilm;
  autoTranslate: boolean;
}) {
  const title = useFilmTitle(item, autoTranslate);
  return (
    <Link
      href={`/film/${item.filmId}`}
      className="no-underline flex-shrink-0 group w-[115px] sm:w-[140px]"
    >
      <div className="rounded-[10px] overflow-hidden border border-[var(--border)] group-hover:border-[rgba(229,9,20,0.35)] bg-[var(--bg-card)] aspect-[2/3] relative transition-colors">
        <PosterImage
          src={item.posterUrlPreview || item.posterUrl}
          alt={title}
          title={title}
        />
      </div>
      <p className="text-[11px] sm:text-[12px] font-semibold text-[var(--text)] mt-1.5 truncate group-hover:text-white">
        {title}
      </p>
    </Link>
  );
}

export default function WatchPageClient({
  filmId,
  initialPlayerId,
}: {
  filmId: string;
  initialPlayerId?: string;
}) {
  const id = parseInt(filmId, 10);
  const router = useRouter();
  const { toast } = useToast();
  const autoTranslate = useAutoTranslate();

  const [noKey, setNoKey] = useState(false);
  const [film, setFilm] = useState<Film | null>(null);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [activeSeason, setActiveSeason] = useState(0);
  const [similars, setSimilars] = useState<SimilarFilm[]>([]);
  const [loading, setLoading] = useState(!isNaN(id));
  const [error, setError] = useState(isNaN(id));

  const [activeProvider, setActiveProvider] = useState<PlayerProvider>(() =>
    getPlayerById(initialPlayerId),
  );
  const [cropHeader, setCropHeader] = useState<boolean>(
    Boolean(activeProvider.cropTopHeader),
  );
  const [serverModalOpen, setServerModalOpen] = useState(false);
  const [trailerModalOpen, setTrailerModalOpen] = useState(false);

  const [isFav, setIsFav] = useState(false);
  const [isWL, setIsWL] = useState(false);

  const name = useFilmTitle(film, autoTranslate);
  const description = useTranslate(film?.description || film?.shortDescription);
  useDocumentTitle(film ? `Watching ${name}` : "Watch");

  const secondsRef = useRef(0);
  const addedRef = useRef(false);

  useEffect(() => {
    const prefs = getPreferences();
    const chosen = getPlayerById(initialPlayerId || prefs.preferredPlayerId);
    setActiveProvider(chosen);
    setCropHeader(Boolean(chosen.cropTopHeader));
  }, [initialPlayerId]);

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
    setIsFav(isInList("favorites", id));
    setIsWL(isInList("watchlater", id));

    getFilm(id)
      .then((f) => {
        if (!mounted) return;
        setFilm(f);
        setLoading(false);

        const fs = getPreferences().filmSections;
        if (fs.similars) {
          getSimilarFilms(id)
            .then((d) => mounted && setSimilars(d.items ?? []))
            .catch(() => {});
        }
        if (f.serial || f.type === "TV_SERIES" || f.type === "MINI_SERIES") {
          getFilmSeasons(id)
            .then((d) => mounted && setSeasons(d.items ?? []))
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

  // Accurate 10-second (1000ms interval) watch history tracker
  useEffect(() => {
    if (!film || isNaN(id)) return;
    secondsRef.current = 0;
    addedRef.current = false;

    const timer = setInterval(() => {
      secondsRef.current += 1;
      if (secondsRef.current >= HISTORY_THRESHOLD_S && !addedRef.current) {
        addedRef.current = true;
        addToHistory({
          film_id: id,
          film_name: name || film.nameEn || film.nameOriginal || film.nameRu || "Unknown",
          poster_url: film.posterUrlPreview || film.posterUrl || null,
          year: film.year ?? film.startYear ?? null,
          rating: film.ratingKinopoisk ?? film.ratingImdb ?? null,
        });
        clearInterval(timer);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [film, id, name]);

  // Block popup ads from iframe
  useEffect(() => {
    const originalOpen = window.open;
    window.open = function (url, target, features) {
      if (target === "_blank" || !target) return null;
      return originalOpen.call(window, url, target, features);
    };
    return () => {
      window.open = originalOpen;
    };
  }, []);

  if (noKey) return <NoKeyBanner />;

  if (loading) {
    return (
      <PageContainer>
        <div className="skeleton h-10 w-64 rounded-[8px] mb-4" />
        <div className="skeleton w-full aspect-video max-h-[80vh] rounded-[var(--radius-lg)]" />
      </PageContainer>
    );
  }

  if (error || !film) {
    return (
      <PageContainer>
        <EmptyState
          icon={<CircleAlert size={36} stroke="var(--accent)" />}
          title="Unable to Load Stream"
          description="The requested film could not be loaded."
          actionLabel="Back to Home"
          actionHref="/"
        />
      </PageContainer>
    );
  }

  const rating = film.ratingKinopoisk ?? film.ratingImdb;
  const year = film.year || film.startYear;
  const playerUrl = activeProvider.buildUrl(id);
  const videosEnabled = getPreferences().filmSections.videos;

  const filmEntry = {
    film_id: id,
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

  const handleSelectProvider = (provider: PlayerProvider) => {
    setActiveProvider(provider);
    setCropHeader(Boolean(provider.cropTopHeader));
    router.replace(`/watch/${id}?player=${encodeURIComponent(provider.id)}`, {
      scroll: false,
    });
    toast.info(`Switched to ${provider.name}`);
  };

  return (
    <PageContainer className="pt-4 sm:pt-6">
      {/* Top Cinema Control Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4 bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-lg)] px-4 py-3">
        <div className="flex items-center gap-3 min-w-0 flex-wrap">
          <BackButton
            fallbackHref={`/film/${id}`}
            label="Film Details"
            className="mb-0"
          />
          <span className="text-[var(--border-hover)] hidden sm:inline">|</span>
          <div className="min-w-0 flex items-center gap-2.5 flex-wrap">
            <Link
              href={`/film/${id}`}
              className="no-underline hover:underline text-white"
            >
              <h1 className="font-display tracking-[1.2px] text-[18px] sm:text-[22px] text-white leading-none m-0 truncate">
                {name}
              </h1>
            </Link>
            {year && (
              <span className="text-[12px] text-[var(--text-muted)]">
                ({year})
              </span>
            )}
            {film.filmLength && (
              <span className="text-[12px] text-[var(--text-muted)] hidden sm:inline">
                · {Math.floor(film.filmLength / 60)}h {film.filmLength % 60}m
              </span>
            )}
            {rating && (
              <span className="inline-flex items-center gap-1 text-[12px] text-[#f5c518] font-display">
                <Star size={11} fill="#f5c518" stroke="#f5c518" />
                {rating.toFixed(1)}
              </span>
            )}
          </div>
        </div>

        {/* Action controls */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setServerModalOpen(true)}
            className="btn btn-primary py-2 px-3.5 text-[12px] sm:text-[13px]"
          >
            <Server size={14} />
            {activeProvider.name}
          </button>

          <button
            type="button"
            onClick={() => setCropHeader((v) => !v)}
            title={
              cropHeader
                ? "Disable top header crop"
                : "Crop provider top header"
            }
            className={`btn btn-ghost py-2 px-3 text-[12px] ${
              cropHeader ? "border-[rgba(229,9,20,0.4)] text-[var(--accent)]" : ""
            }`}
          >
            {cropHeader ? <Crop size={14} /> : <Maximize2 size={14} />}
            <span className="hidden sm:inline">
              {cropHeader ? "Cropped Fit" : "Full Fit"}
            </span>
          </button>

          {videosEnabled && (
            <button
              type="button"
              onClick={() => setTrailerModalOpen(true)}
              className="btn btn-ghost py-2 px-3 text-[12px]"
            >
              <FilmIcon size={14} />
              <span className="hidden sm:inline">Trailer</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleFav}
            aria-label="Toggle Favorite"
            className={`btn btn-ghost py-2 px-3 text-[12px] ${
              isFav ? "border-[rgba(229,9,20,0.5)] text-[var(--accent)]" : ""
            }`}
          >
            <Heart
              size={14}
              fill={isFav ? "var(--accent)" : "none"}
              stroke={isFav ? "var(--accent)" : "currentColor"}
            />
          </button>

          <button
            type="button"
            onClick={handleWL}
            aria-label="Toggle Watch Later"
            className={`btn btn-ghost py-2 px-3 text-[12px] ${
              isWL ? "border-[rgba(96,165,250,0.5)] text-[#60a5fa]" : ""
            }`}
          >
            <Clock
              size={14}
              stroke={isWL ? "#60a5fa" : "currentColor"}
            />
          </button>
        </div>
      </div>

      {/* Theater Video Stage */}
      <div className="w-full aspect-video max-h-[80vh] bg-black rounded-[var(--radius-lg)] overflow-hidden relative border border-[var(--border)] shadow-[0_20px_70px_rgba(0,0,0,0.85)]">
        <iframe
          key={`${activeProvider.id}-${id}`}
          src={playerUrl}
          allowFullScreen
          className={
            cropHeader
              ? "absolute w-full border-none block bg-black top-0 md:-top-[81%] h-full md:h-[180%]"
              : "absolute inset-0 w-full h-full border-none block bg-black"
          }
          allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
          title={name}
        />
      </div>

      {/* Synopsis + Genres below player */}
      <div className="mt-6 bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-lg)] p-4 sm:p-6">
        <div className="flex flex-wrap gap-2 mb-3">
          {film.genres?.map((g) => (
            <Link
              key={g.genre}
              href={`/explore?genres=${encodeURIComponent(g.genre)}`}
              className="no-underline"
            >
              <span className="tag tag-accent capitalize cursor-pointer">
                {translateGenre(g.genre, autoTranslate)}
              </span>
            </Link>
          ))}
          {film.countries?.map((c) => (
            <Link
              key={c.country}
              href={`/explore?countries=${encodeURIComponent(c.country)}`}
              className="no-underline"
            >
              <span className="tag tag-dim cursor-pointer">
                {translateCountry(c.country, autoTranslate)}
              </span>
            </Link>
          ))}
        </div>
        {description && (
          <p className="text-[13px] sm:text-[14px] text-[var(--text-dim)] leading-[1.7] m-0">
            {description}
          </p>
        )}
      </div>

      {/* Seasons & Episodes (for TV Series) */}
      {seasons.length > 0 && (
        <div className="mt-8">
          <SectionHeader title="SEASONS & EPISODES" count={seasons.length} />
          <TabBar className="mb-4">
            {seasons.map((s, i) => (
              <TabPill
                key={s.number ?? i}
                active={activeSeason === i}
                onClick={() => setActiveSeason(i)}
              >
                Season {s.number} ({s.episodes.length})
              </TabPill>
            ))}
          </TabBar>
          {seasons[activeSeason] && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {seasons[activeSeason].episodes.map((ep, i) => (
                <EpisodeRow
                  key={`${ep.seasonNumber}-${ep.episodeNumber}-${i}`}
                  epNumber={ep.episodeNumber}
                  nameRu={ep.nameRu}
                  nameEn={ep.nameEn}
                  releaseDate={ep.releaseDate}
                  synopsis={ep.synopsis}
                  autoTranslate={autoTranslate}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Similar Films */}
      {similars.length > 0 && (
        <div className="mt-8">
          <SectionHeader title="SIMILAR FILMS" count={similars.length} />
          <div className="flex gap-3 overflow-x-auto pb-3 scrollbar-none">
            {similars.slice(0, 12).map((sf) => (
              <SimilarCard
                key={sf.filmId}
                item={sf}
                autoTranslate={autoTranslate}
              />
            ))}
          </div>
        </div>
      )}

      {serverModalOpen && (
        <PlayerSelectModal
          open={serverModalOpen}
          filmId={id}
          filmTitle={name}
          filmYear={year}
          selectedPlayerId={activeProvider.id}
          onClose={() => setServerModalOpen(false)}
          onSelectProvider={handleSelectProvider}
        />
      )}

      {trailerModalOpen && (
        <TrailerModal
          open={trailerModalOpen}
          filmId={id}
          filmTitle={name}
          onClose={() => setTrailerModalOpen(false)}
        />
      )}
    </PageContainer>
  );
}
