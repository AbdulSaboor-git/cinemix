"use client";
import Link from "next/link";
import { Search, Star, Film as FilmIcon, Tv, ArrowUpRight } from "lucide-react";
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
  const rawRating = film.ratingImdb ?? film.ratingKinopoisk ?? film.rating;
  const numericRating =
    typeof rawRating === "number"
      ? rawRating
      : typeof rawRating === "string" && !rawRating.endsWith("%")
        ? parseFloat(rawRating)
        : NaN;
  const hasValidRating = !isNaN(numericRating) && numericRating > 0;
  const poster = film.posterUrlPreview ?? film.posterUrl;
  const isSeries =
    film.serial ||
    film.type === "TV_SERIES" ||
    film.type === "MINI_SERIES" ||
    film.type === "TV_SHOW";

  return (
    <Link
      href={`/film/${id}`}
      onClick={onSelect}
      className={`!block w-full no-underline select-none active:!scale-[0.99] transition-colors duration-150 ${
        active ? "bg-[var(--bg-elevated)]" : "hover:bg-[var(--bg-elevated)]/90"
      } ${!isLast ? "border-b border-[var(--border)]" : ""}`}
    >
      <div className="flex items-center gap-3 px-3.5 py-2.5 w-full min-w-0">
        {/* Constrained mini poster container (overrides mini fallback min-h-[90px]) */}
        <div className="w-9 h-[52px] rounded-[6px] overflow-hidden flex-shrink-0 bg-[var(--surface)] relative border border-white/[0.06] [&>*]:!min-h-0">
          <PosterImage
            src={poster}
            alt={name}
            title={name}
            size="sm"
            fallbackType="mini"
            className="w-full h-full relative overflow-hidden bg-[var(--surface)] [&>*]:!min-h-0"
          />
        </div>

        {/* Title & Metadata */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <p className="text-[13px] sm:text-[14px] font-semibold text-[var(--text)] truncate m-0 leading-snug">
              {name}
            </p>
          </div>

          <div className="flex items-center gap-1.5 mt-1 flex-wrap text-[11px] text-[var(--text-muted)] leading-none">
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.4px] text-[var(--text-dim)] bg-white/[0.05] border border-white/[0.06] rounded px-1.5 py-[2px]">
              {isSeries ? <Tv size={9} /> : <FilmIcon size={9} />}
              {isSeries ? "Series" : "Movie"}
            </span>

            {film.year && (
              <span className="font-medium text-[var(--text-dim)]">
                {film.year}
              </span>
            )}

            {film.genres?.[0] && (
              <span className="capitalize truncate max-w-[120px]">
                · {translateGenre(film.genres[0].genre, autoTranslate)}
              </span>
            )}

            {film.countries?.[0] && (
              <span className="hidden sm:inline truncate max-w-[120px]">
                · {translateCountry(film.countries[0].country, autoTranslate)}
              </span>
            )}
          </div>
        </div>

        {/* Right-aligned Rating Badge */}
        <div className="flex items-center gap-2 flex-shrink-0 pl-1">
          {hasValidRating ? (
            <div className="flex items-center gap-1 bg-black/45 border border-[rgba(245,197,24,0.3)] rounded-[6px] px-2 py-0.5">
              <Star size={10} fill="var(--gold)" stroke="var(--gold)" />
              <span className="text-[12px] text-[var(--gold)] font-semibold font-display tracking-[0.5px]">
                {numericRating.toFixed(1)}
              </span>
            </div>
          ) : (
            <ArrowUpRight
              size={14}
              className="text-[var(--text-muted)] opacity-60"
            />
          )}
        </div>
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
    <div className="absolute top-[calc(100%+8px)] left-0 right-0 w-full min-w-[280px] z-[200] flex flex-col overflow-hidden slide-down bg-[#101014]/98 backdrop-blur-[24px] [-webkit-backdrop-filter:blur(24px)] border border-white/[0.1] rounded-[12px] shadow-[0_24px_64px_rgba(0,0,0,0.85)]">
      {sugLoading && (
        <div className="px-3.5 py-2 text-[11px] font-medium text-[var(--text-muted)] border-b border-[var(--border)] flex items-center justify-between">
          <span>Searching catalog…</span>
          <span className="w-2 h-2 rounded-full bg-[var(--accent)] animate-pulse" />
        </div>
      )}

      <div className="flex flex-col w-full max-h-[380px] overflow-y-auto">
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
      </div>

      {showSeeAllLink && search.trim().length > 0 && (
        <Link
          href={`/search?q=${encodeURIComponent(search.trim())}`}
          onClick={onSelect}
          className="!block w-full no-underline active:!scale-[0.99]"
        >
          <div className="flex items-center justify-between gap-2 px-3.5 py-2.5 text-[12px] font-semibold text-[var(--accent)] bg-[var(--bg-card)] cursor-pointer hover:bg-[var(--bg-elevated)] transition-colors duration-150 border-t border-[var(--border)]">
            <span className="inline-flex items-center gap-1.5 truncate">
              <Search size={12} />
              <span className="truncate">
                See all results for &ldquo;{search.trim()}&rdquo;
              </span>
            </span>
            <ArrowUpRight size={13} className="flex-shrink-0" />
          </div>
        </Link>
      )}
    </div>
  );
}
