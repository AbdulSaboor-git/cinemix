"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { getFilmsByFilter, getFilters } from "@/lib/kinopoisk";
import { Film, Genre, Country } from "@/types/kinopoisk";
import { translateGenre, translateCountry } from "@/lib/translate";
import FilmCard from "@/components/FilmCard";
import Pagination from "@/components/Pagination";
import Link from "next/link";
import { getPreferences } from "@/lib/preferences";
import { useAutoTranslate } from "@/hooks/useTranslate";

const TYPES = [
  // { value: "ALL", label: "All" },
  { value: "FILM", label: "Movies" },
  { value: "TV_SERIES", label: "Series" },
  { value: "TV_SHOW", label: "TV Shows" },
  { value: "MINI_SERIES", label: "Mini Series" },
];
const ORDERS = [
  { value: "RATING", label: "Top Rated" },
  { value: "NUM_VOTE", label: "Most Voted" },
  { value: "YEAR", label: "Newest First" },
];
const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: 80 }, (_, i) => CURRENT_YEAR + 1 - i);
const RATING_OPTIONS = [9, 8, 7, 6, 5, 4];

interface Props {
  type?: string;
  order?: string;
  page?: string;
  genres?: string;
  countries?: string;
  ratingFrom?: string;
  ratingTo?: string;
  yearFrom?: string;
  yearTo?: string;
}

export default function BrowseClient({
  type: tp,
  order: ord,
  page: pg,
  genres: genreParam,
  countries: countryParam,
  ratingFrom: rfParam,
  ratingTo: rtParam,
  yearFrom: yfParam,
  yearTo: ytParam,
}: Props) {
  type FilmType = "ALL" | "FILM" | "TV_SERIES" | "TV_SHOW" | "MINI_SERIES";
  type OrderType = "RATING" | "NUM_VOTE" | "YEAR";

  const page = Math.max(1, parseInt(pg || "1"));

  // Parse numeric values — may be undefined if param is a name string
  const parsedGenreId =
    genreParam && !isNaN(Number(genreParam)) ? parseInt(genreParam) : undefined;
  const parsedCountryId =
    countryParam && !isNaN(Number(countryParam))
      ? parseInt(countryParam)
      : undefined;

  const ratingFrom = rfParam ? parseInt(rfParam) : undefined;
  const ratingTo = rtParam ? parseInt(rtParam) : undefined;
  const yearFrom = yfParam ? parseInt(yfParam) : undefined;
  const yearTo = ytParam ? parseInt(ytParam) : undefined;

  const [films, setFilms] = useState<Film[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [genres, setGenres] = useState<Genre[]>([]);
  const [countries, setCountries] = useState<Country[]>([]);

  // Resolved IDs — may be resolved from a name string
  const [resolvedGenreId, setResolvedGenreId] = useState<number | undefined>(
    parsedGenreId,
  );
  const [resolvedCountryId, setResolvedCountryId] = useState<
    number | undefined
  >(parsedCountryId);

  // Mobile filter drawer state
  const [filterOpen, setFilterOpen] = useState(false);
  const router = useRouter();
  const autoTranslate = useAutoTranslate();

  // Load filters and resolve name→id if params are strings
  useEffect(() => {
    // Reset to parsed values first (handles numeric params immediately)
    setResolvedGenreId(parsedGenreId);
    setResolvedCountryId(parsedCountryId);

    getFilters()
      .then((f) => {
        setGenres(f.genres);
        setCountries(f.countries);

        // Resolve country name → id
        if (countryParam && isNaN(Number(countryParam))) {
          const match = f.countries.find(
            (c) => c.country.toLowerCase() === countryParam.toLowerCase(),
          );
          if (match) setResolvedCountryId(match.id);
        }

        // Resolve genre name → id
        if (genreParam && isNaN(Number(genreParam))) {
          const match = f.genres.find(
            (g) => g.genre.toLowerCase() === genreParam.toLowerCase(),
          );
          if (match) setResolvedGenreId(match.id);
        }
      })
      .catch(() => {});
  }, [countryParam, genreParam, parsedCountryId, parsedGenreId]);

  // Prefs for defaults when URL params are absent
  const [ready, setReady] = useState(false);
  const [prefType, setPrefType] = useState<FilmType>("ALL");
  const [prefOrder, setPrefOrder] = useState<OrderType>("RATING");

  // Resolved values — use URL params first, then prefs, then defaults
  const type = (tp || prefType) as FilmType;
  const order = (ord || prefOrder) as OrderType;

  useEffect(() => {
    const prefs = getPreferences();
    setPrefType((prefs.defaultExploreType as FilmType) || "ALL");
    setPrefOrder((prefs.defaultExploreOrder as OrderType) || "RATING");
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    // Wait until name params are resolved before fetching
    if (
      (genreParam &&
        !isNaN(Number(genreParam)) === false &&
        resolvedGenreId === undefined &&
        genreParam) ||
      (countryParam &&
        isNaN(Number(countryParam)) &&
        resolvedCountryId === undefined)
    ) {
      // Still resolving name → id, skip fetch for now
      return;
    }

    setLoading(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
    getFilmsByFilter({
      type:
        type === "ALL"
          ? undefined
          : (type as "FILM" | "TV_SERIES" | "TV_SHOW" | "MINI_SERIES"),
      order,
      page,
      genres: resolvedGenreId,
      countries: resolvedCountryId,
      ratingFrom,
      ratingTo,
      yearFrom,
      yearTo,
    })
      .then((d) => {
        setFilms(d.items ?? []);
        setTotalPages(d.totalPages ?? 1);
        setTotal(d.total ?? 0);
      })
      .catch(() => {
        setFilms([]);
        setTotalPages(1);
      })
      .finally(() => setLoading(false));
  }, [
    ready,
    type,
    order,
    page,
    resolvedGenreId,
    resolvedCountryId,
    ratingFrom,
    ratingTo,
    yearFrom,
    yearTo,
    genreParam,
    countryParam,
  ]);

  const buildHref = useCallback(
    (p: number) => {
      const params = new URLSearchParams();
      if (type !== "ALL") params.set("type", type);
      if (order !== "RATING") params.set("order", order);
      if (resolvedGenreId) params.set("genres", String(resolvedGenreId));
      if (resolvedCountryId) params.set("countries", String(resolvedCountryId));
      if (ratingFrom) params.set("ratingFrom", String(ratingFrom));
      if (ratingTo) params.set("ratingTo", String(ratingTo));
      if (yearFrom) params.set("yearFrom", String(yearFrom));
      if (yearTo) params.set("yearTo", String(yearTo));
      params.set("page", String(p));
      return `/explore?${params.toString()}`;
    },
    [
      type,
      order,
      resolvedGenreId,
      resolvedCountryId,
      ratingFrom,
      ratingTo,
      yearFrom,
      yearTo,
    ],
  );

  const buildFilterHref = useCallback(
    (overrides: Record<string, string | undefined>) => {
      const merged: Record<string, string | undefined> = {
        type: type !== "ALL" ? type : undefined,
        order: order !== "RATING" ? order : undefined,
        genres: resolvedGenreId ? String(resolvedGenreId) : undefined,
        countries: resolvedCountryId ? String(resolvedCountryId) : undefined,
        ratingFrom: ratingFrom ? String(ratingFrom) : undefined,
        ratingTo: ratingTo ? String(ratingTo) : undefined,
        yearFrom: yearFrom ? String(yearFrom) : undefined,
        yearTo: yearTo ? String(yearTo) : undefined,
        ...overrides,
      };
      const params = new URLSearchParams();
      Object.entries(merged).forEach(([k, v]) => {
        if (v !== undefined) params.set(k, v);
      });
      return `/explore?${params.toString()}`;
    },
    [
      type,
      order,
      resolvedGenreId,
      resolvedCountryId,
      ratingFrom,
      ratingTo,
      yearFrom,
      yearTo,
    ],
  );

  const activeFilterCount = [
    resolvedGenreId,
    resolvedCountryId,
    ratingFrom,
    ratingTo,
    yearFrom,
    yearTo,
  ].filter(Boolean).length;

  const title = TYPES.find((t) => t.value === type)?.label || "Explore";

  const activeFilterTags: { label: string; clearKey: string }[] = [];
  if (resolvedGenreId) {
    const g = genres.find((g) => g.id === resolvedGenreId);
    activeFilterTags.push({
      label: g
        ? translateGenre(g.genre, autoTranslate) || g.genre
        : `Genre #${resolvedGenreId}`,
      clearKey: "genres",
    });
  }
  if (resolvedCountryId) {
    const c = countries.find((c) => c.id === resolvedCountryId);
    activeFilterTags.push({
      label: c
        ? translateCountry(c.country, autoTranslate) || c.country
        : `Country #${resolvedCountryId}`,
      clearKey: "countries",
    });
  }
  if (ratingFrom)
    activeFilterTags.push({
      label: `${ratingFrom}+ ★`,
      clearKey: "ratingFrom",
    });
  if (ratingTo)
    activeFilterTags.push({ label: `≤ ${ratingTo} ★`, clearKey: "ratingTo" });
  if (yearFrom)
    activeFilterTags.push({ label: `From ${yearFrom}`, clearKey: "yearFrom" });
  if (yearTo)
    activeFilterTags.push({ label: `To ${yearTo}`, clearKey: "yearTo" });

  // Shared filter selects — rendered in both drawer (mobile) and bar (desktop)
  const FilterSelects = ({ onAfterChange }: { onAfterChange?: () => void }) => (
    <>
      <select
        className="select w-full sm:w-auto"
        value={order}
        onChange={(e) => {
          router.push(
            buildFilterHref({ order: e.target.value, page: undefined }),
          );
          onAfterChange?.();
        }}
      >
        {ORDERS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <select
        className="select w-full sm:w-auto"
        value={resolvedGenreId || ""}
        onChange={(e) => {
          router.push(
            buildFilterHref({
              genres: e.target.value || undefined,
              page: undefined,
            }),
          );
          onAfterChange?.();
        }}
      >
        <option value="">All Genres</option>
        {genres
          .filter((g) => g.id !== 28 && g.id !== 25)
          .map((g) => (
            <option key={g.id} value={g.id}>
              {translateGenre(g.genre, autoTranslate) || g.genre}
            </option>
          ))}
      </select>
      <select
        className="select w-full sm:w-auto"
        value={resolvedCountryId || ""}
        onChange={(e) => {
          router.push(
            buildFilterHref({
              countries: e.target.value || undefined,
              page: undefined,
            }),
          );
          onAfterChange?.();
        }}
      >
        <option value="">All Countries</option>
        {countries.map((c) => (
          <option key={c.id} value={c.id}>
            {translateCountry(c.country, autoTranslate) || c.country}
          </option>
        ))}
      </select>
      <select
        className="select w-full sm:w-auto"
        value={ratingFrom || ""}
        onChange={(e) => {
          router.push(
            buildFilterHref({
              ratingFrom: e.target.value || undefined,
              page: undefined,
            }),
          );
          onAfterChange?.();
        }}
      >
        <option value="">Min Rating</option>
        {RATING_OPTIONS.map((r) => (
          <option key={r} value={r}>
            {r}+ ★
          </option>
        ))}
      </select>
      <select
        className="select w-full sm:w-auto"
        value={yearFrom || ""}
        onChange={(e) => {
          router.push(
            buildFilterHref({
              yearFrom: e.target.value || undefined,
              page: undefined,
            }),
          );
          onAfterChange?.();
        }}
      >
        <option value="">From Year</option>
        {YEAR_OPTIONS.map((y) => (
          <option key={y} value={y}>
            {y}
          </option>
        ))}
      </select>
      <select
        className="select w-full sm:w-auto"
        value={yearTo || ""}
        onChange={(e) => {
          router.push(
            buildFilterHref({
              yearTo: e.target.value || undefined,
              page: undefined,
            }),
          );
          onAfterChange?.();
        }}
      >
        <option value="">To Year</option>
        {YEAR_OPTIONS.map((y) => (
          <option key={y} value={y}>
            {y}
          </option>
        ))}
      </select>
    </>
  );

  return (
    <div className="min-h-screen pb-20">
      {/* ── Page header ── */}
      <div className="px-4 sm:px-[var(--page-x)] pt-7 sm:pt-10 pb-5 sm:pb-8">
        <p className="text-[11px] text-[var(--text-muted)] uppercase tracking-[2px] mb-1 sm:mb-2">
          Explore
        </p>
        <div className="flex items-end justify-between flex-wrap gap-2 sm:gap-3">
          <h1
            suppressHydrationWarning
            className="font-display uppercase leading-none tracking-[2px]"
            style={{ fontSize: "clamp(28px, 6vw, 60px)" }}
          >
            {title}
          </h1>
          {total > 0 && !loading && (
            <span className="text-[12px] sm:text-[13px] text-[var(--text-muted)] pb-1">
              {total.toLocaleString()} titles
            </span>
          )}
        </div>
      </div>

      {/* ── Type tabs — horizontal scroll on mobile ── */}
      <div className="px-4 sm:px-[var(--page-x)] mb-4 sm:mb-5">
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {TYPES.map((t) => (
            <Link
              key={t.value}
              href={buildFilterHref({
                type: t.value === "ALL" ? undefined : t.value,
                page: undefined,
              })}
              className="no-underline shrink-0"
            >
              <button
                className={`px-3 sm:px-4 py-[8px] sm:py-[9px] rounded-[8px] text-[12px] sm:text-[13px] font-semibold cursor-pointer transition-all duration-[180ms] whitespace-nowrap
                  ${
                    type === t.value
                      ? "bg-[var(--accent)] text-white border border-[var(--accent)]"
                      : "bg-[var(--bg-elevated)] text-[var(--text-dim)] border border-[var(--border)] hover:border-[var(--border-hover)] hover:text-[var(--text)]"
                  }`}
              >
                {t.label}
              </button>
            </Link>
          ))}
        </div>
      </div>

      {/* ── Filter bar — desktop: inline row | mobile: toggle button + drawer ── */}
      <div className="px-4 sm:px-[var(--page-x)] mb-5 sm:mb-6">
        {/* Mobile: filter toggle button */}
        <div className="flex items-center gap-2 sm:hidden mb-3">
          <button
            onClick={() => setFilterOpen((v) => !v)}
            className={`flex items-center gap-2 px-4 py-[9px] rounded-[8px] text-[13px] font-semibold border transition-all duration-[180ms]
              ${
                filterOpen || activeFilterCount > 0
                  ? "bg-[var(--accent-dim)] border-[rgba(229,9,20,0.4)] text-[var(--accent)]"
                  : "bg-[var(--bg-elevated)] border-[var(--border)] text-[var(--text-dim)]"
              }`}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
            >
              <line x1="4" y1="6" x2="20" y2="6" />
              <line x1="8" y1="12" x2="16" y2="12" />
              <line x1="11" y1="18" x2="13" y2="18" />
            </svg>
            Filters
            {activeFilterCount > 0 && (
              <span className="bg-[var(--accent)] text-white text-[10px] font-bold rounded-full w-[18px] h-[18px] flex items-center justify-center leading-none">
                {activeFilterCount}
              </span>
            )}
          </button>

          {activeFilterCount > 0 && (
            <Link
              href={`/explore${type !== "ALL" ? `?type=${type}` : ""}`}
              className="no-underline"
            >
              <button className="btn btn-ghost py-[9px] px-3 text-[12px]">
                <svg
                  width="11"
                  height="11"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
                Clear
              </button>
            </Link>
          )}
        </div>

        {/* Mobile: collapsible filter drawer */}
        {filterOpen && (
          <div className="sm:hidden flex flex-col gap-2 mb-3 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-[12px] p-4">
            <FilterSelects onAfterChange={() => setFilterOpen(false)} />
          </div>
        )}

        {/* Desktop: inline filter row */}
        <div className="hidden sm:flex flex-wrap gap-2 items-center">
          <FilterSelects />
          {activeFilterCount > 0 && (
            <Link
              href={`/explore${type !== "ALL" ? `?type=${type}` : ""}`}
              className="no-underline"
            >
              <button className="btn btn-ghost py-[9px] px-4 text-[12px]">
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
                Clear ({activeFilterCount})
              </button>
            </Link>
          )}
        </div>

        {/* Active filter chips */}
        {activeFilterTags.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3">
            {activeFilterTags.map((tag) => (
              <Link
                key={tag.clearKey}
                href={buildFilterHref({
                  [tag.clearKey]: undefined,
                  page: undefined,
                })}
                className="no-underline"
              >
                <span className="inline-flex items-center gap-[5px] text-[11px] sm:text-[12px] text-[var(--text-dim)] bg-[var(--accent-dim)] border border-[rgba(229,9,20,0.25)] rounded-full px-3 py-1 cursor-pointer hover:border-[var(--accent)] transition-colors">
                  {tag.label}
                  <svg
                    width="10"
                    height="10"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                  >
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* ── Film grid ── */}
      <div className="px-4 sm:px-[var(--page-x)]">
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
          <div className="flex flex-col items-center justify-center py-24 sm:py-32 gap-4 text-[var(--text-dim)]">
            <svg
              width="48"
              height="48"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--text-muted)"
              strokeWidth="1.5"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
            <p className="text-[16px] sm:text-[18px] font-medium">
              No results found
            </p>
            <p className="text-[12px] sm:text-[13px] text-[var(--text-muted)]">
              Try adjusting the filters
            </p>
          </div>
        ) : (
          <div className="film-grid">
            {films.map((film, i) => (
              <FilmCard
                key={film.kinopoiskId ?? film.filmId ?? i}
                film={film}
                variant="grid"
              />
            ))}
          </div>
        )}
      </div>

      <Pagination page={page} totalPages={totalPages} buildHref={buildHref} />
    </div>
  );
}
