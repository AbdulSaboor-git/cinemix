// app/api/poster/route.ts
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export interface PosterLookupQuery {
  key: string;
  imdbId?: string | null;
  title?: string | null;
  origTitle?: string | null;
  year?: number | string | null;
  type?: string | null;
}

export interface PosterLookupResult {
  posterUrl: string | null;
  imdbId: string | null;
}

interface ImdbSuggestionItem {
  id?: string;
  l?: string;
  y?: number;
  yr?: string;
  q?: string;
  qid?: string;
  rank?: number;
  i?: {
    imageUrl?: string;
    width?: number;
    height?: number;
  };
}

interface ImdbSuggestionResponse {
  d?: ImdbSuggestionItem[];
}

// ─── Server-Side In-Memory Cache (7d TTL for hits, 2h for misses) ────────────

const HIT_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MISS_TTL_MS = 2 * 60 * 60 * 1000;
const MAX_CACHE_ENTRIES = 2500;

const serverPosterCache = new Map<
  string,
  { data: PosterLookupResult; expiresAt: number }
>();
const inflightLookups = new Map<string, Promise<PosterLookupResult>>();

function getCachedResult(cacheKey: string): PosterLookupResult | undefined {
  const entry = serverPosterCache.get(cacheKey);
  if (!entry) return undefined;
  if (Date.now() > entry.expiresAt) {
    serverPosterCache.delete(cacheKey);
    return undefined;
  }
  return entry.data;
}

function setCachedResult(cacheKey: string, data: PosterLookupResult): void {
  if (serverPosterCache.size >= MAX_CACHE_ENTRIES) {
    const oldestKey = serverPosterCache.keys().next().value;
    if (oldestKey) serverPosterCache.delete(oldestKey);
  }
  const ttl = data.posterUrl ? HIT_TTL_MS : MISS_TTL_MS;
  serverPosterCache.set(cacheKey, {
    data,
    expiresAt: Date.now() + ttl,
  });
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const BROWSER_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  Accept: "application/json,text/plain,*/*",
  "Accept-Language": "en-US,en;q=0.9",
};

function hasCyrillic(text?: string | null): boolean {
  if (!text) return false;
  return /[а-яё]/i.test(text);
}

function isValidPosterUrl(url?: string | null): url is string {
  if (!url || typeof url !== "string") return false;
  const lower = url.trim().toLowerCase();
  if (!lower.startsWith("https://")) return false;
  if (
    lower.includes("nopicture") ||
    lower.includes("no-poster") ||
    lower.includes("no_poster") ||
    lower.includes("placeholder") ||
    lower.includes("spacer.gif") ||
    lower.includes("default_avatar")
  ) {
    return false;
  }
  return true;
}

function normalizeTitleForMatch(raw?: string | null): string {
  if (!raw) return "";
  return raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\b(the|a|an)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanSearchTitle(raw?: string | null): string {
  if (!raw) return "";
  return raw
    .replace(/\s*\((?:сериал|мини-сериал|тв|фильм|кино|series|tv|mini-series|\d{4}.*?)\)\s*/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildImdbSuggestionUrl(rawQuery: string): string {
  const cleaned = rawQuery
    .toLowerCase()
    .trim()
    .replace(/['"`]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60);

  const slug = cleaned || "x";
  const firstChar = /^[a-z0-9]/.test(slug[0]) ? slug[0] : "x";
  return `https://v3.sg.media-imdb.com/suggestion/${firstChar}/${encodeURIComponent(slug)}.json`;
}

async function fetchImdbSuggestions(
  rawQuery: string,
): Promise<ImdbSuggestionItem[]> {
  const url = buildImdbSuggestionUrl(rawQuery);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3500);

  try {
    const res = await fetch(url, {
      headers: BROWSER_HEADERS,
      signal: controller.signal,
      next: { revalidate: 604800 },
    });
    if (!res.ok) return [];
    const data = (await res.json()) as ImdbSuggestionResponse;
    return Array.isArray(data?.d) ? data.d : [];
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

function scoreCandidate(
  item: ImdbSuggestionItem,
  targetTitles: string[],
  targetYear: number | null,
  targetType?: string | null,
): number {
  if (!item.id || !/^tt\d+$/i.test(item.id)) return -999;
  if (!isValidPosterUrl(item.i?.imageUrl)) return -999;

  const qid = (item.qid || item.q || "").toLowerCase();
  if (qid.includes("videogame") || qid.includes("video game") || qid === "podcastseries") {
    return -999;
  }

  const candNorm = normalizeTitleForMatch(item.l);
  if (!candNorm) return -999;

  let titleScore = -30;
  for (const t of targetTitles) {
    const targetNorm = normalizeTitleForMatch(t);
    if (!targetNorm) continue;

    if (candNorm === targetNorm) {
      titleScore = Math.max(titleScore, 65);
      break;
    }

    // Match before colon (e.g. "Mission: Impossible - Dead Reckoning" vs "Mission: Impossible")
    const candBase = normalizeTitleForMatch(item.l?.split(":")[0]);
    const targetBase = normalizeTitleForMatch(t.split(":")[0]);
    if (candBase && targetBase && candBase.length >= 4 && candBase === targetBase) {
      titleScore = Math.max(titleScore, 42);
    }

    if (
      (candNorm.startsWith(targetNorm) || targetNorm.startsWith(candNorm)) &&
      Math.min(candNorm.length, targetNorm.length) >= 4
    ) {
      titleScore = Math.max(titleScore, 38);
    }

    const candWords = candNorm.split(" ").filter(Boolean);
    const targetWords = new Set(targetNorm.split(" ").filter(Boolean));
    if (candWords.length > 0 && targetWords.size > 0) {
      const shared = candWords.filter((w) => targetWords.has(w)).length;
      const ratio = shared / Math.max(candWords.length, targetWords.size);
      if (ratio >= 0.75) {
        titleScore = Math.max(titleScore, 28);
      }
    }
  }

  if (titleScore < 0) return -999;

  let yearScore = 0;
  const itemYear = typeof item.y === "number" && item.y > 1880 ? item.y : null;

  if (targetYear && itemYear) {
    const diff = Math.abs(itemYear - targetYear);
    if (diff === 0) {
      yearScore = 45;
    } else if (diff === 1) {
      yearScore = 30;
    } else if (diff === 2) {
      yearScore = 10;
    } else {
      // Strictly reject titles from a completely different release era
      return -999;
    }
  } else if (targetYear && !itemYear) {
    yearScore = -10;
  }

  let typeScore = 0;
  const normType = (targetType || "").toUpperCase();
  const isTargetSeries =
    normType === "TV_SERIES" ||
    normType === "MINI_SERIES" ||
    normType === "TV_SHOW";
  const isCandSeries =
    qid.includes("tvseries") ||
    qid.includes("tvminiseries") ||
    qid.includes("tv series") ||
    qid.includes("mini-series");

  if (normType) {
    if (isTargetSeries && isCandSeries) typeScore = 15;
    else if (!isTargetSeries && !isCandSeries) typeScore = 12;
    else typeScore = -8;
  }

  const rankBonus =
    typeof item.rank === "number" && item.rank > 0
      ? Math.max(0, 8 - Math.log10(item.rank) * 2)
      : 0;

  return titleScore + yearScore + typeScore + rankBonus;
}

async function resolvePosterInternal(
  query: PosterLookupQuery,
): Promise<PosterLookupResult> {
  const cleanImdbId =
    query.imdbId && /^tt\d+$/i.test(query.imdbId.trim())
      ? query.imdbId.trim().toLowerCase()
      : null;

  const parsedYear = query.year ? parseInt(String(query.year), 10) : NaN;
  const validYear =
    !isNaN(parsedYear) && parsedYear >= 1888 && parsedYear <= 2035
      ? parsedYear
      : null;

  const candidateTitles = [query.origTitle, query.title]
    .map((t) => cleanSearchTitle(t))
    .filter(
      (t): t is string =>
        Boolean(t) &&
        t.toLowerCase() !== "unknown" &&
        !hasCyrillic(t) &&
        t.length >= 2,
    );

  const uniqueTitles = Array.from(new Set(candidateTitles));

  const cacheSignature = cleanImdbId
    ? `imdb:${cleanImdbId}`
    : uniqueTitles.length > 0
      ? `title:${normalizeTitleForMatch(uniqueTitles[0])}:${validYear || ""}:${query.type || ""}`
      : "";

  if (!cacheSignature) {
    return { posterUrl: null, imdbId: null };
  }

  const cached = getCachedResult(cacheSignature);
  if (cached !== undefined) {
    return cached;
  }

  const inflight = inflightLookups.get(cacheSignature);
  if (inflight) {
    return inflight;
  }

  const lookupPromise = (async (): Promise<PosterLookupResult> => {
    // 1. Direct IMDb ID resolution (100% exact title match)
    if (cleanImdbId) {
      const items = await fetchImdbSuggestions(cleanImdbId);
      const exact =
        items.find((it) => it.id?.toLowerCase() === cleanImdbId) ||
        (items.length === 1 && items[0].id?.toLowerCase().startsWith("tt")
          ? items[0]
          : undefined);

      if (exact && isValidPosterUrl(exact.i?.imageUrl)) {
        const res = {
          posterUrl: exact.i!.imageUrl!,
          imdbId: exact.id!.toLowerCase(),
        };
        setCachedResult(cacheSignature, res);
        return res;
      }

      // If IMDb suggestion API didn't have an image for this tt-ID, try title + year if available
      if (uniqueTitles.length === 0) {
        const fallbackCdn = {
          posterUrl: `https://images.metahub.space/poster/large/${cleanImdbId}/img`,
          imdbId: cleanImdbId,
        };
        setCachedResult(cacheSignature, fallbackCdn);
        return fallbackCdn;
      }
    }

    // 2. Title + Year resolution (for cards/lists without imdbId)
    if (uniqueTitles.length > 0) {
      const primaryTitle = uniqueTitles[0];
      const searchQueries: string[] = [];

      if (validYear) {
        searchQueries.push(`${primaryTitle} ${validYear}`);
      }
      searchQueries.push(primaryTitle);

      if (uniqueTitles[1] && uniqueTitles[1] !== primaryTitle) {
        if (validYear) {
          searchQueries.push(`${uniqueTitles[1]} ${validYear}`);
        } else {
          searchQueries.push(uniqueTitles[1]);
        }
      }

      let bestCandidate: ImdbSuggestionItem | null = null;
      let bestScore = -999;

      for (const qStr of searchQueries) {
        const suggestions = await fetchImdbSuggestions(qStr);
        for (const item of suggestions) {
          // If we already know cleanImdbId, prefer exact ID match immediately
          if (cleanImdbId && item.id?.toLowerCase() === cleanImdbId) {
            if (isValidPosterUrl(item.i?.imageUrl)) {
              const res = {
                posterUrl: item.i!.imageUrl!,
                imdbId: cleanImdbId,
              };
              setCachedResult(cacheSignature, res);
              return res;
            }
          }

          const s = scoreCandidate(item, uniqueTitles, validYear, query.type);
          if (s > bestScore) {
            bestScore = s;
            bestCandidate = item;
          }
        }

        // Stop early if we found a high-confidence match (exact title + matching year)
        if (bestScore >= 85 && bestCandidate) {
          break;
        }
      }

      const minRequiredScore = validYear ? 48 : 62;
      if (
        bestCandidate &&
        bestScore >= minRequiredScore &&
        isValidPosterUrl(bestCandidate.i?.imageUrl)
      ) {
        const res = {
          posterUrl: bestCandidate.i!.imageUrl!,
          imdbId: bestCandidate.id ? bestCandidate.id.toLowerCase() : cleanImdbId,
        };
        setCachedResult(cacheSignature, res);
        return res;
      }
    }

    // 3. Final fallback if cleanImdbId was provided
    if (cleanImdbId) {
      const fallbackCdn = {
        posterUrl: `https://images.metahub.space/poster/large/${cleanImdbId}/img`,
        imdbId: cleanImdbId,
      };
      setCachedResult(cacheSignature, fallbackCdn);
      return fallbackCdn;
    }

    const miss = { posterUrl: null, imdbId: null };
    setCachedResult(cacheSignature, miss);
    return miss;
  })();

  inflightLookups.set(cacheSignature, lookupPromise);
  try {
    return await lookupPromise;
  } finally {
    inflightLookups.delete(cacheSignature);
  }
}

// ─── Route Handlers (Single GET + Micro-Batched POST) ────────────────────────

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const query: PosterLookupQuery = {
    key: sp.get("key") || "single",
    imdbId: sp.get("imdbId"),
    title: sp.get("title"),
    origTitle: sp.get("origTitle"),
    year: sp.get("year"),
    type: sp.get("type"),
  };

  const result = await resolvePosterInternal(query);
  return NextResponse.json(result, {
    status: 200,
    headers: {
      "Cache-Control": "public, max-age=604800, stale-while-revalidate=86400",
    },
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { items?: PosterLookupQuery[] };
    const items = Array.isArray(body?.items) ? body.items.slice(0, 30) : [];

    if (items.length === 0) {
      return NextResponse.json({ results: {} }, { status: 200 });
    }

    const settled = await Promise.all(
      items.map(async (item) => {
        const res = await resolvePosterInternal(item);
        return [item.key, res] as const;
      }),
    );

    const results: Record<string, PosterLookupResult> = {};
    for (const [key, res] of settled) {
      if (key) results[key] = res;
    }

    return NextResponse.json(
      { results },
      {
        status: 200,
        headers: {
          "Cache-Control": "public, max-age=604800, stale-while-revalidate=86400",
        },
      },
    );
  } catch {
    return NextResponse.json({ results: {} }, { status: 200 });
  }
}