"use client";
import React, {
  useEffect,
  useState,
  useCallback,
  useMemo,
  useRef,
  useTransition,
  memo,
} from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Search,
  X,
  Flame,
  Sparkles,
  Calendar,
  Trophy,
  Compass,
  Star,
  SlidersHorizontal,
  ArrowDown,
  ArrowUp,
  Shuffle,
  History,
  Eye,
  Play,
  Heart,
  Clock,
  ShieldAlert,
} from "lucide-react";
import {
  discoverFilms,
  getFilters,
  getFilm,
  getFilmStaff,
  analyzeSemanticQuery,
} from "@/lib/kinopoisk";
import {
  Film,
  Genre,
  Country,
  ExploreSortOrder,
  SortDirection,
  Staff,
  MatchedPersonSummary,
} from "@/types/kinopoisk";
import { translateGenre, translateCountry, isRussian } from "@/lib/translate";
import {
  useAutoTranslate,
  useFilmTitle,
  useTranslate,
} from "@/hooks/useTranslate";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { syncRouteInNavStack } from "@/components/BackButton";
import { useListStatus } from "@/hooks/useListStatus";
import {
  useSearchSuggestions,
  getRecentSearches,
  saveRecentSearch,
  clearRecentSearches,
} from "@/hooks/useSearchSuggestions";
import {
  getPreferences,
  hasApiKeys,
  hasVerifiedApiKey,
} from "@/lib/preferences";
import {
  toggleFavorite,
  toggleWatchLater,
  getList,
  getRatedFilms,
} from "@/lib/userLists";
import { useToast } from "@/lib/toast";
import { getQuickCertBadge } from "@/lib/parentalGuide";
import FilmCard, {
  FilmCardSkeleton,
  FilmCardSkeletonGrid,
} from "@/components/FilmCard";
import SearchSuggestionDropdown from "@/components/SearchSuggestionDropdown";
import PageContainer from "@/components/ui/PageContainer";
import TabBar from "@/components/ui/TabBar";
import TabPill from "@/components/ui/TabPill";
import ModalShell from "@/components/ui/ModalShell";
import PosterImage from "@/components/ui/PosterImage";
import EmptyState from "@/components/ui/EmptyState";
import NoKeyBanner from "@/components/ui/NoKeyBanner";
import ParentalGuideModal from "@/components/ParentalGuideModal";
import type { ExploreSearchParams } from "@/app/explore/page";

export type ExploreFeedId =
  | "TRENDING"
  | "FOR_YOU"
  | "RECENT_RELEASES"
  | "BLOCKBUSTERS"
  | "HIDDEN_GEMS"
  | "TOP_RATED";

interface FeedConfig {
  id: ExploreFeedId;
  label: string;
  defaultOrder: ExploreSortOrder;
  icon: React.ReactNode;
}

const FEEDS: FeedConfig[] = [
  {
    id: "TRENDING",
    label: "Trending",
    defaultOrder: "TRENDING",
    icon: <Flame size={13} />,
  },
  {
    id: "FOR_YOU",
    label: "For You",
    defaultOrder: "TASTE_MATCH",
    icon: <Sparkles size={13} />,
  },
  {
    id: "RECENT_RELEASES",
    label: "Recent",
    defaultOrder: "YEAR",
    icon: <Calendar size={13} />,
  },
  {
    id: "BLOCKBUSTERS",
    label: "Blockbusters",
    defaultOrder: "NUM_VOTE",
    icon: <Trophy size={13} />,
  },
  {
    id: "HIDDEN_GEMS",
    label: "Hidden Gems",
    defaultOrder: "HIDDEN_GEMS",
    icon: <Compass size={13} />,
  },
  {
    id: "TOP_RATED",
    label: "Top Rated",
    defaultOrder: "RATING",
    icon: <Star size={13} />,
  },
];

const TYPES = [
  { value: "ALL", label: "All" },
  { value: "FILM", label: "Movies" },
  { value: "TV_SERIES", label: "TV Series" },
  { value: "MINI_SERIES", label: "Mini Series" },
  { value: "TV_SHOW", label: "TV Shows" },
] as const;

/**
 * Returns the streamlined, non-contradictory sort options tailored to the active Feed or Search context.
 * Inspired by IMDb & Letterboxd: removes redundant rating sub-variants and hides incompatible preset sorts
 * (such as "Trending" inside "For You" or "Hidden Gems" outside the Hidden Gems feed).
 */
function getScopedSortOptions(
  activeFeed: ExploreFeedId,
  hasSearchQuery: boolean,
): { value: ExploreSortOrder; label: string }[] {
  if (hasSearchQuery) {
    return [
      { value: "TRENDING", label: "Best Match (Relevance)" },
      { value: "RATING", label: "User Rating" },
      { value: "NUM_VOTE", label: "Most Popular (Votes)" },
      { value: "YEAR", label: "Release Date" },
      { value: "TITLE", label: "Title (A–Z)" },
    ];
  }

  switch (activeFeed) {
    case "FOR_YOU":
      return [
        { value: "TASTE_MATCH", label: "Taste Match (For You)" },
        { value: "RATING", label: "Highest Rated" },
        { value: "YEAR", label: "Release Year" },
        { value: "NUM_VOTE", label: "Most Popular" },
        { value: "RANDOM", label: "Surprise Shuffle" },
      ];
    case "RECENT_RELEASES":
      return [
        { value: "YEAR", label: "Release Date (Newest)" },
        { value: "TRENDING", label: "Trending Now" },
        { value: "RATING", label: "Highest Rated" },
        { value: "NUM_VOTE", label: "Most Popular" },
      ];
    case "BLOCKBUSTERS":
      return [
        { value: "NUM_VOTE", label: "Most Popular (Votes)" },
        { value: "RATING", label: "Highest Rated" },
        { value: "YEAR", label: "Release Year" },
        { value: "RANDOM", label: "Surprise Shuffle" },
      ];
    case "HIDDEN_GEMS":
      return [
        { value: "HIDDEN_GEMS", label: "Cult Gem Score" },
        { value: "RATING", label: "Highest Rated" },
        { value: "YEAR", label: "Release Year" },
        { value: "RANDOM", label: "Surprise Shuffle" },
      ];
    case "TOP_RATED":
      return [
        { value: "RATING", label: "Highest Rated" },
        { value: "NUM_VOTE", label: "Most Popular (Votes)" },
        { value: "YEAR", label: "Release Year" },
        { value: "RANDOM", label: "Surprise Shuffle" },
      ];
    case "TRENDING":
    default:
      return [
        { value: "TRENDING", label: "Trending Momentum" },
        { value: "NUM_VOTE", label: "Most Popular (Votes)" },
        { value: "RATING", label: "Highest Rated" },
        { value: "YEAR", label: "Release Year" },
        { value: "RANDOM", label: "Surprise Shuffle" },
      ];
  }
}

const QUICK_SEARCH_IDEAS = [
  "Interstellar",
  "Harry Potter",
  "Dune 2021",
  "Time Travel",
  "Mind Bending",
  "Severance",
];

// ── Snapshot Cache for 0ms feed/tab switching & back navigation restoration ──
let cachedSimpleFilters: { genres: Genre[]; countries: Country[] } | null =
  null;

interface SimpleBrowseSnapshot {
  queryKey: string;
  timestamp: number;
  films: Film[];
  totalPages: number;
  streamedPage: number;
  matchedPerson?: MatchedPersonSummary | null;
  correctedQuery?: string | null;
  targetYear?: number | null;
}

const SNAPSHOT_TTL = 5 * 60 * 1000;
const simpleCacheMap = new Map<string, SimpleBrowseSnapshot>();
const SCROLL_STORAGE_KEY = "cinemix_simple_explore_scroll";
const STATE_STORAGE_KEY = "cinemix_simple_explore_last_state";

if (typeof window !== "undefined") {
  window.addEventListener("cinemix-cache-clear", () => {
    simpleCacheMap.clear();
  });
}

function getValidSnapshot(queryKey: string): SimpleBrowseSnapshot | null {
  if (!hasVerifiedApiKey()) return null;
  const entry = simpleCacheMap.get(queryKey);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > SNAPSHOT_TTL) {
    simpleCacheMap.delete(queryKey);
    return null;
  }
  return entry;
}

function setSnapshot(snapshot: SimpleBrowseSnapshot): void {
  if (simpleCacheMap.size >= 25) {
    const oldestKey = simpleCacheMap.keys().next().value;
    if (oldestKey) simpleCacheMap.delete(oldestKey);
  }
  simpleCacheMap.set(snapshot.queryKey, snapshot);
}

function resolveGenreTokens(raw: string | undefined, list: Genre[]): number[] {
  if (!raw) return [];
  const out: number[] = [];
  for (const token of raw.split(",")) {
    const t = token.trim();
    if (!t) continue;
    if (!isNaN(Number(t))) {
      out.push(parseInt(t, 10));
    } else if (list.length > 0) {
      const lower = t.toLowerCase();
      const match = list.find(
        (g) =>
          g.genre.toLowerCase() === lower ||
          translateGenre(g.genre, true).toLowerCase() === lower,
      );
      if (match) out.push(match.id);
    }
  }
  return Array.from(new Set(out));
}

function resolveCountryTokens(
  raw: string | undefined,
  list: Country[],
): number[] {
  if (!raw) return [];
  const out: number[] = [];
  for (const token of raw.split(",")) {
    const t = token.trim();
    if (!t) continue;
    if (!isNaN(Number(t))) {
      out.push(parseInt(t, 10));
    } else if (list.length > 0) {
      const lower = t.toLowerCase();
      const match = list.find(
        (c) =>
          c.country.toLowerCase() === lower ||
          translateCountry(c.country, true).toLowerCase() === lower,
      );
      if (match) out.push(match.id);
    }
  }
  return Array.from(new Set(out));
}

const MemoizedPosterGrid = memo(function MemoizedPosterGrid({
  films,
  loadingMore,
  onQuickPeek,
}: {
  films: Film[];
  loadingMore: boolean;
  onQuickPeek: (film: Film) => void;
}) {
  return (
    <div className="film-grid fade-in">
      {films.map((film, i) => {
        const fid = film.kinopoiskId ?? film.filmId ?? i;
        return (
          <FilmCard
            key={`${fid}-${i}`}
            film={film}
            variant="grid"
            priority={i < 6}
            onQuickPeek={onQuickPeek}
          />
        );
      })}
      {loadingMore &&
        Array.from({ length: 8 }).map((_, idx) => (
          <FilmCardSkeleton key={`more-skel-${idx}`} variant="grid" />
        ))}
    </div>
  );
});

export default function SimpleExploreClient(props: ExploreSearchParams) {
  const router = useRouter();
  const { toast } = useToast();
  const autoTranslate = useAutoTranslate();
  const [, startTransition] = useTransition();

  const [optimisticParams, setOptimisticParams] =
    useState<ExploreSearchParams>(props);
  const prevPropsRef = useRef(props);

  useEffect(() => {
    if (prevPropsRef.current !== props) {
      prevPropsRef.current = props;
      setOptimisticParams(props);
    }
  }, [props]);

  const p = optimisticParams;
  const page = Math.max(1, parseInt(p.page || "1", 10));

  const [noKey, setNoKey] = useState(false);
  const [ready, setReady] = useState(false);
  const [prefType, setPrefType] = useState<string>("ALL");
  const [prefOrder, setPrefOrder] = useState<ExploreSortOrder>("TRENDING");
  const [infiniteScrollEnabled, setInfiniteScrollEnabled] =
    useState<boolean>(true);
  const [tasteSig, setTasteSig] = useState("");
  const [randomSeed, setRandomSeed] = useState(1);

  const [genres, setGenres] = useState<Genre[]>([]);
  const [countries, setCountries] = useState<Country[]>([]);
  const [filtersLoaded, setFiltersLoaded] = useState(false);

  // Unified Search Bar State
  const activeSearchQuery = (p.q || p.keyword || "").trim();
  const [searchInput, setSearchInput] = useState(activeSearchQuery);
  const [searchFocused, setSearchFocused] = useState(false);
  const [recentTerms, setRecentTerms] = useState<string[]>([]);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchWrapperRef = useRef<HTMLDivElement>(null);
  const quickTermsRef = useRef<HTMLDivElement>(null);
  const loadMoreTriggerRef = useRef<HTMLDivElement>(null);

  const {
    suggestions,
    matchedPerson: sugMatchedPerson,
    semanticMeta,
    sugLoading,
    sugVisible,
    selectedIdx,
    setSugVisible,
    fetchSuggestions,
    clearSuggestions,
    handleKeyNav,
  } = useSearchSuggestions();

  useEffect(() => {
    setSearchInput(activeSearchQuery);
    setRecentTerms(getRecentSearches());
  }, [activeSearchQuery]);

  // Listen for Navbar search icon tap when already on /explore
  useEffect(() => {
    const onFocusSearch = () => {
      window.scrollTo({ top: 0, behavior: "smooth" });
      setTimeout(() => {
        searchInputRef.current?.focus();
        setSearchFocused(true);
      }, 80);
    };
    window.addEventListener("cinemix-focus-explore-search", onFocusSearch);
    return () =>
      window.removeEventListener("cinemix-focus-explore-search", onFocusSearch);
  }, []);

  // Close suggestion dropdown on outside click or Escape
  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      if (
        !searchWrapperRef.current?.contains(e.target as Node) &&
        !quickTermsRef.current?.contains(e.target as Node)
      ) {
        setSugVisible(false);
        setSearchFocused(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSugVisible(false);
        setSearchFocused(false);
        searchInputRef.current?.blur();
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [setSugVisible]);

  // Sync API keys & user preferences
  useEffect(() => {
    const syncKeyAndPrefs = (event?: Event) => {
      if (!hasApiKeys()) {
        simpleCacheMap.clear();
        setNoKey(true);
        setFilms([]);
        setReady(false);
        return;
      }
      if (
        event?.type === "cinemix-session-change" &&
        (event as CustomEvent<{ source?: string }>).detail?.source ===
          "list-toggle"
      ) {
        return;
      }
      setNoKey(false);
      const prefs = getPreferences();
      setPrefType(prefs.defaultExploreType || "ALL");
      setPrefOrder(
        (prefs.defaultExploreOrder as ExploreSortOrder) || "TRENDING",
      );
      setInfiniteScrollEnabled(prefs.infiniteScrollEnabled ?? true);
      setRecentTerms(getRecentSearches());

      const nextTasteSig = [
        getRatedFilms()
          .slice(0, 18)
          .map(
            (x) =>
              `${x.film_id}:${x.user_rating}:${(x.taste_tags ?? []).join("+")}`,
          )
          .join(","),
        getList("favorites")
          .slice(0, 16)
          .map((x) => x.film_id)
          .join(","),
        getList("watchlater")
          .slice(0, 16)
          .map((x) => x.film_id)
          .join(","),
        getList("history")
          .slice(0, 16)
          .map((x) => x.film_id)
          .join(","),
      ].join("|");
      setTasteSig(nextTasteSig);
      setReady(true);
    };
    syncKeyAndPrefs();
    window.addEventListener("cinemix-session-change", syncKeyAndPrefs);
    window.addEventListener("storage", syncKeyAndPrefs);
    return () => {
      window.removeEventListener("cinemix-session-change", syncKeyAndPrefs);
      window.removeEventListener("storage", syncKeyAndPrefs);
    };
  }, []);

  // Load genre/country metadata if deep link tokens are present
  useEffect(() => {
    if (!hasApiKeys()) return;
    if (cachedSimpleFilters) {
      setGenres(cachedSimpleFilters.genres);
      setCountries(cachedSimpleFilters.countries);
      setFiltersLoaded(true);
      return;
    }
    let mounted = true;
    getFilters()
      .then((f) => {
        cachedSimpleFilters = { genres: f.genres, countries: f.countries };
        if (!mounted) return;
        setGenres(f.genres);
        setCountries(f.countries);
      })
      .catch(() => {})
      .finally(() => {
        if (mounted) setFiltersLoaded(true);
      });
    return () => {
      mounted = false;
    };
  }, []);

  // Determine active Feed Tab
  const activeFeed: ExploreFeedId = useMemo(() => {
    const rawLens = (p.feed || p.lens || "").toUpperCase();
    if (rawLens === "FOR_YOU") return "FOR_YOU";
    if (rawLens === "RECENT_RELEASES" || rawLens === "RECENT") {
      return "RECENT_RELEASES";
    }
    if (rawLens === "BLOCKBUSTERS" || rawLens === "HOLLYWOOD_BLOCKBUSTERS") {
      return "BLOCKBUSTERS";
    }
    if (rawLens === "HIDDEN_GEMS") return "HIDDEN_GEMS";
    if (rawLens === "TOP_RATED") return "TOP_RATED";
    if (rawLens === "TRENDING") return "TRENDING";

    // Map user's Default Explore Sort preference when no explicit feed/order is in URL
    if (!p.order && !p.lens && !p.feed) {
      if (prefOrder === "RATING") return "TOP_RATED";
      if (prefOrder === "YEAR") return "RECENT_RELEASES";
      return "TRENDING";
    }
    if (p.order === "HIDDEN_GEMS") return "HIDDEN_GEMS";
    return "TRENDING";
  }, [p.feed, p.lens, p.order, prefOrder]);

  const feedMeta = useMemo(
    () => FEEDS.find((f) => f.id === activeFeed) ?? FEEDS[0],
    [activeFeed],
  );

  const type = (
    p.type ? p.type : activeFeed === "FOR_YOU" ? "ALL" : prefType || "ALL"
  ) as "ALL" | "FILM" | "TV_SERIES" | "TV_SHOW" | "MINI_SERIES";

  const availableSortOptions = useMemo(
    () => getScopedSortOptions(activeFeed, Boolean(activeSearchQuery)),
    [activeFeed, activeSearchQuery],
  );

  // Scoped Sort Order: strictly respects the active feed's natural order unless the user
  // explicitly selected a compatible sort option for this feed.
  const order: ExploreSortOrder = useMemo(() => {
    if (activeSearchQuery && !p.order) {
      return "TRENDING";
    }
    if (p.order) {
      let normalized: ExploreSortOrder = p.order as ExploreSortOrder;
      if (p.order === "YEAR_DESC" || p.order === "YEAR_ASC") {
        normalized = "YEAR";
      } else if (p.order === "RELEVANCE") {
        normalized = "TRENDING";
      } else if (
        p.order === "IMDB_RATING" ||
        p.order === "KP_RATING" ||
        p.order === "CRITICS"
      ) {
        normalized = "RATING";
      }
      if (availableSortOptions.some((o) => o.value === normalized)) {
        return normalized;
      }
    }
    return feedMeta.defaultOrder;
  }, [p.order, activeSearchQuery, availableSortOptions, feedMeta]);

  const direction: SortDirection =
    p.dir === "ASC" || p.order === "YEAR_ASC" ? "ASC" : "DESC";

  const resolvedGenres = useMemo(
    () => resolveGenreTokens(p.genres, genres),
    [p.genres, genres],
  );
  const resolvedCountries = useMemo(
    () => resolveCountryTokens(p.countries, countries),
    [p.countries, countries],
  );
  const yearFrom =
    p.yearFrom !== undefined && p.yearFrom !== ""
      ? parseInt(p.yearFrom, 10)
      : undefined;
  const yearTo =
    p.yearTo !== undefined && p.yearTo !== ""
      ? parseInt(p.yearTo, 10)
      : undefined;

  // Scoped baseline rules per feed (kept clean under the hood—no ugly filter chips!)
  const feedScopedOptions = useMemo(() => {
    if (activeSearchQuery) {
      return {
        lens: undefined,
        trendingWindow: false,
        ratingFrom: p.rated === "1" ? 1.0 : undefined,
        ratingTo: undefined,
        minVotes: undefined,
        requireImdb: false,
        hideWatched: false,
      };
    }
    switch (activeFeed) {
      case "FOR_YOU":
        return {
          lens: "FOR_YOU",
          trendingWindow: false,
          ratingFrom: undefined,
          ratingTo: undefined,
          minVotes: undefined,
          requireImdb: false,
          hideWatched: true,
        };
      case "RECENT_RELEASES":
        return {
          lens: "RECENT_RELEASES",
          trendingWindow: false,
          ratingFrom: undefined,
          ratingTo: undefined,
          minVotes: undefined,
          requireImdb: false,
          hideWatched: false,
        };
      case "BLOCKBUSTERS":
        return {
          lens: "HOLLYWOOD_BLOCKBUSTERS",
          trendingWindow: false,
          ratingFrom: 7.0,
          ratingTo: undefined,
          minVotes: 25000,
          requireImdb: true,
          hideWatched: false,
        };
      case "HIDDEN_GEMS":
        return {
          lens: "HIDDEN_GEMS",
          trendingWindow: false,
          ratingFrom: 7.2,
          ratingTo: 8.8,
          minVotes: 1000,
          requireImdb: false,
          hideWatched: false,
        };
      case "TOP_RATED":
        return {
          lens: "TOP_RATED",
          trendingWindow: false,
          ratingFrom: 7.5,
          ratingTo: undefined,
          minVotes: 10000,
          requireImdb: false,
          hideWatched: false,
        };
      case "TRENDING":
      default:
        return {
          lens: "TRENDING",
          trendingWindow: true,
          ratingFrom: undefined,
          ratingTo: undefined,
          minVotes: undefined,
          requireImdb: false,
          hideWatched: false,
        };
    }
  }, [activeFeed, activeSearchQuery, p.rated]);

  useDocumentTitle(
    activeSearchQuery
      ? `Search: ${activeSearchQuery}`
      : `Explore — ${feedMeta.label}`,
  );

  const activeQueryKey = useMemo(() => {
    return JSON.stringify({
      activeFeed,
      activeSearchQuery,
      type,
      order,
      direction,
      resolvedGenres,
      resolvedCountries,
      yearFrom,
      yearTo,
      rated: p.rated,
      page,
      randomSeed,
      tasteSig: activeFeed === "FOR_YOU" ? tasteSig : "",
    });
  }, [
    activeFeed,
    activeSearchQuery,
    type,
    order,
    direction,
    resolvedGenres,
    resolvedCountries,
    yearFrom,
    yearTo,
    p.rated,
    page,
    randomSeed,
    tasteSig,
  ]);

  const [films, setFilms] = useState<Film[]>([]);
  const [matchedPerson, setMatchedPerson] =
    useState<MatchedPersonSummary | null>(null);
  const [correctedQuery, setCorrectedQuery] = useState<string | null>(null);
  const [targetYear, setTargetYear] = useState<number | null>(null);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [streamedPage, setStreamedPage] = useState(page);

  const [quickPeekFilm, setQuickPeekFilm] = useState<Film | null>(null);
  const [surpriseModalOpen, setSurpriseModalOpen] = useState(false);
  const [surpriseFilm, setSurpriseFilm] = useState<Film | null>(null);
  const [parentalGuideFilm, setParentalGuideFilm] = useState<Film | null>(null);

  const activeQuerySemantic = useMemo(
    () => (activeSearchQuery ? analyzeSemanticQuery(activeSearchQuery) : null),
    [activeSearchQuery],
  );

  const rawPersonName =
    autoTranslate && matchedPerson?.nameEn && !isRussian(matchedPerson.nameEn)
      ? matchedPerson.nameEn
      : matchedPerson?.nameRu || matchedPerson?.nameEn || "";
  const personDisplayName =
    useTranslate(rawPersonName) || rawPersonName || activeSearchQuery;
  const personDisplayProf = useTranslate(matchedPerson?.profession);

  const pushExploreParams = useCallback(
    (overrides: Record<string, string | undefined>, replaceAll = false) => {
      const base: Record<string, string | undefined> = replaceAll
        ? {}
        : {
            feed:
              activeFeed !== "TRENDING" || p.feed || p.lens
                ? activeFeed
                : undefined,
            type:
              type === "ALL" ? (prefType !== "ALL" ? "ALL" : undefined) : type,
            order: order !== feedMeta.defaultOrder ? order : undefined,
            dir: direction !== "DESC" ? direction : undefined,
            q: activeSearchQuery || undefined,
            genres: p.genres,
            countries: p.countries,
            yearFrom: p.yearFrom,
            yearTo: p.yearTo,
            rated: p.rated,
          };

      const merged: Record<string, string | undefined> = {
        ...base,
        page: undefined,
        ...overrides,
      };

      const cleanNext: Record<string, string> = {};
      const sp = new URLSearchParams();
      Object.entries(merged).forEach(([k, v]) => {
        if (v !== undefined && v !== "") {
          sp.set(k, v);
          cleanNext[k] = v;
        }
      });

      setLoading(true);
      setLoadingMore(false);
      setStreamedPage(1);
      setOptimisticParams(cleanNext as ExploreSearchParams);

      try {
        sessionStorage.setItem(STATE_STORAGE_KEY, JSON.stringify(cleanNext));
      } catch {
        // ignore
      }

      const qs = sp.toString();
      const href = qs ? `/explore?${qs}` : "/explore";
      syncRouteInNavStack(href);
      startTransition(() => {
        router.push(href, { scroll: false });
      });
    },
    [
      activeFeed,
      type,
      prefType,
      order,
      feedMeta.defaultOrder,
      direction,
      activeSearchQuery,
      p.feed,
      p.lens,
      p.genres,
      p.countries,
      p.yearFrom,
      p.yearTo,
      p.rated,
      router,
    ],
  );

  const requiresMetadata =
    Boolean(p.genres && isNaN(Number(p.genres.split(",")[0]))) ||
    Boolean(p.countries && isNaN(Number(p.countries.split(",")[0])));

  // Fetch films for active Feed or Search Query
  useEffect(() => {
    if (!ready || noKey) return;
    if (requiresMetadata && !filtersLoaded) return;

    const cachedSnap = getValidSnapshot(activeQueryKey);
    if (cachedSnap) {
      setFilms(cachedSnap.films);
      setMatchedPerson(cachedSnap.matchedPerson ?? null);
      setCorrectedQuery(cachedSnap.correctedQuery ?? null);
      setTargetYear(cachedSnap.targetYear ?? null);
      setTotalPages(cachedSnap.totalPages);
      setStreamedPage(cachedSnap.streamedPage);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setStreamedPage(page);

    discoverFilms({
      type,
      includeGenres: resolvedGenres,
      includeCountries: resolvedCountries,
      order,
      direction,
      ratingFrom: feedScopedOptions.ratingFrom,
      ratingTo: feedScopedOptions.ratingTo,
      minVotes: feedScopedOptions.minVotes,
      requireImdb: feedScopedOptions.requireImdb,
      yearFrom,
      yearTo,
      keyword: activeSearchQuery || undefined,
      lens: feedScopedOptions.lens,
      trendingWindow: feedScopedOptions.trendingWindow,
      hideWatched: feedScopedOptions.hideWatched,
      page,
      randomSeed,
      allGenresList: cachedSimpleFilters?.genres ?? genres,
      allCountriesList: cachedSimpleFilters?.countries ?? countries,
    })
      .then((res) => {
        if (cancelled) return;
        if (!hasApiKeys()) {
          simpleCacheMap.clear();
          setNoKey(true);
          setFilms([]);
          return;
        }
        const items = res.items ?? [];
        const pages = res.totalPages ?? 1;
        setFilms(items);
        setMatchedPerson(res.matchedPerson ?? null);
        setCorrectedQuery(res.correctedQuery ?? null);
        setTargetYear(res.targetYear ?? null);
        setTotalPages(pages);
        setSnapshot({
          queryKey: activeQueryKey,
          timestamp: Date.now(),
          films: items,
          totalPages: pages,
          streamedPage: page,
          matchedPerson: res.matchedPerson ?? null,
          correctedQuery: res.correctedQuery ?? null,
          targetYear: res.targetYear ?? null,
        });
      })
      .catch(() => {
        if (cancelled) return;
        if (!hasApiKeys()) {
          simpleCacheMap.clear();
          setNoKey(true);
        }
        setFilms([]);
        setMatchedPerson(null);
        setCorrectedQuery(null);
        setTargetYear(null);
        setTotalPages(1);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [
    ready,
    noKey,
    requiresMetadata,
    filtersLoaded,
    activeQueryKey,
    type,
    resolvedGenres,
    resolvedCountries,
    order,
    direction,
    feedScopedOptions,
    yearFrom,
    yearTo,
    activeSearchQuery,
    page,
    randomSeed,
    genres,
    countries,
  ]);

  // Save & restore scroll position when navigating back from a film detail page
  useEffect(() => {
    if (loading || films.length === 0) return;
    try {
      const savedScroll = sessionStorage.getItem(SCROLL_STORAGE_KEY);
      if (savedScroll) {
        const y = parseInt(savedScroll, 10);
        sessionStorage.removeItem(SCROLL_STORAGE_KEY);
        if (!isNaN(y) && y > 80) {
          requestAnimationFrame(() => {
            window.scrollTo({ top: y, behavior: "instant" as ScrollBehavior });
          });
        }
      }
    } catch {
      // ignore
    }
  }, [loading, films.length]);

  useEffect(() => {
    const saveScrollOnClick = (e: MouseEvent) => {
      const anchor = (e.target as HTMLElement)?.closest("a");
      if (anchor && anchor.getAttribute("href")?.startsWith("/film/")) {
        try {
          sessionStorage.setItem(SCROLL_STORAGE_KEY, String(window.scrollY));
        } catch {
          // ignore
        }
      }
    };
    document.addEventListener("click", saveScrollOnClick, true);
    return () => document.removeEventListener("click", saveScrollOnClick, true);
  }, []);

  const handleLoadNextBatch = useCallback(async () => {
    if (loading || loadingMore || streamedPage >= totalPages) return;
    setLoadingMore(true);
    try {
      const existingIds = new Set(films.map((f) => f.kinopoiskId ?? f.filmId));
      let nextP = streamedPage + 1;
      const collected: Film[] = [];

      for (let attempt = 0; attempt < 2 && nextP <= totalPages; attempt++) {
        const res = await discoverFilms({
          type,
          includeGenres: resolvedGenres,
          includeCountries: resolvedCountries,
          order,
          direction,
          ratingFrom: feedScopedOptions.ratingFrom,
          ratingTo: feedScopedOptions.ratingTo,
          minVotes: feedScopedOptions.minVotes,
          requireImdb: feedScopedOptions.requireImdb,
          yearFrom,
          yearTo,
          keyword: activeSearchQuery || undefined,
          lens: feedScopedOptions.lens,
          trendingWindow: feedScopedOptions.trendingWindow,
          hideWatched: feedScopedOptions.hideWatched,
          page: nextP,
          randomSeed: randomSeed + attempt * 19,
          allGenresList: cachedSimpleFilters?.genres ?? genres,
          allCountriesList: cachedSimpleFilters?.countries ?? countries,
        });

        for (const item of res.items ?? []) {
          const id = item.kinopoiskId ?? item.filmId;
          if (id && !existingIds.has(id)) {
            existingIds.add(id);
            collected.push(item);
          }
        }

        if (collected.length >= 8) break;
        nextP += 1;
      }

      const finalStreamedPage = Math.min(totalPages, nextP);
      setFilms((prev) => {
        const updated = [...prev, ...collected];
        const snap = simpleCacheMap.get(activeQueryKey);
        if (snap) {
          setSnapshot({
            ...snap,
            films: updated,
            streamedPage: finalStreamedPage,
          });
        }
        return updated;
      });
      setStreamedPage(finalStreamedPage);
    } catch {
      toast.error("Could not load next batch");
    } finally {
      setLoadingMore(false);
    }
  }, [
    loading,
    loadingMore,
    streamedPage,
    totalPages,
    films,
    type,
    resolvedGenres,
    resolvedCountries,
    order,
    direction,
    feedScopedOptions,
    yearFrom,
    yearTo,
    activeSearchQuery,
    randomSeed,
    genres,
    countries,
    activeQueryKey,
    toast,
  ]);

  // Automatic Infinite Scroll via IntersectionObserver (when enabled in Preferences)
  useEffect(() => {
    if (
      !infiniteScrollEnabled ||
      loading ||
      loadingMore ||
      films.length === 0 ||
      streamedPage >= totalPages
    ) {
      return;
    }
    const el = loadMoreTriggerRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          void handleLoadNextBatch();
        }
      },
      { rootMargin: "0px 0px 650px 0px" },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [
    infiniteScrollEnabled,
    loading,
    loadingMore,
    films.length,
    streamedPage,
    totalPages,
    handleLoadNextBatch,
  ]);

  const handleSearchInputChange = (val: string) => {
    setSearchInput(val);
    if (val.trim().length >= 2) {
      fetchSuggestions(val, 6);
    } else {
      clearSuggestions();
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedIdx >= 0 && suggestions[selectedIdx]) {
      const film = suggestions[selectedIdx];
      clearSuggestions();
      setSearchFocused(false);
      router.push(`/film/${film.kinopoiskId ?? film.filmId}`);
      return;
    }
    const trimmed = searchInput.trim();
    clearSuggestions();
    setSearchFocused(false);
    searchInputRef.current?.blur();
    if (trimmed) {
      setRecentTerms(saveRecentSearch(trimmed));
      pushExploreParams({ q: trimmed, keyword: undefined });
    } else if (activeSearchQuery) {
      pushExploreParams({ q: undefined, keyword: undefined });
    }
  };

  const handleClearSearch = () => {
    setSearchInput("");
    clearSuggestions();
    if (activeSearchQuery) {
      pushExploreParams({ q: undefined, keyword: undefined });
    }
  };

  const handlePickQuickTerm = (term: string) => {
    setSearchInput(term);
    clearSuggestions();
    setSearchFocused(false);
    setRecentTerms(saveRecentSearch(term));
    pushExploreParams({ q: term, keyword: undefined });
  };

  const handleSurpriseMe = useCallback(() => {
    if (films.length === 0) return;
    const pick = films[Math.floor(Math.random() * films.length)];
    setSurpriseFilm(pick);
    setSurpriseModalOpen(true);
  }, [films]);

  const advancedExploreHref = useMemo(() => {
    const sp = new URLSearchParams();
    if (!activeSearchQuery && activeFeed !== "TRENDING") {
      const mappedLens =
        activeFeed === "BLOCKBUSTERS" ? "HOLLYWOOD_BLOCKBUSTERS" : activeFeed;
      sp.set("lens", mappedLens);
    }
    if (type !== "ALL") sp.set("type", type);
    if (order !== feedMeta.defaultOrder) sp.set("order", order);
    if (direction !== "DESC") sp.set("dir", direction);
    if (activeSearchQuery) sp.set("keyword", activeSearchQuery);
    if (p.genres) sp.set("genres", p.genres);
    if (p.countries) sp.set("countries", p.countries);
    if (p.yearFrom) sp.set("yearFrom", p.yearFrom);
    if (p.yearTo) sp.set("yearTo", p.yearTo);
    const qs = sp.toString();
    return qs ? `/explore/advanced?${qs}` : "/explore/advanced";
  }, [
    activeFeed,
    feedMeta.defaultOrder,
    type,
    order,
    direction,
    activeSearchQuery,
    p.genres,
    p.countries,
    p.yearFrom,
    p.yearTo,
  ]);

  if (noKey) return <NoKeyBanner />;

  const effectiveCorrected =
    correctedQuery || activeQuerySemantic?.correctedQuery || null;
  const effectiveYear = targetYear ?? activeQuerySemantic?.targetYear ?? null;

  // Contextual deep-link tags (only if user clicked a Genre/Country/Year tag on a Film page)
  const deepLinkChips: { label: string; onClear: () => void }[] = [];
  if (p.genres) {
    const gLabels = resolvedGenres.map((id) => {
      const found = genres.find((g) => g.id === id);
      return found
        ? translateGenre(found.genre, autoTranslate) || found.genre
        : p.genres;
    });
    deepLinkChips.push({
      label: `Genre: ${gLabels.join(", ") || p.genres}`,
      onClear: () => pushExploreParams({ genres: undefined }),
    });
  }
  if (p.countries) {
    const cLabels = resolvedCountries.map((id) => {
      const found = countries.find((c) => c.id === id);
      return found
        ? translateCountry(found.country, autoTranslate) || found.country
        : p.countries;
    });
    deepLinkChips.push({
      label: `Country: ${cLabels.join(", ") || p.countries}`,
      onClear: () => pushExploreParams({ countries: undefined }),
    });
  }
  if (yearFrom !== undefined || yearTo !== undefined) {
    deepLinkChips.push({
      label: `Year: ${
        yearFrom === yearTo
          ? yearFrom
          : `${yearFrom ?? "Any"}–${yearTo ?? "Now"}`
      }`,
      onClear: () =>
        pushExploreParams({ yearFrom: undefined, yearTo: undefined }),
    });
  }

  return (
    <PageContainer>
      {/* ── Header Row ── */}
      <div className="flex items-center justify-between gap-3 mb-3.5 sm:mb-5">
        <div className="min-w-0">
          <h1 className="font-display tracking-[2px] text-white m-0 text-[clamp(22px,4.5vw,38px)] leading-none truncate">
            {activeSearchQuery ? `SEARCH` : "EXPLORE"}
          </h1>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            type="button"
            onClick={handleSurpriseMe}
            disabled={films.length === 0}
            className="btn btn-ghost py-1.5 px-2.5 sm:py-2 sm:px-3.5 text-[12px] disabled:opacity-40"
            title="Pick a random title from current grid"
          >
            <Shuffle size={13} className="text-[var(--accent)]" />
            <span className="sm:hidden">Surprise</span>
            <span className="hidden sm:inline">Surprise Me</span>
          </button>
          <Link
            href={advancedExploreHref}
            className="btn btn-primary py-1.5 px-3 sm:py-2 sm:px-4 text-[12px] no-underline"
            title="Open Advanced Explore Filter Studio"
          >
            <SlidersHorizontal size={13} />
            <span className="sm:hidden">Advanced</span>
            <span className="hidden sm:inline">Advanced Explore</span>
          </Link>
        </div>
      </div>

      {/* ── Unified Discovery Control Card (Search + Feeds + Types + Sort) ── */}
      <div className="relative z-30 bg-[var(--bg-card)] border border-[var(--border)] rounded-[14px] p-3 sm:p-4 mb-5 sm:mb-6">
        {/* Top Search Bar */}
        <form onSubmit={handleSearchSubmit}>
          <div ref={searchWrapperRef} className="relative w-full">
            <div className="flex items-stretch gap-2 ">
              <div className="relative flex-1 min-w-0 ">
                <Search
                  size={15}
                  strokeWidth={2.2}
                  className={`absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none transition-colors ${
                    sugLoading
                      ? "text-[var(--accent)]"
                      : "text-[var(--text-muted)]"
                  }`}
                />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchInput}
                  onChange={(e) => handleSearchInputChange(e.target.value)}
                  onKeyDown={(e) => handleKeyNav(e, suggestions.length)}
                  onFocus={() => {
                    setSearchFocused(true);
                    if (
                      searchInput.trim().length >= 2 &&
                      (suggestions.length > 0 ||
                        semanticMeta ||
                        sugMatchedPerson)
                    ) {
                      setSugVisible(true);
                    }
                  }}
                  placeholder="Search titles, franchises, release years, or themes…"
                  className="input w-full text-[13px] sm:text-[14px] py-2 sm:py-2.5 pl-9 pr-9 rounded-[10px] bg-[var(--bg-elevated)] border-[var(--border)] focus:border-[var(--accent)]"
                />
                {(searchInput || activeSearchQuery) && (
                  <button
                    type="button"
                    onClick={handleClearSearch}
                    className="absolute right-2 top-1/2 -translate-y-1/2 bg-transparent border-none cursor-pointer text-[var(--text-muted)] hover:text-white transition-colors w-7 h-7 rounded-full flex items-center justify-center"
                    aria-label="Clear search"
                  >
                    <X size={14} strokeWidth={2.3} />
                  </button>
                )}
              </div>

              {searchInput.trim().length > 0 && (
                <button
                  type="submit"
                  className="btn btn-primary p-2 sm:py-2.5 px-3.5 sm:px-4 text-[12px] sm:text-[13px] rounded-[10px] min-h-full"
                >
                  <Search size={13} />
                  <span className="hidden sm:inline">Search</span>
                </button>
              )}
            </div>

            {sugVisible && (
              <SearchSuggestionDropdown
                suggestions={suggestions}
                matchedPerson={sugMatchedPerson}
                semanticMeta={semanticMeta}
                selectedIdx={selectedIdx}
                sugLoading={sugLoading}
                search={searchInput}
                showSeeAllLink={
                  searchInput.trim().toLowerCase() !==
                  activeSearchQuery.toLowerCase()
                }
                onSelect={() => {
                  setSugVisible(false);
                  setSearchFocused(false);
                }}
                onQueryPick={handlePickQuickTerm}
              />
            )}
          </div>
        </form>

        {/* Collapsible Recent Searches & Quick Ideas when search input is focused and empty */}
        {searchFocused && !searchInput.trim() && (
          <div
            ref={quickTermsRef}
            className="flex flex-col gap-2 mt-2.5 pt-2.5 border-t border-[var(--border)] fade-in"
          >
            {
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10.5px] font-bold uppercase tracking-[0.8px] text-[var(--text-muted)] inline-flex items-center gap-1 mr-1">
                  <History size={11} className="text-[#60a5fa]" />
                  Recent:
                </span>
                {recentTerms.length > 0 &&
                  recentTerms.slice(0, 6).map((term) => (
                    <button
                      key={term}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => handlePickQuickTerm(term)}
                      className="px-2.5 py-1 rounded-[7px] text-[11px] font-medium bg-[var(--bg-elevated)] border border-[var(--border)] text-[var(--text)] hover:border-[#60a5fa] cursor-pointer transition-colors"
                    >
                      {term}
                    </button>
                  ))}
                {recentTerms.length > 0 && (
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      clearRecentSearches();
                      setRecentTerms([]);
                    }}
                    className="text-[11px] text-[var(--text-muted)] hover:text-white underline bg-transparent border-none cursor-pointer ml-1"
                  >
                    Clear
                  </button>
                )}
              </div>
            }

            <div className="hidden sm:flex items-center gap-1.5 flex-wrap">
              <span className="text-[10.5px] font-bold uppercase tracking-[0.8px] text-[var(--text-muted)] inline-flex items-center gap-1 mr-1">
                <Sparkles size={11} className="text-[var(--accent)]" />
                Try:
              </span>
              {QUICK_SEARCH_IDEAS.map((term) => (
                <button
                  key={term}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => handlePickQuickTerm(term)}
                  className="px-2.5 py-1 rounded-[7px] text-[11px] font-medium bg-[var(--bg-elevated)] border border-[var(--border)] text-[var(--text-dim)] hover:text-white hover:border-[var(--border-hover)] cursor-pointer transition-colors"
                >
                  {term}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Row 1: Feed Selector Bar (shown when not in active search query mode) */}
        {!activeSearchQuery && (
          <div className="mt-3 pt-2.5 border-t border-[var(--border)]">
            <TabBar>
              {FEEDS.map((f) => {
                const isSelected = activeFeed === f.id;
                return (
                  <TabPill
                    key={f.id}
                    active={isSelected}
                    onClick={() => {
                      if (isSelected) return;
                      pushExploreParams(
                        {
                          feed: f.id,
                          order: undefined,
                          dir: undefined,
                          q: undefined,
                          keyword: undefined,
                        },
                        true,
                      );
                    }}
                  >
                    {f.icon}
                    <span>{f.label}</span>
                  </TabPill>
                );
              })}
            </TabBar>
          </div>
        )}

        {/* Row 2: Content Type Pills + Scoped Sort Selector */}
        <div className="mt-2.5 pt-2.5 border-t border-[var(--border)] flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          {/* Media Type Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
            {TYPES.map((t) => {
              const isSelected = type === t.value;
              return (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => {
                    if (isSelected) return;
                    pushExploreParams({
                      type:
                        t.value === "ALL"
                          ? prefType !== "ALL"
                            ? "ALL"
                            : undefined
                          : t.value,
                    });
                  }}
                  className={`px-3 py-1.5 rounded-[8px] text-[12px] font-semibold border transition-colors cursor-pointer whitespace-nowrap active:scale-95 ${
                    isSelected
                      ? "bg-[var(--accent)] border-[var(--accent)] text-white"
                      : "bg-[var(--bg-elevated)] border-[var(--border)] text-[var(--text-dim)] hover:text-white"
                  }`}
                >
                  {t.label}
                </button>
              );
            })}
          </div>

          {/* Sort Selector + Direction */}
          <div className="flex items-stretch gap-1.5 flex-shrink-0">
            <select
              className="select text-[12px] py-1.5 px-3 rounded-[8px] flex-1 sm:flex-initial min-w-[155px]"
              value={order}
              onChange={(e) => {
                const nextOrd = e.target.value as ExploreSortOrder;
                if (nextOrd === "RANDOM") {
                  setRandomSeed((s) => s + 1);
                }
                const selectingFeedDefault =
                  nextOrd === feedMeta.defaultOrder && !activeSearchQuery;
                const preserveFeedAgainstPreference =
                  selectingFeedDefault &&
                  !p.feed &&
                  !p.lens &&
                  prefOrder !== feedMeta.defaultOrder;
                pushExploreParams({
                  ...(preserveFeedAgainstPreference
                    ? { feed: activeFeed }
                    : {}),
                  order: selectingFeedDefault ? undefined : nextOrd,
                  dir: nextOrd === "TITLE" ? "ASC" : undefined,
                });
              }}
              aria-label="Sort titles by"
            >
              {availableSortOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>

            {order !== "RANDOM" && order !== "TASTE_MATCH" ? (
              <button
                type="button"
                onClick={() =>
                  pushExploreParams({
                    dir: direction === "DESC" ? "ASC" : "DESC",
                  })
                }
                title={
                  direction === "DESC"
                    ? "Descending (Highest / Newest first) — Click for Ascending"
                    : "Ascending (Lowest / Oldest first) — Click for Descending"
                }
                className={`px-2.5 py-1.5 rounded-[8px] text-[12px] font-semibold border transition-colors cursor-pointer inline-flex items-center gap-1 flex-shrink-0 ${
                  direction === "ASC"
                    ? "bg-[rgba(245,197,24,0.14)] border-[rgba(245,197,24,0.45)] text-[#f5c518]"
                    : "bg-[var(--bg-elevated)] border-[var(--border)] text-[var(--text-dim)] hover:text-white"
                }`}
              >
                {direction === "DESC" ? (
                  <>
                    <ArrowDown size={13} />
                    <span className="hidden md:inline">DESC</span>
                  </>
                ) : (
                  <>
                    <ArrowUp size={13} />
                    <span className="hidden md:inline">ASC</span>
                  </>
                )}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setLoading(true);
                  setRandomSeed((s) => s + 1);
                }}
                className="px-2.5 py-1.5 rounded-[8px] text-[12px] font-semibold border border-[var(--accent)] bg-[var(--accent-dim)] text-white cursor-pointer inline-flex items-center gap-1.5 flex-shrink-0"
              >
                <Shuffle size={13} />
                <span className="hidden md:inline">Reshuffle</span>
              </button>
            )}
          </div>
        </div>

        {/* Optional Contextual Deep-Link Chips (Only when user clicked a Genre/Country/Year link on Film page) */}
        {deepLinkChips.length > 0 && (
          <div className="flex items-center flex-wrap gap-1.5 mt-2.5 pt-2.5 border-t border-[var(--border)]">
            {deepLinkChips.map((chip, idx) => (
              <button
                key={`${chip.label}-${idx}`}
                type="button"
                onClick={chip.onClear}
                className="inline-flex items-center gap-1.5 text-[11px] font-semibold rounded-full px-2.5 py-1 border bg-[rgba(34,197,94,0.12)] border-[rgba(34,197,94,0.35)] text-[#4ade80] cursor-pointer"
              >
                {chip.label}
                <X size={10} strokeWidth={3} />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Smart Search Feedback & Matched Actor Banner ── */}
      {activeSearchQuery &&
        !loading &&
        (effectiveCorrected ||
          effectiveYear !== null ||
          activeQuerySemantic?.matchedConcept) && (
          <div className="mb-4 px-3.5 py-2.5 rounded-[12px] bg-[var(--bg-card)] border border-[var(--border)] flex items-center justify-between gap-2 flex-wrap text-[12px]">
            <div className="flex items-center gap-2 flex-wrap">
              <Sparkles size={13} className="text-[var(--accent)] shrink-0" />
              {effectiveCorrected && (
                <span className="text-[var(--text-dim)]">
                  Including smart matches for{" "}
                  <button
                    type="button"
                    onClick={() => handlePickQuickTerm(effectiveCorrected)}
                    className="font-bold text-white hover:text-[var(--accent)] underline bg-transparent border-none cursor-pointer p-0"
                  >
                    “{effectiveCorrected}”
                  </button>
                </span>
              )}
              {effectiveYear !== null && (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#60a5fa] bg-[rgba(96,165,250,0.12)] border border-[rgba(96,165,250,0.3)] rounded-md px-2 py-0.5">
                  <Calendar size={11} />
                  Release Year: {effectiveYear}
                </span>
              )}
              {activeQuerySemantic?.matchedConcept && (
                <span className="text-[var(--text-dim)]">
                  · Theme:{" "}
                  <strong className="text-[#f5c518]">
                    {activeQuerySemantic.matchedConcept.label}
                  </strong>
                </span>
              )}
            </div>

            {(activeQuerySemantic?.relatedTerms?.length ?? 0) > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap">
                {activeQuerySemantic!.relatedTerms.slice(0, 3).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => handlePickQuickTerm(t)}
                    className="px-2 py-0.5 rounded-full text-[11px] bg-[var(--bg-elevated)] border border-[var(--border)] text-[var(--text-dim)] hover:text-white hover:border-[var(--accent)] cursor-pointer transition-colors"
                  >
                    {t}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

      {/* ── Poster Grid ── */}
      {loading ? (
        <FilmCardSkeletonGrid count={20} />
      ) : films.length === 0 ? (
        <EmptyState
          icon={<Search size={36} />}
          title={
            activeSearchQuery
              ? `No Matches for “${activeSearchQuery}”`
              : "No Matching Titles Found"
          }
          description={
            activeSearchQuery
              ? "Try another title, actor name, or switch media type to All."
              : "Try switching feeds or opening Advanced Explore for custom filters."
          }
          actionLabel={activeSearchQuery ? "Clear Search" : "Reset Feed"}
          onAction={() => pushExploreParams({}, true)}
        />
      ) : (
        <MemoizedPosterGrid
          films={films}
          loadingMore={loadingMore}
          onQuickPeek={setQuickPeekFilm}
        />
      )}

      {/* ── Auto-Infinite Scroll Sentinel + Fallback Load More Button ── */}
      {!loading && films.length > 0 && streamedPage < totalPages && (
        <div
          ref={loadMoreTriggerRef}
          className="mt-8 flex flex-col items-center justify-center gap-2"
        >
          <button
            type="button"
            onClick={handleLoadNextBatch}
            disabled={loadingMore}
            className="btn btn-ghost border-[rgba(229,9,20,0.35)] text-white px-6 py-2.5 text-[13px] font-semibold hover:bg-[var(--accent-dim)]"
          >
            {loadingMore ? "Loading More…" : "Load More"}
          </button>
        </div>
      )}

      {/* Quick-Peek Modal */}
      {quickPeekFilm && (
        <SimpleQuickPeekModal
          film={quickPeekFilm}
          autoTranslate={autoTranslate}
          onClose={() => setQuickPeekFilm(null)}
          onWatchNow={(fid) => {
            setQuickPeekFilm(null);
            router.push(`/watch/${fid}`);
          }}
          onOpenDetails={(fid) => {
            setQuickPeekFilm(null);
            router.push(`/film/${fid}`);
          }}
          onOpenParentalGuide={(f) => {
            setQuickPeekFilm(null);
            setParentalGuideFilm(f);
          }}
        />
      )}

      {/* Surprise Me Modal */}
      {surpriseModalOpen && surpriseFilm && (
        <SimpleSurpriseModal
          film={surpriseFilm}
          autoTranslate={autoTranslate}
          onSpinAgain={handleSurpriseMe}
          onClose={() => setSurpriseModalOpen(false)}
          onWatchNow={(fid) => {
            setSurpriseModalOpen(false);
            router.push(`/film/${fid}`);
          }}
        />
      )}

      {parentalGuideFilm && (
        <ParentalGuideModal
          open={Boolean(parentalGuideFilm)}
          onClose={() => setParentalGuideFilm(null)}
          film={parentalGuideFilm}
        />
      )}
    </PageContainer>
  );
}

function SimpleQuickPeekModal({
  film,
  autoTranslate,
  onClose,
  onWatchNow,
  onOpenDetails,
  onOpenParentalGuide,
}: {
  film: Film;
  autoTranslate: boolean;
  onClose: () => void;
  onWatchNow: (filmId: number) => void;
  onOpenDetails: (filmId: number) => void;
  onOpenParentalGuide: (film: Film) => void;
}) {
  const id = film.kinopoiskId ?? film.filmId ?? 0;
  const [detail, setDetail] = useState<Film>(film);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const { isFav, isWL } = useListStatus(id);
  const { toast } = useToast();

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    Promise.allSettled([getFilm(id), getFilmStaff(id)])
      .then(([fRes, sRes]) => {
        if (!mounted) return;
        if (fRes.status === "fulfilled") setDetail(fRes.value);
        if (sRes.status === "fulfilled") {
          setStaff(Array.isArray(sRes.value) ? sRes.value : []);
        }
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [id]);

  const title = useFilmTitle(detail, autoTranslate);
  const synopsis = useTranslate(
    detail.description || detail.shortDescription || "",
  );
  const certBadge = getQuickCertBadge(detail);
  const actors = staff.filter((s) => s.professionKey === "ACTOR").slice(0, 6);

  const filmEntry = {
    film_id: id,
    film_name: title,
    poster_url: detail.posterUrlPreview || detail.posterUrl || null,
    year: detail.year ?? null,
    rating: detail.ratingImdb ?? detail.ratingKinopoisk ?? null,
  };

  return (
    <ModalShell
      open
      onClose={onClose}
      title="QUICK PEEK PREVIEW"
      subtitle={title}
      icon={<Eye size={16} />}
      maxWidthClass="sm:max-w-[680px]"
    >
      <div className="flex flex-col sm:flex-row gap-5">
        <PosterImage
          src={detail.posterUrlPreview || detail.posterUrl}
          alt={title}
          title={title}
          filmId={id}
          imdbId={detail.imdbId}
          year={detail.year}
          className="w-[140px] sm:w-[180px] aspect-[2/3] rounded-[10px] overflow-hidden flex-shrink-0 mx-auto sm:mx-0 bg-[var(--surface)] relative"
        />
        <div className="flex-1 min-w-0">
          <h3 className="font-display text-[24px] sm:text-[28px] tracking-[1px] text-white leading-tight m-0">
            {title}
          </h3>
          <div className="flex items-center gap-2 flex-wrap mt-2 text-[12px] text-[var(--text-muted)]">
            {detail.year && <span>{detail.year}</span>}
            {detail.filmLength && (
              <span>
                · {Math.floor(detail.filmLength / 60)}h {detail.filmLength % 60}
                m
              </span>
            )}
            {certBadge && (
              <button
                type="button"
                onClick={() => onOpenParentalGuide(detail)}
                className="px-2 py-0.5 rounded bg-[var(--accent-dim)] border border-[rgba(229,9,20,0.35)] text-[11px] font-bold text-white cursor-pointer inline-flex items-center gap-1"
              >
                <ShieldAlert size={11} />
                {certBadge.label} · Parental Guide
              </button>
            )}
          </div>

          <div className="flex items-center gap-2.5 mt-3 flex-wrap">
            {detail.ratingImdb && (
              <span className="px-2.5 py-1 rounded bg-[rgba(245,197,24,0.14)] border border-[rgba(245,197,24,0.4)] text-[#f5c518] text-[12px] font-bold">
                ★ IMDb {detail.ratingImdb.toFixed(1)}
              </span>
            )}
            {detail.ratingKinopoisk && (
              <span className="px-2.5 py-1 rounded bg-[var(--bg-elevated)] border border-[var(--border)] text-white text-[12px] font-bold">
                KP {detail.ratingKinopoisk.toFixed(1)}
              </span>
            )}
          </div>

          <div className="flex flex-wrap gap-1.5 mt-3">
            {detail.genres?.map((g) => (
              <span
                key={g.genre}
                className="tag tag-accent text-[10px] capitalize"
              >
                {translateGenre(g.genre, autoTranslate)}
              </span>
            ))}
          </div>

          <div className="mt-3">
            {loading && !synopsis ? (
              <div className="skeleton h-20 rounded-[8px]" />
            ) : (
              <p className="text-[13px] text-[var(--text-dim)] leading-[1.65] m-0 line-clamp-5">
                {synopsis || "No synopsis available for this title."}
              </p>
            )}
          </div>

          {actors.length > 0 && (
            <div className="mt-3">
              <span className="text-[11px] text-[var(--text-muted)] uppercase tracking-[0.8px] block mb-1">
                Top Cast
              </span>
              <div className="flex flex-wrap gap-1.5">
                {actors.map((a) => (
                  <Link
                    key={a.staffId}
                    href={`/person/${a.staffId}`}
                    className="text-[11px] text-[var(--text)] bg-[var(--bg-elevated)] border border-[var(--border)] rounded px-2 py-0.5 no-underline hover:border-[var(--accent)]"
                  >
                    {a.nameEn || a.nameRu}
                  </Link>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center gap-2 mt-5 flex-wrap">
            <button
              type="button"
              onClick={() => onWatchNow(id)}
              className="btn btn-primary py-2 px-4 text-[12px]"
            >
              <Play size={13} fill="currentColor" />
              Watch Now
            </button>
            <button
              type="button"
              onClick={() => onOpenDetails(id)}
              className="btn btn-ghost py-2 px-4 text-[12px]"
            >
              Details
            </button>
            <button
              type="button"
              onClick={() => {
                const added = toggleFavorite(filmEntry);
                toast.show(
                  added ? "Added to Favorites" : "Removed from Favorites",
                  {
                    type: added ? "success" : "info",
                    icon: "heart",
                    description: title,
                    posterUrl: filmEntry.poster_url,
                  },
                );
              }}
              className={`btn btn-ghost py-2 px-3 text-[12px] ${
                isFav
                  ? "!border-[rgba(229,9,20,0.5)] !text-[var(--accent)]"
                  : ""
              }`}
            >
              <Heart
                size={13}
                fill={isFav ? "var(--accent)" : "none"}
                stroke={isFav ? "var(--accent)" : "currentColor"}
              />
              <span className="sm:hidden">{isFav ? "Saved" : "Fav"}</span>
              <span className="hidden sm:inline">
                {isFav ? "In Favorites" : "Favorite"}
              </span>
            </button>
            <button
              type="button"
              onClick={() => {
                const added = toggleWatchLater(filmEntry);
                toast.show(
                  added ? "Saved to Watch Later" : "Removed from Watch Later",
                  {
                    type: "info",
                    icon: "clock",
                    description: title,
                    posterUrl: filmEntry.poster_url,
                  },
                );
              }}
              className={`btn btn-ghost py-2 px-3 text-[12px] ${
                isWL ? "!border-[#60a5fa] !text-[#60a5fa]" : ""
              }`}
            >
              <Clock size={13} />
              <span className="sm:hidden">{isWL ? "Listed" : "Later"}</span>
              <span className="hidden sm:inline">
                {isWL ? "In Watch Later" : "Watch Later"}
              </span>
            </button>
          </div>
        </div>
      </div>
    </ModalShell>
  );
}

function SimpleSurpriseModal({
  film,
  autoTranslate,
  onSpinAgain,
  onClose,
  onWatchNow,
}: {
  film: Film;
  autoTranslate: boolean;
  onSpinAgain: () => void;
  onClose: () => void;
  onWatchNow: (filmId: number) => void;
}) {
  const id = film.kinopoiskId ?? film.filmId ?? 0;
  const title = useFilmTitle(film, autoTranslate);
  const rating = film.ratingImdb ?? film.ratingKinopoisk;

  return (
    <ModalShell
      open
      onClose={onClose}
      title="SURPRISE PICK"
      subtitle="Random selection from your active feed"
      icon={<Shuffle size={16} />}
      maxWidthClass="sm:max-w-[460px]"
    >
      <div className="flex flex-col items-center text-center">
        <PosterImage
          src={film.posterUrlPreview || film.posterUrl}
          alt={title}
          title={title}
          filmId={id}
          imdbId={film.imdbId}
          year={film.year}
          className="w-[150px] aspect-[2/3] rounded-[12px] overflow-hidden bg-[var(--surface)] mb-4 relative"
        />
        <h3 className="font-display text-[26px] tracking-[1px] text-white m-0">
          {title}
        </h3>
        <div className="flex items-center gap-2 mt-1.5 text-[12px] text-[var(--text-muted)]">
          {film.year && <span>{film.year}</span>}
          {rating && (
            <span className="text-[#f5c518] font-bold">
              ★ {rating.toFixed(1)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2.5 mt-5 w-full">
          <button
            type="button"
            onClick={onSpinAgain}
            className="btn btn-ghost flex-1 justify-center py-2.5 text-[12px]"
          >
            <Shuffle size={13} />
            Spin Again
          </button>
          <button
            type="button"
            onClick={() => onWatchNow(id)}
            className="btn btn-primary flex-1 justify-center py-2.5 text-[12px]"
          >
            <Play size={13} fill="currentColor" />
            Open Film
          </button>
        </div>
      </div>
    </ModalShell>
  );
}
