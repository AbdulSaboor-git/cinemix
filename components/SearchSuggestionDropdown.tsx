"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Search,
  Star,
  Film as FilmIcon,
  Tv,
  ArrowUpRight,
  Sparkles,
  Play,
  User,
  Calendar,
} from "lucide-react";
import { Film, MatchedPersonSummary } from "@/types/kinopoisk";
import { SemanticSearchAnalysis } from "@/lib/kinopoisk";
import { translateGenre, translateCountry, isRussian } from "@/lib/translate";
import { useAutoTranslate, useFilmTitle, useTranslate } from "@/hooks/useTranslate";
import { saveRecentSearch } from "@/hooks/useSearchSuggestions";
import PosterImage from "@/components/ui/PosterImage";

interface SuggestionItemProps {
  film: Film;
  query: string;
  active: boolean;
  isLast: boolean;
  autoTranslate: boolean;
  onSelect: () => void;
}

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
      <span className="text-white underline decoration-[var(--accent)] decoration-2 underline-offset-2">
        {match}
      </span>
      {after}
    </>
  );
}

function SuggestionRow({
  film,
  query,
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
    <div
      className={`group flex items-center gap-3 px-3.5 py-2 w-full min-w-0 select-none transition-colors duration-150 ${
        active ? "bg-[var(--bg-elevated)]" : "hover:bg-[var(--bg-elevated)]/90"
      } ${!isLast ? "border-b border-[var(--border)]" : ""}`}
    >
      <Link
        href={`/film/${id}`}
        onClick={() => {
          saveRecentSearch(name);
          onSelect();
        }}
        className="flex items-center gap-3 flex-1 min-w-0 no-underline active:scale-[0.99] transition-transform"
      >
        {/* Fast Direct Thumbnail */}
        <div className="w-9 h-[52px] rounded-[6px] overflow-hidden flex-shrink-0 bg-[var(--surface)] relative border border-white/[0.08] [&>*]:!min-h-0">
          <PosterImage
            src={poster}
            alt={name}
            title={name}
            filmId={id}
            imdbId={film.imdbId}
            year={film.year ?? film.startYear}
            size="sm"
            fallbackType="mini"
            disableEnglishLookup
            className="w-full h-full relative overflow-hidden bg-[var(--surface)] [&>*]:!min-h-0"
          />
        </div>

        {/* Title & Metadata */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <p className="text-[13px] sm:text-[13.5px] font-semibold text-[var(--text)] group-hover:text-white truncate m-0 leading-snug">
              {highlightMatch(name, query)}
            </p>
          </div>

          <div className="flex items-center gap-1.5 mt-1 flex-wrap text-[11px] text-[var(--text-muted)] leading-none">
            <span className="inline-flex items-center gap-1 text-[9.5px] font-bold uppercase tracking-[0.4px] text-[var(--text-dim)] bg-white/[0.05] border border-white/[0.07] rounded px-1.5 py-[2px]">
              {isSeries ? <Tv size={9} /> : <FilmIcon size={9} />}
              {isSeries ? "Series" : "Movie"}
            </span>

            {(film.year || film.startYear) && (
              <span className="font-medium text-[var(--text-dim)]">
                {film.year || film.startYear}
              </span>
            )}

            {film.genres?.[0] && (
              <span className="capitalize truncate max-w-[115px]">
                · {translateGenre(film.genres[0].genre, autoTranslate)}
              </span>
            )}

            {film.countries?.[0] && (
              <span className="hidden sm:inline truncate max-w-[110px]">
                · {translateCountry(film.countries[0].country, autoTranslate)}
              </span>
            )}
          </div>
        </div>
      </Link>

      {/* Right-aligned Rating Badge + Quick Watch Action */}
      <div className="flex items-center gap-1.5 flex-shrink-0 pl-1">
        {hasValidRating && (
          <div className="flex items-center gap-1 bg-black/45 border border-[rgba(245,197,24,0.3)] rounded-[6px] px-1.5 py-0.5">
            <Star size={10} fill="var(--gold)" stroke="var(--gold)" />
            <span className="text-[11.5px] text-[var(--gold)] font-semibold font-display tracking-[0.5px]">
              {numericRating.toFixed(1)}
            </span>
          </div>
        )}

        <Link
          href={`/watch/${id}`}
          onClick={() => {
            saveRecentSearch(name);
            onSelect();
          }}
          title={`Watch ${name} now`}
          aria-label={`Watch ${name}`}
          className="w-7 h-7 rounded-full bg-white/[0.06] hover:bg-[var(--accent)] text-[var(--text-dim)] hover:text-white border border-white/[0.08] flex items-center justify-center no-underline transition-all active:scale-90"
        >
          <Play size={11} fill="currentColor" className="ml-[1px]" />
        </Link>
      </div>
    </div>
  );
}

export interface SearchSuggestionDropdownProps {
  suggestions: Film[];
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
  matchedPerson,
  semanticMeta,
  selectedIdx,
  sugLoading,
  search,
  onSelect,
  onQueryPick,
  showSeeAllLink = true,
}: SearchSuggestionDropdownProps) {
  const autoTranslate = useAutoTranslate();
  const router = useRouter();

  const rawPersonName =
    autoTranslate && matchedPerson?.nameEn && !isRussian(matchedPerson.nameEn)
      ? matchedPerson.nameEn
      : matchedPerson?.nameRu || matchedPerson?.nameEn || "";
  const personName = useTranslate(rawPersonName) || rawPersonName;
  const personProf = useTranslate(matchedPerson?.profession);

  const corrected = semanticMeta?.correctedQuery;
  const concept = semanticMeta?.matchedConcept;
  const targetYear = semanticMeta?.targetYear;
  const relatedPills = semanticMeta?.relatedTerms ?? [];
  const hasTopStrip = Boolean(
    corrected || concept || targetYear || relatedPills.length > 0,
  );

  if (
    !sugLoading &&
    suggestions.length === 0 &&
    !hasTopStrip &&
    !matchedPerson
  ) {
    return null;
  }

  const handlePickTerm = (term: string) => {
    saveRecentSearch(term);
    if (onQueryPick) {
      onQueryPick(term);
    } else {
      onSelect();
      router.push(`/search?q=${encodeURIComponent(term)}`);
    }
  };

  return (
    <div className="absolute top-[calc(100%+8px)] left-0 right-0 w-full min-w-[280px] z-[200] flex flex-col overflow-hidden slide-down bg-[#101014]/98 backdrop-blur-[24px] [-webkit-backdrop-filter:blur(24px)] border border-white/[0.12] rounded-[12px] shadow-[0_24px_64px_rgba(0,0,0,0.88)]">
      {/* Tier 1: Instant Query, Year Filter & Semantic Concept Strip */}
      {hasTopStrip && (
        <div className="px-3 py-2 bg-white/[0.02] border-b border-[var(--border)] flex flex-col gap-1.5">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            {corrected && (
              <div className="flex items-center gap-1.5 text-[11.5px] text-[var(--text-dim)]">
                <Sparkles size={11} className="text-[var(--accent)] shrink-0" />
                <span>Showing smart matches for</span>
                <button
                  type="button"
                  onClick={() => handlePickTerm(corrected)}
                  className="font-bold text-white hover:text-[var(--accent)] underline bg-transparent border-none cursor-pointer p-0"
                >
                  {corrected}
                </button>
              </div>
            )}

            {targetYear && (
              <span className="inline-flex items-center gap-1 text-[10.5px] font-semibold text-[#60a5fa] bg-[rgba(96,165,250,0.12)] border border-[rgba(96,165,250,0.3)] rounded-md px-2 py-0.5">
                <Calendar size={10} />
                Release Year: {targetYear}
              </span>
            )}
          </div>

          {concept && (
            <div className="flex items-center justify-between gap-2 text-[11px] text-[#f5c518] bg-[rgba(245,197,24,0.08)] border border-[rgba(245,197,24,0.22)] rounded-[7px] px-2.5 py-1">
              <span className="inline-flex items-center gap-1.5 font-semibold truncate">
                <Sparkles size={11} />
                <span>Theme: {concept.label}</span>
              </span>
              {concept.genreIds?.[0] && (
                <Link
                  href={`/explore?genres=${concept.genreIds.join(",")}&genreMode=OR`}
                  onClick={onSelect}
                  className="text-[10.5px] font-bold text-white hover:underline no-underline shrink-0"
                >
                  Explore Theme →
                </Link>
              )}
            </div>
          )}

          {relatedPills.length > 0 && (
            <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-0.5">
              <span className="text-[10px] uppercase tracking-[0.6px] text-[var(--text-muted)] font-bold shrink-0">
                Try:
              </span>
              {relatedPills.slice(0, 4).map((term) => (
                <button
                  key={term}
                  type="button"
                  onClick={() => handlePickTerm(term)}
                  className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-[var(--bg-elevated)] hover:bg-[var(--accent-dim)] border border-[var(--border)] hover:border-[var(--accent)] text-[var(--text-dim)] hover:text-white cursor-pointer whitespace-nowrap transition-colors"
                >
                  {term}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Matched Actor / Director Quick Banner */}
      {matchedPerson && (
        <div className="px-3.5 py-2 bg-[rgba(229,9,20,0.08)] border-b border-[var(--border)] flex items-center justify-between gap-2.5">
          <Link
            href={`/person/${matchedPerson.personId}`}
            onClick={() => {
              if (personName) saveRecentSearch(personName);
              onSelect();
            }}
            className="flex items-center gap-2.5 min-w-0 flex-1 no-underline group"
          >
            <div className="w-8 h-10 rounded-[6px] overflow-hidden flex-shrink-0 bg-[var(--surface)] border border-white/15 relative">
              <PosterImage
                src={matchedPerson.posterUrl}
                alt={personName}
                title={personName}
                fallbackType="person"
                disableEnglishLookup
                className="w-full h-full relative overflow-hidden bg-[var(--surface)]"
              />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="text-[9.5px] font-bold uppercase tracking-[0.5px] text-[var(--accent)] bg-[rgba(229,9,20,0.18)] border border-[rgba(229,9,20,0.35)] rounded px-1.5 py-[1px] inline-flex items-center gap-1">
                  <User size={9} />
                  Person
                </span>
                <p className="text-[13px] font-bold text-white group-hover:text-[var(--accent)] truncate m-0">
                  {personName}
                </p>
              </div>
              <p className="text-[11px] text-[var(--text-muted)] truncate m-0 mt-0.5">
                {personProf ? `${personProf} · ` : ""}
                {matchedPerson.creditsCount} credits listed below
              </p>
            </div>
          </Link>
          <Link
            href={`/person/${matchedPerson.personId}`}
            onClick={onSelect}
            className="text-[11px] font-semibold text-white bg-white/[0.08] hover:bg-[var(--accent)] border border-white/15 rounded-[7px] px-2.5 py-1 no-underline whitespace-nowrap transition-colors"
          >
            Profile →
          </Link>
        </div>
      )}

      {sugLoading && suggestions.length === 0 && (
        <div className="px-3.5 py-2.5 text-[11.5px] font-medium text-[var(--text-muted)] border-b border-[var(--border)] flex items-center justify-between">
          <span>Searching catalog…</span>
          <span className="w-2 h-2 rounded-full bg-[var(--accent)] animate-pulse" />
        </div>
      )}

      {/* Tier 2: Rich Visual Title & Credit Matches */}
      {suggestions.length > 0 && (
        <div className="flex flex-col w-full max-h-[360px] overflow-y-auto">
          {suggestions.map((film, i) => (
            <SuggestionRow
              key={film.kinopoiskId ?? film.filmId ?? i}
              film={film}
              query={corrected || semanticMeta?.cleanQuery || search}
              active={i === selectedIdx}
              isLast={i === suggestions.length - 1 && !showSeeAllLink}
              autoTranslate={autoTranslate}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}

      {showSeeAllLink && search.trim().length > 0 && (
        <Link
          href={`/search?q=${encodeURIComponent(search.trim())}`}
          onClick={() => {
            saveRecentSearch(search.trim());
            onSelect();
          }}
          className="!block w-full no-underline active:!scale-[0.99]"
        >
          <div className="flex items-center justify-between gap-2 px-3.5 py-2.5 text-[12px] font-semibold text-[var(--accent)] bg-[var(--bg-card)] cursor-pointer hover:bg-[var(--bg-elevated)] transition-colors duration-150 border-t border-[var(--border)]">
            <span className="inline-flex items-center gap-1.5 truncate">
              <Search size={12} />
              <span className="truncate">
                {matchedPerson
                  ? `See all ${matchedPerson.creditsCount} credits for “${personName || search.trim()}”`
                  : `See all results for “${search.trim()}”`}
              </span>
            </span>
            <ArrowUpRight size={13} className="flex-shrink-0" />
          </div>
        </Link>
      )}
    </div>
  );
}
