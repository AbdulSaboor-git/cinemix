"use client";
import Link from "next/link";
import { Search, Star } from "lucide-react";
import { Film } from "@/types/kinopoisk";
import { translateGenre, translateCountry } from "@/lib/translate";
import { useAutoTranslate, useFilmTitle } from "@/hooks/useTranslate";
import PosterImage from "@/components/ui/PosterImage";

interface SuggestionItemProps {
  film: Film;
  active: boolean;
  isLast: boolean;
  autoTranslate: boolean;
  onSelect: () => void;
}

function SuggestionRow({
  film,
  active,
  isLast,
  autoTranslate,
  onSelect,
}: SuggestionItemProps) {
  const id = film.kinopoiskId ?? film.filmId;
  const name = useFilmTitle(film, autoTranslate);
  const rating = film.ratingKinopoisk ?? film.ratingImdb ?? film.rating;
  const poster = film.posterUrlPreview ?? film.posterUrl;

  return (
    <Link href={`/film/${id}`} className="no-underline" onClick={onSelect}>
      <div
        className={`flex items-center gap-[10px] px-[14px] py-[10px] cursor-pointer transition-colors duration-100 ${
          active ? "bg-[var(--bg-elevated)]" : "hover:bg-[var(--bg-elevated)]"
        } ${!isLast ? "border-b border-[var(--border)]" : ""}`}
      >
        <PosterImage
          src={poster}
          alt={name}
          title={name}
          fallbackType="mini"
          className="w-8 h-12 rounded-[4px] overflow-hidden flex-shrink-0 bg-[var(--surface)] relative"
        />
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold text-[var(--text)] truncate">
            {name}
          </p>
          <div className="flex gap-[6px] items-center mt-[2px] flex-wrap">
            {film.year && (
              <span className="text-[11px] text-[var(--text-muted)]">
                {film.year}
              </span>
            )}
            {film.genres?.[0] && (
              <span className="text-[10px] text-[var(--text-muted)] capitalize">
                · {translateGenre(film.genres[0].genre, autoTranslate)}
              </span>
            )}
            {film.countries?.[0] && (
              <span className="hidden sm:inline text-[10px] text-[var(--text-muted)]">
                · {translateCountry(film.countries[0].country, autoTranslate)}
              </span>
            )}
          </div>
        </div>
        {rating !== undefined && rating !== null && (
          <div className="flex items-center gap-[3px] flex-shrink-0">
            <Star size={9} fill="var(--gold)" stroke="var(--gold)" />
            <span className="text-[11px] text-[var(--gold)] font-semibold font-display">
              {typeof rating === "number" ? rating.toFixed(1) : rating}
            </span>
          </div>
        )}
      </div>
    </Link>
  );
}

interface SearchSuggestionDropdownProps {
  suggestions: Film[];
  selectedIdx: number;
  sugLoading: boolean;
  search: string;
  onSelect: () => void;
  showSeeAllLink?: boolean;
}

export default function SearchSuggestionDropdown({
  suggestions,
  selectedIdx,
  sugLoading,
  search,
  onSelect,
  showSeeAllLink = true,
}: SearchSuggestionDropdownProps) {
  const autoTranslate = useAutoTranslate();

  return (
    <div className="absolute top-[calc(100%+8px)] left-0 right-0 z-[200] overflow-hidden slide-down bg-[rgba(15,15,15,0.98)] backdrop-blur-[24px] border border-[var(--border)] rounded-[12px] shadow-[0_20px_60px_rgba(0,0,0,0.7)]">
      {sugLoading && (
        <div className="px-4 py-[10px] text-[11px] text-[var(--text-muted)]">
          Searching…
        </div>
      )}
      {suggestions.map((film, i) => (
        <SuggestionRow
          key={film.kinopoiskId ?? film.filmId ?? i}
          film={film}
          active={i === selectedIdx}
          isLast={i === suggestions.length - 1 && !showSeeAllLink}
          autoTranslate={autoTranslate}
          onSelect={onSelect}
        />
      ))}
      {showSeeAllLink && search.trim().length > 0 && (
        <Link
          href={`/search?q=${encodeURIComponent(search.trim())}`}
          className="no-underline"
          onClick={onSelect}
        >
          <div className="flex items-center gap-[6px] px-[14px] py-[10px] text-[12px] font-semibold text-[var(--accent)] bg-[var(--bg-card)] cursor-pointer hover:bg-[var(--bg-elevated)] transition-colors duration-100">
            <Search size={12} />
            See all results for &ldquo;{search}&rdquo;
          </div>
        </Link>
      )}
    </div>
  );
}
