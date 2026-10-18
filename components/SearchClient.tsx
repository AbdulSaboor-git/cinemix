"use client";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";
import { searchFilms } from "@/lib/kinopoisk";
import { Film } from "@/types/kinopoisk";
import { useSearchSuggestions } from "@/hooks/useSearchSuggestions";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { hasApiKeys } from "@/lib/preferences";
import FilmCard from "@/components/FilmCard";
import Pagination from "@/components/Pagination";
import SearchSuggestionDropdown from "@/components/SearchSuggestionDropdown";
import PageContainer from "@/components/ui/PageContainer";
import PageHeader from "@/components/ui/PageHeader";
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
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

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
  }, [query]);

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
        <div className="relative w-full max-w-[600px]">
          <input
            ref={inputRef}
            value={search}
            onChange={(e) => handleChange(e.target.value)}
            onKeyDown={(e) => handleKeyNav(e, suggestions.length)}
            onFocus={() => suggestions.length > 0 && setSugVisible(true)}
            onBlur={() => setTimeout(() => setSugVisible(false), 250)}
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
        />
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
      ) : films.length === 0 ? (
        <EmptyState
          icon={<Search size={40} />}
          title={`No Results for “${query}”`}
          description="Try a different search term or explore by genre."
          actionLabel="Explore All"
          actionHref="/explore"
        />
      ) : (
        <div className="film-grid">
          {films.map((film, i) => {
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
