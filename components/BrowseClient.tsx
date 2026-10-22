"use client";
import React, {
  useEffect,
  useState,
  useCallback,
  useMemo,
  useRef,
} from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  X,
  Search,
  Sparkles,
  ArrowDown,
  ArrowUp,
  Shuffle,
  BookmarkPlus,
  Trash2,
  Eye,
  ShieldAlert,
  Play,
  Heart,
  Clock,
  Star,
  Plus,
  Minus,
  SlidersHorizontal,
  ChevronDown,
  Check,
  RotateCcw,
} from "lucide-react";
import {
  discoverFilms,
  getFilters,
  getFilm,
  getFilmStaff,
} from "@/lib/kinopoisk";
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
  Staff,
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
import { lockScroll, unlockScroll } from "@/lib/scrollLock";
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
  { value: "ALL", label: "All" },
  { value: "FILM", label: "Movies" },
  { value: "TV_SERIES", label: "TV Series" },
  { value: "MINI_SERIES", label: "Mini Series" },
  { value: "TV_SHOW", label: "TV Shows" },
] as const;

const SORT_ORDERS: { value: ExploreSortOrder; label: string }[] = [
  { value: "NUM_VOTE", label: "Most Popular" },
  { value: "RATING", label: "Top Rated" },
  { value: "IMDB_RATING", label: "IMDb Rating" },
  { value: "KP_RATING", label: "Kinopoisk Rating" },
  { value: "YEAR", label: "Release Year" },
  { value: "HIDDEN_GEMS", label: "Hidden Gems" },
  { value: "CRITICS", label: "Critics Score" },
  { value: "TITLE", label: "Title (A–Z)" },
  { value: "RANDOM", label: "Random Roulette" },
];

const RATING_TIERS: { label: string; min: number; max: number }[] = [
  { label: "Masterpieces (8.5–10)", min: 8.5, max: 10 },
  { label: "Great (7.0–8.4)", min: 7.0, max: 8.4 },
  { label: "Popcorn (5.5–6.9)", min: 5.5, max: 6.9 },
  { label: "Mixed (4.0–5.4)", min: 4.0, max: 5.4 },
  { label: "Low / Camp (1.0–3.9)", min: 1.0, max: 3.9 },
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
    },
  },
  {
    id: "HOLLYWOOD_BLOCKBUSTERS",
    label: "Blockbusters",
    badge: "Global Hits",
    params: {
      type: "FILM",
      order: "NUM_VOTE",
      dir: "DESC",
      ratingFrom: "7",
      minVotes: "25000",
      requireImdb: "1",
    },
  },
  {
    id: "HIDDEN_GEMS",
    label: "Hidden Gems",
    badge: "7.2+ Cult",
    params: {
      order: "HIDDEN_GEMS",
      dir: "DESC",
      ratingFrom: "7.2",
      ratingTo: "8.8",
      minVotes: "1000",
    },
  },
  {
    id: "MIND_BENDING",
    label: "Mind-Bending Sci-Fi",
    badge: "Sci-Fi + Thriller",
    params: {
      type: "FILM",
      genres: "6,1",
      genreMode: "OR",
      order: "IMDB_RATING",
      dir: "DESC",
      ratingFrom: "7",
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
    label: "90s & 2000s Gold",
    badge: "1990–2009",
    params: {
      yearFrom: "1990",
      yearTo: "2009",
      order: "NUM_VOTE",
      dir: "DESC",
      ratingFrom: "7.2",
    },
  },
  {
    id: "FAMILY_NIGHT",
    label: "Family Night",
    badge: "Safe & Fun",
    params: {
      age: "FAMILY",
      ratingFrom: "6.8",
      order: "NUM_VOTE",
      dir: "DESC",
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

function sameNumArray(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false;
  const sA = [...a].sort((x, y) => x - y);
  const sB = [...b].sort((x, y) => x - y);
  return sA.every((v, i) => v === sB[i]);
}

function sameStrArray(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const sA = [...a].sort();
  const sB = [...b].sort();
  return sA.every((v, i) => v === sB[i]);
}

interface DraftFilterState {
  includeGenres: number[];
  excludeGenres: number[];
  genreMatchMode: "AND" | "OR";
  includeCountries: number[];
  excludeCountries: number[];
  ratingFrom: string;
  ratingTo: string;
  ratingSource: RatingSource;
  minVotes: string;
  requireImdb: boolean;
  yearFrom: string;
  yearTo: string;
  runtimeBucket: RuntimeBucket;
  includeAgeTiers: AgeTierFilter[];
  excludeAgeTiers: AgeTierFilter[];
  seriesStatus: SeriesStatusFilter;
  keyword: string;
  collectionPreset?: CollectionType;
  hideWatched: boolean;
  hideFavorites: boolean;
  hideWatchLater: boolean;
}

/**
 * Interactive Tag Pill:
 * - Single tap/click: Includes tag (or Excludes tag if tapMode === "EXCLUDE", or clears if already active)
 * - Long-press (380ms on mobile/touch) OR right-click: Directly Excludes tag from any state!
 */
function FilterTagPill({
  label,
  status,
  tapMode,
  onToggleInclude,
  onToggleExclude,
}: {
  label: string;
  status: "INCLUDED" | "EXCLUDED" | "NONE";
  tapMode: "INCLUDE" | "EXCLUDE";
  onToggleInclude: () => void;
  onToggleExclude: () => void;
}) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didLongPressRef = useRef(false);

  const startPress = () => {
    didLongPressRef.current = false;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      didLongPressRef.current = true;
      if (typeof navigator !== "undefined" && navigator.vibrate) {
        navigator.vibrate(25);
      }
      onToggleExclude();
    }, 380);
  };

  const clearPress = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  useEffect(() => clearPress, []);

  return (
    <button
      type="button"
      onTouchStart={startPress}
      onTouchEnd={clearPress}
      onTouchMove={clearPress}
      onTouchCancel={clearPress}
      onMouseDown={(e) => {
        if (e.button === 0) startPress();
      }}
      onMouseUp={clearPress}
      onMouseLeave={clearPress}
      onContextMenu={(e) => {
        e.preventDefault();
        clearPress();
        onToggleExclude();
      }}
      onClick={(e) => {
        e.preventDefault();
        if (didLongPressRef.current) {
          didLongPressRef.current = false;
          return;
        }
        if (tapMode === "EXCLUDE") {
          onToggleExclude();
        } else {
          onToggleInclude();
        }
      }}
      className={`px-3 py-1.5 rounded-full text-[12px] font-medium border transition-all cursor-pointer capitalize inline-flex items-center gap-1.5 select-none [-webkit-touch-callout:none] active:scale-95 ${
        status === "INCLUDED"
          ? "bg-[rgba(34,197,94,0.16)] border-[#22c55e] text-[#4ade80] font-semibold shadow-[0_0_12px_rgba(34,197,94,0.2)]"
          : status === "EXCLUDED"
            ? "bg-[rgba(229,9,20,0.16)] border-[var(--accent)] text-[var(--accent)] line-through font-semibold"
            : "bg-[var(--bg-elevated)] border-[var(--border)] text-[var(--text-dim)] hover:border-[var(--border-hover)] hover:text-white"
      }`}
    >
      {status === "INCLUDED" && <Plus size={11} strokeWidth={3} />}
      {status === "EXCLUDED" && <Minus size={11} strokeWidth={3} />}
      <span>{label}</span>
    </button>
  );
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

  const [genres, setGenres] = useState<Genre[]>([]);
  const [countries, setCountries] = useState<Country[]>([]);
  const [filtersLoaded, setFiltersLoaded] = useState(false);

  const [films, setFilms] = useState<Film[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [streamedPage, setStreamedPage] = useState(page);

  // Studio Command Deck & Mobile Drawer UI state
  const [deckExpanded, setDeckExpanded] = useState(false);
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);
  const [activeStudioTab, setActiveStudioTab] = useState<
    "GENRES" | "COUNTRIES" | "RATINGS" | "ERA_RUNTIME" | "LIBRARY"
  >("GENRES");
  const [tapMode, setTapMode] = useState<"INCLUDE" | "EXCLUDE">("INCLUDE");
  const [countrySearch, setCountrySearch] = useState("");
  const [randomSeed, setRandomSeed] = useState(1);

  // Custom saved presets
  const [savedPresets, setSavedPresets] = useState<SavedExplorePreset[]>([]);
  const [presetNameInput, setPresetNameInput] = useState("");
  const [showSavePresetInput, setShowSavePresetInput] = useState(false);

  // Quick-Peek & Randomizer modals
  const [quickPeekFilm, setQuickPeekFilm] = useState<Film | null>(null);
  const [surpriseModalOpen, setSurpriseModalOpen] = useState(false);
  const [surpriseFilm, setSurpriseFilm] = useState<Film | null>(null);
  const [parentalGuideFilm, setParentalGuideFilm] = useState<Film | null>(null);

  // Lock body scroll when mobile filter bottom-sheet is open
  useEffect(() => {
    if (!mobileSheetOpen) return;
    lockScroll();
    return () => unlockScroll();
  }, [mobileSheetOpen]);

  // Applied URL parameters
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

  // Resolved applied genre and country IDs
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

  // Staged Draft State (updates locally on tag/input changes without firing API calls until "Apply Filters" is clicked)
  const [draft, setDraft] = useState<DraftFilterState>({
    includeGenres: parseNumberList(props.genres),
    excludeGenres: parseNumberList(props.excludeGenres),
    genreMatchMode: props.genreMode === "OR" ? "OR" : "AND",
    includeCountries: parseNumberList(props.countries),
    excludeCountries: parseNumberList(props.excludeCountries),
    ratingFrom: props.ratingFrom || "",
    ratingTo: props.ratingTo || "",
    ratingSource: (props.ratingSource as RatingSource) || "AUTO",
    minVotes: props.minVotes || "",
    requireImdb: props.requireImdb === "1",
    yearFrom: props.yearFrom || "",
    yearTo: props.yearTo || "",
    runtimeBucket: (props.runtime as RuntimeBucket) || "ANY",
    includeAgeTiers: parseStringList(props.age) as AgeTierFilter[],
    excludeAgeTiers: parseStringList(props.excludeAge) as AgeTierFilter[],
    seriesStatus: (props.status as SeriesStatusFilter) || "ALL",
    keyword: props.keyword || "",
    collectionPreset: props.collection as CollectionType | undefined,
    hideWatched: props.hideWatched === "1",
    hideFavorites: props.hideFavorites === "1",
    hideWatchLater: props.hideWatchLater === "1",
  });

  useDocumentTitle("Explore Films & Series");

  useEffect(() => {
    if (!hasApiKeys()) {
      setNoKey(true);
      setLoading(false);
      return;
    }
    const prefs = getPreferences();
    setPrefType(prefs.defaultExploreType || "ALL");
    setPrefOrder((prefs.defaultExploreOrder as ExploreSortOrder) || "NUM_VOTE");
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

        const incG = resolveGenreTokens(props.genres);
        const excG = resolveGenreTokens(props.excludeGenres);
        const incC = resolveCountryTokens(props.countries);
        const excC = resolveCountryTokens(props.excludeCountries);

        setResolvedIncludeGenres(incG);
        setResolvedExcludeGenres(excG);
        setResolvedIncludeCountries(incC);
        setResolvedExcludeCountries(excC);

        setDraft((prev) => ({
          ...prev,
          includeGenres: incG,
          excludeGenres: excG,
          includeCountries: incC,
          excludeCountries: excC,
        }));
      })
      .catch(() => {})
      .finally(() => setFiltersLoaded(true));
  }, [
    props.genres,
    props.excludeGenres,
    props.countries,
    props.excludeCountries,
  ]);

  // Sync URL prop changes back into draft state
  useEffect(() => {
    setDraft((prev) => ({
      ...prev,
      genreMatchMode: props.genreMode === "OR" ? "OR" : "AND",
      ratingFrom: props.ratingFrom || "",
      ratingTo: props.ratingTo || "",
      ratingSource: (props.ratingSource as RatingSource) || "AUTO",
      minVotes: props.minVotes || "",
      requireImdb: props.requireImdb === "1",
      yearFrom: props.yearFrom || "",
      yearTo: props.yearTo || "",
      runtimeBucket: (props.runtime as RuntimeBucket) || "ANY",
      includeAgeTiers: parseStringList(props.age) as AgeTierFilter[],
      excludeAgeTiers: parseStringList(props.excludeAge) as AgeTierFilter[],
      seriesStatus: (props.status as SeriesStatusFilter) || "ALL",
      keyword: props.keyword || "",
      collectionPreset: props.collection as CollectionType | undefined,
      hideWatched: props.hideWatched === "1",
      hideFavorites: props.hideFavorites === "1",
      hideWatchLater: props.hideWatchLater === "1",
    }));
  }, [
    props.genreMode,
    props.ratingFrom,
    props.ratingTo,
    props.ratingSource,
    props.minVotes,
    props.requireImdb,
    props.yearFrom,
    props.yearTo,
    props.runtime,
    props.age,
    props.excludeAge,
    props.status,
    props.keyword,
    props.collection,
    props.hideWatched,
    props.hideFavorites,
    props.hideWatchLater,
  ]);

  // Count how many staged draft filter changes are waiting to be applied
  const pendingChangesCount = useMemo(() => {
    let diff = 0;
    if (!sameNumArray(draft.includeGenres, resolvedIncludeGenres)) diff++;
    if (!sameNumArray(draft.excludeGenres, resolvedExcludeGenres)) diff++;
    if (draft.genreMatchMode !== genreMatchMode) diff++;
    if (!sameNumArray(draft.includeCountries, resolvedIncludeCountries)) diff++;
    if (!sameNumArray(draft.excludeCountries, resolvedExcludeCountries)) diff++;
    if (draft.ratingFrom.trim() !== (props.ratingFrom || "")) diff++;
    if (draft.ratingTo.trim() !== (props.ratingTo || "")) diff++;
    if (draft.ratingSource !== ratingSource) diff++;
    if (draft.minVotes.trim() !== (props.minVotes || "")) diff++;
    if (draft.requireImdb !== requireImdb) diff++;
    if (draft.yearFrom.trim() !== (props.yearFrom || "")) diff++;
    if (draft.yearTo.trim() !== (props.yearTo || "")) diff++;
    if (draft.runtimeBucket !== runtimeBucket) diff++;
    if (!sameStrArray(draft.includeAgeTiers, includeAgeTiers)) diff++;
    if (!sameStrArray(draft.excludeAgeTiers, excludeAgeTiers)) diff++;
    if (draft.seriesStatus !== seriesStatus) diff++;
    if (draft.keyword.trim() !== (props.keyword || "").trim()) diff++;
    if (draft.collectionPreset !== collectionPreset) diff++;
    if (draft.hideWatched !== hideWatched) diff++;
    if (draft.hideFavorites !== hideFavorites) diff++;
    if (draft.hideWatchLater !== hideWatchLater) diff++;
    return diff;
  }, [
    draft,
    resolvedIncludeGenres,
    resolvedExcludeGenres,
    genreMatchMode,
    resolvedIncludeCountries,
    resolvedExcludeCountries,
    props.ratingFrom,
    props.ratingTo,
    ratingSource,
    props.minVotes,
    requireImdb,
    props.yearFrom,
    props.yearTo,
    runtimeBucket,
    includeAgeTiers,
    excludeAgeTiers,
    seriesStatus,
    props.keyword,
    collectionPreset,
    hideWatched,
    hideFavorites,
    hideWatchLater,
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

  // Commit staged draft state when user clicks "Apply Filters"
  const handleApplyDraftFilters = useCallback(() => {
    pushFilters({
      genres:
        draft.includeGenres.length > 0
          ? draft.includeGenres.join(",")
          : undefined,
      excludeGenres:
        draft.excludeGenres.length > 0
          ? draft.excludeGenres.join(",")
          : undefined,
      genreMode:
        draft.genreMatchMode !== "AND" ? draft.genreMatchMode : undefined,
      countries:
        draft.includeCountries.length > 0
          ? draft.includeCountries.join(",")
          : undefined,
      excludeCountries:
        draft.excludeCountries.length > 0
          ? draft.excludeCountries.join(",")
          : undefined,
      ratingFrom: draft.ratingFrom.trim() || undefined,
      ratingTo: draft.ratingTo.trim() || undefined,
      ratingSource:
        draft.ratingSource !== "AUTO" ? draft.ratingSource : undefined,
      minVotes: draft.minVotes.trim() || undefined,
      requireImdb: draft.requireImdb ? "1" : undefined,
      yearFrom: draft.yearFrom.trim() || undefined,
      yearTo: draft.yearTo.trim() || undefined,
      runtime: draft.runtimeBucket !== "ANY" ? draft.runtimeBucket : undefined,
      age:
        draft.includeAgeTiers.length > 0
          ? draft.includeAgeTiers.join(",")
          : undefined,
      excludeAge:
        draft.excludeAgeTiers.length > 0
          ? draft.excludeAgeTiers.join(",")
          : undefined,
      status: draft.seriesStatus !== "ALL" ? draft.seriesStatus : undefined,
      keyword: draft.keyword.trim() || undefined,
      collection: draft.collectionPreset,
      hideWatched: draft.hideWatched ? "1" : undefined,
      hideFavorites: draft.hideFavorites ? "1" : undefined,
      hideWatchLater: draft.hideWatchLater ? "1" : undefined,
      lens: undefined,
    });
    setMobileSheetOpen(false);
  }, [draft, pushFilters]);

  const handleResetAllFilters = useCallback(() => {
    setDraft({
      includeGenres: [],
      excludeGenres: [],
      genreMatchMode: "AND",
      includeCountries: [],
      excludeCountries: [],
      ratingFrom: "",
      ratingTo: "",
      ratingSource: "AUTO",
      minVotes: "",
      requireImdb: false,
      yearFrom: "",
      yearTo: "",
      runtimeBucket: "ANY",
      includeAgeTiers: [],
      excludeAgeTiers: [],
      seriesStatus: "ALL",
      keyword: "",
      collectionPreset: undefined,
      hideWatched: false,
      hideFavorites: false,
      hideWatchLater: false,
    });
    setMobileSheetOpen(false);
    router.push("/explore");
  }, [router]);

  const buildPageHref = useCallback(
    (p: number) => buildFilterHref({ page: String(p) }),
    [buildFilterHref],
  );

  // Check whether a saved custom preset matches the currently active URL parameters
  const isSavedPresetSelected = useCallback(
    (preset: SavedExplorePreset): boolean => {
      const pParams = preset.params ?? {};
      const activeRec = currentParamsRecord();
      const keys = new Set([
        ...Object.keys(pParams),
        ...Object.keys(activeRec).filter((k) => activeRec[k] !== undefined),
      ]);
      keys.delete("page");
      if (keys.size === 0) return false;
      for (const k of keys) {
        const a = pParams[k] || undefined;
        const b = activeRec[k] || undefined;
        if (a !== b) return false;
      }
      return true;
    },
    [currentParamsRecord],
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
      })
      .catch(() => {
        if (cancelled) return;
        setFilms([]);
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
    filtersLoaded,
    type,
    excludeTypes,
    resolvedIncludeGenres,
    genreMatchMode,
    resolvedExcludeGenres,
    resolvedIncludeCountries,
    resolvedExcludeCountries,
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

  // Filtered countries for the Studio Country Deck
  const filteredCountries = useMemo(() => {
    const q = countrySearch.trim().toLowerCase();
    const list = countries.filter((c) => {
      if (!q) return true;
      const en = translateCountry(c.country, true).toLowerCase();
      return c.country.toLowerCase().includes(q) || en.includes(q);
    });
    return list.slice(0, 48);
  }, [countries, countrySearch]);

  if (noKey) return <NoKeyBanner />;

  // Draft Include / Exclude handlers (can exclude any tag directly without including first!)
  const toggleDraftGenreInclude = (genreId: number) => {
    setDraft((prev) => {
      const isInc = prev.includeGenres.includes(genreId);
      const isExc = prev.excludeGenres.includes(genreId);
      if (isInc || isExc) {
        return {
          ...prev,
          includeGenres: prev.includeGenres.filter((id) => id !== genreId),
          excludeGenres: prev.excludeGenres.filter((id) => id !== genreId),
        };
      }
      return {
        ...prev,
        includeGenres: [...prev.includeGenres, genreId],
        excludeGenres: prev.excludeGenres.filter((id) => id !== genreId),
      };
    });
  };

  const toggleDraftGenreExclude = (genreId: number) => {
    setDraft((prev) => {
      const isExc = prev.excludeGenres.includes(genreId);
      if (isExc) {
        return {
          ...prev,
          excludeGenres: prev.excludeGenres.filter((id) => id !== genreId),
        };
      }
      return {
        ...prev,
        includeGenres: prev.includeGenres.filter((id) => id !== genreId),
        excludeGenres: [...prev.excludeGenres, genreId],
      };
    });
  };

  const toggleDraftCountryInclude = (countryId: number) => {
    setDraft((prev) => {
      const isInc = prev.includeCountries.includes(countryId);
      const isExc = prev.excludeCountries.includes(countryId);
      if (isInc || isExc) {
        return {
          ...prev,
          includeCountries: prev.includeCountries.filter(
            (id) => id !== countryId,
          ),
          excludeCountries: prev.excludeCountries.filter(
            (id) => id !== countryId,
          ),
        };
      }
      return {
        ...prev,
        includeCountries: [...prev.includeCountries, countryId],
        excludeCountries: prev.excludeCountries.filter(
          (id) => id !== countryId,
        ),
      };
    });
  };

  const toggleDraftCountryExclude = (countryId: number) => {
    setDraft((prev) => {
      const isExc = prev.excludeCountries.includes(countryId);
      if (isExc) {
        return {
          ...prev,
          excludeCountries: prev.excludeCountries.filter(
            (id) => id !== countryId,
          ),
        };
      }
      return {
        ...prev,
        includeCountries: prev.includeCountries.filter(
          (id) => id !== countryId,
        ),
        excludeCountries: [...prev.excludeCountries, countryId],
      };
    });
  };

  const toggleDraftAgeInclude = (tier: AgeTierFilter) => {
    setDraft((prev) => {
      const isInc = prev.includeAgeTiers.includes(tier);
      const isExc = prev.excludeAgeTiers.includes(tier);
      if (isInc || isExc) {
        return {
          ...prev,
          includeAgeTiers: prev.includeAgeTiers.filter((t) => t !== tier),
          excludeAgeTiers: prev.excludeAgeTiers.filter((t) => t !== tier),
        };
      }
      return {
        ...prev,
        includeAgeTiers: [...prev.includeAgeTiers, tier],
        excludeAgeTiers: prev.excludeAgeTiers.filter((t) => t !== tier),
      };
    });
  };

  const toggleDraftAgeExclude = (tier: AgeTierFilter) => {
    setDraft((prev) => {
      const isExc = prev.excludeAgeTiers.includes(tier);
      if (isExc) {
        return {
          ...prev,
          excludeAgeTiers: prev.excludeAgeTiers.filter((t) => t !== tier),
        };
      }
      return {
        ...prev,
        includeAgeTiers: prev.includeAgeTiers.filter((t) => t !== tier),
        excludeAgeTiers: [...prev.excludeAgeTiers, tier],
      };
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

  // Build active applied filter chips (no Russian exclusion chip — silent backend rule)
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
      label: "IMDb Rated",
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
          : runtimeBucket === "STANDARD" || runtimeBucket === "MEDIUM"
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
      label: `“${props.keyword.trim()}”`,
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

  const studioTabs = [
    {
      id: "GENRES" as const,
      label: "Genres",
      count: draft.includeGenres.length + draft.excludeGenres.length,
    },
    {
      id: "COUNTRIES" as const,
      label: "Countries",
      count: draft.includeCountries.length + draft.excludeCountries.length,
    },
    {
      id: "RATINGS" as const,
      label: "Rating & Votes",
      count:
        (draft.ratingFrom || draft.ratingTo ? 1 : 0) +
        (draft.minVotes ? 1 : 0) +
        (draft.requireImdb ? 1 : 0),
    },
    {
      id: "ERA_RUNTIME" as const,
      label: "Year & Runtime",
      count:
        (draft.yearFrom || draft.yearTo ? 1 : 0) +
        (draft.runtimeBucket !== "ANY" ? 1 : 0) +
        draft.includeAgeTiers.length +
        draft.excludeAgeTiers.length +
        (draft.seriesStatus !== "ALL" ? 1 : 0),
    },
    {
      id: "LIBRARY" as const,
      label: "Themes & Library",
      count:
        (draft.collectionPreset ? 1 : 0) +
        (draft.hideWatched ? 1 : 0) +
        (draft.hideFavorites ? 1 : 0) +
        (draft.hideWatchLater ? 1 : 0),
    },
  ];

  // Shared Filter Panel Body rendered inside Desktop Deck or Mobile Bottom-Sheet
  const renderFilterDeckBody = () => (
    <div className="flex flex-col gap-4">
      {/* Segmented Tap Mode Bar for Genres / Countries / Age */}
      {(activeStudioTab === "GENRES" ||
        activeStudioTab === "COUNTRIES" ||
        activeStudioTab === "ERA_RUNTIME") && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-[10px] px-3 py-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-[0.8px]">
              Tap Action:
            </span>
            <div className="inline-flex items-center rounded-[8px] bg-[var(--bg-card)] p-0.5 border border-[var(--border)]">
              <button
                type="button"
                onClick={() => setTapMode("INCLUDE")}
                className={`px-2.5 py-1 rounded-[6px] text-[11px] font-bold border-none cursor-pointer inline-flex items-center gap-1 transition-colors ${
                  tapMode === "INCLUDE"
                    ? "bg-[#22c55e] text-black"
                    : "bg-transparent text-[var(--text-dim)] hover:text-white"
                }`}
              >
                <Plus size={11} strokeWidth={3} />
                Include
              </button>
              <button
                type="button"
                onClick={() => setTapMode("EXCLUDE")}
                className={`px-2.5 py-1 rounded-[6px] text-[11px] font-bold border-none cursor-pointer inline-flex items-center gap-1 transition-colors ${
                  tapMode === "EXCLUDE"
                    ? "bg-[var(--accent)] text-white"
                    : "bg-transparent text-[var(--text-dim)] hover:text-white"
                }`}
              >
                <Minus size={11} strokeWidth={3} />
                Exclude
              </button>
            </div>
            <span className="text-[11px] text-[var(--text-muted)] hidden sm:inline">
              (Tip: You can also long-press or right-click any tag to exclude it
              directly)
            </span>
          </div>

          {activeStudioTab === "GENRES" && (
            <div className="inline-flex items-center gap-1 bg-[var(--bg-card)] border border-[var(--border)] rounded-[8px] p-0.5 self-start sm:self-auto">
              <button
                type="button"
                onClick={() =>
                  setDraft((d) => ({ ...d, genreMatchMode: "AND" }))
                }
                className={`px-2.5 py-1 rounded-[6px] text-[11px] font-bold border-none cursor-pointer ${
                  draft.genreMatchMode === "AND"
                    ? "bg-[var(--accent)] text-white"
                    : "bg-transparent text-[var(--text-muted)] hover:text-white"
                }`}
              >
                Match ALL (AND)
              </button>
              <button
                type="button"
                onClick={() =>
                  setDraft((d) => ({ ...d, genreMatchMode: "OR" }))
                }
                className={`px-2.5 py-1 rounded-[6px] text-[11px] font-bold border-none cursor-pointer ${
                  draft.genreMatchMode === "OR"
                    ? "bg-[var(--accent)] text-white"
                    : "bg-transparent text-[var(--text-muted)] hover:text-white"
                }`}
              >
                Match ANY (OR)
              </button>
            </div>
          )}
        </div>
      )}

      {/* TAB 1: MULTI-GENRE MATRIX */}
      {activeStudioTab === "GENRES" && (
        <div className="flex flex-wrap gap-2">
          {genres.map((g) => {
            const isInc = draft.includeGenres.includes(g.id);
            const isExc = draft.excludeGenres.includes(g.id);
            const status = isInc ? "INCLUDED" : isExc ? "EXCLUDED" : "NONE";
            const label = translateGenre(g.genre, autoTranslate) || g.genre;
            return (
              <FilterTagPill
                key={g.id}
                label={label}
                status={status}
                tapMode={tapMode}
                onToggleInclude={() => toggleDraftGenreInclude(g.id)}
                onToggleExclude={() => toggleDraftGenreExclude(g.id)}
              />
            );
          })}
        </div>
      )}

      {/* TAB 2: COUNTRIES MATRIX */}
      {activeStudioTab === "COUNTRIES" && (
        <div>
          <div className="mb-3">
            <input
              type="text"
              value={countrySearch}
              onChange={(e) => setCountrySearch(e.target.value)}
              placeholder="Search country to include or exclude…"
              className="input text-[12px] py-2 px-3 w-full sm:w-[280px]"
            />
          </div>
          <div className="flex flex-wrap gap-2 max-h-[220px] overflow-y-auto pr-1">
            {filteredCountries.map((c) => {
              const isInc = draft.includeCountries.includes(c.id);
              const isExc = draft.excludeCountries.includes(c.id);
              const status = isInc ? "INCLUDED" : isExc ? "EXCLUDED" : "NONE";
              const label =
                translateCountry(c.country, autoTranslate) || c.country;
              return (
                <FilterTagPill
                  key={c.id}
                  label={label}
                  status={status}
                  tapMode={tapMode}
                  onToggleInclude={() => toggleDraftCountryInclude(c.id)}
                  onToggleExclude={() => toggleDraftCountryExclude(c.id)}
                />
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
              Rating Bracket Presets
            </p>
            <div className="flex flex-wrap gap-2 mb-4">
              {RATING_TIERS.map((tier) => {
                const active =
                  draft.ratingFrom === String(tier.min) &&
                  draft.ratingTo === String(tier.max);
                return (
                  <button
                    key={tier.label}
                    type="button"
                    onClick={() =>
                      setDraft((d) =>
                        active
                          ? { ...d, ratingFrom: "", ratingTo: "" }
                          : {
                              ...d,
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

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              <div>
                <label className="block text-[11px] text-[var(--text-muted)] mb-1">
                  Min Rating (0–10)
                </label>
                <input
                  type="number"
                  min={0}
                  max={10}
                  step={0.5}
                  value={draft.ratingFrom}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, ratingFrom: e.target.value }))
                  }
                  placeholder="0.0"
                  className="input w-full py-1.5 px-3 text-[12px]"
                />
              </div>
              <div>
                <label className="block text-[11px] text-[var(--text-muted)] mb-1">
                  Max Rating (0–10)
                </label>
                <input
                  type="number"
                  min={0}
                  max={10}
                  step={0.5}
                  value={draft.ratingTo}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, ratingTo: e.target.value }))
                  }
                  placeholder="10.0"
                  className="input w-full py-1.5 px-3 text-[12px]"
                />
              </div>
              <div className="col-span-2 sm:col-span-1">
                <label className="block text-[11px] text-[var(--text-muted)] mb-1">
                  Rating Source
                </label>
                <select
                  className="select w-full py-1.5 px-3 text-[12px]"
                  value={draft.ratingSource}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      ratingSource: e.target.value as RatingSource,
                    }))
                  }
                >
                  <option value="AUTO">Auto (IMDb Priority)</option>
                  <option value="IMDB">IMDb Score</option>
                  <option value="KP">Kinopoisk Score</option>
                  <option value="AVERAGE">Combined Average</option>
                  <option value="CRITICS">Critics Score</option>
                </select>
              </div>
            </div>
          </div>

          <div>
            <p className="text-[11px] font-bold uppercase tracking-[1px] text-[var(--text-muted)] mb-2">
              Minimum Vote Confidence
            </p>
            <div className="flex flex-wrap gap-2 mb-4">
              {[
                { label: "Any Votes", val: "" },
                { label: "500+ Votes", val: "500" },
                { label: "2.5K+ Votes", val: "2500" },
                { label: "10K+ Popular", val: "10000" },
                { label: "50K+ Blockbusters", val: "50000" },
              ].map((v) => {
                const active = draft.minVotes === v.val;
                return (
                  <button
                    key={v.label}
                    type="button"
                    onClick={() => setDraft((d) => ({ ...d, minVotes: v.val }))}
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
                checked={draft.requireImdb}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, requireImdb: e.target.checked }))
                }
                className="accent-[var(--accent)]"
              />
              Require Official IMDb Score
            </label>
          </div>
        </div>
      )}

      {/* TAB 4: ERA, RUNTIME & AGE SUITABILITY */}
      {activeStudioTab === "ERA_RUNTIME" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[1px] text-[var(--text-muted)] mb-2">
              Decade & Custom Year Range
            </p>
            <div className="flex flex-wrap gap-1.5 mb-3">
              {DECADE_PRESETS.map((dec) => {
                const active =
                  draft.yearFrom === String(dec.from ?? "") &&
                  draft.yearTo === String(dec.to ?? "");
                return (
                  <button
                    key={dec.label}
                    type="button"
                    onClick={() =>
                      setDraft((d) =>
                        active
                          ? { ...d, yearFrom: "", yearTo: "" }
                          : {
                              ...d,
                              yearFrom: dec.from ? String(dec.from) : "",
                              yearTo: dec.to ? String(dec.to) : "",
                            },
                      )
                    }
                    className={`px-2.5 py-1 rounded-[6px] text-[11px] font-semibold border cursor-pointer ${
                      active
                        ? "bg-[var(--accent)] border-[var(--accent)] text-white"
                        : "bg-[var(--bg-elevated)] border-[var(--border)] text-[var(--text-dim)] hover:text-white"
                    }`}
                  >
                    {dec.label}
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
                value={draft.yearFrom}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, yearFrom: e.target.value }))
                }
                className="input w-full py-1.5 px-2.5 text-[12px]"
              />
              <span className="text-[var(--text-muted)]">–</span>
              <input
                type="number"
                min={1900}
                max={CURRENT_YEAR + 2}
                placeholder={`To (e.g. ${CURRENT_YEAR})`}
                value={draft.yearTo}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, yearTo: e.target.value }))
                }
                className="input w-full py-1.5 px-2.5 text-[12px]"
              />
            </div>
          </div>

          <div>
            <p className="text-[11px] font-bold uppercase tracking-[1px] text-[var(--text-muted)] mb-2">
              Runtime Budget
            </p>
            <div className="flex flex-col gap-1.5">
              {(
                [
                  { id: "ANY", label: "Any Length" },
                  { id: "SHORT", label: "Quick Watch (< 95 min)" },
                  { id: "STANDARD", label: "Standard (95–130 min)" },
                  { id: "EPIC", label: "Epic (> 130 min)" },
                ] as { id: RuntimeBucket; label: string }[]
              ).map((rt) => (
                <button
                  key={rt.id}
                  type="button"
                  onClick={() =>
                    setDraft((d) => ({ ...d, runtimeBucket: rt.id }))
                  }
                  className={`px-3 py-1.5 rounded-[8px] text-[12px] font-medium border text-left cursor-pointer ${
                    draft.runtimeBucket === rt.id
                      ? "bg-[var(--accent-dim)] border-[var(--accent)] text-white font-semibold"
                      : "bg-[var(--bg-elevated)] border-[var(--border)] text-[var(--text-dim)] hover:text-white"
                  }`}
                >
                  {rt.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-[11px] font-bold uppercase tracking-[1px] text-[var(--text-muted)] mb-2">
              Age Suitability
            </p>
            <div className="flex flex-wrap gap-2 mb-4">
              {(
                [
                  { id: "FAMILY", label: "Family (G / PG / 0+ / 6+)" },
                  { id: "TEEN", label: "Teen (PG-13 / 12+ / 16+)" },
                  { id: "MATURE", label: "Mature (R / 18+)" },
                ] as { id: AgeTierFilter; label: string }[]
              ).map((tier) => {
                const isInc = draft.includeAgeTiers.includes(tier.id);
                const isExc = draft.excludeAgeTiers.includes(tier.id);
                const status = isInc ? "INCLUDED" : isExc ? "EXCLUDED" : "NONE";
                return (
                  <FilterTagPill
                    key={tier.id}
                    label={tier.label}
                    status={status}
                    tapMode={tapMode}
                    onToggleInclude={() => toggleDraftAgeInclude(tier.id)}
                    onToggleExclude={() => toggleDraftAgeExclude(tier.id)}
                  />
                );
              })}
            </div>

            <p className="text-[11px] font-bold uppercase tracking-[1px] text-[var(--text-muted)] mb-2">
              Series Completion Status
            </p>
            <div className="flex gap-1.5 flex-wrap">
              {(
                [
                  { id: "ALL", label: "All" },
                  { id: "COMPLETED", label: "Completed" },
                  { id: "ONGOING", label: "Ongoing" },
                ] as { id: SeriesStatusFilter; label: string }[]
              ).map((st) => (
                <button
                  key={st.id}
                  type="button"
                  onClick={() =>
                    setDraft((d) => ({ ...d, seriesStatus: st.id }))
                  }
                  className={`px-2.5 py-1 rounded-[6px] text-[11px] font-semibold border cursor-pointer ${
                    draft.seriesStatus === st.id
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
              Theme Collections
            </p>
            <div className="flex flex-wrap gap-2">
              {COLLECTION_PRESETS.map((col) => {
                const active = draft.collectionPreset === col.value;
                return (
                  <button
                    key={col.value}
                    type="button"
                    onClick={() =>
                      setDraft((d) => ({
                        ...d,
                        collectionPreset: active ? undefined : col.value,
                      }))
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
              Personal Library Filters
            </p>
            <div className="flex flex-col gap-2.5 text-[12px] text-[var(--text-dim)]">
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={draft.hideWatched}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, hideWatched: e.target.checked }))
                  }
                  className="accent-[var(--accent)]"
                />
                Hide films in my Watch History
              </label>
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={draft.hideFavorites}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, hideFavorites: e.target.checked }))
                  }
                  className="accent-[var(--accent)]"
                />
                Hide films already in Favorites
              </label>
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={draft.hideWatchLater}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      hideWatchLater: e.target.checked,
                    }))
                  }
                  className="accent-[var(--accent)]"
                />
                Hide films already in Watch Later
              </label>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <PageContainer>
      {/* Clean, Uncluttered Explore Header (Task 3) */}
      <PageHeader
        title="EXPLORE"
        className="mb-4 sm:mb-6"
        rightSlot={
          <button
            type="button"
            onClick={handleSurpriseMe}
            disabled={films.length === 0}
            className="btn btn-primary py-2 px-3.5 text-[12px] disabled:opacity-40"
          >
            <Shuffle size={13} />
            Surprise Me
          </button>
        }
      />

      {/* ── LAYER 1: Default Smart Lenses + Separate Custom Saved Presets Row (Tasks 4 & 10) ── */}
      <div className="mb-4 sm:mb-5">
        <div className="flex items-center justify-between gap-2 mb-2">
          <span className="text-[11px] font-bold uppercase tracking-[1.4px] text-[var(--text-muted)] flex items-center gap-1.5">
            <Sparkles size={12} className="text-[var(--accent)]" />
            Quick Presets
          </span>
          <button
            type="button"
            onClick={() => setShowSavePresetInput((v) => !v)}
            className="text-[11px] font-semibold text-[var(--accent)] hover:underline inline-flex items-center gap-1 bg-transparent border-none cursor-pointer"
          >
            <BookmarkPlus size={12} />
            Save Current Filters
          </button>
        </div>

        {showSavePresetInput && (
          <div className="flex items-center gap-2 mb-3 bg-[var(--bg-card)] border border-[var(--border)] rounded-[10px] p-2.5 max-w-[420px]">
            <input
              type="text"
              value={presetNameInput}
              onChange={(e) => setPresetNameInput(e.target.value)}
              placeholder="Preset name (e.g. 90s Sci-Fi)…"
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

        {/* Row 1: Built-In Smart Lenses */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1.5 scrollbar-none">
          {SMART_LENSES.map((lens) => {
            const isSelected = activeLens === lens.id;
            return (
              <button
                key={lens.id}
                type="button"
                onClick={() => {
                  if (isSelected) {
                    handleResetAllFilters();
                  } else {
                    pushFilters({ ...lens.params, lens: lens.id }, true);
                  }
                }}
                className={`flex-shrink-0 px-3 py-2 rounded-[10px] border text-left transition-all cursor-pointer flex items-center gap-2 ${
                  isSelected
                    ? "bg-[var(--accent-dim)] border-[var(--accent)] text-white shadow-[0_0_18px_rgba(229,9,20,0.25)]"
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
        </div>

        {/* Row 2: Custom Saved Presets on a Separate Line Below Default Presets (Tasks 4 & 10) */}
        {savedPresets.length > 0 && (
          <div className="mt-2.5 pt-2.5 border-t border-[var(--border)]">
            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
              <span className="text-[10px] font-bold uppercase tracking-[1px] text-[var(--text-muted)] flex-shrink-0 mr-1">
                Saved:
              </span>
              {savedPresets.map((preset) => {
                const selected = isSavedPresetSelected(preset);
                return (
                  <div
                    key={preset.id}
                    className={`flex-shrink-0 inline-flex items-center rounded-[10px] overflow-hidden border transition-all ${
                      selected
                        ? "bg-[rgba(245,197,24,0.2)] border-[#f5c518] shadow-[0_0_18px_rgba(245,197,24,0.3)]"
                        : "bg-[var(--bg-card)] border-[var(--border)] hover:border-[rgba(245,197,24,0.45)]"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        if (selected) {
                          handleResetAllFilters();
                        } else {
                          pushFilters(preset.params ?? {}, true);
                        }
                      }}
                      className={`px-3 py-1.5 text-[12px] font-semibold bg-transparent border-none cursor-pointer inline-flex items-center gap-1.5 whitespace-nowrap ${
                        selected
                          ? "text-white"
                          : "text-[var(--text-dim)] hover:text-white"
                      }`}
                    >
                      {selected ? (
                        <Check
                          size={12}
                          strokeWidth={3}
                          className="text-[#f5c518]"
                        />
                      ) : (
                        <Star
                          size={11}
                          fill="#f5c518"
                          stroke="#f5c518"
                          className="opacity-80"
                        />
                      )}
                      <span>{preset.name}</span>
                      {selected && (
                        <span className="text-[9px] font-bold uppercase tracking-[0.5px] bg-[#f5c518] text-black px-1.5 py-[1px] rounded">
                          Active
                        </span>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const next = deleteExplorePreset(preset.id);
                        setSavedPresets(next);
                        toast.info(`Removed preset "${preset.name}"`);
                      }}
                      title="Delete preset"
                      className="px-2 py-1.5 text-[var(--text-muted)] hover:text-[var(--accent)] bg-transparent border-none border-l border-[var(--border)] cursor-pointer"
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ── LAYER 2: Responsive Filter & Sort Command Bar (Tasks 6, 7, 8, 9, 11, 12) ── */}
      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-[14px] p-3 sm:p-4 mb-6 shadow-[0_12px_40px_rgba(0,0,0,0.4)]">
        {/* Top Row: Media Types + Sort + Keyword */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5">
          {/* Media Type Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
            {TYPES.map((t) => {
              const isSelected = type === t.value;
              return (
                <button
                  key={t.value}
                  type="button"
                  onClick={() =>
                    pushFilters({
                      type: t.value === "ALL" ? undefined : t.value,
                    })
                  }
                  className={`px-3 py-1.5 rounded-[8px] text-[12px] font-semibold border transition-all cursor-pointer whitespace-nowrap ${
                    isSelected
                      ? "bg-[var(--accent)] border-[var(--accent)] text-white shadow-[0_0_12px_rgba(229,9,20,0.3)]"
                      : "bg-[var(--bg-elevated)] border-[var(--border)] text-[var(--text-dim)] hover:text-white"
                  }`}
                >
                  {t.label}
                </button>
              );
            })}
          </div>

          {/* Mobile & Desktop Control Row: Filter Drawer Button (Mobile) + Keyword + Sort + ASC/DESC */}
          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            {/* Mobile Filter Sheet Trigger Button */}
            <button
              type="button"
              onClick={() => setMobileSheetOpen(true)}
              className={`md:hidden flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-[8px] text-[12px] font-semibold border cursor-pointer transition-all ${
                activeFilterTags.length > 0 || pendingChangesCount > 0
                  ? "bg-[var(--accent-dim)] border-[var(--accent)] text-white"
                  : "bg-[var(--bg-elevated)] border-[var(--border)] text-[var(--text-dim)]"
              }`}
            >
              <SlidersHorizontal size={13} />
              <span>Filters</span>
              {(activeFilterTags.length > 0 || pendingChangesCount > 0) && (
                <span className="bg-[var(--accent)] text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] px-1 flex items-center justify-center">
                  {activeFilterTags.length + pendingChangesCount}
                </span>
              )}
            </button>

            {/* Sort Order Selector */}
            <select
              className="select text-[12px] py-2 px-3 rounded-[8px] flex-1 sm:flex-initial min-w-[135px]"
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
                className={`px-3 py-2 rounded-[8px] text-[12px] font-semibold border transition-all cursor-pointer inline-flex items-center gap-1 flex-shrink-0 ${
                  direction === "ASC"
                    ? "bg-[rgba(245,197,24,0.14)] border-[rgba(245,197,24,0.45)] text-[#f5c518]"
                    : "bg-[var(--bg-elevated)] border-[var(--border)] text-[var(--text-dim)] hover:text-white"
                }`}
              >
                {direction === "DESC" ? (
                  <>
                    <ArrowDown size={13} />
                    <span className="hidden sm:inline">DESC</span>
                  </>
                ) : (
                  <>
                    <ArrowUp size={13} />
                    <span className="hidden sm:inline">ASC</span>
                  </>
                )}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setRandomSeed((s) => s + 1)}
                className="px-3 py-2 rounded-[8px] text-[12px] font-semibold border border-[var(--accent)] bg-[var(--accent-dim)] text-white cursor-pointer inline-flex items-center gap-1.5 flex-shrink-0"
              >
                <Shuffle size={13} />
                <span className="hidden sm:inline">Reshuffle</span>
              </button>
            )}

            {/* Keyword Input */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleApplyDraftFilters();
              }}
              className="relative w-full sm:w-[180px]"
            >
              <Search
                size={13}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none"
              />
              <input
                type="text"
                value={draft.keyword}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, keyword: e.target.value }))
                }
                placeholder="Keyword…"
                className="input w-full pl-8 pr-7 py-1.5 text-[12px] rounded-[8px]"
              />
              {draft.keyword && (
                <button
                  type="button"
                  onClick={() => {
                    setDraft((d) => ({ ...d, keyword: "" }));
                    if (props.keyword) pushFilters({ keyword: undefined });
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-white bg-transparent border-none cursor-pointer"
                >
                  <X size={12} />
                </button>
              )}
            </form>
          </div>
        </div>

        {/* Desktop Filter Category Tabs */}
        <div className="hidden md:flex items-center justify-between gap-2 pt-3 mt-3 border-t border-[var(--border)] flex-wrap">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            {studioTabs.map((tab) => {
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
                  <span>{tab.label}</span>
                  {tab.count > 0 && (
                    <span className="bg-[var(--accent)] text-white text-[10px] font-bold rounded-full px-1.5 py-0">
                      {tab.count}
                    </span>
                  )}
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
            {pendingChangesCount > 0 && (
              <button
                type="button"
                onClick={handleApplyDraftFilters}
                className="btn btn-primary py-1.5 px-4 text-[12px] animate-pulse"
              >
                <Check size={13} strokeWidth={2.8} />
                Apply Filters ({pendingChangesCount})
              </button>
            )}
            <button
              type="button"
              onClick={() => setDeckExpanded((v) => !v)}
              className="text-[12px] font-semibold text-[var(--accent)] bg-transparent border-none cursor-pointer hover:underline"
            >
              {deckExpanded ? "Hide Filters ▲" : "Customize Filters ▼"}
            </button>
          </div>
        </div>

        {/* Desktop Expandable Studio Filter Panel + Apply Filters Footer */}
        {deckExpanded && (
          <div className="hidden md:block mt-4 pt-4 border-t border-[var(--border)] fade-in">
            {renderFilterDeckBody()}

            {/* Explicit Apply & Reset Action Bar (Task 8) */}
            <div className="flex items-center justify-between gap-3 mt-5 pt-3.5 border-t border-[var(--border)]">
              <span className="text-[11px] text-[var(--text-muted)]">
                {pendingChangesCount > 0
                  ? `${pendingChangesCount} filter change${pendingChangesCount !== 1 ? "s" : ""} ready to apply`
                  : "Select multiple tags or ranges above, then click Apply Filters."}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleResetAllFilters}
                  className="btn btn-ghost py-2 px-4 text-[12px]"
                >
                  <RotateCcw size={12} />
                  Reset All
                </button>
                <button
                  type="button"
                  onClick={handleApplyDraftFilters}
                  className="btn btn-primary py-2 px-5 text-[12px]"
                >
                  <Check size={13} strokeWidth={2.5} />
                  {pendingChangesCount > 0
                    ? `Apply Filters (${pendingChangesCount})`
                    : "Apply Filters"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Active Applied Filter Summary Chips */}
        {activeFilterTags.length > 0 && (
          <div className="flex items-center flex-wrap gap-1.5 mt-3 pt-3 border-t border-[var(--border)]">
            {activeFilterTags.map((tag, idx) => (
              <button
                key={`${tag.label}-${idx}`}
                type="button"
                onClick={tag.onClear}
                className={`inline-flex items-center gap-1.5 text-[11px] font-semibold rounded-full px-2.5 py-1 border cursor-pointer transition-colors ${
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
              onClick={handleResetAllFilters}
              className="text-[11px] font-semibold text-[var(--text-muted)] hover:text-white underline bg-transparent border-none cursor-pointer ml-1"
            >
              Clear All
            </button>
          </div>
        )}
      </div>

      {/* ── Mobile Slide-Up Filter Sheet (Tasks 7, 8, 11, 12) ── */}
      {mobileSheetOpen && (
        <div
          className="md:hidden fixed inset-0 z-[950] bg-black/80 backdrop-blur-md flex flex-col justify-end fade-in"
          onClick={(e) => {
            if (e.target === e.currentTarget) setMobileSheetOpen(false);
          }}
        >
          <div className="bg-[var(--bg-card)] border-t border-[var(--border)] rounded-t-[20px] max-h-[88vh] flex flex-col overflow-hidden shadow-[0_-20px_60px_rgba(0,0,0,0.9)]">
            {/* Sheet Header */}
            <div className="flex items-center justify-between px-4 py-3.5 border-b border-[var(--border)]">
              <div className="flex items-center gap-2">
                <SlidersHorizontal size={15} className="text-[var(--accent)]" />
                <span className="font-display tracking-[1.5px] text-[18px] text-white">
                  FILTERS
                </span>
              </div>
              <button
                type="button"
                onClick={() => setMobileSheetOpen(false)}
                className="w-8 h-8 rounded-full border border-[var(--border)] bg-[var(--bg-elevated)] text-[var(--text-dim)] flex items-center justify-center cursor-pointer"
                aria-label="Close filters"
              >
                <X size={15} />
              </button>
            </div>

            {/* Category Tabs inside Mobile Sheet */}
            <div className="flex items-center gap-1.5 overflow-x-auto px-4 py-2.5 border-b border-[var(--border)] bg-[var(--bg)] scrollbar-none">
              {studioTabs.map((tab) => {
                const active = activeStudioTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveStudioTab(tab.id)}
                    className={`px-3 py-1.5 rounded-[8px] text-[12px] font-semibold border whitespace-nowrap cursor-pointer inline-flex items-center gap-1.5 ${
                      active
                        ? "bg-[var(--accent)] border-[var(--accent)] text-white"
                        : "bg-[var(--bg-elevated)] border-[var(--border)] text-[var(--text-dim)]"
                    }`}
                  >
                    <span>{tab.label}</span>
                    {tab.count > 0 && (
                      <span
                        className={`text-[10px] font-bold rounded-full px-1.5 ${
                          active
                            ? "bg-black/30 text-white"
                            : "bg-[var(--accent)] text-white"
                        }`}
                      >
                        {tab.count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Scrollable Sheet Content */}
            <div className="flex-1 overflow-y-auto p-4">
              {renderFilterDeckBody()}
            </div>

            {/* Sticky Bottom Apply & Reset Footer */}
            <div className="px-4 py-3 border-t border-[var(--border)] bg-[var(--bg)] flex items-center gap-2.5 safe-bottom">
              <button
                type="button"
                onClick={handleResetAllFilters}
                className="btn btn-ghost py-2.5 px-4 text-[13px] justify-center"
              >
                <RotateCcw size={13} />
                Reset
              </button>
              <button
                type="button"
                onClick={handleApplyDraftFilters}
                className="btn btn-primary flex-1 py-2.5 px-5 text-[13px] justify-center"
              >
                <Check size={14} strokeWidth={2.5} />
                {pendingChangesCount > 0
                  ? `Apply Filters (${pendingChangesCount})`
                  : "Apply Filters"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── LAYER 3: Standard Poster Grid (Task 6) ── */}
      {loading ? (
        <div className="film-grid">
          {Array.from({ length: 20 }).map((_, i) => (
            <div
              key={i}
              className="skeleton aspect-[2/3] rounded-[10px] sm:rounded-[12px]"
            />
          ))}
        </div>
      ) : films.length === 0 ? (
        <EmptyState
          icon={<Search size={36} />}
          title="No Matching Titles Found"
          description="Try relaxing your genre or rating filters, or switch from Match ALL (AND) to Match ANY (OR)."
          actionLabel="Reset All Filters"
          onAction={handleResetAllFilters}
        />
      ) : (
        <div className="film-grid">
          {films.map((film, i) => {
            const fid = film.kinopoiskId ?? film.filmId ?? i;
            return (
              <FilmCard
                key={`${fid}-${i}`}
                film={film}
                variant="grid"
                index={i}
                onQuickPeek={(f) => setQuickPeekFilm(f)}
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
              {loadingMore ? "Loading Next Batch…" : "Load More (+20 Titles)"}
            </button>
          )}
          <Pagination
            page={page}
            totalPages={totalPages}
            buildHref={buildPageHref}
          />
        </div>
      )}

      {/* Quick-Peek Modal */}
      {quickPeekFilm && (
        <QuickPeekModal
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

      {/* Surprise Me / Spin the Reel Modal (Task 5 fixed) */}
      {surpriseModalOpen && surpriseFilm && (
        <SurpriseMeModal
          film={surpriseFilm}
          autoTranslate={autoTranslate}
          onSpinAgain={handleSurpriseMe}
          onClose={() => setSurpriseModalOpen(false)}
          onWatchNow={(fid) => {
            setSurpriseModalOpen(false);
            router.push(`/watch/${fid}`);
          }}
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

/* ── Quick-Peek Slide-Over Modal ──────────────────────────────────────────── */
function QuickPeekModal({
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
          src={detail.posterUrlPreview || detail.posterUrl}
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
              Full Details
            </button>
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

/* ── Surprise Me / Roulette Modal (Task 5 Fixed) ──────────────────────────── */
function SurpriseMeModal({
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

  return (
    <ModalShell
      open
      onClose={onClose}
      title="TONIGHT'S RANDOM PICK"
      subtitle="Drawn from your active Explore filters"
      icon={<Shuffle size={16} />}
      maxWidthClass="sm:max-w-[480px]"
    >
      <div className="flex flex-col items-center text-center">
        <PosterImage
          src={film.posterUrlPreview || film.posterUrl}
          alt={title}
          title={title}
          priority
          className="w-[155px] aspect-[2/3] rounded-[12px] overflow-hidden shadow-[0_12px_40px_rgba(0,0,0,0.7)] mb-4 bg-[var(--surface)] relative"
        />
        <h3 className="font-display text-[26px] tracking-[1px] text-white m-0">
          {title}
        </h3>
        <div className="flex items-center gap-2 justify-center mt-2 text-[12px] text-[var(--text-muted)]">
          {film.year && <span>{film.year}</span>}
          {(film.ratingImdb || film.ratingKinopoisk) && (
            <span className="text-[#f5c518] font-bold">
              · ★ {(film.ratingImdb ?? film.ratingKinopoisk)?.toFixed(1)}
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
          <button
            type="button"
            onClick={() => onWatchNow(id)}
            className="btn btn-primary flex-1 justify-center py-2.5 text-[13px]"
          >
            <Play size={14} fill="currentColor" />
            Watch Now
          </button>
        </div>
      </div>
    </ModalShell>
  );
}
