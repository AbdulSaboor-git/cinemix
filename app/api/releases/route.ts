// app/api/releases/route.ts
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export interface GlobalReleaseBridgeItem {
  imdbId: string;
  title: string;
  originalTitle?: string;
  year: number;
  releaseDate: string; // YYYY-MM-DD (Global / US wide release date)
  type: "FILM" | "TV_SERIES" | "MINI_SERIES" | "TV_SHOW";
  posterUrl?: string | null;
  ratingImdb?: number;
  ratingImdbVoteCount?: number;
  runtimeMinutes?: number;
  ratingMpaa?: string;
  genres?: { genre: string }[];
  countries?: { country: string }[];
  shortDescription?: string;
}

export interface BatchReleaseLookupInput {
  key: string;
  imdbId?: string | null;
  title?: string | null;
  origTitle?: string | null;
  year?: number | null;
}

export interface BatchReleaseLookupResult {
  releaseDate: string | null; // YYYY-MM-DD (True wide release date, excluding festival premieres & re-releases)
  year: number | null;
  imdbId: string | null;
  titleEn?: string | null;
  posterUrl?: string | null;
  type?: "FILM" | "TV_SERIES" | "MINI_SERIES" | "TV_SHOW" | null;
  ratingImdb?: number | null;
  ratingImdbVoteCount?: number | null;
  ratingMpaa?: string | null;
}

const BROWSER_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  Accept: "application/json,text/plain,*/*",
  "Accept-Language": "en-US,en;q=0.9",
};

const GRAPHQL_ENDPOINTS = [
  "https://caching.graphql.imdb.com/",
  "https://api.graphql.imdb.com/",
];

const CALENDAR_CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours
const ITEM_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

const calendarCache = new Map<
  string,
  { items: GlobalReleaseBridgeItem[]; expiresAt: number }
>();
const itemReleaseCache = new Map<
  string,
  { data: BatchReleaseLookupResult; expiresAt: number }
>();

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function getLastDayOfMonth(year: number, month1To12: number): number {
  return new Date(Date.UTC(year, month1To12, 0)).getUTCDate();
}

function formatIsoDate(
  y?: number | null,
  m?: number | null,
  d?: number | null,
): string | null {
  if (!y || y < 1888 || y > 2035) return null;
  if (!m || m < 1 || m > 12) return null;
  const safeDay = d && d >= 1 && d <= 31 ? d : 1;
  return `${y}-${pad2(m)}-${pad2(safeDay)}`;
}

function mapImdbTitleType(
  rawTypeId?: string | null,
): "FILM" | "TV_SERIES" | "MINI_SERIES" | "TV_SHOW" {
  const id = (rawTypeId || "").toLowerCase();
  if (id === "tvminiseries" || id === "tv_miniseries") return "MINI_SERIES";
  if (id === "tvseries" || id === "tv_series") return "TV_SERIES";
  if (id === "tvspecial" || id === "tvshort" || id === "tv_special") {
    return "TV_SHOW";
  }
  return "FILM";
}

function isFestivalOrPremiereAttribute(attrs?: { text?: string }[] | null): boolean {
  if (!attrs || attrs.length === 0) return false;
  for (const a of attrs) {
    const t = (a?.text || "").toLowerCase();
    if (
      t.includes("premiere") ||
      t.includes("festival") ||
      t.includes("re-release") ||
      t.includes("rerelease") ||
      t.includes("restored") ||
      t.includes("anniversary")
    ) {
      return true;
    }
  }
  return false;
}

interface GraphqlReleaseDateEdge {
  node?: {
    year?: number | null;
    month?: number | null;
    day?: number | null;
    country?: { id?: string | null; text?: string | null } | null;
    attributes?: { text?: string }[] | null;
  } | null;
}

interface GraphqlSearchTitleNode {
  id?: string;
  titleType?: { id?: string; text?: string } | null;
  titleText?: { text?: string } | null;
  originalTitleText?: { text?: string } | null;
  releaseYear?: { year?: number; endYear?: number } | null;
  releaseDate?: {
    year?: number | null;
    month?: number | null;
    day?: number | null;
    country?: { id?: string | null; text?: string | null } | null;
    attributes?: { text?: string }[] | null;
  } | null;
  releaseDates?: {
    edges?: GraphqlReleaseDateEdge[] | null;
  } | null;
  primaryImage?: { url?: string | null } | null;
  certificate?: { rating?: string | null } | null;
  ratingsSummary?: {
    aggregateRating?: number | null;
    voteCount?: number | null;
  } | null;
  runtime?: { seconds?: number | null } | null;
  titleGenres?: {
    genres?: { genre?: { text?: string | null } | null }[] | null;
  } | null;
  countriesOfOrigin?: {
    countries?: { id?: string | null; text?: string | null }[] | null;
  } | null;
  plot?: {
    plotText?: { plainText?: string | null } | null;
  } | null;
}

/**
 * Picks the canonical wide theatrical/streaming release date (preferring US/UK/Global wide release)
 * and strictly ignoring red-carpet festival premieres or later re-releases.
 */
function pickWideGlobalReleaseDate(
  node: GraphqlSearchTitleNode,
  targetYear?: number | null,
): string | null {
  const prodYear = node.releaseYear?.year ?? targetYear ?? null;
  const edges = node.releaseDates?.edges ?? [];

  const validCandidates: {
    iso: string;
    year: number;
    countryId: string;
    isFestival: boolean;
    score: number;
  }[] = [];

  for (const edge of edges) {
    const rd = edge?.node;
    if (!rd) continue;
    const iso = formatIsoDate(rd.year, rd.month, rd.day);
    if (!iso || !rd.year) continue;

    // Ignore re-releases many years after production year
    if (prodYear && rd.year > prodYear + 1) continue;
    if (prodYear && rd.year < prodYear - 1) continue;

    const isFest = isFestivalOrPremiereAttribute(rd.attributes);
    const countryId = (rd.country?.id || "").toUpperCase();

    let score = 0;
    if (!isFest) score += 50;
    if (countryId === "US") score += 30;
    else if (countryId === "GB" || countryId === "CA" || countryId === "AU") {
      score += 20;
    } else if (countryId === "RU" || countryId === "BY") {
      score -= 40;
    }
    if (prodYear && rd.year === prodYear) score += 15;

    validCandidates.push({
      iso,
      year: rd.year,
      countryId,
      isFestival: isFest,
      score,
    });
  }

  if (validCandidates.length > 0) {
    validCandidates.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.iso.localeCompare(b.iso);
    });
    return validCandidates[0].iso;
  }

  // Fallback to node.releaseDate (which is localized to US via x-imdb-user-country: US)
  if (node.releaseDate) {
    const rd = node.releaseDate;
    const iso = formatIsoDate(rd.year, rd.month, rd.day);
    if (iso && (!prodYear || !rd.year || Math.abs(rd.year - prodYear) <= 1)) {
      return iso;
    }
  }

  return null;
}

const MONTHLY_CALENDAR_GQL = `
query MonthlyGlobalReleases($start: Date!, $end: Date!, $types: [String!]!) {
  advancedTitleSearch(
    first: 50
    sortBy: POPULARITY
    sortOrder: ASC
    constraints: {
      titleTypeConstraint: { anyTitleTypeIds: $types }
      releaseDateConstraint: { releaseDateRange: { start: $start, end: $end } }
      originCountryConstraint: {
        anyCountries: [
          "US", "GB", "CA", "AU", "NZ", "IE",
          "FR", "DE", "IT", "ES", "SE", "DK", "NO",
          "KR", "JP", "HK", "TW", "MX", "BR", "AR", "IN"
        ]
      }
    }
  ) {
    edges {
      node {
        title {
          id
          titleType {
            id
            text
          }
          titleText {
            text
          }
          originalTitleText {
            text
          }
          releaseYear {
            year
            endYear
          }
          releaseDate {
            year
            month
            day
            country {
              id
              text
            }
            attributes {
              text
            }
          }
          primaryImage {
            url
          }
          certificate {
            rating
          }
          ratingsSummary {
            aggregateRating
            voteCount
          }
          runtime {
            seconds
          }
          titleGenres {
            genres {
              genre {
                text
              }
            }
          }
          countriesOfOrigin {
            countries {
              id
              text
            }
          }
          plot {
            plotText {
              plainText
            }
          }
        }
      }
    }
  }
}
`;

async function fetchMonthlyFromImdbGraphql(
  year: number,
  month: number,
  mediaType: string,
): Promise<GlobalReleaseBridgeItem[]> {
  const mm = pad2(month);
  const lastDay = pad2(getLastDayOfMonth(year, month));
  const start = `${year}-${mm}-01`;
  const end = `${year}-${mm}-${lastDay}`;
  const prefix = `${year}-${mm}`;

  const types =
    mediaType === "FILM"
      ? ["movie", "tvMovie"]
      : mediaType === "TV_SERIES"
        ? ["tvSeries"]
        : mediaType === "MINI_SERIES"
          ? ["tvMiniSeries"]
          : mediaType === "TV_SHOW"
            ? ["tvSpecial", "tvShort"]
            : ["movie", "tvSeries", "tvMiniSeries"];

  for (const endpoint of GRAPHQL_ENDPOINTS) {
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          ...BROWSER_HEADERS,
          "Content-Type": "application/json",
          Accept: "application/graphql+json, application/json",
          Origin: "https://www.imdb.com",
          Referer: "https://www.imdb.com/calendar/?region=US",
          "x-imdb-client-name": "imdb-web-next-localized",
          "x-imdb-user-country": "US",
          "x-imdb-user-language": "en-US",
        },
        body: JSON.stringify({
          query: MONTHLY_CALENDAR_GQL,
          variables: { start, end, types },
        }),
        signal: AbortSignal.timeout(4500),
      });

      if (!res.ok) continue;
      const json = (await res.json()) as {
        data?: {
          advancedTitleSearch?: {
            edges?: { node?: { title?: GraphqlSearchTitleNode } }[];
          };
        };
      };

      const edges = json?.data?.advancedTitleSearch?.edges;
      if (!Array.isArray(edges) || edges.length === 0) continue;

      const out: GlobalReleaseBridgeItem[] = [];
      const seen = new Set<string>();

      for (const edge of edges) {
        const t = edge?.node?.title;
        if (!t?.id || !t.titleText?.text) continue;
        const imdbId = t.id.trim().toLowerCase();
        if (seen.has(imdbId)) continue;

        const mappedType = mapImdbTitleType(t.titleType?.id);
        const prodYear = t.releaseYear?.year ?? year;

        // Strictly block old movies (e.g. 2022 re-releases) from appearing in current/next year calendar
        if (mappedType === "FILM") {
          if (prodYear < year - 1 || prodYear > year + 1) continue;
          if (prodYear === year - 1 && month > 4) continue;
        } else {
          // For series, allow new series or returning series if releaseDate is in this month
          if (prodYear < year - 2 || prodYear > year + 1) continue;
        }

        // Skip Russian-origin titles
        const originCountries = t.countriesOfOrigin?.countries ?? [];
        const isRussianOrigin = originCountries.some((c) => {
          const cid = (c?.id || "").toUpperCase();
          return cid === "RU" || cid === "SUHH" || cid === "BY";
        });
        if (isRussianOrigin) continue;

        // Skip festival-only premieres if their actual wide release is in a different month
        if (isFestivalOrPremiereAttribute(t.releaseDate?.attributes)) {
          continue;
        }

        let releaseIso = pickWideGlobalReleaseDate(t, year);
        if (releaseIso && !releaseIso.startsWith(prefix)) {
          // If IMDb's primary US release date is in a DIFFERENT month than the queried month,
          // do NOT place this title in this month!
          continue;
        }
        if (!releaseIso) {
          releaseIso = `${year}-${mm}-15`;
        }

        seen.add(imdbId);

        const runtimeSecs = t.runtime?.seconds;
        const runtimeMinutes =
          typeof runtimeSecs === "number" && runtimeSecs > 0
            ? Math.round(runtimeSecs / 60)
            : undefined;

        const genres = (t.titleGenres?.genres ?? [])
          .map((g) => g?.genre?.text?.trim())
          .filter((g): g is string => Boolean(g))
          .map((genre) => ({ genre }));

        const countries = originCountries
          .map((c) => c?.text?.trim())
          .filter((c): c is string => Boolean(c))
          .map((country) => ({ country }));

        out.push({
          imdbId,
          title: t.titleText.text.trim(),
          originalTitle: t.originalTitleText?.text?.trim() || undefined,
          year: prodYear,
          releaseDate: releaseIso,
          type: mappedType,
          posterUrl: t.primaryImage?.url || null,
          ratingImdb:
            typeof t.ratingsSummary?.aggregateRating === "number" &&
            t.ratingsSummary.aggregateRating > 0
              ? t.ratingsSummary.aggregateRating
              : undefined,
          ratingImdbVoteCount:
            typeof t.ratingsSummary?.voteCount === "number"
              ? t.ratingsSummary.voteCount
              : undefined,
          runtimeMinutes,
          ratingMpaa: t.certificate?.rating || undefined,
          genres: genres.length > 0 ? genres : undefined,
          countries: countries.length > 0 ? countries : undefined,
          shortDescription: t.plot?.plotText?.plainText || undefined,
        });
      }

      if (out.length > 0) {
        return out;
      }
    } catch {
      continue;
    }
  }

  return [];
}

const SINGLE_TITLE_RELEASE_GQL = `
query TitleGlobalRelease($id: ID!) {
  title(id: $id) {
    id
    titleType {
      id
      text
    }
    titleText {
      text
    }
    releaseYear {
      year
    }
    releaseDate {
      year
      month
      day
      country {
        id
        text
      }
      attributes {
        text
      }
    }
    releaseDates(first: 25) {
      edges {
        node {
          year
          month
          day
          country {
            id
            text
          }
          attributes {
            text
          }
        }
      }
    }
    primaryImage {
      url
    }
    certificate {
      rating
    }
    ratingsSummary {
      aggregateRating
      voteCount
    }
  }
}
`;

async function resolveImdbIdBySuggestion(
  title?: string | null,
  year?: number | null,
): Promise<string | null> {
  if (!title || !title.trim()) return null;
  const q = year ? `${title.trim()} ${year}` : title.trim();
  const slug = q
    .toLowerCase()
    .replace(/['"`]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60);
  if (!slug) return null;
  const firstChar = /^[a-z0-9]/.test(slug[0]) ? slug[0] : "x";
  const url = `https://v3.sg.media-imdb.com/suggestion/${firstChar}/${encodeURIComponent(slug)}.json`;

  try {
    const res = await fetch(url, {
      headers: BROWSER_HEADERS,
      signal: AbortSignal.timeout(2500),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      d?: { id?: string; l?: string; y?: number }[];
    };
    const list = Array.isArray(data?.d) ? data.d : [];
    for (const item of list) {
      if (!item.id || !/^tt\d+$/i.test(item.id)) continue;
      if (year && item.y && Math.abs(item.y - year) > 1) continue;
      return item.id.toLowerCase();
    }
  } catch {
    // ignore
  }
  return null;
}

async function lookupSingleTitleGlobalRelease(
  input: BatchReleaseLookupInput,
): Promise<BatchReleaseLookupResult> {
  const cleanImdb =
    input.imdbId && /^tt\d+$/i.test(input.imdbId.trim())
      ? input.imdbId.trim().toLowerCase()
      : await resolveImdbIdBySuggestion(
          input.title || input.origTitle,
          input.year,
        );

  if (!cleanImdb) {
    return {
      releaseDate: null,
      year: input.year ?? null,
      imdbId: null,
    };
  }

  const cached = itemReleaseCache.get(cleanImdb);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  for (const endpoint of GRAPHQL_ENDPOINTS) {
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          ...BROWSER_HEADERS,
          "Content-Type": "application/json",
          Accept: "application/graphql+json, application/json",
          Origin: "https://www.imdb.com",
          Referer: `https://www.imdb.com/title/${cleanImdb}/releaseinfo/`,
          "x-imdb-client-name": "imdb-web-next-localized",
          "x-imdb-user-country": "US",
          "x-imdb-user-language": "en-US",
        },
        body: JSON.stringify({
          query: SINGLE_TITLE_RELEASE_GQL,
          variables: { id: cleanImdb },
        }),
        signal: AbortSignal.timeout(3200),
      });

      if (!res.ok) continue;
      const json = (await res.json()) as {
        data?: { title?: GraphqlSearchTitleNode };
      };
      const node = json?.data?.title;
      if (!node) continue;

      const releaseDate = pickWideGlobalReleaseDate(node, input.year);
      const result: BatchReleaseLookupResult = {
        releaseDate,
        year: node.releaseYear?.year ?? input.year ?? null,
        imdbId: cleanImdb,
        titleEn: node.titleText?.text || null,
        posterUrl: node.primaryImage?.url || null,
        type: mapImdbTitleType(node.titleType?.id),
        ratingImdb: node.ratingsSummary?.aggregateRating ?? null,
        ratingImdbVoteCount: node.ratingsSummary?.voteCount ?? null,
        ratingMpaa: node.certificate?.rating ?? null,
      };

      if (itemReleaseCache.size > 2000) {
        const firstKey = itemReleaseCache.keys().next().value;
        if (firstKey) itemReleaseCache.delete(firstKey);
      }
      itemReleaseCache.set(cleanImdb, {
        data: result,
        expiresAt: Date.now() + ITEM_CACHE_TTL_MS,
      });
      return result;
    } catch {
      continue;
    }
  }

  return {
    releaseDate: null,
    year: input.year ?? null,
    imdbId: cleanImdb,
  };
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const now = new Date();
  const year = parseInt(sp.get("year") || String(now.getFullYear()), 10);
  const month = parseInt(sp.get("month") || String(now.getMonth() + 1), 10);
  const type = (sp.get("type") || "ALL").toUpperCase();

  if (isNaN(year) || year < 1900 || year > 2035 || isNaN(month) || month < 1 || month > 12) {
    return NextResponse.json({ items: [] }, { status: 400 });
  }

  const cacheKey = `${year}:${month}:${type}`;
  const cached = calendarCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return NextResponse.json(
      { items: cached.items },
      {
        status: 200,
        headers: {
          "Cache-Control": "public, max-age=3600, stale-while-revalidate=7200",
        },
      },
    );
  }

  const items = await fetchMonthlyFromImdbGraphql(year, month, type);
  if (items.length > 0) {
    if (calendarCache.size > 200) {
      const oldest = calendarCache.keys().next().value;
      if (oldest) calendarCache.delete(oldest);
    }
    calendarCache.set(cacheKey, {
      items,
      expiresAt: Date.now() + CALENDAR_CACHE_TTL_MS,
    });
  }

  return NextResponse.json(
    { items },
    {
      status: 200,
      headers: {
        "Cache-Control": "public, max-age=3600, stale-while-revalidate=7200",
      },
    },
  );
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { items?: BatchReleaseLookupInput[] };
    const items = Array.isArray(body?.items) ? body.items.slice(0, 24) : [];
    if (items.length === 0) {
      return NextResponse.json({ results: {} }, { status: 200 });
    }

    const settled = await Promise.all(
      items.map(async (item) => {
        const res = await lookupSingleTitleGlobalRelease(item);
        return [item.key, res] as const;
      }),
    );

    const results: Record<string, BatchReleaseLookupResult> = {};
    for (const [key, val] of settled) {
      if (key) results[key] = val;
    }

    return NextResponse.json({ results }, { status: 200 });
  } catch {
    return NextResponse.json({ results: {} }, { status: 200 });
  }
}
