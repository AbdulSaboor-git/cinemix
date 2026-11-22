"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, ArrowUpRight } from "lucide-react";
import { MatchedPersonSummary } from "@/types/kinopoisk";
import { SemanticSearchAnalysis } from "@/lib/kinopoisk";
import {
  saveRecentSearch,
  SearchSuggestionItem,
} from "@/hooks/useSearchSuggestions";

function highlightMatch(text: string, query: string) {
  const cleanQ = query.trim();
  if (!cleanQ || cleanQ.length < 2) return text;
  const idx = text.toLowerCase().indexOf(cleanQ.toLowerCase());
  if (idx === -1) return text;
  const before = text.slice(0, idx);
  const match = text.slice(idx, idx + cleanQ.length);
  const after = text.slice(idx + cleanQ.length);
  return (
    <>
      {before}
      <span className="text-white font-semibold underline decoration-[var(--accent)] decoration-2 underline-offset-2">
        {match}
      </span>
      {after}
    </>
  );
}

export interface SearchSuggestionDropdownProps {
  suggestions: SearchSuggestionItem[];
  matchedPerson?: MatchedPersonSummary | null;
  semanticMeta?: SemanticSearchAnalysis | null;
  selectedIdx: number;
  sugLoading: boolean;
  search: string;
  onSelect: () => void;
  onQueryPick?: (q: string) => void;
  showSeeAllLink?: boolean;
}

export default function SearchSuggestionDropdown({
  suggestions,
  semanticMeta,
  selectedIdx,
  sugLoading,
  search,
  onSelect,
  onQueryPick,
  showSeeAllLink = true,
}: SearchSuggestionDropdownProps) {
  const router = useRouter();
  const cleanSearch = search.trim();

  if (!sugLoading && suggestions.length === 0) {
    return null;
  }

  const handleSelectItem = (item: SearchSuggestionItem) => {
    saveRecentSearch(item.title);
    if (item.filmId && item.kind !== "person") {
      onSelect();
      router.push(`/film/${item.filmId}`);
      return;
    }
    if (onQueryPick) {
      onQueryPick(item.title);
    } else {
      onSelect();
      router.push(`/explore?q=${encodeURIComponent(item.title)}`);
    }
  };

  const highlightQuery = semanticMeta?.cleanQuery || cleanSearch;

  return (
    <div
      className="absolute top-[calc(100%+8px)] left-0 right-0 w-full min-w-[260px] z-[200] flex flex-col overflow-hidden slide-down bg-[#101014]/98 backdrop-blur-[24px] [-webkit-backdrop-filter:blur(24px)] border border-white/[0.12] rounded-[12px] shadow-[0_24px_64px_rgba(0,0,0,0.88)]"
      onTouchStart={() => {
        if (
          typeof document !== "undefined" &&
          document.activeElement instanceof HTMLElement
        ) {
          document.activeElement.blur();
        }
      }}
    >
      {sugLoading && suggestions.length === 0 && (
        <div className="px-3.5 py-2.5 text-[12px] font-medium text-[var(--text-muted)] flex items-center justify-between">
          <span>Searching…</span>
          <span className="w-2 h-2 rounded-full bg-[var(--accent)] animate-pulse" />
        </div>
      )}

      {suggestions.length > 0 && (
        <div className="flex flex-col w-full max-h-[320px] overflow-y-auto overscroll-contain">
          {suggestions.map((item, i) => {
            const active = i === selectedIdx;
            const isLast = i === suggestions.length - 1 && !showSeeAllLink;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => handleSelectItem(item)}
                className={`w-full text-left flex items-center justify-between gap-2.5 px-3.5 py-2.5 bg-transparent border-0 cursor-pointer select-none transition-colors duration-150 active:scale-[0.99] ${
                  active
                    ? "bg-[var(--bg-elevated)] text-white"
                    : "text-[var(--text)] hover:bg-[var(--bg-elevated)]/90 hover:text-white"
                } ${!isLast ? "border-b border-[var(--border)]" : ""}`}
              >
                <span className="flex items-center gap-2.5 min-w-0 flex-1">
                  <Search
                    size={13}
                    className="text-[var(--text-muted)] flex-shrink-0"
                  />
                  <span className="text-[13.5px] font-medium truncate leading-snug">
                    {highlightMatch(item.title, highlightQuery)}
                  </span>
                </span>
                {item.year ? (
                  <span className="text-[11.5px] text-[var(--text-muted)] flex-shrink-0">
                    {item.year}
                  </span>
                ) : item.kind === "person" ? (
                  <span className="text-[10.5px] text-[var(--text-muted)] flex-shrink-0">
                    Credits
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      )}

      {showSeeAllLink && cleanSearch.length > 0 && (
        <Link
          href={`/explore?q=${encodeURIComponent(cleanSearch)}`}
          onClick={() => {
            saveRecentSearch(cleanSearch);
            onSelect();
          }}
          className="!block w-full no-underline active:!scale-[0.99]"
        >
          <div className="flex items-center justify-between gap-2 px-3.5 py-2.5 text-[12px] font-semibold text-[var(--accent)] bg-[var(--bg-card)] cursor-pointer hover:bg-[var(--bg-elevated)] transition-colors duration-150 border-t border-[var(--border)]">
            <span className="inline-flex items-center gap-1.5 truncate">
              <Search size={12} />
              <span className="truncate">
                {`Search “${cleanSearch}”`}
              </span>
            </span>
            <ArrowUpRight size={13} className="flex-shrink-0" />
          </div>
        </Link>
      )}
    </div>
  );
}
