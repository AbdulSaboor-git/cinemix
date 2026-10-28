"use client";
import { useEffect, useState, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Search,
  X,
  Compass,
  Film as FilmIcon,
  Tv,
  Star,
  Sparkles,
  RotateCcw,
} from "lucide-react";
import { searchFilms, isRussianDomesticFilm } from "@/lib/kinopoisk";
import { Film } from "@/types/kinopoisk";
import { useSearchSuggestions } from "@/hooks/useSearchSuggestions";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { hasApiKeys, getPreferences } from "@/lib/preferences";
import FilmCard from "@/components/FilmCard";
import Pagination from "@/components/Pagination";
import SearchSuggestionDropdown from "@/components/SearchSuggestionDropdown";
import PageContainer from "@/components/ui/PageContainer";
import PageHeader from "@/components/ui/PageHeader";
import EmptyState from "@/components/ui/EmptyState";
import NoKeyBanner from "@/components/ui/NoKeyBanner";

const QUICK_SEARCH_IDEAS = [
  "Interstellar",
  "Dune",
  "The Dark Knight",
  "Oppenheimer",
  "Breaking Bad",
  "Inception",
  "Severance",
  "Spider-Man",
];

function isSeriesFilm(f: Film): boolean {
  return (
    Boolean(f.serial) ||
    f.type === "TV_SERIES" ||
    f.type === "MINI_SERIES" ||
    f.type === "TV_SHOW"
  );
}

function getNumericRating(f: Film): number {
  const raw = f.ratingImdb ?? f.ratingKinopoisk ?? f.rating;
  if (typeof raw === "number") return raw > 0 && raw <= 10 ? raw : 0;
  if (typeof raw === "string" && !raw.trim().endsWith("%")) {
    const parsed = parseFloat(raw);
    return !isNaN(parsed) && parsed > 0 && parsed <= 10 ? parsed : 0;
  }
  return 0;
}

export default function SearchClient({
  q,
  page: pg,
}: {
  q?: string;
  page?: string;
}) {
  const query = (q || "").trim();
  const page = Math.max(1, parseInt(pg || "1", 10));
  const [noKey, setNoKey] = useState(false);
  const [films, setFilms] = useState<Film[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState(query);

  // Post-Search Filter & Sort Controls
  const [mediaFilter, setMediaFilter] = useState<"ALL" | "FILM" | "SERIES">(
    "ALL",
  );
  const [hideUnrated, setHideUnrated] = useState(false);
  const [sortBy, setSortBy] = useState<
    "RELEVANCE" | "RATING" | "YEAR_DESC" | "YEAR_ASC"
  >("RELEVANCE");

  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useDocumentTitle(query ? `Search: ${query}` : "Search");

  const {
    suggestions,
    sugLoading,
    sugVisible,
    selectedIdx,
    setSugVisible,
    fetchSuggestions,
    clearSuggestions,
    handleKeyNav,
  } = useSearchSuggestions();

  useEffect(() => {
    if (!hasApiKeys()) {
      setNoKey(true);
      return;
    }
    setSearch(query);
    clearSuggestions();
  }, [query, clearSuggestions]);

  useEffect(() => {
    if (!sugVisible) return;
    const onPointerDown = (e: PointerEvent) => {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(e.target as Node)
      ) {
        setSugVisible(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSugVisible(false);
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [sugVisible, setSugVisible]);

  useEffect(() => {
    if (!hasApiKeys() || !query) {
      setFilms([]);
      setTotal(0);
      setTotalPages(1);
      return;
    }
    setLoading(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
    searchFilms(query, page)
      .then((d) => {
        setFilms(d.items ?? []);
        setTotalPages(d.totalPages ?? 1);
        setTotal(d.total ?? 0);
      })
      .catch(() => setFilms([]))
      .finally(() => setLoading(false));
  }, [query, page]);

  // Base region-aware pool so tab counts (All / Movies / Series) stay accurate
  const regionalPool = useMemo(() => {
    const regionMode =
      typeof window !== "undefined"
        ? (getPreferences().contentRegionMode ?? "GLOBAL_FIRST")
        : "GLOBAL_FIRST";

    if (regionMode === "GLOBAL_FIRST") {
      const globalOnly = films.filter((f) => !isRussianDomesticFilm(f));
      return globalOnly.length > 0 ? globalOnly : films;
    }
    return films;
  }, [films]);

  const counts = useMemo(() => {
    const pool = hideUnrated
      ? regionalPool.filter((f) => getNumericRating(f) > 0)
      : regionalPool;
    let movieCount = 0;
    let seriesCount = 0;
    for (const f of pool) {
      if (isSeriesFilm(f)) seriesCount += 1;
      else movieCount += 1;
    }
    return {
      all: pool.length,
      movies: movieCount,
      series: seriesCount,
    };
  }, [regionalPool, hideUnrated]);

  const displayedFilms = useMemo(() => {
    const filtered = regionalPool.filter((f) => {
      if (mediaFilter === "FILM" && isSeriesFilm(f)) return false;
      if (mediaFilter === "SERIES" && !isSeriesFilm(f)) return false;
      if (hideUnrated && getNumericRating(f) <= 0) return false;
      return true;
    });

    if (sortBy === "RATING") {
      return [...filtered].sort(
        (a, b) => getNumericRating(b) - getNumericRating(a),
      );
    }
    if (sortBy === "YEAR_DESC") {
      return [...filtered].sort(
        (a, b) =>
          Number(b.year || b.startYear || 0) -
          Number(a.year || a.startYear || 0),
      );
    }
    if (sortBy === "YEAR_ASC") {
      return [...filtered].sort(
        (a, b) =>
          Number(a.year || a.startYear || 9999) -
          Number(b.year || b.startYear || 9999),
      );
    }
    return filtered;
  }, [regionalPool, mediaFilter, hideUnrated, sortBy]);

  if (noKey) return <NoKeyBanner />;

  const handleChange = (val: string) => {
    setSearch(val);
    if (val.trim().length >= 2) {
      fetchSuggestions(val, 6);
    } else {
      clearSuggestions();
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedIdx >= 0 && suggestions[selectedIdx]) {
      const film = suggestions[selectedIdx];
      clearSuggestions();
      router.push(`/film/${film.kinopoiskId ?? film.filmId}`);
      return;
    }
    const trimmed = search.trim();
    if (trimmed) {
      clearSuggestions();
      router.push(`/search?q=${encodeURIComponent(trimmed)}`);
    }
  };

  const hasActivePostFilters =
    mediaFilter !== "ALL" || hideUnrated || sortBy !== "RELEVANCE";

  const resetPostFilters = () => {
    setMediaFilter("ALL");
    setHideUnrated(false);
    setSortBy("RELEVANCE");
  };

  return (
    <PageContainer>
      {/* Consistent Top PageHeader (matches Explore, Top 250, and Premieres) */}
      <PageHeader
        eyebrow={query ? "Search Results" : "Catalog Search"}
        eyebrowIcon={<Search size={13} />}
        eyebrowColor="var(--accent)"
        title={query ? `“${query}”` : "SEARCH"}
        subtitle={
          query
            ? !loading && total > 0
              ? `Found ${total.toLocaleString()} matching title${total !== 1 ? "s" : ""}`
              : loading
                ? "Searching the CineMix catalog…"
                : "No exact matches found for this query."
            : "Search across movies, TV series, mini-series, and international releases."
        }
        className="mb-4 sm:mb-6"
        rightSlot={
          query ? (
            <Link
              href={`/explore?keyword=${encodeURIComponent(query)}`}
              className="no-underline"
            >
              <span className="btn btn-ghost py-2 px-3.5 text-[12px]">
                <Compass size={13} />
                Open in Advanced Explore
              </span>
            </Link>
          ) : null
        }
      />

      {/* Unified Search & Post-Filter Control Deck (matches BrowseClient Layer 2 card) */}
      <div className="relative z-30 bg-[var(--bg-card)] border border-[var(--border)] rounded-[14px] p-3 sm:p-4 mb-6 shadow-[0_12px_40px_rgba(0,0,0,0.4)]">
        <form onSubmit={handleSubmit}>
          <div ref={wrapperRef} className="relative w-full">
            <div className="flex items-center gap-2">
              <div className="relative flex-1 min-w-0">
                <Search
                  size={16}
                  strokeWidth={2.2}
                  className={`absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none transition-colors ${
                    sugLoading
                      ? "text-[var(--accent)] opacity-100"
                      : "text-[var(--text-muted)]"
                  }`}
                />
                <input
                  ref={inputRef}
                  type="text"
                  value={search}
                  onChange={(e) => handleChange(e.target.value)}
                  onKeyDown={(e) => handleKeyNav(e, suggestions.length)}
                  onFocus={() => {
                    if (search.trim().length >= 2 && suggestions.length > 0) {
                      setSugVisible(true);
                    }
                  }}
                  placeholder="Search films, TV series, keywords…"
                  className="input w-full text-[14px] sm:text-[15px] py-2.5 sm:py-3 pl-10 pr-9 rounded-[10px] bg-[var(--bg-elevated)] border-[var(--border)] focus:border-[var(--accent)]"
                  autoFocus={!query}
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearch("");
                      clearSuggestions();
                      inputRef.current?.focus();
                    }}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 bg-transparent border-none cursor-pointer text-[var(--text-muted)] hover:text-white transition-colors w-7 h-7 rounded-full flex items-center justify-center"
                    aria-label="Clear search"
                  >
                    <X size={15} strokeWidth={2.3} />
                  </button>
                )}
              </div>

              <button
                type="submit"
                disabled={!search.trim()}
                className="btn btn-primary py-2.5 sm:py-3 px-4 sm:px-5 text-[13px] rounded-[10px] flex-shrink-0 disabled:opacity-40 disabled:pointer-events-none"
              >
                <Search size={14} />
                <span className="hidden xs:inline">Search</span>
              </button>
            </div>

            {/* Instant Search Suggestion Dropdown */}
            {sugVisible && suggestions.length > 0 && (
              <SearchSuggestionDropdown
                suggestions={suggestions}
                selectedIdx={selectedIdx}
                sugLoading={sugLoading}
                search={search}
                showSeeAllLink={
                  search.trim().toLowerCase() !== query.toLowerCase()
                }
                onSelect={() => setSugVisible(false)}
              />
            )}
          </div>
        </form>

        {/* Quick Search Chips when no query is active */}
        {!query && (
          <div className="flex items-center gap-2 flex-wrap mt-3 pt-3 border-t border-[var(--border)]">
            <span className="text-[11px] font-bold uppercase tracking-[1px] text-[var(--text-muted)] inline-flex items-center gap-1 mr-1">
              <Sparkles size={11} className="text-[var(--accent)]" />
              Popular:
            </span>
            {QUICK_SEARCH_IDEAS.map((term) => (
              <button
                key={term}
                type="button"
                onClick={() => {
                  setSearch(term);
                  clearSuggestions();
                  router.push(`/search?q=${encodeURIComponent(term)}`);
                }}
                className="px-2.5 py-1 rounded-[8px] text-[11px] sm:text-[12px] font-medium bg-[var(--bg-elevated)] border border-[var(--border)] text-[var(--text-dim)] hover:text-white hover:border-[var(--border-hover)] cursor-pointer transition-all active:scale-95"
              >
                {term}
              </button>
            ))}
          </div>
        )}

        {/* Post-Search Filter & Sort Toolbar (matches BrowseClient toolbar styling) */}
        {query && !loading && films.length > 0 && (
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5 mt-3 pt-3 border-t border-[var(--border)]">
            {/* Media Type Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
              <button
                type="button"
                onClick={() => setMediaFilter("ALL")}
                className={`px-3 py-1.5 rounded-[8px] text-[12px] font-semibold border transition-all cursor-pointer whitespace-nowrap inline-flex items-center gap-1.5 active:scale-95 ${
                  mediaFilter === "ALL"
                    ? "bg-[var(--accent)] border-[var(--accent)] text-white shadow-[0_0_12px_rgba(229,9,20,0.3)]"
                    : "bg-[var(--bg-elevated)] border-[var(--border)] text-[var(--text-dim)] hover:text-white"
                }`}
              >
                <span>All</span>
                <span
                  className={`text-[10px] px-1.5 py-[1px] rounded font-bold ${
                    mediaFilter === "ALL"
                      ? "bg-black/25 text-white"
                      : "bg-[var(--surface)] text-[var(--text-muted)]"
                  }`}
                >
                  {counts.all}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setMediaFilter("FILM")}
                className={`px-3 py-1.5 rounded-[8px] text-[12px] font-semibold border transition-all cursor-pointer whitespace-nowrap inline-flex items-center gap-1.5 active:scale-95 ${
                  mediaFilter === "FILM"
                    ? "bg-[var(--accent)] border-[var(--accent)] text-white shadow-[0_0_12px_rgba(229,9,20,0.3)]"
                    : "bg-[var(--bg-elevated)] border-[var(--border)] text-[var(--text-dim)] hover:text-white"
                }`}
              >
                <FilmIcon size={12} />
                <span>Movies</span>
                <span
                  className={`text-[10px] px-1.5 py-[1px] rounded font-bold ${
                    mediaFilter === "FILM"
                      ? "bg-black/25 text-white"
                      : "bg-[var(--surface)] text-[var(--text-muted)]"
                  }`}
                >
                  {counts.movies}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setMediaFilter("SERIES")}
                className={`px-3 py-1.5 rounded-[8px] text-[12px] font-semibold border transition-all cursor-pointer whitespace-nowrap inline-flex items-center gap-1.5 active:scale-95 ${
                  mediaFilter === "SERIES"
                    ? "bg-[var(--accent)] border-[var(--accent)] text-white shadow-[0_0_12px_rgba(229,9,20,0.3)]"
                    : "bg-[var(--bg-elevated)] border-[var(--border)] text-[var(--text-dim)] hover:text-white"
                }`}
              >
                <Tv size={12} />
                <span>Series</span>
                <span
                  className={`text-[10px] px-1.5 py-[1px] rounded font-bold ${
                    mediaFilter === "SERIES"
                      ? "bg-black/25 text-white"
                      : "bg-[var(--surface)] text-[var(--text-muted)]"
                  }`}
                >
                  {counts.series}
                </span>
              </button>
            </div>

            {/* Right Controls: Rated Only + Sort Select + Reset */}
            <div className="flex items-stretch gap-2 flex-wrap sm:flex-nowrap">
              <button
                type="button"
                onClick={() => setHideUnrated((v) => !v)}
                className={`px-3 py-1.5 rounded-[8px] text-[12px] font-semibold border cursor-pointer transition-all inline-flex items-center gap-1.5 whitespace-nowrap active:scale-95 ${
                  hideUnrated
                    ? "bg-[rgba(245,197,24,0.14)] border-[rgba(245,197,24,0.45)] text-[#f5c518]"
                    : "bg-[var(--bg-elevated)] border-[var(--border)] text-[var(--text-dim)] hover:text-white"
                }`}
              >
                <Star
                  size={11}
                  fill={hideUnrated ? "#f5c518" : "none"}
                  stroke={hideUnrated ? "#f5c518" : "currentColor"}
                />
                <span>Rated Only</span>
              </button>

              <select
                value={sortBy}
                onChange={(e) =>
                  setSortBy(
                    e.target.value as
                      | "RELEVANCE"
                      | "RATING"
                      | "YEAR_DESC"
                      | "YEAR_ASC",
                  )
                }
                aria-label="Sort search results"
                className="select text-[12px] py-1.5 px-3 rounded-[8px] flex-1 sm:flex-initial min-w-[155px]"
              >
                <option value="RELEVANCE">Best Match</option>
                <option value="RATING">Highest Rating</option>
                <option value="YEAR_DESC">Newest Release</option>
                <option value="YEAR_ASC">Oldest Release</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Results Grid / Empty States */}
      {!query ? (
        <EmptyState
          icon={<Search size={40} stroke="var(--accent)" strokeWidth={1.6} />}
          title="Explore the CineMix Catalog"
          description="Type a film or series title above, or jump into Advanced Explore to filter by genre, country, era, and rating."
          actionLabel="Open Advanced Explore"
          actionHref="/explore"
        />
      ) : loading ? (
        <div className="film-grid">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="skeleton aspect-[2/3] rounded-[12px]" />
          ))}
        </div>
      ) : displayedFilms.length === 0 ? (
        <EmptyState
          icon={<Search size={38} />}
          title={
            films.length > 0 && hasActivePostFilters
              ? "No Results Match Active Filters"
              : `No Results for “${query}”`
          }
          description={
            films.length > 0 && hasActivePostFilters
              ? "Try resetting your Movie/Series or Rated Only filter to view all results on this page."
              : "Check the spelling or try searching with an English or original title."
          }
          actionLabel={
            films.length > 0 && hasActivePostFilters
              ? "Reset Page Filters"
              : "Explore All Films"
          }
          onAction={
            films.length > 0 && hasActivePostFilters
              ? resetPostFilters
              : undefined
          }
          actionHref={
            films.length > 0 && hasActivePostFilters ? undefined : "/explore"
          }
        />
      ) : (
        <div className="film-grid">
          {displayedFilms.map((film, i) => {
            const id = film.kinopoiskId ?? film.filmId ?? i;
            return <FilmCard key={id} film={film} priority={i < 6} />;
          })}
        </div>
      )}

      {query && totalPages > 1 && (
        <Pagination
          page={page}
          totalPages={totalPages}
          buildHref={(p) => `/search?q=${encodeURIComponent(query)}&page=${p}`}
        />
      )}
    </PageContainer>
  );
}
