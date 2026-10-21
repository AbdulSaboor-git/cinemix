"use client";
import { useState, useEffect, useRef, useMemo } from "react";
import Link from "next/link";
import {
  Heart,
  Clock,
  Star,
  CircleAlert,
  ShieldAlert,
  Maximize2,
  Minimize2,
  Moon,
  Sun,
  Search,
  Lock,
} from "lucide-react";
import {
  getFilm,
  getFilmSeasons,
  getSimilarFilms,
  isAdultContentFilm,
  isSafeModeActive,
} from "@/lib/kinopoisk";
import { Film, Season, SimilarFilm } from "@/types/kinopoisk";
import { getPreferences, hasApiKeys } from "@/lib/preferences";
import {
  addToHistory,
  toggleFavorite,
  toggleWatchLater,
} from "@/lib/userLists";
import {
  translateGenre,
  translateCountry,
  formatDateSafe,
} from "@/lib/translate";
import {
  useAutoTranslate,
  useFilmTitle,
  useTranslate,
} from "@/hooks/useTranslate";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { useListStatus } from "@/hooks/useListStatus";
import { useToast } from "@/lib/toast";
import BackButton from "@/components/BackButton";
import PageContainer from "@/components/ui/PageContainer";
import SectionHeader from "@/components/ui/SectionHeader";
import TabBar from "@/components/ui/TabBar";
import TabPill from "@/components/ui/TabPill";
import PosterImage from "@/components/ui/PosterImage";
import EmptyState from "@/components/ui/EmptyState";
import NoKeyBanner from "@/components/ui/NoKeyBanner";
import ParentalGuideModal from "@/components/ParentalGuideModal";

const HISTORY_THRESHOLD_S = 10;
const PLAYER_BASE_URL = "https://kinodivbox.github.io/iframe";

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
  const safeDate = formatDateSafe(releaseDate, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

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
          {safeDate && (
            <span className="text-[10px] sm:text-[11px] text-[var(--text-muted)]">
              {safeDate}
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

export default function WatchPageClient({ filmId }: { filmId: string }) {
  const id = parseInt(filmId, 10);
  const { toast } = useToast();
  const autoTranslate = useAutoTranslate();

  const [noKey, setNoKey] = useState(false);
  const [film, setFilm] = useState<Film | null>(null);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [activeSeason, setActiveSeason] = useState(0);
  const [episodeQuery, setEpisodeQuery] = useState("");
  const [similars, setSimilars] = useState<SimilarFilm[]>([]);
  const [loading, setLoading] = useState(!isNaN(id));
  const [error, setError] = useState(isNaN(id));

  // Cinema Controls: Wide Theater & Lights-Off Mode
  const [wideTheater, setWideTheater] = useState(false);
  const [lightsOff, setLightsOff] = useState(false);
  const [parentalOpen, setParentalOpen] = useState(false);

  const { isFav, isWL } = useListStatus(isNaN(id) ? 0 : id);

  const name = useFilmTitle(film, autoTranslate);
  const description = useTranslate(film?.description || film?.shortDescription);
  useDocumentTitle(film ? `Watching ${name}` : "Watch");

  const secondsRef = useRef(0);
  const addedRef = useRef(false);

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

    // Restore last-selected season for this series
    try {
      const savedSeason = localStorage.getItem(`cinemix_last_season_${id}`);
      if (savedSeason !== null) {
        const parsed = parseInt(savedSeason, 10);
        if (!isNaN(parsed) && parsed >= 0) setActiveSeason(parsed);
      }
    } catch {
      // ignore
    }

    getFilm(id)
      .then((f) => {
        if (!mounted) return;
        setFilm(f);
        setLoading(false);

        if (isSafeModeActive() && isAdultContentFilm(f)) {
          return;
        }

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

  // Keyboard shortcuts: W for Wide Theater, L for Lights-Off
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.key === "w" || e.key === "W") {
        setWideTheater((v) => !v);
      } else if (e.key === "l" || e.key === "L") {
        setLightsOff((v) => !v);
      } else if (e.key === "Escape" && lightsOff) {
        setLightsOff(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightsOff]);

  // Accurate 10-second (1000ms interval) watch history tracker
  useEffect(() => {
    if (!film || isNaN(id)) return;
    if (isSafeModeActive() && isAdultContentFilm(film)) return;
    secondsRef.current = 0;
    addedRef.current = false;

    const timer = setInterval(() => {
      secondsRef.current += 1;
      if (secondsRef.current >= HISTORY_THRESHOLD_S && !addedRef.current) {
        addedRef.current = true;
        addToHistory({
          film_id: id,
          film_name:
            name ||
            film.nameEn ||
            film.nameOriginal ||
            film.nameRu ||
            "Unknown",
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

  const currentSeasonEpisodes = useMemo(() => {
    const list = seasons[activeSeason]?.episodes ?? [];
    const q = episodeQuery.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (ep) =>
        String(ep.episodeNumber).includes(q) ||
        (ep.nameEn || "").toLowerCase().includes(q) ||
        (ep.nameRu || "").toLowerCase().includes(q),
    );
  }, [seasons, activeSeason, episodeQuery]);

  if (noKey) return <NoKeyBanner />;

  if (loading) {
    return (
      <PageContainer className="pt-3 sm:pt-5">
        <div className="max-w-[960px] mx-auto">
          <div className="skeleton h-11 w-full rounded-[12px] mb-3" />
          <div className="skeleton w-full h-[360px] sm:h-[460px] md:h-[520px] rounded-[16px]" />
        </div>
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

  // App-Wide Safe Mode Direct Route Gate
  if (isSafeModeActive() && isAdultContentFilm(film)) {
    return (
      <PageContainer className="flex items-center justify-center">
        <EmptyState
          icon={<Lock size={44} stroke="var(--accent)" strokeWidth={1.6} />}
          title="Safe Mode Content Restricted"
          description="This stream is restricted because Safe Mode is enabled in your preferences."
          actionLabel="Back to Home"
          actionHref="/"
        />
      </PageContainer>
    );
  }

  const rating = film.ratingKinopoisk ?? film.ratingImdb;
  const year = film.year || film.startYear;
  const playerUrl = `${PLAYER_BASE_URL}?id=${id}`;

  const filmEntry = {
    film_id: id,
    film_name: name,
    poster_url: film.posterUrlPreview || film.posterUrl || null,
    year: film.year ?? film.startYear ?? null,
    rating: film.ratingKinopoisk ?? film.ratingImdb ?? null,
  };

  const handleFav = () => {
    const added = toggleFavorite(filmEntry);
    toast.success(added ? "Added to Favorites" : "Removed from Favorites");
  };

  const handleWL = () => {
    const added = toggleWatchLater(filmEntry);
    toast.info(added ? "Saved to Watch Later" : "Removed from Watch Later");
  };

  return (
    <PageContainer className="pt-3 sm:pt-5 relative">
      {/* Cinema Lights-Off Dim Overlay */}
      {lightsOff && (
        <div
          className="fixed inset-0 bg-black/85 z-[90] transition-opacity"
          onClick={() => setLightsOff(false)}
        />
      )}

      <div
        className={`${
          wideTheater ? "max-w-[1280px]" : "max-w-[960px]"
        } mx-auto transition-all duration-300 relative ${
          lightsOff ? "z-[95]" : ""
        }`}
      >
        {/* Top Cinema Control Bar */}
        <div className="w-full flex flex-row items-center flex-wrap justify-between gap-2 sm:gap-3 mb-3 bg-[var(--bg-card)] border border-[var(--border)] rounded-[12px] px-3.5 sm:px-4 py-2.5">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-wrap">
            <BackButton
              fallbackHref={`/film/${id}`}
              label="Film Details"
              className="mb-0.5"
              iconOnlyOnPhone
            />
            <span className="text-[var(--border-hover)] hidden sm:inline">
              |
            </span>
            <div className="min-w-0 flex items-center gap-2 flex-wrap">
              <Link
                href={`/film/${id}`}
                className="no-underline hover:underline text-white"
              >
                <h1 className="font-display tracking-[1.2px] text-[16px] sm:text-[20px] text-white leading-none m-0 truncate">
                  {name}
                </h1>
              </Link>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {year && (
                <span className="text-[11px] text-[var(--text-muted)]">
                  ({year})
                </span>
              )}
              {film.filmLength && (
                <span className="text-[11px] text-[var(--text-muted)]">
                  · {Math.floor(film.filmLength / 60)}h {film.filmLength % 60}m
                </span>
              )}
              {rating && (
                <span className="inline-flex items-center gap-1 text-[11px] sm:text-[12px] text-[#f5c518] font-display">
                  <Star
                    className="mb-0.5 sm:mb-1"
                    size={11}
                    fill="#f5c518"
                    stroke="#f5c518"
                  />
                  {rating.toFixed(1)}
                </span>
              )}
              {film.ratingAgeLimits && (
                <button
                  type="button"
                  onClick={() => setParentalOpen(true)}
                  title="View Parental Guide"
                  className="tag tag-accent text-[10px] sm:text-[11px] cursor-pointer hover:border-[rgba(229,9,20,0.5)] inline-flex items-center gap-1"
                >
                  <ShieldAlert size={11} />
                  {film.ratingAgeLimits.replace("age", "")}+
                </button>
              )}
              {film.ratingMpaa && (
                <button
                  type="button"
                  onClick={() => setParentalOpen(true)}
                  title="View Parental Guide"
                  className="tag tag-dim text-[10px] sm:text-[11px] cursor-pointer hover:border-[var(--border-hover)] inline-flex items-center gap-1"
                >
                  <ShieldAlert size={11} />
                  {film.ratingMpaa.toUpperCase()}
                </button>
              )}
            </div>
          </div>

          {/* Action controls */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setWideTheater((v) => !v)}
              title="Toggle Wide Theater Mode (W)"
              className={`btn btn-ghost py-1.5 px-2.5 text-[12px] hidden md:inline-flex ${
                wideTheater
                  ? "border-[rgba(229,9,20,0.5)] text-[var(--accent)]"
                  : ""
              }`}
            >
              {wideTheater ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
              <span>{wideTheater ? "Standard" : "Wide"}</span>
            </button>

            <button
              type="button"
              onClick={() => setLightsOff((v) => !v)}
              title="Toggle Cinema Lights-Off Mode (L)"
              className={`btn btn-ghost py-1.5 px-2.5 text-[12px] ${
                lightsOff
                  ? "border-[rgba(245,197,24,0.5)] text-[#f5c518]"
                  : ""
              }`}
            >
              {lightsOff ? <Sun size={14} /> : <Moon size={14} />}
              <span className="hidden sm:inline">
                {lightsOff ? "Lights On" : "Lights Off"}
              </span>
            </button>

            {!film.ratingAgeLimits && !film.ratingMpaa && (
              <button
                type="button"
                onClick={() => setParentalOpen(true)}
                aria-label="View Parental Guide"
                title="View Parental Guide"
                className="btn btn-ghost py-1.5 px-2.5 text-[12px]"
              >
                <ShieldAlert size={14} />
              </button>
            )}
            <button
              type="button"
              onClick={handleFav}
              aria-label={isFav ? "In Favorites" : "Add to Favorites"}
              title={isFav ? "In Favorites" : "Add to Favorites"}
              className={`btn btn-ghost py-1.5 px-2.5 text-[12px] ${
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
              aria-label={isWL ? "In Watch Later" : "Save to Watch Later"}
              title={isWL ? "In Watch Later" : "Save to Watch Later"}
              className={`btn btn-ghost py-1.5 px-2.5 text-[12px] ${
                isWL ? "border-[rgba(96,165,250,0.5)] text-[#60a5fa]" : ""
              }`}
            >
              <Clock size={14} stroke={isWL ? "#60a5fa" : "currentColor"} />
            </button>
          </div>
        </div>

        {/* Theater Video Stage */}
        <div className="w-full rounded-[16px] overflow-hidden shadow-[0_24px_80px_rgba(0,0,0,0.85)]">
          <iframe
            key={id}
            src={playerUrl}
            width="100%"
            height="510"
            frameBorder="0"
            scrolling="no"
            allowFullScreen
            loading="lazy"
            allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
            title={name}
            className={`w-full ${
              wideTheater
                ? "h-[380px] sm:h-[500px] md:h-[640px]"
                : "h-[340px] sm:h-[440px] md:h-[510px]"
            } border-none block bg-[#1e1918] overflow-hidden transition-all duration-300`}
          />
        </div>

        {/* Synopsis + Genres below player */}
        <div className="mt-5 bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-lg)] p-4 sm:p-6">
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
            <SectionHeader
              title="SEASONS & EPISODES"
              count={seasons.length}
              rightSlot={
                <div className="relative w-[190px]">
                  <Search
                    size={12}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none"
                  />
                  <input
                    type="text"
                    value={episodeQuery}
                    onChange={(e) => setEpisodeQuery(e.target.value)}
                    placeholder="Find episode…"
                    className="input w-full pl-8 pr-3 py-1 text-[12px] rounded-[8px]"
                  />
                </div>
              }
            />
            <TabBar className="mb-4">
              {seasons.map((s, i) => (
                <TabPill
                  key={s.number ?? i}
                  active={activeSeason === i}
                  onClick={() => {
                    setActiveSeason(i);
                    try {
                      localStorage.setItem(
                        `cinemix_last_season_${id}`,
                        String(i),
                      );
                    } catch {
                      // ignore
                    }
                  }}
                >
                  Season {s.number} ({s.episodes.length})
                </TabPill>
              ))}
            </TabBar>
            {seasons[activeSeason] && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {currentSeasonEpisodes.map((ep, i) => (
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
      </div>

      <ParentalGuideModal
        open={parentalOpen}
        onClose={() => setParentalOpen(false)}
        film={film}
      />
    </PageContainer>
  );
}
