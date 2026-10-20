"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ListFilter, X, Search } from "lucide-react";
import { getFilmsByFilter, getFilters } from "@/lib/kinopoisk";
import { Film, Genre, Country } from "@/types/kinopoisk";
import { translateGenre, translateCountry } from "@/lib/translate";
import FilmCard from "@/components/FilmCard";
import Pagination from "@/components/Pagination";
import PageContainer from "@/components/ui/PageContainer";
import PageHeader from "@/components/ui/PageHeader";
import TabBar from "@/components/ui/TabBar";
import TabPill from "@/components/ui/TabPill";
import EmptyState from "@/components/ui/EmptyState";
import NoKeyBanner from "@/components/ui/NoKeyBanner";
import { getPreferences, hasApiKeys } from "@/lib/preferences";
import { useAutoTranslate } from "@/hooks/useTranslate";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";

const TYPES = [
  { value: "ALL", label: "All" },
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
const YEAR_OPTIONS = Array.from({ length: 80 }, (_, i) => CURRENT_YEAR + -i);
const RATING_OPTIONS = [9, 8, 7, 6, 5, 4];

type FilmType = "ALL" | "FILM" | "TV_SERIES" | "TV_SHOW" | "MINI_SERIES";
type OrderType = "RATING" | "NUM_VOTE" | "YEAR";

interface FilterSelectsProps {
  order: OrderType;
  resolvedGenreId?: number;
  resolvedCountryId?: number;
  ratingFrom?: number;
  yearFrom?: number;
  yearTo?: number;
  genres: Genre[];
  countries: Country[];
  autoTranslate: boolean;
  onFilterChange: (overrides: Record<string, string | undefined>) => void;
}

function FilterSelects({
  order,
  resolvedGenreId,
  resolvedCountryId,
  ratingFrom,
  yearFrom,
  yearTo,
  genres,
  countries,
  autoTranslate,
  onFilterChange,
}: FilterSelectsProps) {
  return (
    <>
      <select
        className="select w-full sm:w-auto"
        value={order}
        onChange={(e) =>
          onFilterChange({ order: e.target.value, page: undefined })
        }
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
        onChange={(e) =>
          onFilterChange({
            genres: e.target.value || undefined,
            page: undefined,
          })
        }
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
        onChange={(e) =>
          onFilterChange({
            countries: e.target.value || undefined,
            page: undefined,
          })
        }
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
        onChange={(e) =>
          onFilterChange({
            ratingFrom: e.target.value || undefined,
            page: undefined,
          })
        }
      >
        <option value="">Min Rating</option>
        {RATING_OPTIONS.map((r) => (
          <option key={r} value={r}>
            {r}+ Rating
          </option>
        ))}
      </select>
      <select
        className="select w-full sm:w-auto"
        value={yearFrom || ""}
        onChange={(e) =>
          onFilterChange({
            yearFrom: e.target.value || undefined,
            page: undefined,
          })
        }
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
        onChange={(e) =>
          onFilterChange({
            yearTo: e.target.value || undefined,
            page: undefined,
          })
        }
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
}

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
  const page = Math.max(1, parseInt(pg || "1", 10));

  const parsedGenreId =
    genreParam && !isNaN(Number(genreParam))
      ? parseInt(genreParam, 10)
      : undefined;
  const parsedCountryId =
    countryParam && !isNaN(Number(countryParam))
      ? parseInt(countryParam, 10)
      : undefined;

  const ratingFrom = rfParam ? parseInt(rfParam, 10) : undefined;
  const ratingTo = rtParam ? parseInt(rtParam, 10) : undefined;
  const yearFrom = yfParam ? parseInt(yfParam, 10) : undefined;
  const yearTo = ytParam ? parseInt(ytParam, 10) : undefined;

  const [noKey, setNoKey] = useState(false);
  const [films, setFilms] = useState<Film[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [genres, setGenres] = useState<Genre[]>([]);
  const [countries, setCountries] = useState<Country[]>([]);
  const [filtersLoaded, setFiltersLoaded] = useState(false);

  const [resolvedGenreId, setResolvedGenreId] = useState<number | undefined>(
    parsedGenreId,
  );
  const [resolvedCountryId, setResolvedCountryId] = useState<
    number | undefined
  >(parsedCountryId);

  const [filterOpen, setFilterOpen] = useState(false);
  const router = useRouter();
  const autoTranslate = useAutoTranslate();

  const [ready, setReady] = useState(false);
  const [prefType, setPrefType] = useState<FilmType>("ALL");
  const [prefOrder, setPrefOrder] = useState<OrderType>("RATING");

  const type = (tp || prefType) as FilmType;
  const order = (ord || prefOrder) as OrderType;
  const title =
    type === "ALL"
      ? "Explore All"
      : TYPES.find((t) => t.value === type)?.label || "Explore";

  useDocumentTitle(title);

  useEffect(() => {
    if (!hasApiKeys()) {
      setNoKey(true);
      setLoading(false);
      return;
    }
    const prefs = getPreferences();
    setPrefType((prefs.defaultExploreType as FilmType) || "ALL");
    setPrefOrder((prefs.defaultExploreOrder as OrderType) || "RATING");
    setReady(true);
  }, []);

  useEffect(() => {
    if (!hasApiKeys()) return;
    setResolvedGenreId(parsedGenreId);
    setResolvedCountryId(parsedCountryId);

    const needsStringResolution =
      Boolean(genreParam && isNaN(Number(genreParam))) ||
      Boolean(countryParam && isNaN(Number(countryParam)));

    if (!needsStringResolution) {
      setFiltersLoaded(true);
    } else {
      setFiltersLoaded(false);
    }

    getFilters()
      .then((f) => {
        setGenres(f.genres);
        setCountries(f.countries);

        if (countryParam && isNaN(Number(countryParam))) {
          const target = countryParam.trim().toLowerCase();
          const match = f.countries.find(
            (c) =>
              c.country.toLowerCase() === target ||
              translateCountry(c.country, true).toLowerCase() === target,
          );
          setResolvedCountryId(match?.id);
        }

        if (genreParam && isNaN(Number(genreParam))) {
          const target = genreParam.trim().toLowerCase();
          const match = f.genres.find(
            (g) =>
              g.genre.toLowerCase() === target ||
              translateGenre(g.genre, true).toLowerCase() === target,
          );
          setResolvedGenreId(match?.id);
        }
      })
      .catch(() => {})
      .finally(() => {
        setFiltersLoaded(true);
      });
  }, [countryParam, genreParam, parsedCountryId, parsedGenreId]);

  useEffect(() => {
    if (!ready || noKey || !filtersLoaded) return;

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
    noKey,
    filtersLoaded,
    type,
    order,
    page,
    resolvedGenreId,
    resolvedCountryId,
    ratingFrom,
    ratingTo,
    yearFrom,
    yearTo,
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
      const qs = params.toString();
      return qs ? `/explore?${qs}` : "/explore";
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

  if (noKey) return <NoKeyBanner />;

  const activeFilterCount = [
    resolvedGenreId,
    resolvedCountryId,
    ratingFrom,
    ratingTo,
    yearFrom,
    yearTo,
  ].filter(Boolean).length;

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
      label: `${ratingFrom}+ Rating`,
      clearKey: "ratingFrom",
    });
  if (ratingTo)
    activeFilterTags.push({
      label: `<= ${ratingTo} Rating`,
      clearKey: "ratingTo",
    });
  if (yearFrom)
    activeFilterTags.push({ label: `From ${yearFrom}`, clearKey: "yearFrom" });
  if (yearTo)
    activeFilterTags.push({ label: `To ${yearTo}`, clearKey: "yearTo" });

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Explore"
        title={title}
        rightSlot={
          total > 0 && !loading ? (
            <span className="text-[12px] sm:text-[13px] text-[var(--text-muted)]">
              {total.toLocaleString()} titles
            </span>
          ) : null
        }
      />

      {/* ── Type tabs ── */}
      <TabBar className="mb-4 sm:mb-5">
        {TYPES.map((t) => (
          <TabPill
            key={t.value}
            active={type === t.value}
            href={buildFilterHref({
              type: t.value === "ALL" ? "ALL" : t.value,
              page: undefined,
            })}
          >
            {t.label}
          </TabPill>
        ))}
      </TabBar>

      {/* ── Filter bar ── */}
      <div className="mb-5 sm:mb-6">
        {/* Mobile: filter toggle button */}
        <div className="flex items-center gap-2 sm:hidden mb-3">
          <button
            type="button"
            onClick={() => setFilterOpen((v) => !v)}
            className={`flex items-center gap-2 px-4 py-[9px] rounded-[8px] text-[13px] font-semibold border transition-all duration-[180ms] cursor-pointer ${
              filterOpen || activeFilterCount > 0
                ? "bg-[var(--accent-dim)] border-[rgba(229,9,20,0.4)] text-[var(--accent)]"
                : "bg-[var(--bg-elevated)] border-[var(--border)] text-[var(--text-dim)]"
            }`}
          >
            <ListFilter size={14} strokeWidth={2.2} />
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
              <button
                type="button"
                className="btn btn-ghost py-[9px] px-3 text-[12px]"
              >
                <X size={11} strokeWidth={2.5} />
                Clear
              </button>
            </Link>
          )}
        </div>

        {/* Mobile: collapsible filter drawer */}
        {filterOpen && (
          <div className="sm:hidden flex flex-col gap-2 mb-3 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-[12px] p-4">
            <FilterSelects
              order={order}
              resolvedGenreId={resolvedGenreId}
              resolvedCountryId={resolvedCountryId}
              ratingFrom={ratingFrom}
              yearFrom={yearFrom}
              yearTo={yearTo}
              genres={genres}
              countries={countries}
              autoTranslate={autoTranslate}
              onFilterChange={(overrides) => {
                router.push(buildFilterHref(overrides));
                setFilterOpen(false);
              }}
            />
          </div>
        )}

        {/* Desktop: inline filter row */}
        <div className="hidden sm:flex flex-wrap gap-2 items-center">
          <FilterSelects
            order={order}
            resolvedGenreId={resolvedGenreId}
            resolvedCountryId={resolvedCountryId}
            ratingFrom={ratingFrom}
            yearFrom={yearFrom}
            yearTo={yearTo}
            genres={genres}
            countries={countries}
            autoTranslate={autoTranslate}
            onFilterChange={(overrides) =>
              router.push(buildFilterHref(overrides))
            }
          />
          {activeFilterCount > 0 && (
            <Link
              href={`/explore${type !== "ALL" ? `?type=${type}` : ""}`}
              className="no-underline"
            >
              <button
                type="button"
                className="btn btn-ghost py-[9px] px-4 text-[12px]"
              >
                <X size={12} strokeWidth={2.5} />
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
                  <X size={10} strokeWidth={3} />
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* ── Film grid ── */}
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
          title="No Results Found"
          description="Try adjusting your genre, country, rating, or year filters."
          actionLabel="Reset Filters"
          actionHref="/explore"
        />
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

      <Pagination page={page} totalPages={totalPages} buildHref={buildHref} />
    </PageContainer>
  );
}
