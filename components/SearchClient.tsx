"use client";
import { useEffect, useState, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Search, X, SlidersHorizontal, Compass } from "lucide-react";
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
import TabBar from "@/components/ui/TabBar";
import TabPill from "@/components/ui/TabPill";
import EmptyState from "@/components/ui/EmptyState";
import NoKeyBanner from "@/components/ui/NoKeyBanner";

export default function SearchClient({
  q,
  page: pg,
}: {
  q?: string;
  page?: string;
}) {
  const query = q || "";
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
  const [excludeRu, setExcludeRu] = useState(false);
  const [hideUnrated, setHideUnrated] = useState(false);
  const [sortBy, setSortBy] = useState<"RELEVANCE" | "RATING" | "YEAR">(
    "RELEVANCE",
  );

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
    const prefs = getPreferences();
    if (prefs.contentRegionMode === "GLOBAL_FIRST") {
      setExcludeRu(false);
    }
  }, [query]);

  // Outside pointerdown listener replaces fragile 250ms onBlur timeout
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
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [sugVisible, setSugVisible]);

  useEffect(() => {
    if (!hasApiKeys() || !query) return;
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

  const displayedFilms = useMemo(() => {
    const filtered = films.filter((f) => {
      if (mediaFilter === "FILM" && f.type && f.type !== "FILM") return false;
      if (
        mediaFilter === "SERIES" &&
        f.type !== "TV_SERIES" &&
        f.type !== "MINI_SERIES" &&
        f.type !== "TV_SHOW" &&
        !f.serial
      ) {
        return false;
      }
      if (excludeRu && isRussianDomesticFilm(f)) return false;
      if (hideUnrated) {
        const r = f.ratingImdb ?? f.ratingKinopoisk ?? f.rating;
        if (!r || Number(r) <= 0) return false;
      }
      return true;
    });

    if (sortBy === "RATING") {
      return [...filtered].sort((a, b) => {
        const rA = a.ratingImdb ?? a.ratingKinopoisk ?? Number(a.rating || 0);
        const rB = b.ratingImdb ?? b.ratingKinopoisk ?? Number(b.rating || 0);
        return rB - rA;
      });
    }
    if (sortBy === "YEAR") {
      return [...filtered].sort(
        (a, b) => Number(b.year || 0) - Number(a.year || 0),
      );
    }
    return filtered;
  }, [films, mediaFilter, excludeRu, hideUnrated, sortBy]);

  if (noKey) return <NoKeyBanner />;

  const handleChange = (val: string) => {
    setSearch(val);
    if (val !== query) fetchSuggestions(val, 5);
    else clearSuggestions();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedIdx >= 0 && suggestions[selectedIdx]) {
      const film = suggestions[selectedIdx];
      router.push(`/film/${film.kinopoiskId ?? film.filmId}`);
    } else if (search.trim()) {
      router.push(`/search?q=${encodeURIComponent(search.trim())}`);
    }
    clearSuggestions();
  };

  return (
    <PageContainer>
      {/* Search box */}
      <form onSubmit={handleSubmit} className="mb-6 sm:mb-8">
        <div ref={wrapperRef} className="relative w-full max-w-[640px]">
          <input
            ref={inputRef}
            value={search}
            onChange={(e) => handleChange(e.target.value)}
            onKeyDown={(e) => handleKeyNav(e, suggestions.length)}
            onFocus={() => suggestions.length > 0 && setSugVisible(true)}
            placeholder="Search films, series, actors…"
            className="input text-[15px] sm:text-[16px] py-3 pl-10 pr-10 sm:py-3.5 rounded-xl sm:rounded-[14px] w-full"
            autoFocus={!query}
          />
          <Search
            size={16}
            strokeWidth={2.2}
            className={`absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none transition-opacity ${
              sugLoading ? "opacity-100" : "opacity-40"
            }`}
          />
          {search && (
            <button
              type="button"
              onClick={() => {
                setSearch("");
                clearSuggestions();
                inputRef.current?.focus();
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 bg-transparent border-none cursor-pointer text-[var(--text-muted)] p-1 hover:text-[var(--text)] transition-colors min-w-[32px] min-h-[32px] flex items-center justify-center"
              aria-label="Clear search"
            >
              <X size={16} strokeWidth={2.5} />
            </button>
          )}

          {sugVisible && suggestions.length > 0 && (
            <SearchSuggestionDropdown
              suggestions={suggestions}
              selectedIdx={selectedIdx}
              sugLoading={sugLoading}
              search={search}
              showSeeAllLink={false}
              onSelect={() => clearSuggestions()}
            />
          )}
        </div>
      </form>

      {/* Query header */}
      {query && (
        <PageHeader
          eyebrow="Results for"
          title={`“${query}”`}
          subtitle={
            total > 0 && !loading
              ? `${total.toLocaleString()} result${total !== 1 ? "s" : ""} found`
              : undefined
          }
          rightSlot={
            <Link
              href={`/explore?keyword=${encodeURIComponent(query)}`}
              className="no-underline"
            >
              <span className="btn btn-ghost py-2 px-3.5 text-[12px]">
                <Compass size={13} />
                Open in Advanced Explore
              </span>
            </Link>
          }
        />
      )}

      {/* Post-Search Filter & Sort Bar */}
      {query && !loading && films.length > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 bg-[var(--bg-card)] border border-[var(--border)] rounded-[12px] p-3">
          <div className="flex items-center gap-2 flex-wrap">
            <TabBar>
              <TabPill
                active={mediaFilter === "ALL"}
                onClick={() => setMediaFilter("ALL")}
              >
                All ({films.length})
              </TabPill>
              <TabPill
                active={mediaFilter === "FILM"}
                onClick={() => setMediaFilter("FILM")}
              >
                Movies
              </TabPill>
              <TabPill
                active={mediaFilter === "SERIES"}
                onClick={() => setMediaFilter("SERIES")}
              >
                Series
              </TabPill>
            </TabBar>

            <button
              type="button"
              onClick={() => setExcludeRu((v) => !v)}
              className={`px-3 py-1.5 rounded-[8px] text-[12px] font-semibold border cursor-pointer ${
                excludeRu
                  ? "bg-[var(--accent-dim)] border-[var(--accent)] text-white"
                  : "bg-[var(--bg-elevated)] border-[var(--border)] text-[var(--text-dim)] hover:text-white"
              }`}
            >
              Exclude Russian
            </button>

            <button
              type="button"
              onClick={() => setHideUnrated((v) => !v)}
              className={`px-3 py-1.5 rounded-[8px] text-[12px] font-semibold border cursor-pointer ${
                hideUnrated
                  ? "bg-[var(--accent-dim)] border-[var(--accent)] text-white"
                  : "bg-[var(--bg-elevated)] border-[var(--border)] text-[var(--text-dim)] hover:text-white"
              }`}
            >
              Rated Only
            </button>
          </div>

          <div className="flex items-center gap-2">
            <SlidersHorizontal size={13} className="text-[var(--text-muted)]" />
            <select
              value={sortBy}
              onChange={(e) =>
                setSortBy(e.target.value as "RELEVANCE" | "RATING" | "YEAR")
              }
              className="select text-[12px] py-1.5 px-3 rounded-[8px]"
            >
              <option value="RELEVANCE">Sort: Best Match</option>
              <option value="RATING">Sort: Highest Rating</option>
              <option value="YEAR">Sort: Newest Year</option>
            </select>
          </div>
        </div>
      )}

      {/* Results */}
      {!query ? (
        <EmptyState
          icon={<Search size={44} />}
          title="Type to Start Searching"
          description="Search for films, TV series, actors, and more."
        />
      ) : loading ? (
        <div className="film-grid">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="skeleton aspect-[2/3] rounded-[12px]" />
          ))}
        </div>
      ) : displayedFilms.length === 0 ? (
        <EmptyState
          icon={<Search size={40} />}
          title={`No Results for “${query}”`}
          description="Try clearing your post-search filters or explore by genre."
          actionLabel="Explore All"
          actionHref="/explore"
        />
      ) : (
        <div className="film-grid">
          {displayedFilms.map((film, i) => {
            const id = film.kinopoiskId ?? film.filmId ?? i;
            return <FilmCard key={id} film={film} />;
          })}
        </div>
      )}

      {query && (
        <Pagination
          page={page}
          totalPages={totalPages}
          buildHref={(p) => `/search?q=${encodeURIComponent(query)}&page=${p}`}
        />
      )}
    </PageContainer>
  );
}
