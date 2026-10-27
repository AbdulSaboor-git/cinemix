"use client";
import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import Link from "next/link";
import {
  Heart,
  Clock,
  Star,
  CircleAlert,
  ShieldAlert,
  Maximize2,
  Minimize2,
  Search,
  Lock,
  Server,
  Film as FilmIcon,
  Calendar,
  CalendarCheck,
  CalendarCheckIcon,
  Clock3Icon,
  PlayIcon,
  PlayCircleIcon,
} from "lucide-react";
import {
  getFilm,
  getFilmSeasons,
  getSimilarFilms,
  isAdultContentFilm,
  isSafeModeActive,
  hydrateFilmWithCache,
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
import FilmCard from "@/components/FilmCard";
import BackButton from "@/components/BackButton";
import PageContainer from "@/components/ui/PageContainer";
import SectionHeader from "@/components/ui/SectionHeader";
import TabBar from "@/components/ui/TabBar";
import TabPill from "@/components/ui/TabPill";
import EmptyState from "@/components/ui/EmptyState";
import NoKeyBanner from "@/components/ui/NoKeyBanner";
import ParentalGuideModal from "@/components/ParentalGuideModal";

const HISTORY_THRESHOLD_S = 10;
const PLAYER_PROXY_URL = "/api/kinodivbox";
const EPISODES_PAGE_SIZE = 24;

interface KinoDivBoxServer {
  index: number;
  id: string;
  name: string;
  rawName: string;
  isTrailer?: boolean;
  active: boolean;
}

interface SavedServerSelection {
  id: string;
  index: number;
  rawName: string;
}

const DEFAULT_KDB_SERVERS: KinoDivBoxServer[] = [
  { index: 0, id: "alloha", name: "Alloha", rawName: "Alloha", active: true },
  {
    index: 1,
    id: "collaps",
    name: "Collaps",
    rawName: "Collaps",
    active: false,
  },
  { index: 2, id: "hdvb", name: "HDVB", rawName: "HDVB", active: false },
  { index: 3, id: "veoveo", name: "VeoVeo", rawName: "VeoVeo", active: false },
  {
    index: 4,
    id: "videoseed",
    name: "VideoSeeD",
    rawName: "VideoSeeD",
    active: false,
  },
  { index: 5, id: "kodik", name: "Kodik", rawName: "Kodik", active: false },
  {
    index: 6,
    id: "trailer",
    name: "Trailer",
    rawName: "Трейлер",
    isTrailer: true,
    active: false,
  },
];

function getServerStorageKey(filmId: number | string) {
  return `cinemix_last_server_${filmId}`;
}

function readSavedServer(filmId: number | string): SavedServerSelection | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(getServerStorageKey(filmId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SavedServerSelection>;
    if (
      typeof parsed?.id === "string" &&
      typeof parsed?.index === "number" &&
      typeof parsed?.rawName === "string"
    ) {
      return {
        id: parsed.id,
        index: parsed.index,
        rawName: parsed.rawName,
      };
    }
  } catch {
    // ignore storage errors
  }
  return null;
}

function applySavedServerToList(
  servers: KinoDivBoxServer[],
  saved: SavedServerSelection | null,
): { list: KinoDivBoxServer[]; matched: KinoDivBoxServer | null } {
  if (!saved || servers.length === 0) {
    return { list: servers, matched: null };
  }
  const matched =
    servers.find(
      (s) =>
        s.id === saved.id ||
        s.rawName === saved.rawName ||
        s.index === saved.index,
    ) ?? null;

  if (!matched) {
    return { list: servers, matched: null };
  }

  const list = servers.map((item) => ({
    ...item,
    active: item.id === matched.id && item.index === matched.index,
  }));

  return { list, matched };
}

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
  const titleInput = useMemo(() => ({ nameRu, nameEn }), [nameRu, nameEn]);
  const epTitle = useFilmTitle(titleInput, autoTranslate);
  const translatedSynopsis = useTranslate(synopsis);
  const safeDate = useMemo(
    () =>
      formatDateSafe(releaseDate, {
        year: "numeric",
        month: "short",
        day: "numeric",
      }),
    [releaseDate],
  );

  return (
    <div className="flex items-start gap-3 border border-[var(--border)] bg-[var(--bg-card)] rounded-[10px] px-3.5 sm:px-4 py-2.5 sm:py-3 transition-colors hover:border-[var(--border-hover)]">
      <span className="font-display text-[var(--text-muted)] flex-shrink-0 text-[15px] sm:text-[18px] w-6 sm:w-8 pt-0.5">
        {epNumber}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <p className="font-semibold text-[var(--text)] text-[12px] sm:text-[13px] truncate m-0">
            {epTitle && epTitle !== "Unknown" ? epTitle : `Episode ${epNumber}`}
          </p>
          {safeDate && (
            <span className="text-[10px] sm:text-[11px] text-[var(--text-muted)]">
              {safeDate}
            </span>
          )}
        </div>
        {translatedSynopsis && (
          <p className="text-[11px] sm:text-[12px] text-[var(--text-muted)] mt-1 mb-0 line-clamp-2 leading-relaxed">
            {translatedSynopsis}
          </p>
        )}
      </div>
    </div>
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
  const [visibleEpCount, setVisibleEpCount] = useState(EPISODES_PAGE_SIZE);
  const [similars, setSimilars] = useState<SimilarFilm[]>([]);
  const [loading, setLoading] = useState(!isNaN(id));
  const [error, setError] = useState(isNaN(id));

  // Cinema Controls: Wide Theater & KinoDivBox Remapped Server Buttons
  const [wideTheater, setWideTheater] = useState(false);
  const [parentalOpen, setParentalOpen] = useState(false);
  const [kdbServers, setKdbServers] =
    useState<KinoDivBoxServer[]>(DEFAULT_KDB_SERVERS);

  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const lastServersSigRef = useRef<string>("");
  const savedServerRef = useRef<SavedServerSelection | null>(null);
  const needsIframeServerSyncRef = useRef<boolean>(false);

  const { isFav, isWL } = useListStatus(isNaN(id) ? 0 : id);

  const name = useFilmTitle(film, autoTranslate);
  const description = useTranslate(film?.description || film?.shortDescription);
  useDocumentTitle(film ? `Watching ${name}` : "Watch");

  const secondsRef = useRef(0);
  const addedRef = useRef(false);
  const latestNameRef = useRef(name);
  latestNameRef.current = name;

  const postServerSelectToIframe = useCallback(
    (srv: { index: number; id: string; rawName: string }) => {
      iframeRef.current?.contentWindow?.postMessage(
        {
          type: "CINEMIX_KDB_SELECT",
          index: srv.index,
          id: srv.id,
          name: srv.rawName,
        },
        "*",
      );
    },
    [],
  );

  // Restore saved server selection (or reset to default) and reset episode pagination when switching films
  useEffect(() => {
    const saved = !isNaN(id) ? readSavedServer(id) : null;
    savedServerRef.current = saved;
    needsIframeServerSyncRef.current = Boolean(saved);

    const { list } = applySavedServerToList(DEFAULT_KDB_SERVERS, saved);
    setKdbServers(list);
    lastServersSigRef.current = JSON.stringify(list);
    setVisibleEpCount(EPISODES_PAGE_SIZE);
    setEpisodeQuery("");
  }, [id]);

  // Listen for extracted/synced server buttons from the /api/kinodivbox bridge
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (!e.data || typeof e.data !== "object") return;
      if (e.data.type === "CINEMIX_KDB_SERVERS") {
        if (String(e.data.filmId) !== String(id)) return;
        const incoming = Array.isArray(e.data.servers)
          ? (e.data.servers as KinoDivBoxServer[])
          : [];
        if (incoming.length === 0) return;

        let nextServers = incoming;
        const saved = savedServerRef.current;

        // If a saved server exists from before refresh, keep it active and instruct the iframe to select it
        if (saved) {
          const { list, matched } = applySavedServerToList(incoming, saved);
          if (matched) {
            nextServers = list;
            const incomingActive = incoming.find((s) => s.active);
            const alreadySyncedInIframe =
              incomingActive &&
              (incomingActive.id === matched.id ||
                incomingActive.index === matched.index);

            if (needsIframeServerSyncRef.current || !alreadySyncedInIframe) {
              needsIframeServerSyncRef.current = false;
              postServerSelectToIframe(matched);
            }
          }
        }

        const sig = JSON.stringify(nextServers);
        if (sig !== lastServersSigRef.current) {
          lastServersSigRef.current = sig;
          setKdbServers(nextServers);
        }
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [id, postServerSelectToIframe]);

  const handleSelectKdbServer = useCallback(
    (srv: KinoDivBoxServer) => {
      const selection: SavedServerSelection = {
        id: srv.id,
        index: srv.index,
        rawName: srv.rawName,
      };
      savedServerRef.current = selection;
      needsIframeServerSyncRef.current = false;

      if (!isNaN(id)) {
        try {
          localStorage.setItem(
            getServerStorageKey(id),
            JSON.stringify(selection),
          );
        } catch {
          // ignore storage quota errors
        }
      }

      setKdbServers((prev) => {
        const next = prev.map((item) => ({
          ...item,
          active: item.id === srv.id || item.rawName === srv.rawName,
        }));
        lastServersSigRef.current = JSON.stringify(next);
        return next;
      });

      postServerSelectToIframe(srv);
    },
    [id, postServerSelectToIframe],
  );

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

    try {
      const savedSeason = localStorage.getItem(`cinemix_last_season_${id}`);
      if (savedSeason !== null) {
        const parsed = parseInt(savedSeason, 10);
        if (!isNaN(parsed) && parsed >= 0) setActiveSeason(parsed);
      } else {
        setActiveSeason(0);
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
            .then((d) => {
              if (!mounted) return;
              const loadedSeasons = d.items ?? [];
              setSeasons(loadedSeasons);
              setActiveSeason((prev) =>
                prev >= loadedSeasons.length ? 0 : prev,
              );
            })
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

  // Keyboard shortcuts: W for Wide Theater
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.key === "w" || e.key === "W") {
        setWideTheater((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

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
            latestNameRef.current ||
            film.nameEn ||
            film.nameOriginal ||
            film.nameRu ||
            "Unknown",
          poster_url: film.posterUrlPreview || film.posterUrl || null,
          year: film.year ?? film.startYear ?? null,
          rating: film.ratingImdb ?? film.ratingKinopoisk ?? null,
        });
        clearInterval(timer);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [film, id]);

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

  const displayedEpisodes = useMemo(
    () => currentSeasonEpisodes.slice(0, visibleEpCount),
    [currentSeasonEpisodes, visibleEpCount],
  );

  const hydratedSimilars = useMemo(
    () =>
      similars.slice(0, 14).map((sf) =>
        hydrateFilmWithCache({
          kinopoiskId: sf.filmId,
          filmId: sf.filmId,
          nameRu: sf.nameRu,
          nameEn: sf.nameEn,
          nameOriginal: sf.nameOriginal,
          posterUrl: sf.posterUrl,
          posterUrlPreview: sf.posterUrlPreview,
        }),
      ),
    [similars],
  );

  if (noKey) return <NoKeyBanner />;

  if (loading) {
    return (
      <PageContainer>
        <div className="max-w-[960px] mx-auto flex flex-col gap-3">
          <div className="skeleton h-[96px] sm:h-[88px] w-full rounded-[14px]" />
          <div className="skeleton w-full aspect-video sm:aspect-auto sm:h-[340px] md:h-[410px] lg:h-[500px] rounded-[14px] sm:rounded-[16px]" />
          <div className="skeleton sm:hidden h-[46px] w-full rounded-[12px]" />
          <div className="skeleton h-[120px] w-full rounded-[14px] mt-1" />
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

  const rawRating = film.ratingImdb ?? film.ratingKinopoisk;
  const rating =
    typeof rawRating === "number" && rawRating > 0 ? rawRating : null;
  const ratingSource = film.ratingImdb
    ? "IMDb"
    : film.ratingKinopoisk
      ? "KP"
      : "Score";
  const year = film.year || film.startYear;
  const durationText =
    film.filmLength && film.filmLength > 0
      ? `${Math.floor(film.filmLength / 60)}h ${film.filmLength % 60}m`
      : null;
  const ageRatingText = film.ratingAgeLimits
    ? `${film.ratingAgeLimits.replace(/^age/i, "")}+`
    : film.ratingMpaa
      ? film.ratingMpaa.toUpperCase()
      : null;

  const playerUrl = `${PLAYER_PROXY_URL}?id=${id}`;

  const filmEntry = {
    film_id: id,
    film_name: name,
    poster_url: film.posterUrlPreview || film.posterUrl || null,
    year: film.year ?? film.startYear ?? null,
    rating: rating,
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
    <PageContainer className="relative">
      <div
        className={`${
          wideTheater ? "max-w-[1280px]" : "max-w-[960px]"
        } mx-auto transition-all duration-300 relative`}
      >
        {/* ── Top Header & Cinema Control Card ── */}
        <div className="w-full flex flex-col gap-2.5 mb-2.5 sm:mb-3 bg-[var(--bg-card)] border border-[var(--border)] rounded-[14px] sm:rounded-[12px] p-3 sm:px-4 sm:py-2.5 shadow-[0_8px_28px_rgba(0,0,0,0.4)]">
          {/* Header Row: Back + Title/Year on left, Action buttons on right */}
          <div className="w-full flex items-center sm:items-center justify-between gap-2.5 sm:gap-3">
            <div className="flex items-start sm:items-center gap-2 sm:gap-3 min-w-0 flex-1">
              <div className="pt-0.5 sm:pt-0 flex-shrink-0">
                <BackButton
                  fallbackHref={`/film/${id}`}
                  label="Film Details"
                  className="mb-0"
                  iconOnlyOnPhone
                />
              </div>
              <span className="text-[var(--border-hover)] hidden sm:inline select-none">
                |
              </span>

              {/* Title + Metadata */}
              <div className="min-w-0 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 sm:flex-wrap flex-1">
                <div className="flex items-baseline gap-1.5 flex-wrap min-w-0">
                  <h1 className="font-display tracking-[1.1px] text-[17px] sm:text-[20px] text-white line-clamp-2">
                    {name}
                  </h1>
                  {year && (
                    <span className="hidden sm:inline text-[11px] sm:text-[12px] font-medium text-[var(--text-muted)] flex-shrink-0">
                      ({year})
                    </span>
                  )}
                  {durationText && (
                    <span className="hidden sm:inline text-[11px] text-[var(--text-muted)] flex-shrink-0">
                      · {durationText}
                    </span>
                  )}
                </div>

                {/* Desktop inline Rating & Age badges (hidden on mobile where the 2-column box is shown) */}
                <div className="hidden sm:flex items-center gap-2">
                  {rating && (
                    <span className="inline-flex items-center gap-1 text-[12px] text-[#f5c518] font-display">
                      <Star
                        className="mb-0.5"
                        size={11}
                        fill="#f5c518"
                        stroke="#f5c518"
                      />
                      {rating.toFixed(1)}
                    </span>
                  )}
                  {ageRatingText && (
                    <button
                      type="button"
                      onClick={() => setParentalOpen(true)}
                      title="View Parental Guide"
                      className="tag tag-accent text-[11px] cursor-pointer hover:border-[rgba(229,9,20,0.5)] inline-flex items-center gap-1"
                    >
                      <ShieldAlert size={11} />
                      {ageRatingText}
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Quick Action Controls (Favorite, Watch Later, Desktop Wide Mode) */}
            <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
              <div className="hidden md:inline-flex">
                <button
                  type="button"
                  onClick={() => setWideTheater((v) => !v)}
                  title="Toggle Wide Theater Mode (W)"
                  className={`btn btn-ghost h-8 px-2.5 text-[12px] ${
                    wideTheater
                      ? "border-[rgba(229,9,20,0.5)] text-[var(--accent)]"
                      : ""
                  }`}
                >
                  {wideTheater ? (
                    <Minimize2 size={14} />
                  ) : (
                    <Maximize2 size={14} />
                  )}
                  <span>{wideTheater ? "Standard" : "Wide"}</span>
                </button>
              </div>

              {!ageRatingText && (
                <button
                  type="button"
                  onClick={() => setParentalOpen(true)}
                  aria-label="View Parental Guide"
                  title="View Parental Guide"
                  className="hidden sm:inline-flex btn btn-ghost h-8 w-8 p-0 items-center justify-center text-[12px]"
                >
                  <ShieldAlert size={14} />
                </button>
              )}

              <button
                type="button"
                onClick={handleFav}
                aria-label={isFav ? "In Favorites" : "Add to Favorites"}
                title={isFav ? "In Favorites" : "Add to Favorites"}
                className={`btn btn-ghost h-8 w-8 p-0 inline-flex items-center justify-center rounded-[9px] transition-all active:scale-90 ${
                  isFav
                    ? "border-[rgba(229,9,20,0.45)] bg-[rgba(229,9,20,0.1)] text-[var(--accent)]"
                    : ""
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
                className={`btn btn-ghost h-8 w-8 p-0 inline-flex items-center justify-center rounded-[9px] transition-all active:scale-90 ${
                  isWL
                    ? "border-[rgba(96,165,250,0.45)] bg-[rgba(96,165,250,0.1)] text-[#60a5fa]"
                    : ""
                }`}
              >
                <Clock size={14} stroke={isWL ? "#60a5fa" : "currentColor"} />
              </button>
            </div>
          </div>

          {/* ── Desktop Server Selector Bar (hidden on mobile; relocated below player on mobile) ── */}
          {kdbServers.length > 0 && (
            <div className="hidden sm:flex items-center overflow-x-auto scrollbar-none w-full gap-2 pt-2 pb-0.5 border-t border-[var(--border)]">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[1px] text-[var(--text-muted)] flex-shrink-0 mr-1">
                <Server size={12} className="text-[var(--accent)]" />
                <span>Server</span>
              </span>
              {kdbServers.map((srv) => (
                <button
                  key={srv.id}
                  type="button"
                  onClick={() => handleSelectKdbServer(srv)}
                  className={`flex-shrink-0 px-5 py-1 rounded-[7px] text-[12px] font-semibold cursor-pointer transition-all duration-150 inline-flex items-center gap-1.5 border ${
                    srv.active
                      ? "bg-[var(--accent)] text-white border-[var(--accent)] shadow-[0_0_14px_rgba(229,9,20,0.35)]"
                      : "bg-[var(--bg-elevated)] text-[var(--text-dim)] border-[var(--border)] hover:border-[var(--border-hover)] hover:text-white"
                  }`}
                >
                  {srv.isTrailer ? (
                    <span className="inline-flex items-center gap-1.5">
                      <FilmIcon size={12} />
                      {srv.name}
                    </span>
                  ) : (
                    <span>{srv.index + 1}</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ── Theater Video Stage ── */}
        <div className="w-full rounded-[14px] sm:rounded-[16px] overflow-hidden border border-white/[0.07] bg-[#0d0c0c] shadow-[0_20px_60px_rgba(0,0,0,0.85)]">
          <iframe
            ref={iframeRef}
            key={id}
            src={playerUrl}
            onLoad={() => {
              iframeRef.current?.contentWindow?.postMessage(
                { type: "CINEMIX_KDB_PING" },
                "*",
              );
              if (savedServerRef.current) {
                postServerSelectToIframe(savedServerRef.current);
              }
            }}
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
                ? "aspect-video sm:aspect-auto sm:h-[500px] md:h-[440px] lg:h-[540px]"
                : "aspect-video sm:aspect-auto h-[300px] sm:h-[340px] md:h-[410px] lg:h-[500px]"
            } border-none block bg-[#141212] overflow-hidden transition-all duration-300`}
          />
        </div>

        {/* ── Mobile Server Switcher Dock (placed directly beneath player for ergonomic thumb reach & zero clipping) ── */}
        {kdbServers.length > 0 && (
          <div className="sm:hidden flex flex-col gap-2 mt-2.5 bg-[var(--bg-card)] border border-[var(--border)] rounded-[12px] p-2.5 shadow-[0_6px_20px_rgba(0,0,0,0.35)]">
            <div className="flex items-center justify-between gap-2 px-0.5">
              <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[1px] text-[var(--text-muted)]">
                <Server size={11} className="text-[var(--accent)]" />
                <span>Stream Source</span>
              </span>
              {kdbServers.find((s) => s.active) && (
                <span className="text-[10px] font-medium text-[var(--text-dim)]">
                  Active:{" "}
                  <strong className="text-white font-semibold">
                    {kdbServers.find((s) => s.active)?.isTrailer
                      ? "Trailer"
                      : `Server ${(kdbServers.find((s) => s.active)?.index ?? 0) + 1}`}
                  </strong>
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5">
              {/* Numbered Stream Servers */}
              <div className="grid grid-cols-6 gap-1.5 flex-1">
                {kdbServers
                  .filter((srv) => !srv.isTrailer)
                  .map((srv) => (
                    <button
                      key={srv.id}
                      type="button"
                      onClick={() => handleSelectKdbServer(srv)}
                      className={`h-8 rounded-[8px] text-[12px] font-semibold cursor-pointer transition-all duration-150 flex items-center justify-center border active:scale-95 ${
                        srv.active
                          ? "bg-[var(--accent)] text-white border-[var(--accent)] shadow-[0_0_12px_rgba(229,9,20,0.4)]"
                          : "bg-[var(--bg-elevated)] text-[var(--text-dim)] border-[var(--border)] hover:text-white"
                      }`}
                    >
                      {srv.index + 1}
                    </button>
                  ))}
              </div>
            </div>
            {kdbServers
              .filter((srv) => srv.isTrailer)
              .map((srv) => (
                <button
                  key={srv.id}
                  type="button"
                  onClick={() => handleSelectKdbServer(srv)}
                  className={`h-8 flex items-center justify-center gap-1 rounded-[8px] text-[12px] font-semibold cursor-pointer transition-all duration-150 border active:scale-95 ${
                    srv.active
                      ? "bg-[var(--accent)] text-white border-[var(--accent)] shadow-[0_0_12px_rgba(229,9,20,0.4)]"
                      : "bg-[var(--bg-elevated)] text-[var(--text-dim)] border-[var(--border)] hover:text-white"
                  }`}
                >
                  <PlayCircleIcon size={14} />
                  Trailer
                </button>
              ))}
          </div>
        )}
        <div className="sm:hidden mt-2.5 bg-[var(--bg-card)] border border-[var(--border)] rounded-[12px] p-2.5 shadow-[0_6px_20px_rgba(0,0,0,0.35)]">
          <div className="grid grid-cols-3 gap-2 sm:hidden pt-0.5">
            {/*  1 */}
            <div className="flex items-center justify-center gap-1 px-3 py-2 rounded-[10px] bg-white/[0.03] border border-white/[0.07]">
              <span className="font-display text-[15px] tracking-[0.5px] text-[#f5c518] leading-none">
                {rating ? rating.toFixed(1) : "—"}
              </span>
              <Star
                size={12}
                className="mb-0.5"
                fill="#f5c518"
                stroke="#f5c518"
              />
            </div>
            {/* 2 */}
            <button
              type="button"
              onClick={() => setParentalOpen(true)}
              title="View Parental Guide"
              className="flex items-center text-red-700 justify-center gap-1 px-3 py-2 rounded-[10px] bg-white/[0.03] border border-white/[0.07] active:scale-[0.98] cursor-pointer transition-all text-left"
            >
              <ShieldAlert size={14} className="mb-0.5" />
              <span className="font-display text-sm">
                {ageRatingText ?? "Guide"}
              </span>
            </button>
            {/* 3 */}
            <div className="flex items-center text-[var(--text-dim)] justify-center gap-1 px-3 py-2 rounded-[10px] bg-white/[0.03] border border-white/[0.07]">
              <CalendarCheckIcon size={14} className="mb-0.5" />
              <span className="font-display text-sm">{year ?? "—"}</span>
            </div>
          </div>
        </div>

        {/* ── Synopsis + Genres Card ── */}
        <div className="mt-3 sm:mt-5 bg-[var(--bg-card)] border border-[var(--border)] rounded-[14px] sm:rounded-[var(--radius-lg)] p-3.5 sm:p-6">
          {((film.genres && film.genres.length > 0) ||
            (film.countries && film.countries.length > 0)) && (
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mb-3">
              {film.genres?.map((g) => (
                <Link
                  key={g.genre}
                  href={`/explore?genres=${encodeURIComponent(g.genre)}`}
                  className="no-underline"
                >
                  <span className="tag tag-dim capitalize cursor-pointer text-[11px] sm:text-[12px]">
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
                  <span className="tag tag-dim cursor-pointer text-[11px] sm:text-[12px]">
                    {translateCountry(c.country, autoTranslate)}
                  </span>
                </Link>
              ))}
              {film.filmLength && film.filmLength > 0 && (
                <span className="text-xs sm:hidden text-[var(--text-dim)]">
                  {durationText ?? "—"}
                </span>
              )}
            </div>
          )}

          {description ? (
            <p className="text-[13px] sm:text-[14px] text-[var(--text-dim)] leading-[1.68] m-0">
              {description}
            </p>
          ) : (
            <p className="text-[12px] sm:text-[13px] text-[var(--text-muted)] italic m-0">
              No synopsis available for this title.
            </p>
          )}
        </div>

        {/* ── Seasons & Episodes (for TV Series) ── */}
        {seasons.length > 0 && (
          <div className="mt-7 sm:mt-8">
            <SectionHeader
              title="SEASONS & EPISODES"
              count={seasons.length}
              rightSlot={
                <div className="relative w-[160px] sm:w-[190px]">
                  <Search
                    size={12}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none"
                  />
                  <input
                    type="text"
                    value={episodeQuery}
                    onChange={(e) => {
                      setEpisodeQuery(e.target.value);
                      setVisibleEpCount(EPISODES_PAGE_SIZE);
                    }}
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
                    setVisibleEpCount(EPISODES_PAGE_SIZE);
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
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {displayedEpisodes.map((ep, i) => (
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
                {currentSeasonEpisodes.length > visibleEpCount && (
                  <div className="mt-4 flex justify-center">
                    <button
                      type="button"
                      onClick={() =>
                        setVisibleEpCount((c) => c + EPISODES_PAGE_SIZE)
                      }
                      className="btn btn-ghost px-4 py-2 text-[12px]"
                    >
                      Show More Episodes (
                      {currentSeasonEpisodes.length - visibleEpCount} remaining)
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ── Similar Films ── */}
        {hydratedSimilars.length > 0 && (
          <div className="mt-7 sm:mt-8">
            <SectionHeader
              title="SIMILAR FILMS"
              count={hydratedSimilars.length}
            />
            <div className="flex gap-3 overflow-x-auto pb-3 scrollbar-none">
              {hydratedSimilars.map((hydratedFilm) => (
                <FilmCard
                  key={hydratedFilm.kinopoiskId ?? hydratedFilm.filmId}
                  film={hydratedFilm}
                  variant="scroll"
                  size="sm"
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
