"use client";
import React, { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  X,
  Search,
  Sparkles,
  ArrowDown,
  ArrowUp,
  Shuffle,
  LayoutGrid,
  Grid3X3,
  List as ListIcon,
  BookmarkPlus,
  Trash2,
  Eye,
  Scale,
  ShieldAlert,
  Play,
  Heart,
  Clock,
  Star,
  Plus,
  Minus,
  Globe,
  SlidersHorizontal,
  ChevronDown,
} from "lucide-react";
import { discoverFilms, getFilters, getFilm, getStaff } from "@/lib/kinopoisk";
import {
  Film,
  Genre,
  Country,
  ExploreSortOrder,
  SortDirection,
  RatingSource,
  RuntimeBucket,
  AgeTierFilter,
  SeriesStatusFilter,
  CollectionType,
  SavedExplorePreset,
  StaffMember,
} from "@/types/kinopoisk";
import { translateGenre, translateCountry } from "@/lib/translate";
import {
  useAutoTranslate,
  useFilmTitle,
  useTranslate,
} from "@/hooks/useTranslate";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { useListStatus } from "@/hooks/useListStatus";
import {
  getPreferences,
  hasApiKeys,
  getSavedExplorePresets,
  saveExplorePreset,
  deleteExplorePreset,
} from "@/lib/preferences";
import { toggleFavorite, toggleWatchLater } from "@/lib/userLists";
import { useToast } from "@/lib/toast";
import { getQuickCertBadge } from "@/lib/parentalGuide";
import FilmCard from "@/components/FilmCard";
import Pagination from "@/components/Pagination";
import PageContainer from "@/components/ui/PageContainer";
import PageHeader from "@/components/ui/PageHeader";
import ModalShell from "@/components/ui/ModalShell";
import PosterImage from "@/components/ui/PosterImage";
import EmptyState from "@/components/ui/EmptyState";
import NoKeyBanner from "@/components/ui/NoKeyBanner";
import ParentalGuideModal from "@/components/ParentalGuideModal";
import type { ExploreSearchParams } from "@/app/explore/page";

const TYPES = [
  { value: "ALL", label: "All Media" },
  { value: "FILM", label: "Movies" },
  { value: "TV_SERIES", label: "TV Series" },
  { value: "MINI_SERIES", label: "Mini Series" },
  { value: "TV_SHOW", label: "TV Shows" },
] as const;

const SORT_ORDERS: { value: ExploreSortOrder; label: string }[] = [
  { value: "NUM_VOTE", label: "Most Popular (Votes)" },
  { value: "RATING", label: "Best Overall Rating" },
  { value: "IMDB_RATING", label: "IMDb Rating" },
  { value: "KP_RATING", label: "Kinopoisk Rating" },
  { value: "YEAR", label: "Release Year" },
  { value: "HIDDEN_GEMS", label: "Hidden Gems (High Score, Cult)" },
  { value: "CRITICS", label: "Critics Score" },
  { value: "TITLE", label: "Title (A–Z)" },
  { value: "RANDOM", label: "Random Roulette" },
];

const RATING_TIERS: {
  label: string;
  min: number;
  max: number;
  desc: string;
}[] = [
  {
    label: "Masterpieces (8.5–10)",
    min: 8.5,
    max: 10,
    desc: "All-time classics",
  },
  { label: "Great (7.0–8.4)", min: 7.0, max: 8.4, desc: "Highly acclaimed" },
  {
    label: "Popcorn (5.5–6.9)",
    min: 5.5,
    max: 6.9,
    desc: "Fun casual watches",
  },
  { label: "Mixed (4.0–5.4)", min: 4.0, max: 5.4, desc: "Divisive titles" },
  {
    label: "So-Bad-It's-Good (1.0–3.9)",
    min: 1.0,
    max: 3.9,
    desc: "Cult camp & low-tier",
  },
];

const CURRENT_YEAR = new Date().getFullYear();

const DECADE_PRESETS: { label: string; from?: number; to?: number }[] = [
  { label: "Upcoming", from: CURRENT_YEAR + 1, to: CURRENT_YEAR + 2 },
  { label: "2020s", from: 2020, to: CURRENT_YEAR },
  { label: "2010s", from: 2010, to: 2019 },
  { label: "2000s", from: 2000, to: 2009 },
  { label: "1990s", from: 1990, to: 1999 },
  { label: "1980s", from: 1980, to: 1989 },
  { label: "1970s", from: 1970, to: 1979 },
  { label: "Classic (<1970)", from: 1900, to: 1969 },
];

const COLLECTION_PRESETS: { value: CollectionType; label: string }[] = [
  { value: "OSKAR_WINNERS_2021", label: "🏆 Oscar Winners" },
  { value: "COMICS_THEME", label: "🦸 Superhero & Comics" },
  { value: "ZOMBIE_THEME", label: "🧟 Zombie Apocalypse" },
  { value: "CATASTROPHE_THEME", label: "🌋 Disaster & Survival" },
  { value: "VAMPIRE_THEME", label: "🧛 Vampires & Gothic" },
  { value: "FAMILY", label: "👨‍👩‍👧‍👦 Family Favorites" },
];

interface SmartLens {
  id: string;
  label: string;
  badge: string;
  params: Record<string, string | undefined>;
}

const SMART_LENSES: SmartLens[] = [
  {
    id: "FOR_YOU",
    label: "For You",
    badge: "Taste Match",
    params: {
      lens: "FOR_YOU",
      hideWatched: "1",
      excludeRu: "1",
    },
  },
  {
    id: "HOLLYWOOD_BLOCKBUSTERS",
    label: "Hollywood Blockbusters",
    badge: "Global Hits",
    params: {
      type: "FILM",
      order: "NUM_VOTE",
      dir: "DESC",
      ratingFrom: "7",
      minVotes: "25000",
      excludeRu: "1",
      requireImdb: "1",
    },
  },
  {
    id: "HIDDEN_GEMS",
    label: "Underrated Hidden Gems",
    badge: "7.2+ Cult",
    params: {
      order: "HIDDEN_GEMS",
      dir: "DESC",
      ratingFrom: "7.2",
      ratingTo: "8.8",
      minVotes: "1000",
      excludeRu: "1",
    },
  },
  {
    id: "MIND_BENDING",
    label: "Mind-Bending Sci-Fi & Thriller",
    badge: "Sci-Fi + Thriller",
    params: {
      type: "FILM",
      genres: "6,1",
      genreMode: "OR",
      order: "IMDB_RATING",
      dir: "DESC",
      ratingFrom: "7",
      excludeRu: "1",
    },
  },
  {
    id: "OSCAR_WINNERS",
    label: "Oscar Winners",
    badge: "Academy Award",
    params: {
      collection: "OSKAR_WINNERS_2021",
      order: "IMDB_RATING",
      dir: "DESC",
    },
  },
  {
    id: "GOLDEN_90S_00S",
    label: "90s & 2000s Golden Era",
    badge: "1990–2009",
    params: {
      yearFrom: "1990",
      yearTo: "2009",
      order: "NUM_VOTE",
      dir: "DESC",
      ratingFrom: "7.2",
      excludeRu: "1",
    },
  },
  {
    id: "FAMILY_NIGHT",
    label: "Family Movie Night",
    badge: "Safe & Fun",
    params: {
      age: "FAMILY",
      ratingFrom: "6.8",
      order: "NUM_VOTE",
      dir: "DESC",
      excludeRu: "1",
    },
  },
  {
    id: "GUILTY_PLEASURES",
    label: "So-Bad-It's-Good",
    badge: "1.0–5.2 Camp",
    params: {
      ratingFrom: "1",
      ratingTo: "5.2",
      order: "NUM_VOTE",
      dir: "DESC",
    },
  },
];

function parseNumberList(raw?: string): number[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => !isNaN(n) && n > 0);
}

function parseStringList(raw?: string): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function formatVotesCompact(votes?: number): string | null {
  if (!votes || votes <= 0) return null;
  if (votes >= 1_000_000) return `${(votes / 1_000_000).toFixed(1)}M`;
  if (votes >= 1_000) return `${Math.round(votes / 1_000)}K`;
  return String(votes);
}

export default function BrowseClient(props: ExploreSearchParams) {
  const router = useRouter();
  const { toast } = useToast();
  const autoTranslate = useAutoTranslate();

  const page = Math.max(1, parseInt(props.page || "1", 10));

  const [noKey, setNoKey] = useState(false);
  const [ready, setReady] = useState(false);
  const [prefType, setPrefType] = useState<string>("ALL");
  const [prefOrder, setPrefOrder] = useState<ExploreSortOrder>("NUM_VOTE");
  const [prefExcludeRu, setPrefExcludeRu] = useState<boolean>(true);

  const [genres, setGenres] = useState<Genre[]>([]);
  const [countries, setCountries] = useState<Country[]>([]);
  const [filtersLoaded, setFiltersLoaded] = useState(false);

  const [films, setFilms] = useState<Film[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [streamedPage, setStreamedPage] = useState(page);

  // Studio Command Deck UI state
  const [deckExpanded, setDeckExpanded] = useState(false);
  const [activeStudioTab, setActiveStudioTab] = useState<
    "GENRES" | "COUNTRIES" | "RATINGS" | "ERA_RUNTIME" | "LIBRARY"
  >("GENRES");
  const [countrySearch, setCountrySearch] = useState("");
  const [keywordDraft, setKeywordDraft] = useState(props.keyword || "");
  const [randomSeed, setRandomSeed] = useState(1);

  // Custom saved presets
  const [savedPresets, setSavedPresets] = useState<SavedExplorePreset[]>([]);
  const [presetNameInput, setPresetNameInput] = useState("");
  const [showSavePresetInput, setShowSavePresetInput] = useState(false);

  // Quick-Peek, Compare & Randomizer modals
  const [quickPeekFilm, setQuickPeekFilm] = useState<Film | null>(null);
  const [compareFilms, setCompareFilms] = useState<Film[]>([]);
  const [compareModalOpen, setCompareModalOpen] = useState(false);
  const [surpriseModalOpen, setSurpriseModalOpen] = useState(false);
  const [surpriseFilm, setSurpriseFilm] = useState<Film | null>(null);
  const [parentalGuideFilm, setParentalGuideFilm] = useState<Film | null>(null);

  // Resolve active parameters with user preference defaults
  const type = (props.type || prefType || "ALL") as
    | "ALL"
    | "FILM"
    | "TV_SERIES"
    | "TV_SHOW"
    | "MINI_SERIES";
  const excludeTypes = useMemo(
    () => parseStringList(props.excludeTypes),
    [props.excludeTypes],
  );
  const order = (props.order || prefOrder || "NUM_VOTE") as ExploreSortOrder;
  const direction: SortDirection = props.dir === "ASC" ? "ASC" : "DESC";
  const genreMatchMode: "AND" | "OR" = props.genreMode === "OR" ? "OR" : "AND";
  const ratingSource: RatingSource =
    (props.ratingSource as RatingSource) || "AUTO";
  const ratingFrom =
    props.ratingFrom !== undefined && props.ratingFrom !== ""
      ? parseFloat(props.ratingFrom)
      : undefined;
  const ratingTo =
    props.ratingTo !== undefined && props.ratingTo !== ""
      ? parseFloat(props.ratingTo)
      : undefined;
  const minVotes =
    props.minVotes !== undefined && props.minVotes !== ""
      ? parseInt(props.minVotes, 10)
      : undefined;
  const requireImdb = props.requireImdb === "1";
  const yearFrom =
    props.yearFrom !== undefined && props.yearFrom !== ""
      ? parseInt(props.yearFrom, 10)
      : undefined;
  const yearTo =
    props.yearTo !== undefined && props.yearTo !== ""
      ? parseInt(props.yearTo, 10)
      : undefined;
  const runtimeBucket: RuntimeBucket =
    (props.runtime as RuntimeBucket) || "ANY";
  const includeAgeTiers = useMemo(
    () => parseStringList(props.age) as AgeTierFilter[],
    [props.age],
  );
  const excludeAgeTiers = useMemo(
    () => parseStringList(props.excludeAge) as AgeTierFilter[],
    [props.excludeAge],
  );
  const seriesStatus: SeriesStatusFilter =
    (props.status as SeriesStatusFilter) || "ALL";
  const collectionPreset = props.collection as CollectionType | undefined;
  const activeLens = props.lens;
  const hideWatched = props.hideWatched === "1";
  const hideFavorites = props.hideFavorites === "1";
  const hideWatchLater = props.hideWatchLater === "1";
  const excludeRussian =
    props.excludeRu !== undefined ? props.excludeRu === "1" : prefExcludeRu;
  const viewMode: "GRID" | "COMPACT" | "LIST" =
    props.view === "COMPACT" || props.view === "LIST" ? props.view : "GRID";

  // Resolve genre and country strings or IDs into numeric ID arrays
  const [resolvedIncludeGenres, setResolvedIncludeGenres] = useState<number[]>(
    () => parseNumberList(props.genres),
  );
  const [resolvedExcludeGenres, setResolvedExcludeGenres] = useState<number[]>(
    () => parseNumberList(props.excludeGenres),
  );
  const [resolvedIncludeCountries, setResolvedIncludeCountries] = useState<
    number[]
  >(() => parseNumberList(props.countries));
  const [resolvedExcludeCountries, setResolvedExcludeCountries] = useState<
    number[]
  >(() => parseNumberList(props.excludeCountries));

  useDocumentTitle("Explore Films & Series");

  useEffect(() => {
    setKeywordDraft(props.keyword || "");
  }, [props.keyword]);

  useEffect(() => {
    if (!hasApiKeys()) {
      setNoKey(true);
      setLoading(false);
      return;
    }
    const prefs = getPreferences();
    setPrefType(prefs.defaultExploreType || "ALL");
    setPrefOrder((prefs.defaultExploreOrder as ExploreSortOrder) || "NUM_VOTE");
    setPrefExcludeRu(
      (prefs.contentRegionMode ?? "GLOBAL_FIRST") === "GLOBAL_FIRST",
    );
    setSavedPresets(getSavedExplorePresets());
    setReady(true);
  }, []);

  useEffect(() => {
    if (!hasApiKeys()) return;

    getFilters()
      .then((f) => {
        setGenres(f.genres);
        setCountries(f.countries);

        const resolveGenreTokens = (raw?: string): number[] => {
          if (!raw) return [];
          const out: number[] = [];
          for (const token of raw.split(",")) {
            const t = token.trim();
            if (!t) continue;
            if (!isNaN(Number(t))) {
              out.push(parseInt(t, 10));
            } else {
              const lower = t.toLowerCase();
              const match = f.genres.find(
                (g) =>
                  g.genre.toLowerCase() === lower ||
                  translateGenre(g.genre, true).toLowerCase() === lower,
              );
              if (match) out.push(match.id);
            }
          }
          return Array.from(new Set(out));
        };

        const resolveCountryTokens = (raw?: string): number[] => {
          if (!raw) return [];
          const out: number[] = [];
          for (const token of raw.split(",")) {
            const t = token.trim();
            if (!t) continue;
            if (!isNaN(Number(t))) {
              out.push(parseInt(t, 10));
            } else {
              const lower = t.toLowerCase();
              const match = f.countries.find(
                (c) =>
                  c.country.toLowerCase() === lower ||
                  translateCountry(c.country, true).toLowerCase() === lower,
              );
              if (match) out.push(match.id);
            }
          }
          return Array.from(new Set(out));
        };

        setResolvedIncludeGenres(resolveGenreTokens(props.genres));
        setResolvedExcludeGenres(resolveGenreTokens(props.excludeGenres));
        setResolvedIncludeCountries(resolveCountryTokens(props.countries));
        setResolvedExcludeCountries(
          resolveCountryTokens(props.excludeCountries),
        );
      })
      .catch(() => {})
      .finally(() => setFiltersLoaded(true));
  }, [
    props.genres,
    props.excludeGenres,
    props.countries,
    props.excludeCountries,
  ]);

  const currentParamsRecord = useCallback((): Record<
    string,
    string | undefined
  > => {
    return {
      type: type !== "ALL" ? type : undefined,
      excludeTypes:
        excludeTypes.length > 0 ? excludeTypes.join(",") : undefined,
      order: order !== "NUM_VOTE" ? order : undefined,
      dir: direction !== "DESC" ? direction : undefined,
      genres:
        resolvedIncludeGenres.length > 0
          ? resolvedIncludeGenres.join(",")
          : undefined,
      excludeGenres:
        resolvedExcludeGenres.length > 0
          ? resolvedExcludeGenres.join(",")
          : undefined,
      genreMode: genreMatchMode !== "AND" ? genreMatchMode : undefined,
      countries:
        resolvedIncludeCountries.length > 0
          ? resolvedIncludeCountries.join(",")
          : undefined,
      excludeCountries:
        resolvedExcludeCountries.length > 0
          ? resolvedExcludeCountries.join(",")
          : undefined,
      excludeRu: excludeRussian ? "1" : "0",
      ratingFrom: ratingFrom !== undefined ? String(ratingFrom) : undefined,
      ratingTo: ratingTo !== undefined ? String(ratingTo) : undefined,
      ratingSource: ratingSource !== "AUTO" ? ratingSource : undefined,
      minVotes: minVotes !== undefined ? String(minVotes) : undefined,
      requireImdb: requireImdb ? "1" : undefined,
      yearFrom: yearFrom !== undefined ? String(yearFrom) : undefined,
      yearTo: yearTo !== undefined ? String(yearTo) : undefined,
      runtime: runtimeBucket !== "ANY" ? runtimeBucket : undefined,
      age: includeAgeTiers.length > 0 ? includeAgeTiers.join(",") : undefined,
      excludeAge:
        excludeAgeTiers.length > 0 ? excludeAgeTiers.join(",") : undefined,
      status: seriesStatus !== "ALL" ? seriesStatus : undefined,
      keyword: props.keyword?.trim() ? props.keyword.trim() : undefined,
      collection: collectionPreset,
      lens: activeLens,
      hideWatched: hideWatched ? "1" : undefined,
      hideFavorites: hideFavorites ? "1" : undefined,
      hideWatchLater: hideWatchLater ? "1" : undefined,
      view: viewMode !== "GRID" ? viewMode : undefined,
    };
  }, [
    type,
    excludeTypes,
    order,
    direction,
    resolvedIncludeGenres,
    resolvedExcludeGenres,
    genreMatchMode,
    resolvedIncludeCountries,
    resolvedExcludeCountries,
    excludeRussian,
    ratingFrom,
    ratingTo,
    ratingSource,
    minVotes,
    requireImdb,
    yearFrom,
    yearTo,
    runtimeBucket,
    includeAgeTiers,
    excludeAgeTiers,
    seriesStatus,
    props.keyword,
    collectionPreset,
    activeLens,
    hideWatched,
    hideFavorites,
    hideWatchLater,
    viewMode,
  ]);

  const buildFilterHref = useCallback(
    (overrides: Record<string, string | undefined>, replaceAll = false) => {
      const base = replaceAll ? {} : currentParamsRecord();
      const merged: Record<string, string | undefined> = {
        ...base,
        ...overrides,
      };
      const params = new URLSearchParams();
      Object.entries(merged).forEach(([k, v]) => {
        if (v !== undefined && v !== "") params.set(k, v);
      });
      const qs = params.toString();
      return qs ? `/explore?${qs}` : "/explore";
    },
    [currentParamsRecord],
  );

  const pushFilters = useCallback(
    (overrides: Record<string, string | undefined>, replaceAll = false) => {
      router.push(
        buildFilterHref({ page: undefined, ...overrides }, replaceAll),
      );
    },
    [router, buildFilterHref],
  );

  const buildPageHref = useCallback(
    (p: number) => buildFilterHref({ page: String(p) }),
    [buildFilterHref],
  );

  // Fetch films via Partitioned Multi-Constraint Discovery Engine
  useEffect(() => {
    if (!ready || noKey || !filtersLoaded) return;

    let cancelled = false;
    setLoading(true);
    setStreamedPage(page);

    discoverFilms({
      type,
      excludeTypes,
      includeGenres: resolvedIncludeGenres,
      genreMatchMode,
      excludeGenres: resolvedExcludeGenres,
      includeCountries: resolvedIncludeCountries,
      excludeCountries: resolvedExcludeCountries,
      excludeRussian,
      order,
      direction,
      ratingSource,
      ratingFrom,
      ratingTo,
      requireImdb,
      minVotes,
      yearFrom,
      yearTo,
      runtimeBucket,
      includeAgeTiers,
      excludeAgeTiers,
      seriesStatus,
      keyword: props.keyword?.trim() || undefined,
      collectionPreset,
      lens: activeLens,
      hideWatched,
      hideFavorites,
      hideWatchLater,
      page,
      randomSeed,
      allGenresList: genres,
      allCountriesList: countries,
    })
      .then((res) => {
        if (cancelled) return;
        setFilms(res.items ?? []);
        setTotalPages(res.totalPages ?? 1);
        setTotal(res.total ?? 0);
      })
      .catch(() => {
        if (cancelled) return;
        setFilms([]);
        setTotalPages(1);
        setTotal(0);
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
    filtersLoaded,
    type,
    excludeTypes,
    resolvedIncludeGenres,
    genreMatchMode,
    resolvedExcludeGenres,
    resolvedIncludeCountries,
    resolvedExcludeCountries,
    excludeRussian,
    order,
    direction,
    ratingSource,
    ratingFrom,
    ratingTo,
    requireImdb,
    minVotes,
    yearFrom,
    yearTo,
    runtimeBucket,
    includeAgeTiers,
    excludeAgeTiers,
    seriesStatus,
    props.keyword,
    collectionPreset,
    activeLens,
    hideWatched,
    hideFavorites,
    hideWatchLater,
    page,
    randomSeed,
    genres,
    countries,
  ]);

  // Continuous "Load Next Batch (+20)" stream without losing scroll position
  const handleLoadNextBatch = async () => {
    if (loadingMore || streamedPage >= totalPages) return;
    const nextP = streamedPage + 1;
    setLoadingMore(true);
    try {
      const res = await discoverFilms({
        type,
        excludeTypes,
        includeGenres: resolvedIncludeGenres,
        genreMatchMode,
        excludeGenres: resolvedExcludeGenres,
        includeCountries: resolvedIncludeCountries,
        excludeCountries: resolvedExcludeCountries,
        excludeRussian,
        order,
        direction,
        ratingSource,
        ratingFrom,
        ratingTo,
        requireImdb,
        minVotes,
        yearFrom,
        yearTo,
        runtimeBucket,
        includeAgeTiers,
        excludeAgeTiers,
        seriesStatus,
        keyword: props.keyword?.trim() || undefined,
        collectionPreset,
        lens: activeLens,
        hideWatched,
        hideFavorites,
        hideWatchLater,
        page: nextP,
        randomSeed,
        allGenresList: genres,
        allCountriesList: countries,
      });
      const existingIds = new Set(films.map((f) => f.kinopoiskId ?? f.filmId));
      const fresh = (res.items ?? []).filter(
        (f) => !existingIds.has(f.kinopoiskId ?? f.filmId),
      );
      setFilms((prev) => [...prev, ...fresh]);
      setStreamedPage(nextP);
    } catch {
      toast.error("Could not load next batch");
    } finally {
      setLoadingMore(false);
    }
  };

  // Popular quick countries for the Studio Country Deck
  const filteredCountries = useMemo(() => {
    const q = countrySearch.trim().toLowerCase();
    const list = countries.filter((c) => {
      if (!q) return true;
      const en = translateCountry(c.country, true).toLowerCase();
      return c.country.toLowerCase().includes(q) || en.includes(q);
    });
    return list.slice(0, 42);
  }, [countries, countrySearch]);

  if (noKey) return <NoKeyBanner />;

  // Tri-state toggle helper (+ Include -> - Exclude -> Off)
  const handleCycleGenre = (genreId: number) => {
    const isInc = resolvedIncludeGenres.includes(genreId);
    const isExc = resolvedExcludeGenres.includes(genreId);

    if (!isInc && !isExc) {
      const nextInc = [...resolvedIncludeGenres, genreId];
      pushFilters({
        genres: nextInc.join(","),
        lens: undefined,
      });
    } else if (isInc) {
      const nextInc = resolvedIncludeGenres.filter((id) => id !== genreId);
      const nextExc = [...resolvedExcludeGenres, genreId];
      pushFilters({
        genres: nextInc.length > 0 ? nextInc.join(",") : undefined,
        excludeGenres: nextExc.join(","),
        lens: undefined,
      });
    } else {
      const nextExc = resolvedExcludeGenres.filter((id) => id !== genreId);
      pushFilters({
        excludeGenres: nextExc.length > 0 ? nextExc.join(",") : undefined,
        lens: undefined,
      });
    }
  };

  const handleCycleCountry = (countryId: number) => {
    const isInc = resolvedIncludeCountries.includes(countryId);
    const isExc = resolvedExcludeCountries.includes(countryId);

    if (!isInc && !isExc) {
      const nextInc = [...resolvedIncludeCountries, countryId];
      pushFilters({
        countries: nextInc.join(","),
        lens: undefined,
      });
    } else if (isInc) {
      const nextInc = resolvedIncludeCountries.filter((id) => id !== countryId);
      const nextExc = [...resolvedExcludeCountries, countryId];
      pushFilters({
        countries: nextInc.length > 0 ? nextInc.join(",") : undefined,
        excludeCountries: nextExc.join(","),
        lens: undefined,
      });
    } else {
      const nextExc = resolvedExcludeCountries.filter((id) => id !== countryId);
      pushFilters({
        excludeCountries: nextExc.length > 0 ? nextExc.join(",") : undefined,
        lens: undefined,
      });
    }
  };

  const handleCycleAgeTier = (tier: AgeTierFilter) => {
    const isInc = includeAgeTiers.includes(tier);
    const isExc = excludeAgeTiers.includes(tier);

    if (!isInc && !isExc) {
      const nextInc = [...includeAgeTiers, tier];
      pushFilters({ age: nextInc.join(","), lens: undefined });
    } else if (isInc) {
      const nextInc = includeAgeTiers.filter((t) => t !== tier);
      const nextExc = [...excludeAgeTiers, tier];
      pushFilters({
        age: nextInc.length > 0 ? nextInc.join(",") : undefined,
        excludeAge: nextExc.join(","),
        lens: undefined,
      });
    } else {
      const nextExc = excludeAgeTiers.filter((t) => t !== tier);
      pushFilters({
        excludeAge: nextExc.length > 0 ? nextExc.join(",") : undefined,
        lens: undefined,
      });
    }
  };

  const handleToggleCompare = (film: Film) => {
    const id = film.kinopoiskId ?? film.filmId;
    setCompareFilms((prev) => {
      const exists = prev.some((f) => (f.kinopoiskId ?? f.filmId) === id);
      if (exists) {
        return prev.filter((f) => (f.kinopoiskId ?? f.filmId) !== id);
      }
      if (prev.length >= 3) {
        toast.info("Comparison tray holds up to 3 films");
        return [...prev.slice(1), film];
      }
      return [...prev, film];
    });
  };

  const handleSurpriseMe = () => {
    if (films.length === 0) return;
    const pick = films[Math.floor(Math.random() * films.length)];
    setSurpriseFilm(pick);
    setSurpriseModalOpen(true);
  };

  const handleSaveCurrentPreset = () => {
    const label = presetNameInput.trim();
    if (!label) return;
    const cleanParams: Record<string, string> = {};
    Object.entries(currentParamsRecord()).forEach(([k, v]) => {
      if (v !== undefined && v !== "") cleanParams[k] = v;
    });
    const newPreset: SavedExplorePreset = {
      id: `preset-${Date.now()}`,
      name: label,
      params: cleanParams,
      createdAt: Date.now(),
    };
    const updated = saveExplorePreset(newPreset);
    setSavedPresets(updated);
    setPresetNameInput("");
    setShowSavePresetInput(false);
    toast.success(`Saved preset "${label}"`);
  };

  // Build active filter summary tags
  const activeFilterTags: {
    label: string;
    isNegative?: boolean;
    onClear: () => void;
  }[] = [];

  for (const gId of resolvedIncludeGenres) {
    const g = genres.find((item) => item.id === gId);
    const gLabel = g
      ? translateGenre(g.genre, autoTranslate) || g.genre
      : `Genre #${gId}`;
    activeFilterTags.push({
      label: `+ ${gLabel}`,
      onClear: () => {
        const next = resolvedIncludeGenres.filter((id) => id !== gId);
        pushFilters({ genres: next.length ? next.join(",") : undefined });
      },
    });
  }

  for (const gId of resolvedExcludeGenres) {
    const g = genres.find((item) => item.id === gId);
    const gLabel = g
      ? translateGenre(g.genre, autoTranslate) || g.genre
      : `Genre #${gId}`;
    activeFilterTags.push({
      label: `− ${gLabel}`,
      isNegative: true,
      onClear: () => {
        const next = resolvedExcludeGenres.filter((id) => id !== gId);
        pushFilters({
          excludeGenres: next.length ? next.join(",") : undefined,
        });
      },
    });
  }

  for (const cId of resolvedIncludeCountries) {
    const c = countries.find((item) => item.id === cId);
    const cLabel = c
      ? translateCountry(c.country, autoTranslate) || c.country
      : `Country #${cId}`;
    activeFilterTags.push({
      label: `+ ${cLabel}`,
      onClear: () => {
        const next = resolvedIncludeCountries.filter((id) => id !== cId);
        pushFilters({ countries: next.length ? next.join(",") : undefined });
      },
    });
  }

  for (const cId of resolvedExcludeCountries) {
    const c = countries.find((item) => item.id === cId);
    const cLabel = c
      ? translateCountry(c.country, autoTranslate) || c.country
      : `Country #${cId}`;
    activeFilterTags.push({
      label: `− ${cLabel}`,
      isNegative: true,
      onClear: () => {
        const next = resolvedExcludeCountries.filter((id) => id !== cId);
        pushFilters({
          excludeCountries: next.length ? next.join(",") : undefined,
        });
      },
    });
  }

  if (excludeRussian) {
    activeFilterTags.push({
      label: "− Russia / USSR",
      isNegative: true,
      onClear: () => pushFilters({ excludeRu: "0" }),
    });
  }

  if (ratingFrom !== undefined || ratingTo !== undefined) {
    activeFilterTags.push({
      label: `Rating ${ratingFrom ?? 0}–${ratingTo ?? 10}${
        ratingSource !== "AUTO" ? ` (${ratingSource})` : ""
      }`,
      onClear: () =>
        pushFilters({ ratingFrom: undefined, ratingTo: undefined }),
    });
  }

  if (minVotes) {
    activeFilterTags.push({
      label: `${formatVotesCompact(minVotes)}+ Votes`,
      onClear: () => pushFilters({ minVotes: undefined }),
    });
  }

  if (requireImdb) {
    activeFilterTags.push({
      label: "Has IMDb Score",
      onClear: () => pushFilters({ requireImdb: undefined }),
    });
  }

  if (yearFrom !== undefined || yearTo !== undefined) {
    activeFilterTags.push({
      label: `Years ${yearFrom ?? "Any"}–${yearTo ?? "Now"}`,
      onClear: () => pushFilters({ yearFrom: undefined, yearTo: undefined }),
    });
  }

  if (runtimeBucket !== "ANY") {
    activeFilterTags.push({
      label:
        runtimeBucket === "SHORT"
          ? "< 95 min"
          : runtimeBucket === "STANDARD"
            ? "95–130 min"
            : "> 130 min",
      onClear: () => pushFilters({ runtime: undefined }),
    });
  }

  for (const t of includeAgeTiers) {
    activeFilterTags.push({
      label: `+ ${t} Age`,
      onClear: () => {
        const next = includeAgeTiers.filter((x) => x !== t);
        pushFilters({ age: next.length ? next.join(",") : undefined });
      },
    });
  }

  for (const t of excludeAgeTiers) {
    activeFilterTags.push({
      label: `− ${t} Age`,
      isNegative: true,
      onClear: () => {
        const next = excludeAgeTiers.filter((x) => x !== t);
        pushFilters({ excludeAge: next.length ? next.join(",") : undefined });
      },
    });
  }

  if (seriesStatus !== "ALL") {
    activeFilterTags.push({
      label:
        seriesStatus === "COMPLETED" ? "Completed Series" : "Ongoing Series",
      onClear: () => pushFilters({ status: undefined }),
    });
  }

  if (props.keyword?.trim()) {
    activeFilterTags.push({
      label: `Keyword: "${props.keyword.trim()}"`,
      onClear: () => pushFilters({ keyword: undefined }),
    });
  }

  if (collectionPreset) {
    const colLabel =
      COLLECTION_PRESETS.find((c) => c.value === collectionPreset)?.label ||
      collectionPreset;
    activeFilterTags.push({
      label: colLabel,
      onClear: () => pushFilters({ collection: undefined }),
    });
  }

  if (hideWatched) {
    activeFilterTags.push({
      label: "Hide Watched",
      onClear: () => pushFilters({ hideWatched: undefined }),
    });
  }

  if (hideFavorites) {
    activeFilterTags.push({
      label: "Hide In Favorites",
      onClear: () => pushFilters({ hideFavorites: undefined }),
    });
  }

  if (hideWatchLater) {
    activeFilterTags.push({
      label: "Hide Watch Later",
      onClear: () => pushFilters({ hideWatchLater: undefined }),
    });
  }

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Studio Discovery Engine"
        eyebrowIcon={<Sparkles size={13} stroke="var(--accent)" />}
        eyebrowColor="var(--accent)"
        title="EXPLORE"
        subtitle="Multi-genre intersections, negative exclusions, bidirectional rating brackets, and deep 500+ film discovery."
        rightSlot={
          <div className="flex items-center gap-2.5 flex-wrap">
            {total > 0 && !loading && (
              <span className="text-[12px] sm:text-[13px] text-[var(--text-muted)] bg-[var(--bg-elevated)] border border-[var(--border)] px-3 py-1.5 rounded-full">
                <strong className="text-white">
                  {total.toLocaleString()}+
                </strong>{" "}
                matching titles · Page {streamedPage} of {totalPages}
              </span>
            )}
            <button
              type="button"
              onClick={handleSurpriseMe}
              disabled={films.length === 0}
              className="btn btn-primary py-2 px-3.5 text-[12px] disabled:opacity-40"
            >
              <Shuffle size={13} />
              Surprise Me
            </button>
          </div>
        }
      />

      {/* ── LAYER 1: Smart Discovery Lenses & Saved Presets ── */}
      <div className="mb-5">
        <div className="flex items-center justify-between gap-2 mb-2">
          <span className="text-[11px] font-bold uppercase tracking-[1.4px] text-[var(--text-muted)] flex items-center gap-1.5">
            <Sparkles size={12} className="text-[var(--accent)]" />
            Smart Discovery Lenses
          </span>
          <button
            type="button"
            onClick={() => setShowSavePresetInput((v) => !v)}
            className="text-[11px] font-semibold text-[var(--accent)] hover:underline inline-flex items-center gap-1 bg-transparent border-none cursor-pointer"
          >
            <BookmarkPlus size={12} />
            Save Current Filters as Preset
          </button>
        </div>

        {showSavePresetInput && (
          <div className="flex items-center gap-2 mb-3 bg-[var(--bg-card)] border border-[var(--border)] rounded-[10px] p-2.5 max-w-[440px]">
            <input
              type="text"
              value={presetNameInput}
              onChange={(e) => setPresetNameInput(e.target.value)}
              placeholder="e.g. 90s Sci-Fi Night…"
              className="input flex-1 text-[12px] py-1.5 px-3"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSaveCurrentPreset();
              }}
            />
            <button
              type="button"
              onClick={handleSaveCurrentPreset}
              className="btn btn-primary py-1.5 px-3 text-[12px]"
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => setShowSavePresetInput(false)}
              className="btn btn-ghost py-1.5 px-2.5 text-[12px]"
            >
              Cancel
            </button>
          </div>
        )}

        <div className="flex items-center gap-2 overflow-x-auto pb-1.5 scrollbar-none">
          {SMART_LENSES.map((lens) => {
            const isSelected = activeLens === lens.id;
            return (
              <button
                key={lens.id}
                type="button"
                onClick={() => {
                  if (isSelected) {
                    router.push("/explore");
                  } else {
                    pushFilters({ ...lens.params, lens: lens.id }, true);
                  }
                }}
                className={`flex-shrink-0 px-3.5 py-2 rounded-[10px] border text-left transition-all cursor-pointer flex items-center gap-2 ${
                  isSelected
                    ? "bg-[var(--accent-dim)] border-[var(--accent)] text-white shadow-[0_0_20px_rgba(229,9,20,0.25)]"
                    : "bg-[var(--bg-card)] border-[var(--border)] text-[var(--text-dim)] hover:border-[var(--border-hover)] hover:text-white"
                }`}
              >
                <span className="text-[12px] font-semibold whitespace-nowrap">
                  {lens.label}
                </span>
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase tracking-[0.4px] ${
                    isSelected
                      ? "bg-[var(--accent)] text-white"
                      : "bg-[var(--surface)] text-[var(--text-muted)]"
                  }`}
                >
                  {lens.badge}
                </span>
              </button>
            );
          })}

          {/* User Saved Custom Presets */}
          {savedPresets.map((preset) => (
            <div
              key={preset.id}
              className="flex-shrink-0 inline-flex items-center bg-[var(--bg-elevated)] border border-[rgba(245,197,24,0.35)] rounded-[10px] overflow-hidden"
            >
              <button
                type="button"
                onClick={() => pushFilters(preset.params, true)}
                className="px-3 py-2 text-[12px] font-semibold text-[#f5c518] bg-transparent border-none cursor-pointer hover:bg-white/5 whitespace-nowrap"
              >
                ★ {preset.name}
              </button>
              <button
                type="button"
                onClick={() => {
                  const next = deleteExplorePreset(preset.id);
                  setSavedPresets(next);
                  toast.info(`Removed preset "${preset.name}"`);
                }}
                title="Delete preset"
                className="px-2 py-2 text-[var(--text-muted)] hover:text-[var(--accent)] bg-transparent border-none border-l border-[var(--border)] cursor-pointer"
              >
                <Trash2 size={11} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* ── LAYER 2: Media Type Bar + Sort & Studio Filter Command Deck ── */}
      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-[14px] p-3.5 sm:p-5 mb-6 shadow-[0_12px_40px_rgba(0,0,0,0.45)]">
        {/* Top Row: Media Types + Keyword Search + Sort & Direction + View Switcher */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-4 border-b border-[var(--border)]">
          {/* Media Type Pills with Exclude capability */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0 scrollbar-none">
            {TYPES.map((t) => {
              const isSelected = type === t.value;
              const isExcluded = excludeTypes.includes(t.value);
              return (
                <div key={t.value} className="inline-flex items-center">
                  <button
                    type="button"
                    onClick={() =>
                      pushFilters({
                        type: t.value === "ALL" ? undefined : t.value,
                        excludeTypes:
                          excludeTypes.filter((x) => x !== t.value).join(",") ||
                          undefined,
                      })
                    }
                    className={`px-3 py-1.5 rounded-[8px] text-[12px] font-semibold border transition-all cursor-pointer whitespace-nowrap ${
                      isSelected
                        ? "bg-[var(--accent)] border-[var(--accent)] text-white shadow-[0_0_14px_rgba(229,9,20,0.3)]"
                        : isExcluded
                          ? "bg-[rgba(229,9,20,0.12)] border-[rgba(229,9,20,0.4)] text-[var(--accent)] line-through"
                          : "bg-[var(--bg-elevated)] border-[var(--border)] text-[var(--text-dim)] hover:text-white"
                    }`}
                  >
                    {t.label}
                  </button>
                </div>
              );
            })}
          </div>

          {/* Right Controls: Keyword Search + Sort Mode + ASC/DESC + Studio Deck Toggle */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* In-Filter Keyword Input */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                pushFilters({
                  keyword: keywordDraft.trim() || undefined,
                });
              }}
              className="relative flex-1 sm:flex-initial sm:w-[190px]"
            >
              <Search
                size={13}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none"
              />
              <input
                type="text"
                value={keywordDraft}
                onChange={(e) => setKeywordDraft(e.target.value)}
                placeholder="Filter by keyword…"
                className="input w-full pl-8 pr-7 py-[7px] text-[12px] rounded-[8px]"
              />
              {keywordDraft && (
                <button
                  type="button"
                  onClick={() => {
                    setKeywordDraft("");
                    pushFilters({ keyword: undefined });
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-white bg-transparent border-none cursor-pointer"
                >
                  <X size={12} />
                </button>
              )}
            </form>

            {/* Sort Order Selector */}
            <select
              className="select text-[12px] py-[7px] px-3 rounded-[8px]"
              value={order}
              onChange={(e) => {
                const nextOrd = e.target.value as ExploreSortOrder;
                if (nextOrd === "RANDOM") {
                  setRandomSeed((s) => s + 1);
                }
                pushFilters({ order: nextOrd });
              }}
              aria-label="Sort films by"
            >
              {SORT_ORDERS.map((o) => (
                <option key={o.value} value={o.value}>
                  Sort: {o.label}
                </option>
              ))}
            </select>

            {/* Bidirectional Sort Toggle (DESC / ASC) */}
            {order !== "RANDOM" ? (
              <button
                type="button"
                onClick={() =>
                  pushFilters({
                    dir: direction === "DESC" ? "ASC" : "DESC",
                  })
                }
                title={
                  direction === "DESC"
                    ? "Descending (Highest / Newest first) — Click for Ascending"
                    : "Ascending (Lowest / Oldest first) — Click for Descending"
                }
                className={`px-3 py-[7px] rounded-[8px] text-[12px] font-semibold border transition-all cursor-pointer inline-flex items-center gap-1.5 ${
                  direction === "ASC"
                    ? "bg-[rgba(245,197,24,0.14)] border-[rgba(245,197,24,0.45)] text-[#f5c518]"
                    : "bg-[var(--bg-elevated)] border-[var(--border)] text-[var(--text-dim)] hover:text-white"
                }`}
              >
                {direction === "DESC" ? (
                  <>
                    <ArrowDown size={13} />
                    DESC
                  </>
                ) : (
                  <>
                    <ArrowUp size={13} />
                    ASC
                  </>
                )}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setRandomSeed((s) => s + 1)}
                className="px-3 py-[7px] rounded-[8px] text-[12px] font-semibold border border-[var(--accent)] bg-[var(--accent-dim)] text-white cursor-pointer inline-flex items-center gap-1.5"
              >
                <Shuffle size={13} />
                Reshuffle
              </button>
            )}

            {/* View Layout Switcher */}
            <div className="inline-flex items-center rounded-[8px] border border-[var(--border)] bg-[var(--bg-elevated)] p-0.5">
              <button
                type="button"
                onClick={() => pushFilters({ view: undefined })}
                title="Standard Poster Grid"
                className={`p-1.5 rounded-[6px] border-none cursor-pointer transition-colors ${
                  viewMode === "GRID"
                    ? "bg-[var(--accent)] text-white"
                    : "bg-transparent text-[var(--text-muted)] hover:text-white"
                }`}
              >
                <LayoutGrid size={14} />
              </button>
              <button
                type="button"
                onClick={() => pushFilters({ view: "COMPACT" })}
                title="High-Density Compact Grid"
                className={`p-1.5 rounded-[6px] border-none cursor-pointer transition-colors ${
                  viewMode === "COMPACT"
                    ? "bg-[var(--accent)] text-white"
                    : "bg-transparent text-[var(--text-muted)] hover:text-white"
                }`}
              >
                <Grid3X3 size={14} />
              </button>
              <button
                type="button"
                onClick={() => pushFilters({ view: "LIST" })}
                title="Detailed List View"
                className={`p-1.5 rounded-[6px] border-none cursor-pointer transition-colors ${
                  viewMode === "LIST"
                    ? "bg-[var(--accent)] text-white"
                    : "bg-transparent text-[var(--text-muted)] hover:text-white"
                }`}
              >
                <ListIcon size={14} />
              </button>
            </div>
          </div>
        </div>

        {/* Studio Filter Category Tabs */}
        <div className="flex items-center justify-between gap-2 pt-3 flex-wrap">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            {[
              {
                id: "GENRES" as const,
                label: `Genres (${
                  resolvedIncludeGenres.length + resolvedExcludeGenres.length
                })`,
              },
              {
                id: "COUNTRIES" as const,
                label: `Countries & Regions (${
                  resolvedIncludeCountries.length +
                  resolvedExcludeCountries.length +
                  (excludeRussian ? 1 : 0)
                })`,
              },
              {
                id: "RATINGS" as const,
                label: `Ratings & Votes (${
                  (ratingFrom !== undefined || ratingTo !== undefined ? 1 : 0) +
                  (minVotes ? 1 : 0)
                })`,
              },
              {
                id: "ERA_RUNTIME" as const,
                label: "Era, Runtime & Age",
              },
              {
                id: "LIBRARY" as const,
                label: "Themes & Library",
              },
            ].map((tab) => {
              const active = deckExpanded && activeStudioTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    if (deckExpanded && activeStudioTab === tab.id) {
                      setDeckExpanded(false);
                    } else {
                      setActiveStudioTab(tab.id);
                      setDeckExpanded(true);
                    }
                  }}
                  className={`px-3 py-1.5 rounded-[8px] text-[12px] font-semibold border transition-all cursor-pointer inline-flex items-center gap-1.5 whitespace-nowrap ${
                    active
                      ? "bg-[var(--surface)] border-[var(--accent)] text-white"
                      : "bg-[var(--bg-elevated)] border-[var(--border)] text-[var(--text-dim)] hover:text-white"
                  }`}
                >
                  <SlidersHorizontal size={11} />
                  {tab.label}
                  <ChevronDown
                    size={12}
                    className={`transition-transform ${
                      active ? "rotate-180 text-[var(--accent)]" : ""
                    }`}
                  />
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2">
            {/* Quick 1-Click Hollywood / Exclude Russia Toggle */}
            <button
              type="button"
              onClick={() =>
                pushFilters({ excludeRu: excludeRussian ? "0" : "1" })
              }
              className={`px-3 py-1.5 rounded-[8px] text-[11px] font-semibold border transition-all cursor-pointer inline-flex items-center gap-1.5 ${
                excludeRussian
                  ? "bg-[rgba(34,197,94,0.12)] border-[rgba(34,197,94,0.4)] text-[#4ade80]"
                  : "bg-[var(--bg-elevated)] border-[var(--border)] text-[var(--text-muted)] hover:text-white"
              }`}
            >
              <Globe size={12} />
              {excludeRussian
                ? "Hollywood & Global Priority (No RU)"
                : "All Regions (Incl. RU)"}
            </button>

            <button
              type="button"
              onClick={() => setDeckExpanded((v) => !v)}
              className="text-[12px] font-semibold text-[var(--accent)] bg-transparent border-none cursor-pointer hover:underline"
            >
              {deckExpanded ? "Hide Filter Deck ▲" : "Open Full Filter Deck ▼"}
            </button>
          </div>
        </div>

        {/* ── Expandable Studio Filter Panels ── */}
        {deckExpanded && (
          <div className="mt-4 pt-4 border-t border-[var(--border)] fade-in">
            {/* TAB 1: MULTI-GENRE MATRIX (+ INCLUDE / - EXCLUDE / AND-OR) */}
            {activeStudioTab === "GENRES" && (
              <div>
                <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
                  <p className="text-[12px] text-[var(--text-dim)] m-0">
                    Click once to{" "}
                    <span className="text-[#4ade80] font-semibold">
                      + Include
                    </span>{" "}
                    (select 3+ genres simultaneously), click twice to{" "}
                    <span className="text-[var(--accent)] font-semibold">
                      − Exclude
                    </span>
                    , click a third time to clear.
                  </p>
                  <div className="inline-flex items-center gap-1 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-[8px] p-1">
                    <button
                      type="button"
                      onClick={() => pushFilters({ genreMode: "AND" })}
                      className={`px-2.5 py-1 rounded-[6px] text-[11px] font-bold border-none cursor-pointer ${
                        genreMatchMode === "AND"
                          ? "bg-[var(--accent)] text-white"
                          : "bg-transparent text-[var(--text-muted)] hover:text-white"
                      }`}
                    >
                      Match ALL (AND)
                    </button>
                    <button
                      type="button"
                      onClick={() => pushFilters({ genreMode: "OR" })}
                      className={`px-2.5 py-1 rounded-[6px] text-[11px] font-bold border-none cursor-pointer ${
                        genreMatchMode === "OR"
                          ? "bg-[var(--accent)] text-white"
                          : "bg-transparent text-[var(--text-muted)] hover:text-white"
                      }`}
                    >
                      Match ANY (OR)
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {genres.map((g) => {
                    const isInc = resolvedIncludeGenres.includes(g.id);
                    const isExc = resolvedExcludeGenres.includes(g.id);
                    const label =
                      translateGenre(g.genre, autoTranslate) || g.genre;
                    return (
                      <button
                        key={g.id}
                        type="button"
                        onClick={() => handleCycleGenre(g.id)}
                        className={`px-3 py-1.5 rounded-full text-[12px] font-medium border transition-all cursor-pointer capitalize inline-flex items-center gap-1.5 ${
                          isInc
                            ? "bg-[rgba(34,197,94,0.16)] border-[#22c55e] text-[#4ade80] font-semibold shadow-[0_0_12px_rgba(34,197,94,0.2)]"
                            : isExc
                              ? "bg-[rgba(229,9,20,0.15)] border-[var(--accent)] text-[var(--accent)] line-through"
                              : "bg-[var(--bg-elevated)] border-[var(--border)] text-[var(--text-dim)] hover:border-[var(--border-hover)] hover:text-white"
                        }`}
                      >
                        {isInc && <Plus size={11} strokeWidth={3} />}
                        {isExc && <Minus size={11} strokeWidth={3} />}
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* TAB 2: COUNTRIES & REGIONS MATRIX */}
            {activeStudioTab === "COUNTRIES" && (
              <div>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                  <p className="text-[12px] text-[var(--text-dim)] m-0">
                    Click once to{" "}
                    <span className="text-[#4ade80] font-semibold">
                      + Include Country
                    </span>
                    , click twice to{" "}
                    <span className="text-[var(--accent)] font-semibold">
                      − Exclude Country
                    </span>
                    .
                  </p>
                  <input
                    type="text"
                    value={countrySearch}
                    onChange={(e) => setCountrySearch(e.target.value)}
                    placeholder="Search country…"
                    className="input text-[12px] py-1.5 px-3 sm:w-[220px]"
                  />
                </div>

                <div className="flex flex-wrap gap-2 max-h-[210px] overflow-y-auto pr-1">
                  {filteredCountries.map((c) => {
                    const isInc = resolvedIncludeCountries.includes(c.id);
                    const isExc = resolvedExcludeCountries.includes(c.id);
                    const label =
                      translateCountry(c.country, autoTranslate) || c.country;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => handleCycleCountry(c.id)}
                        className={`px-3 py-1.5 rounded-full text-[12px] font-medium border transition-all cursor-pointer inline-flex items-center gap-1.5 ${
                          isInc
                            ? "bg-[rgba(34,197,94,0.16)] border-[#22c55e] text-[#4ade80] font-semibold"
                            : isExc
                              ? "bg-[rgba(229,9,20,0.15)] border-[var(--accent)] text-[var(--accent)] line-through"
                              : "bg-[var(--bg-elevated)] border-[var(--border)] text-[var(--text-dim)] hover:border-[var(--border-hover)] hover:text-white"
                        }`}
                      >
                        {isInc && <Plus size={11} strokeWidth={3} />}
                        {isExc && <Minus size={11} strokeWidth={3} />}
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* TAB 3: RATINGS & VOTE CONFIDENCE */}
            {activeStudioTab === "RATINGS" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[1px] text-[var(--text-muted)] mb-2">
                    1-Click Rating Bracket Presets (Explore Any Tier)
                  </p>
                  <div className="flex flex-wrap gap-2 mb-4">
                    {RATING_TIERS.map((tier) => {
                      const active =
                        ratingFrom === tier.min && ratingTo === tier.max;
                      return (
                        <button
                          key={tier.label}
                          type="button"
                          onClick={() =>
                            pushFilters(
                              active
                                ? { ratingFrom: undefined, ratingTo: undefined }
                                : {
                                    ratingFrom: String(tier.min),
                                    ratingTo: String(tier.max),
                                  },
                            )
                          }
                          className={`px-3 py-1.5 rounded-[8px] text-[12px] font-semibold border cursor-pointer transition-all ${
                            active
                              ? "bg-[var(--accent)] border-[var(--accent)] text-white"
                              : "bg-[var(--bg-elevated)] border-[var(--border)] text-[var(--text-dim)] hover:text-white"
                          }`}
                        >
                          {tier.label}
                        </button>
                      );
                    })}
                  </div>

                  <div className="flex items-center gap-3 flex-wrap">
                    <div>
                      <label className="block text-[11px] text-[var(--text-muted)] mb-1">
                        Min Rating (0.0 – 10.0)
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={10}
                        step={0.5}
                        value={ratingFrom ?? ""}
                        onChange={(e) =>
                          pushFilters({
                            ratingFrom: e.target.value || undefined,
                          })
                        }
                        placeholder="0.0"
                        className="input w-[110px] py-1.5 px-3 text-[12px]"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-[var(--text-muted)] mb-1">
                        Max Rating (0.0 – 10.0)
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={10}
                        step={0.5}
                        value={ratingTo ?? ""}
                        onChange={(e) =>
                          pushFilters({
                            ratingTo: e.target.value || undefined,
                          })
                        }
                        placeholder="10.0"
                        className="input w-[110px] py-1.5 px-3 text-[12px]"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-[var(--text-muted)] mb-1">
                        Rating Source
                      </label>
                      <select
                        className="select py-1.5 px-3 text-[12px]"
                        value={ratingSource}
                        onChange={(e) =>
                          pushFilters({
                            ratingSource:
                              e.target.value === "AUTO"
                                ? undefined
                                : e.target.value,
                          })
                        }
                      >
                        <option value="AUTO">Auto (IMDb Priority)</option>
                        <option value="IMDB">IMDb Score Only</option>
                        <option value="KP">Kinopoisk Score Only</option>
                        <option value="AVERAGE">Combined Average</option>
                        <option value="CRITICS">Critics Score</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[1px] text-[var(--text-muted)] mb-2">
                    Minimum Vote Confidence (&ldquo;Anti-Fluke&rdquo; Filter)
                  </p>
                  <div className="flex flex-wrap gap-2 mb-4">
                    {[
                      { label: "Any Votes", val: undefined },
                      { label: "500+ Votes", val: "500" },
                      { label: "2.5K+ Votes", val: "2500" },
                      { label: "10K+ Popular", val: "10000" },
                      { label: "50K+ Blockbusters", val: "50000" },
                    ].map((v) => {
                      const active = String(minVotes ?? "") === (v.val ?? "");
                      return (
                        <button
                          key={v.label}
                          type="button"
                          onClick={() => pushFilters({ minVotes: v.val })}
                          className={`px-3 py-1.5 rounded-[8px] text-[12px] font-semibold border cursor-pointer ${
                            active
                              ? "bg-[var(--accent)] border-[var(--accent)] text-white"
                              : "bg-[var(--bg-elevated)] border-[var(--border)] text-[var(--text-dim)] hover:text-white"
                          }`}
                        >
                          {v.label}
                        </button>
                      );
                    })}
                  </div>

                  <label className="inline-flex items-center gap-2 cursor-pointer select-none text-[12px] text-[var(--text-dim)]">
                    <input
                      type="checkbox"
                      checked={requireImdb}
                      onChange={(e) =>
                        pushFilters({
                          requireImdb: e.target.checked ? "1" : undefined,
                        })
                      }
                      className="accent-[var(--accent)]"
                    />
                    Require Official IMDb Rating (hides domestic-only unrated
                    titles)
                  </label>
                </div>
              </div>
            )}

            {/* TAB 4: ERA, RUNTIME & AGE SUITABILITY */}
            {activeStudioTab === "ERA_RUNTIME" && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {/* Era & Decade */}
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[1px] text-[var(--text-muted)] mb-2">
                    Decade & Custom Year Range
                  </p>
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {DECADE_PRESETS.map((d) => {
                      const active = yearFrom === d.from && yearTo === d.to;
                      return (
                        <button
                          key={d.label}
                          type="button"
                          onClick={() =>
                            pushFilters(
                              active
                                ? { yearFrom: undefined, yearTo: undefined }
                                : {
                                    yearFrom: d.from
                                      ? String(d.from)
                                      : undefined,
                                    yearTo: d.to ? String(d.to) : undefined,
                                  },
                            )
                          }
                          className={`px-2.5 py-1 rounded-[6px] text-[11px] font-semibold border cursor-pointer ${
                            active
                              ? "bg-[var(--accent)] border-[var(--accent)] text-white"
                              : "bg-[var(--bg-elevated)] border-[var(--border)] text-[var(--text-dim)] hover:text-white"
                          }`}
                        >
                          {d.label}
                        </button>
                      );
                    })}
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={1900}
                      max={CURRENT_YEAR + 2}
                      placeholder="From (e.g. 1994)"
                      value={yearFrom ?? ""}
                      onChange={(e) =>
                        pushFilters({ yearFrom: e.target.value || undefined })
                      }
                      className="input w-full py-1.5 px-2.5 text-[12px]"
                    />
                    <span className="text-[var(--text-muted)]">–</span>
                    <input
                      type="number"
                      min={1900}
                      max={CURRENT_YEAR + 2}
                      placeholder={`To (e.g. ${CURRENT_YEAR})`}
                      value={yearTo ?? ""}
                      onChange={(e) =>
                        pushFilters({ yearTo: e.target.value || undefined })
                      }
                      className="input w-full py-1.5 px-2.5 text-[12px]"
                    />
                  </div>
                </div>

                {/* Runtime Budget */}
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[1px] text-[var(--text-muted)] mb-2">
                    Tonight&apos;s Time Budget (Runtime)
                  </p>
                  <div className="flex flex-col gap-1.5">
                    {[
                      { id: "ANY", label: "Any Length" },
                      { id: "SHORT", label: "Quick Watch (< 95 min)" },
                      {
                        id: "STANDARD",
                        label: "Feature Standard (95–130 min)",
                      },
                      { id: "EPIC", label: "Epic Cinema (> 130 min)" },
                    ].map((rt) => (
                      <button
                        key={rt.id}
                        type="button"
                        onClick={() =>
                          pushFilters({
                            runtime: rt.id === "ANY" ? undefined : rt.id,
                          })
                        }
                        className={`px-3 py-1.5 rounded-[8px] text-[12px] font-medium border text-left cursor-pointer ${
                          runtimeBucket === rt.id
                            ? "bg-[var(--accent-dim)] border-[var(--accent)] text-white font-semibold"
                            : "bg-[var(--bg-elevated)] border-[var(--border)] text-[var(--text-dim)] hover:text-white"
                        }`}
                      >
                        {rt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Age Suitability & Series Status */}
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[1px] text-[var(--text-muted)] mb-2">
                    Age Suitability (+ Include / − Exclude)
                  </p>
                  <div className="flex flex-wrap gap-2 mb-4">
                    {(
                      [
                        { id: "FAMILY", label: "Family (G / PG / 0+ / 6+)" },
                        { id: "TEEN", label: "Teen (PG-13 / 12+ / 16+)" },
                        { id: "MATURE", label: "Mature (R / 18+)" },
                      ] as { id: AgeTierFilter; label: string }[]
                    ).map((tier) => {
                      const isInc = includeAgeTiers.includes(tier.id);
                      const isExc = excludeAgeTiers.includes(tier.id);
                      return (
                        <button
                          key={tier.id}
                          type="button"
                          onClick={() => handleCycleAgeTier(tier.id)}
                          className={`px-3 py-1.5 rounded-[8px] text-[11px] font-semibold border cursor-pointer inline-flex items-center gap-1 ${
                            isInc
                              ? "bg-[rgba(34,197,94,0.16)] border-[#22c55e] text-[#4ade80]"
                              : isExc
                                ? "bg-[rgba(229,9,20,0.15)] border-[var(--accent)] text-[var(--accent)] line-through"
                                : "bg-[var(--bg-elevated)] border-[var(--border)] text-[var(--text-dim)] hover:text-white"
                          }`}
                        >
                          {isInc && <Plus size={10} />}
                          {isExc && <Minus size={10} />}
                          {tier.label}
                        </button>
                      );
                    })}
                  </div>

                  <p className="text-[11px] font-bold uppercase tracking-[1px] text-[var(--text-muted)] mb-2">
                    TV Series Completion Status
                  </p>
                  <div className="flex gap-1.5 flex-wrap">
                    {[
                      { id: "ALL", label: "All" },
                      { id: "COMPLETED", label: "Completed (Binge-Ready)" },
                      { id: "ONGOING", label: "Ongoing" },
                    ].map((st) => (
                      <button
                        key={st.id}
                        type="button"
                        onClick={() =>
                          pushFilters({
                            status: st.id === "ALL" ? undefined : st.id,
                          })
                        }
                        className={`px-2.5 py-1 rounded-[6px] text-[11px] font-semibold border cursor-pointer ${
                          seriesStatus === st.id
                            ? "bg-[var(--accent)] border-[var(--accent)] text-white"
                            : "bg-[var(--bg-elevated)] border-[var(--border)] text-[var(--text-dim)] hover:text-white"
                        }`}
                      >
                        {st.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 5: CURATED THEME COLLECTIONS & PERSONAL LIBRARY */}
            {activeStudioTab === "LIBRARY" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[1px] text-[var(--text-muted)] mb-2">
                    Curated Theme Collections
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {COLLECTION_PRESETS.map((col) => {
                      const active = collectionPreset === col.value;
                      return (
                        <button
                          key={col.value}
                          type="button"
                          onClick={() =>
                            pushFilters({
                              collection: active ? undefined : col.value,
                            })
                          }
                          className={`px-3 py-1.5 rounded-[8px] text-[12px] font-semibold border cursor-pointer ${
                            active
                              ? "bg-[var(--accent)] border-[var(--accent)] text-white"
                              : "bg-[var(--bg-elevated)] border-[var(--border)] text-[var(--text-dim)] hover:text-white"
                          }`}
                        >
                          {col.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[1px] text-[var(--text-muted)] mb-2">
                    Personal Library De-Clutter
                  </p>
                  <div className="flex flex-col gap-2 text-[12px] text-[var(--text-dim)]">
                    <label className="inline-flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={hideWatched}
                        onChange={(e) =>
                          pushFilters({
                            hideWatched: e.target.checked ? "1" : undefined,
                          })
                        }
                        className="accent-[var(--accent)]"
                      />
                      Hide films in my Watch History (discover only unseen
                      titles)
                    </label>
                    <label className="inline-flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={hideFavorites}
                        onChange={(e) =>
                          pushFilters({
                            hideFavorites: e.target.checked ? "1" : undefined,
                          })
                        }
                        className="accent-[var(--accent)]"
                      />
                      Hide films already in my Favorites
                    </label>
                    <label className="inline-flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={hideWatchLater}
                        onChange={(e) =>
                          pushFilters({
                            hideWatchLater: e.target.checked ? "1" : undefined,
                          })
                        }
                        className="accent-[var(--accent)]"
                      />
                      Hide films already in my Watch Later list
                    </label>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Active Filter Summary Chips */}
        {activeFilterTags.length > 0 && (
          <div className="flex items-center flex-wrap gap-2 mt-3.5 pt-3 border-t border-[var(--border)]">
            <span className="text-[11px] font-semibold text-[var(--text-muted)] mr-1">
              Active Filters:
            </span>
            {activeFilterTags.map((tag, idx) => (
              <button
                key={`${tag.label}-${idx}`}
                type="button"
                onClick={tag.onClear}
                className={`inline-flex items-center gap-1.5 text-[11px] font-semibold rounded-full px-3 py-1 border cursor-pointer transition-colors ${
                  tag.isNegative
                    ? "bg-[rgba(229,9,20,0.14)] border-[rgba(229,9,20,0.4)] text-[var(--accent)] hover:border-[var(--accent)]"
                    : "bg-[rgba(34,197,94,0.12)] border-[rgba(34,197,94,0.35)] text-[#4ade80] hover:border-[#22c55e]"
                }`}
              >
                {tag.label}
                <X size={10} strokeWidth={3} />
              </button>
            ))}
            <button
              type="button"
              onClick={() => router.push("/explore")}
              className="text-[11px] font-semibold text-[var(--text-muted)] hover:text-white underline bg-transparent border-none cursor-pointer ml-1"
            >
              Reset All
            </button>
          </div>
        )}
      </div>

      {/* ── LAYER 3: Results Grid / Compact Grid / Detailed List View ── */}
      {loading ? (
        <div
          className={
            viewMode === "LIST"
              ? "flex flex-col gap-3"
              : viewMode === "COMPACT"
                ? "grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3"
                : "film-grid"
          }
        >
          {Array.from({ length: 20 }).map((_, i) => (
            <div
              key={i}
              className={
                viewMode === "LIST"
                  ? "skeleton h-[132px] rounded-[12px]"
                  : "skeleton aspect-[2/3] rounded-[10px] sm:rounded-[12px]"
              }
            />
          ))}
        </div>
      ) : films.length === 0 ? (
        <EmptyState
          icon={<Search size={36} />}
          title="No Matching Titles Found"
          description="Try relaxing your multi-genre intersection, switching from Match ALL (AND) to Match ANY (OR), or widening your rating bracket."
          actionLabel="Reset All Filters"
          actionHref="/explore"
        />
      ) : viewMode === "LIST" ? (
        <div className="flex flex-col gap-3">
          {films.map((film, i) => {
            const fid = film.kinopoiskId ?? film.filmId ?? i;
            const isCompared = compareFilms.some(
              (c) => (c.kinopoiskId ?? c.filmId) === fid,
            );
            return (
              <ExploreDetailedRow
                key={`${fid}-${i}`}
                film={film}
                autoTranslate={autoTranslate}
                isCompared={isCompared}
                onQuickPeek={() => setQuickPeekFilm(film)}
                onToggleCompare={() => handleToggleCompare(film)}
                onOpenParentalGuide={() => setParentalGuideFilm(film)}
              />
            );
          })}
        </div>
      ) : (
        <div
          className={
            viewMode === "COMPACT"
              ? "grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3"
              : "film-grid"
          }
        >
          {films.map((film, i) => {
            const fid = film.kinopoiskId ?? film.filmId ?? i;
            const isCompared = compareFilms.some(
              (c) => (c.kinopoiskId ?? c.filmId) === fid,
            );
            return (
              <FilmCard
                key={`${fid}-${i}`}
                film={film}
                variant="grid"
                onQuickPeek={(f) => setQuickPeekFilm(f)}
                onToggleCompare={(f) => handleToggleCompare(f)}
                isCompared={isCompared}
              />
            );
          })}
        </div>
      )}

      {/* ── LAYER 4: Continuous Stream Button + Deep Pagination ── */}
      {!loading && films.length > 0 && (
        <div className="mt-8 flex flex-col items-center gap-3">
          {streamedPage < totalPages && (
            <button
              type="button"
              onClick={handleLoadNextBatch}
              disabled={loadingMore}
              className="btn btn-ghost border-[rgba(229,9,20,0.4)] text-white px-6 py-3 text-[13px] font-semibold hover:bg-[var(--accent-dim)]"
            >
              {loadingMore
                ? "Loading Next Batch…"
                : `Load Next Batch (+20 Titles · Page ${streamedPage + 1} of ${totalPages})`}
            </button>
          )}
          <Pagination
            page={page}
            totalPages={totalPages}
            buildHref={buildPageHref}
          />
        </div>
      )}

      {/* ── Floating Side-by-Side Comparison Tray ── */}
      {compareFilms.length > 0 && (
        <div className="fixed bottom-[74px] md:bottom-5 left-1/2 -translate-x-1/2 z-[800] bg-[rgba(18,18,18,0.96)] backdrop-blur-xl border border-[rgba(229,9,20,0.45)] rounded-[14px] px-4 py-2.5 shadow-[0_20px_60px_rgba(0,0,0,0.85)] flex items-center gap-3 max-w-[95vw]">
          <div className="flex items-center gap-1.5 text-[12px] font-semibold text-white">
            <Scale size={15} className="text-[var(--accent)]" />
            <span>Compare ({compareFilms.length}/3)</span>
          </div>
          <div className="flex items-center gap-2">
            {compareFilms.map((cf) => {
              const cid = cf.kinopoiskId ?? cf.filmId;
              return (
                <div
                  key={cid}
                  className="flex items-center gap-1.5 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-[8px] px-2 py-1 text-[11px] text-[var(--text)]"
                >
                  <span className="max-w-[90px] truncate">
                    {cf.nameEn || cf.nameOriginal || cf.nameRu}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleToggleCompare(cf)}
                    className="text-[var(--text-muted)] hover:text-white bg-transparent border-none cursor-pointer p-0"
                  >
                    <X size={11} />
                  </button>
                </div>
              );
            })}
          </div>
          <button
            type="button"
            onClick={() => setCompareModalOpen(true)}
            className="btn btn-primary py-1.5 px-3 text-[12px]"
          >
            Compare Now
          </button>
          <button
            type="button"
            onClick={() => setCompareFilms([])}
            className="text-[11px] text-[var(--text-muted)] hover:text-white bg-transparent border-none cursor-pointer"
          >
            Clear
          </button>
        </div>
      )}

      {/* Quick-Peek Modal */}
      {quickPeekFilm && (
        <QuickPeekModal
          film={quickPeekFilm}
          autoTranslate={autoTranslate}
          onClose={() => setQuickPeekFilm(null)}
          onOpenParentalGuide={(f) => {
            setQuickPeekFilm(null);
            setParentalGuideFilm(f);
          }}
        />
      )}

      {/* Side-by-Side Comparison Modal */}
      {compareModalOpen && (
        <CompareFilmsModal
          films={compareFilms}
          autoTranslate={autoTranslate}
          onClose={() => setCompareModalOpen(false)}
          onRemove={(f) => handleToggleCompare(f)}
        />
      )}

      {/* Surprise Me / Spin the Reel Modal */}
      {surpriseModalOpen && surpriseFilm && (
        <SurpriseMeModal
          film={surpriseFilm}
          autoTranslate={autoTranslate}
          onSpinAgain={handleSurpriseMe}
          onClose={() => setSurpriseModalOpen(false)}
        />
      )}

      {/* Parental Guide Modal */}
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

/* ── Detailed List Row Component ──────────────────────────────────────────── */
function ExploreDetailedRow({
  film,
  autoTranslate,
  isCompared,
  onQuickPeek,
  onToggleCompare,
  onOpenParentalGuide,
}: {
  film: Film;
  autoTranslate: boolean;
  isCompared: boolean;
  onQuickPeek: () => void;
  onToggleCompare: () => void;
  onOpenParentalGuide: () => void;
}) {
  const { toast } = useToast();
  const id = film.kinopoiskId ?? film.filmId ?? 0;
  const name = useFilmTitle(film, autoTranslate);
  const { isFav, isWL } = useListStatus(id);
  const certBadge = getQuickCertBadge(film);

  const kp = film.ratingKinopoisk;
  const imdb = film.ratingImdb;
  const votes = formatVotesCompact(
    Math.max(film.ratingKinopoiskVoteCount ?? 0, film.ratingImdbVoteCount ?? 0),
  );

  const filmEntry = {
    film_id: id,
    film_name: name,
    poster_url: film.posterUrlPreview || film.posterUrl || null,
    year: film.year ?? null,
    rating: imdb ?? kp ?? null,
  };

  return (
    <div className="flex items-start gap-3.5 sm:gap-5 bg-[var(--bg-card)] border border-[var(--border)] hover:border-[var(--border-hover)] rounded-[12px] p-3 sm:p-4 transition-all">
      <Link href={`/film/${id}`} className="no-underline flex-shrink-0">
        <PosterImage
          src={film.posterUrlPreview || film.posterUrl}
          alt={name}
          title={name}
          className="w-[74px] sm:w-[92px] aspect-[2/3] rounded-[8px] overflow-hidden bg-[var(--surface)] relative"
        />
      </Link>

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <Link
              href={`/film/${id}`}
              className="no-underline hover:underline text-white"
            >
              <h3 className="text-[15px] sm:text-[17px] font-bold text-white m-0 truncate">
                {name}
              </h3>
            </Link>
            <div className="flex items-center gap-2 flex-wrap mt-1 text-[12px] text-[var(--text-muted)]">
              {film.year && <span>{film.year}</span>}
              {film.filmLength && (
                <span>
                  · {Math.floor(film.filmLength / 60)}h {film.filmLength % 60}m
                </span>
              )}
              {certBadge && (
                <button
                  type="button"
                  onClick={onOpenParentalGuide}
                  title="View Parental Guide"
                  className="px-1.5 py-0.5 rounded bg-[var(--bg-elevated)] border border-[var(--border)] text-[10px] font-bold text-[var(--text-dim)] hover:border-[var(--accent)] hover:text-white cursor-pointer"
                >
                  {certBadge.label}
                </button>
              )}
              {film.countries?.slice(0, 2).map((c) => (
                <span key={c.country}>
                  · {translateCountry(c.country, autoTranslate)}
                </span>
              ))}
            </div>
          </div>

          {/* Ratings Pillar */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {imdb && (
              <div className="px-2.5 py-1 rounded-[8px] bg-[rgba(245,197,24,0.12)] border border-[rgba(245,197,24,0.35)] text-[#f5c518] text-[12px] font-bold flex items-center gap-1">
                <Star size={11} fill="#f5c518" stroke="#f5c518" />
                IMDb {imdb.toFixed(1)}
              </div>
            )}
            {kp && (
              <div className="px-2.5 py-1 rounded-[8px] bg-[var(--bg-elevated)] border border-[var(--border)] text-[var(--text)] text-[12px] font-bold">
                KP {kp.toFixed(1)}
              </div>
            )}
            {votes && (
              <span className="text-[11px] text-[var(--text-muted)] hidden sm:inline">
                ({votes} votes)
              </span>
            )}
          </div>
        </div>

        {/* Genre Pills */}
        <div className="flex flex-wrap gap-1.5 mt-2.5">
          {film.genres?.slice(0, 5).map((g) => (
            <span
              key={g.genre}
              className="tag tag-dim text-[10px] py-[2px] px-2 capitalize"
            >
              {translateGenre(g.genre, autoTranslate)}
            </span>
          ))}
        </div>

        {/* Quick Actions Bar */}
        <div className="flex items-center gap-2 mt-3 flex-wrap">
          <Link href={`/watch/${id}`} className="no-underline">
            <span className="btn btn-primary py-1.5 px-3 text-[11px]">
              <Play size={11} fill="currentColor" />
              Watch
            </span>
          </Link>
          <button
            type="button"
            onClick={onQuickPeek}
            className="btn btn-ghost py-1.5 px-2.5 text-[11px]"
          >
            <Eye size={12} />
            Quick Peek
          </button>
          <button
            type="button"
            onClick={() => {
              const added = toggleFavorite(filmEntry);
              toast.success(
                added ? "Added to Favorites" : "Removed from Favorites",
              );
            }}
            className={`btn btn-ghost py-1.5 px-2.5 text-[11px] ${
              isFav ? "border-[rgba(229,9,20,0.45)] text-[var(--accent)]" : ""
            }`}
          >
            <Heart
              size={12}
              fill={isFav ? "var(--accent)" : "none"}
              stroke={isFav ? "var(--accent)" : "currentColor"}
            />
            {isFav ? "In Favorites" : "Favorite"}
          </button>
          <button
            type="button"
            onClick={() => {
              const added = toggleWatchLater(filmEntry);
              toast.info(
                added ? "Saved to Watch Later" : "Removed from Watch Later",
              );
            }}
            className={`btn btn-ghost py-1.5 px-2.5 text-[11px] ${
              isWL ? "border-[rgba(96,165,250,0.45)] text-[#60a5fa]" : ""
            }`}
          >
            <Clock size={12} />
            {isWL ? "In Watch Later" : "Watch Later"}
          </button>
          <button
            type="button"
            onClick={onToggleCompare}
            className={`btn btn-ghost py-1.5 px-2.5 text-[11px] ${
              isCompared ? "border-[rgba(245,197,24,0.5)] text-[#f5c518]" : ""
            }`}
          >
            <Scale size={12} />
            {isCompared ? "Comparing" : "Compare"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Quick-Peek Slide-Over Modal ──────────────────────────────────────────── */
function QuickPeekModal({
  film,
  autoTranslate,
  onClose,
  onOpenParentalGuide,
}: {
  film: Film;
  autoTranslate: boolean;
  onClose: () => void;
  onOpenParentalGuide: (film: Film) => void;
}) {
  const id = film.kinopoiskId ?? film.filmId ?? 0;
  const [detail, setDetail] = useState<Film>(film);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const { isFav, isWL } = useListStatus(id);
  const { toast } = useToast();

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    Promise.allSettled([getFilm(id), getStaff(id)])
      .then(([fRes, sRes]) => {
        if (!mounted) return;
        if (fRes.status === "fulfilled") setDetail(fRes.value);
        if (sRes.status === "fulfilled")
          setStaff(Array.isArray(sRes.value) ? sRes.value : []);
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
          src={detail.posterUrl || detail.posterUrlPreview}
          alt={title}
          title={title}
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

          {/* Dual Scores */}
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

          {/* Genres */}
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

          {/* Synopsis */}
          <div className="mt-3">
            {loading && !synopsis ? (
              <div className="skeleton h-20 rounded-[8px]" />
            ) : (
              <p className="text-[13px] text-[var(--text-dim)] leading-[1.65] m-0 line-clamp-5">
                {synopsis || "No synopsis available for this title."}
              </p>
            )}
          </div>

          {/* Top Cast */}
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
                    onClick={onClose}
                    className="text-[11px] text-[var(--text)] bg-[var(--bg-elevated)] border border-[var(--border)] rounded px-2 py-0.5 no-underline hover:border-[var(--accent)]"
                  >
                    {a.nameEn || a.nameRu}
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center gap-2 mt-5 flex-wrap">
            <Link
              href={`/watch/${id}`}
              onClick={onClose}
              className="no-underline"
            >
              <span className="btn btn-primary py-2 px-4 text-[12px]">
                <Play size={13} fill="currentColor" />
                Watch Now
              </span>
            </Link>
            <Link
              href={`/film/${id}`}
              onClick={onClose}
              className="no-underline"
            >
              <span className="btn btn-ghost py-2 px-4 text-[12px]">
                Full Details
              </span>
            </Link>
            <button
              type="button"
              onClick={() => {
                const added = toggleFavorite(filmEntry);
                toast.success(
                  added ? "Added to Favorites" : "Removed from Favorites",
                );
              }}
              className="btn btn-ghost py-2 px-3 text-[12px]"
            >
              <Heart
                size={13}
                fill={isFav ? "var(--accent)" : "none"}
                stroke={isFav ? "var(--accent)" : "currentColor"}
              />
              {isFav ? "In Favorites" : "Favorite"}
            </button>
            <button
              type="button"
              onClick={() => {
                const added = toggleWatchLater(filmEntry);
                toast.info(
                  added ? "Saved to Watch Later" : "Removed from Watch Later",
                );
              }}
              className="btn btn-ghost py-2 px-3 text-[12px]"
            >
              <Clock size={13} />
              {isWL ? "In Watch Later" : "Watch Later"}
            </button>
          </div>
        </div>
      </div>
    </ModalShell>
  );
}

/* ── Side-by-Side Comparison Modal ────────────────────────────────────────── */
function CompareFilmsModal({
  films,
  autoTranslate,
  onClose,
  onRemove,
}: {
  films: Film[];
  autoTranslate: boolean;
  onClose: () => void;
  onRemove: (film: Film) => void;
}) {
  return (
    <ModalShell
      open
      onClose={onClose}
      title="SIDE-BY-SIDE FILM COMPARISON"
      subtitle={`Comparing ${films.length} selected title${films.length !== 1 ? "s" : ""}`}
      icon={<Scale size={16} />}
      maxWidthClass="sm:max-w-[820px]"
    >
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {films.map((f) => {
          const id = f.kinopoiskId ?? f.filmId ?? 0;
          const cert = getQuickCertBadge(f);
          const votes = formatVotesCompact(
            Math.max(
              f.ratingImdbVoteCount ?? 0,
              f.ratingKinopoiskVoteCount ?? 0,
            ),
          );
          return (
            <div
              key={id}
              className="bg-[var(--bg-elevated)] border border-[var(--border)] rounded-[12px] p-4 flex flex-col justify-between"
            >
              <div>
                <div className="relative aspect-[2/3] w-[120px] mx-auto rounded-[8px] overflow-hidden mb-3">
                  <PosterImage
                    src={f.posterUrlPreview || f.posterUrl}
                    alt={f.nameEn || f.nameRu || "Film"}
                  />
                </div>
                <h4 className="text-[15px] font-bold text-white text-center m-0 mb-3">
                  {f.nameEn || f.nameOriginal || f.nameRu}
                </h4>

                <div className="flex flex-col gap-2 text-[12px] border-t border-[var(--border)] pt-3">
                  <div className="flex justify-between">
                    <span className="text-[var(--text-muted)]">IMDb Score</span>
                    <span className="font-bold text-[#f5c518]">
                      {f.ratingImdb ? `★ ${f.ratingImdb.toFixed(1)}` : "—"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--text-muted)]">KP Score</span>
                    <span className="font-bold text-white">
                      {f.ratingKinopoisk ? f.ratingKinopoisk.toFixed(1) : "—"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--text-muted)]">Vote Count</span>
                    <span className="text-[var(--text)]">{votes || "—"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--text-muted)]">Year</span>
                    <span className="text-[var(--text)]">{f.year || "—"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--text-muted)]">Runtime</span>
                    <span className="text-[var(--text)]">
                      {f.filmLength
                        ? `${Math.floor(f.filmLength / 60)}h ${f.filmLength % 60}m`
                        : "—"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--text-muted)]">Age Rating</span>
                    <span className="text-[var(--text)]">
                      {cert ? cert.label : "Unrated"}
                    </span>
                  </div>
                  <div>
                    <span className="text-[var(--text-muted)] block mb-1">
                      Genres
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {f.genres?.slice(0, 4).map((g) => (
                        <span
                          key={g.genre}
                          className="tag tag-dim text-[10px] capitalize"
                        >
                          {translateGenre(g.genre, autoTranslate)}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 mt-4 pt-3 border-t border-[var(--border)]">
                <Link
                  href={`/watch/${id}`}
                  onClick={onClose}
                  className="no-underline flex-1"
                >
                  <span className="btn btn-primary w-full justify-center py-2 text-[12px]">
                    <Play size={12} fill="currentColor" />
                    Watch
                  </span>
                </Link>
                <button
                  type="button"
                  onClick={() => onRemove(f)}
                  className="btn btn-ghost py-2 px-3 text-[12px]"
                >
                  Remove
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </ModalShell>
  );
}

/* ── Surprise Me / Roulette Modal ─────────────────────────────────────────── */
function SurpriseMeModal({
  film,
  autoTranslate,
  onSpinAgain,
  onClose,
}: {
  film: Film;
  autoTranslate: boolean;
  onSpinAgain: () => void;
  onClose: () => void;
}) {
  const id = film.kinopoiskId ?? film.filmId ?? 0;
  const title = useFilmTitle(film, autoTranslate);

  return (
    <ModalShell
      open
      onClose={onClose}
      title="TONIGHT'S RANDOM PICK"
      subtitle="Drawn directly from your active Explore filters"
      icon={<Shuffle size={16} />}
      maxWidthClass="sm:max-w-[500px]"
    >
      <div className="flex flex-col items-center text-center">
        <PosterImage
          src={film.posterUrl || film.posterUrlPreview}
          alt={title}
          title={title}
          className="w-[160px] aspect-[2/3] rounded-[12px] overflow-hidden shadow-[0_12px_40px_rgba(0,0,0,0.7)] mb-4 bg-[var(--surface)] relative"
        />
        <h3 className="font-display text-[26px] tracking-[1px] text-white m-0">
          {title}
        </h3>
        <div className="flex items-center gap-2 justify-center mt-2 text-[12px] text-[var(--text-muted)]">
          {film.year && <span>{film.year}</span>}
          {film.ratingImdb && (
            <span className="text-[#f5c518] font-bold">
              · ★ IMDb {film.ratingImdb.toFixed(1)}
            </span>
          )}
          {film.ratingKinopoisk && (
            <span className="text-white font-bold">
              · KP {film.ratingKinopoisk.toFixed(1)}
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5 justify-center mt-3">
          {film.genres?.slice(0, 4).map((g) => (
            <span
              key={g.genre}
              className="tag tag-accent text-[11px] capitalize"
            >
              {translateGenre(g.genre, autoTranslate)}
            </span>
          ))}
        </div>

        <div className="flex items-center gap-3 mt-6 w-full">
          <button
            type="button"
            onClick={onSpinAgain}
            className="btn btn-ghost flex-1 justify-center py-2.5 text-[13px]"
          >
            <Shuffle size={14} />
            Spin Again
          </button>
          <Link
            href={`/watch/${id}`}
            onClick={onClose}
            className="no-underline flex-1"
          >
            <span className="btn btn-primary w-full justify-center py-2.5 text-[13px]">
              <Play size={14} fill="currentColor" />
              Watch Now
            </span>
          </Link>
        </div>
      </div>
    </ModalShell>
  );
}
