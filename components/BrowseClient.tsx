"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { getFilmsByFilter, getFilters } from "@/lib/kinopoisk";
import { Film, Genre, Country } from "@/types/kinopoisk";
import { translateGenre, translateCountry } from "@/lib/translate";
import FilmCard from "@/components/FilmCard";
import Pagination from "@/components/Pagination";
import Link from "next/link";

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
const YEAR_OPTIONS = Array.from({ length: 80 }, (_, i) => 2025 - i);
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

  const type = (tp as FilmType) || "ALL";
  const order = (ord as OrderType) || "RATING";
  const page = Math.max(1, parseInt(pg || "1"));
  const genreId = genreParam ? parseInt(genreParam) : undefined;
  const countryId = countryParam ? parseInt(countryParam) : undefined;
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
  const [filtersOpen, setFiltersOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    getFilters()
      .then((f) => {
        setGenres(f.genres);
        setCountries(f.countries);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
    getFilmsByFilter({
      type:
        type === "ALL"
          ? undefined
          : (type as "FILM" | "TV_SERIES" | "TV_SHOW" | "MINI_SERIES"),
      order,
      page,
      genres: genreId,
      countries: countryId,
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
    type,
    order,
    page,
    genreId,
    countryId,
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
      if (genreId) params.set("genres", String(genreId));
      if (countryId) params.set("countries", String(countryId));
      if (ratingFrom) params.set("ratingFrom", String(ratingFrom));
      if (ratingTo) params.set("ratingTo", String(ratingTo));
      if (yearFrom) params.set("yearFrom", String(yearFrom));
      if (yearTo) params.set("yearTo", String(yearTo));
      params.set("page", String(p));
      return `/explore?${params.toString()}`;
    },
    [type, order, genreId, countryId, ratingFrom, ratingTo, yearFrom, yearTo],
  );

  const buildFilterHref = useCallback(
    (overrides: Record<string, string | undefined>) => {
      const merged: Record<string, string | undefined> = {
        type: type !== "ALL" ? type : undefined,
        order: order !== "RATING" ? order : undefined,
        genres: genreId ? String(genreId) : undefined,
        countries: countryId ? String(countryId) : undefined,
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
    [type, order, genreId, countryId, ratingFrom, ratingTo, yearFrom, yearTo],
  );

  const activeFilterCount = [
    genreId,
    countryId,
    ratingFrom,
    ratingTo,
    yearFrom,
    yearTo,
  ].filter(Boolean).length;
  const title = TYPES.find((t) => t.value === type)?.label || "Explore";

  // Active filter tags for display
  const activeFilterTags: { label: string; clearKey: string }[] = [];
  if (genreId) {
    const g = genres.find((g) => g.id === genreId);
    activeFilterTags.push({
      label: g ? translateGenre(g.genre) || g.genre : `Genre #${genreId}`,
      clearKey: "genres",
    });
  }
  if (countryId) {
    const c = countries.find((c) => c.id === countryId);
    activeFilterTags.push({
      label: c
        ? translateCountry(c.country) || c.country
        : `Country #${countryId}`,
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

  return (
    <div
      style={{ paddingTop: "32px", paddingBottom: "80px", minHeight: "100vh" }}
    >
      {/* Header */}
      <div style={{ padding: "0 clamp(16px,4vw,48px)", marginBottom: "32px" }}>
        <p
          style={{
            fontSize: "11px",
            color: "var(--text-muted)",
            textTransform: "uppercase",
            letterSpacing: "2px",
            marginBottom: 8,
          }}
        >
          Explore
        </p>
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          <h1
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "clamp(36px, 6vw, 56px)",
              letterSpacing: "2px",
              lineHeight: 1,
            }}
          >
            {title}
          </h1>
          {total > 0 && !loading && (
            <span
              style={{
                fontSize: "13px",
                color: "var(--text-muted)",
                paddingBottom: 6,
              }}
            >
              {total.toLocaleString()} titles
            </span>
          )}
        </div>
      </div>

      {/* Type tabs */}
      <div style={{ padding: "0 clamp(16px,4vw,48px)", marginBottom: "16px" }}>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {TYPES.map((t) => (
            <Link
              key={t.value}
              href={buildFilterHref({
                type: t.value === "ALL" ? undefined : t.value,
                page: undefined,
              })}
              style={{ textDecoration: "none" }}
            >
              <button
                style={{
                  padding: "8px 16px",
                  borderRadius: "8px",
                  fontSize: "13px",
                  fontWeight: 600,
                  cursor: "pointer",
                  fontFamily: "var(--font-body)",
                  transition: "all 0.18s ease",
                  background:
                    type === t.value ? "var(--accent)" : "var(--bg-elevated)",
                  color: type === t.value ? "white" : "var(--text-dim)",
                  border: `1px solid ${type === t.value ? "var(--accent)" : "var(--border)"}`,
                }}
              >
                {t.label}
              </button>
            </Link>
          ))}
        </div>
      </div>

      {/* Filter row */}
      <div style={{ padding: "0 clamp(16px,4vw,48px)", marginBottom: "20px" }}>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 8,
            alignItems: "center",
          }}
        >
          {/* Sort */}
          <select
            className="select"
            value={order}
            onChange={(e) =>
              router.push(
                buildFilterHref({ order: e.target.value, page: undefined }),
              )
            }
          >
            {ORDERS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>

          {/* Genre */}
          <select
            className="select"
            value={genreId || ""}
            onChange={(e) =>
              router.push(
                buildFilterHref({
                  genres: e.target.value || undefined,
                  page: undefined,
                }),
              )
            }
          >
            <option value="">All Genres</option>
            {genres
              .filter((g) => g.id !== 28 && g.id !== 25)
              .map((g) => (
                <option key={g.id} value={g.id}>
                  {translateGenre(g.genre) || g.genre}
                </option>
              ))}
          </select>

          {/* Country — previously MISSING */}
          <select
            className="select"
            value={countryId || ""}
            onChange={(e) =>
              router.push(
                buildFilterHref({
                  countries: e.target.value || undefined,
                  page: undefined,
                }),
              )
            }
          >
            <option value="">All Countries</option>
            {countries.map((c) => (
              <option key={c.id} value={c.id}>
                {translateCountry(c.country) || c.country}
              </option>
            ))}
          </select>

          {/* Rating from */}
          <select
            className="select"
            value={ratingFrom || ""}
            onChange={(e) =>
              router.push(
                buildFilterHref({
                  ratingFrom: e.target.value || undefined,
                  page: undefined,
                }),
              )
            }
          >
            <option value="">Min Rating</option>
            {RATING_OPTIONS.map((r) => (
              <option key={r} value={r}>
                {r}+ ★
              </option>
            ))}
          </select>

          {/* Rating to */}
          <select
            className="select"
            value={ratingTo || ""}
            onChange={(e) =>
              router.push(
                buildFilterHref({
                  ratingTo: e.target.value || undefined,
                  page: undefined,
                }),
              )
            }
          >
            <option value="">Max Rating</option>
            {RATING_OPTIONS.map((r) => (
              <option key={r} value={r}>
                ≤ {r} ★
              </option>
            ))}
          </select>

          {/* Year from */}
          <select
            className="select"
            value={yearFrom || ""}
            onChange={(e) =>
              router.push(
                buildFilterHref({
                  yearFrom: e.target.value || undefined,
                  page: undefined,
                }),
              )
            }
          >
            <option value="">From Year</option>
            {YEAR_OPTIONS.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>

          {/* Year to */}
          <select
            className="select"
            value={yearTo || ""}
            onChange={(e) =>
              router.push(
                buildFilterHref({
                  yearTo: e.target.value || undefined,
                  page: undefined,
                }),
              )
            }
          >
            <option value="">To Year</option>
            {YEAR_OPTIONS.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>

          {/* Clear all */}
          {activeFilterCount > 0 && (
            <Link
              href={`/explore${type !== "ALL" ? `?type=${type}` : ""}`}
              style={{ textDecoration: "none" }}
            >
              <button
                className="btn btn-ghost"
                style={{
                  padding: "8px 14px",
                  fontSize: "12px",
                  height: "auto",
                }}
              >
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
          <div
            style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 12 }}
          >
            {activeFilterTags.map((tag) => (
              <Link
                key={tag.clearKey}
                href={buildFilterHref({
                  [tag.clearKey]: undefined,
                  page: undefined,
                })}
                style={{ textDecoration: "none" }}
              >
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 5,
                    fontSize: "12px",
                    color: "var(--text-dim)",
                    background: "var(--accent-dim)",
                    border: "1px solid rgba(229,9,20,0.25)",
                    borderRadius: "20px",
                    padding: "4px 10px",
                    cursor: "pointer",
                  }}
                >
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

      {/* Film grid */}
      <div style={{ padding: "0 clamp(16px,4vw,48px)" }}>
        {loading ? (
          <div className="film-grid">
            {Array.from({ length: 20 }).map((_, i) => (
              <div
                key={i}
                className="skeleton"
                style={{ aspectRatio: "2/3", borderRadius: 12 }}
              />
            ))}
          </div>
        ) : films.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: "100px 0",
              color: "var(--text-dim)",
            }}
          >
            <svg
              width="56"
              height="56"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--text-muted)"
              strokeWidth="1.5"
              style={{ display: "block", margin: "0 auto 16px" }}
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
            <p style={{ fontSize: "18px", marginBottom: 8 }}>
              No results found
            </p>
            <p style={{ fontSize: "13px", color: "var(--text-muted)" }}>
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
