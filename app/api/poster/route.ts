// app/api/poster/route.ts
import { NextRequest, NextResponse } from "next/server";
import { resolveEnglishAlias } from "@/lib/translate";

export const dynamic = "force-dynamic";

export interface PosterLookupQuery {
  key: string;
  imdbId?: string | null;
  title?: string | null;
  origTitle?: string | null;
  nameRu?: string | null;
  year?: number | string | null;
  type?: string | null;
}

export interface PosterLookupResult {
  posterUrl: string | null;
  imdbId: string | null;
  matchedTitle?: string | null;
  matchedYear?: number | null;
}

export interface ImdbSearchBridgeItem {
  imdbId: string;
  title: string;
  year: number | null;
  kind: "movie" | "series" | "person" | "other";
  posterUrl: string | null;
}

interface ImdbSuggestionItem {
  id?: string;
  l?: string;
  y?: number;
  yr?: string;
  q?: string;
  qid?: string;
  s?: string;
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
    .replace(
      /\s*\((?:сериал|мини-сериал|тв|фильм|кино|series|tv|mini-series|\d{4}.*?)\)\s*/gi,
      " ",
    )
    .replace(/\s+/g, " ")
    .trim();
}

function parseValidYear(rawYear?: number | string | null): number | null {
  if (rawYear === undefined || rawYear === null || rawYear === "") return null;
  const m = String(rawYear).match(/\b(18\d{2}|19\d{2}|20\d{2})\b/);
  if (!m) return null;
  const parsed = parseInt(m[1], 10);
  return !isNaN(parsed) && parsed >= 1888 && parsed <= 2035 ? parsed : null;
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

const serverTranslationCache = new Map<string, string | null>();

async function translateCyrillicToEnglishServer(
  text?: string | null,
): Promise<string | null> {
  if (!text || !hasCyrillic(text)) return null;
  const key = text.trim().toLowerCase();
  if (serverTranslationCache.has(key)) {
    return serverTranslationCache.get(key) ?? null;
  }
  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=ru&tl=en&dt=t&q=${encodeURIComponent(text.trim())}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(2500) });
    if (!res.ok) return null;
    const json = await res.json();
    const translated = (json[0] as [string, string][])
      .map((chunk) => chunk[0])
      .join("")
      .trim();
    const result = translated && !hasCyrillic(translated) ? translated : null;
    if (serverTranslationCache.size > 1500) {
      serverTranslationCache.clear();
    }
    serverTranslationCache.set(key, result);
    return result;
  } catch {
    return null;
  }
}

function extractItemStartYear(item: ImdbSuggestionItem): number | null {
  if (typeof item.y === "number" && item.y > 1880) return item.y;
  if (typeof item.yr === "string") {
    const m = item.yr.match(/\b(18\d{2}|19\d{2}|20\d{2})\b/);
    if (m) return parseInt(m[1], 10);
  }
  return null;
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
  if (
    qid.includes("videogame") ||
    qid.includes("video game") ||
    qid === "podcastseries" ||
    qid === "podcastepisode" ||
    qid.includes("musicvideo") ||
    qid.includes("tvepisode")
  ) {
    return -999;
  }

  const candNorm = normalizeTitleForMatch(item.l);
  if (!candNorm) return -999;

  // Strict media type verification when targetType is known
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
  const isCandMovie =
    qid === "movie" ||
    qid === "feature" ||
    qid === "tvmovie" ||
    qid === "video";

  if (normType) {
    if (isTargetSeries && isCandMovie) return -999;
    if (!isTargetSeries && isCandSeries) return -999;
  }

  const itemYear = extractItemStartYear(item);

  // Strict Year Verification: reject any candidate > 1 year off when targetYear is known
  let yearScore = 0;
  if (targetYear !== null) {
    if (!itemYear) return -999;
    const diff = Math.abs(itemYear - targetYear);
    if (diff === 0) {
      yearScore = 75;
    } else if (diff === 1) {
      yearScore = 25;
    } else {
      return -999;
    }
  }

  // Strict Title Verification: only exact, space-insensitive exact, or exact-year colon-base match
  let titleScore = -999;
  for (const t of targetTitles) {
    const targetNorm = normalizeTitleForMatch(t);
    if (!targetNorm) continue;

    if (candNorm === targetNorm) {
      titleScore = Math.max(titleScore, 80);
      break;
    }

    // Space-insensitive exact match (e.g. "old boy" vs "oldboy", "spider man" vs "spiderman")
    if (candNorm.replace(/\s+/g, "") === targetNorm.replace(/\s+/g, "")) {
      titleScore = Math.max(titleScore, 74);
      break;
    }

    // Colon base-title match ONLY when exact release year matches (prevents sequel/remake swaps)
    if (targetYear !== null && itemYear === targetYear) {
      const candBase = normalizeTitleForMatch(item.l?.split(":")[0]);
      const targetBase = normalizeTitleForMatch(t.split(":")[0]);
      if (
        candBase &&
        targetBase &&
        candBase.length >= 4 &&
        candBase === targetBase
      ) {
        titleScore = Math.max(titleScore, 62);
      }
    }
  }

  if (titleScore < 62) return -999;

  // Without a known release year, require exact normalized title equality to prevent misplaced posters
  if (targetYear === null && titleScore < 74) {
    return -999;
  }

  const typeScore = normType ? 12 : 0;
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

  const validYear = parseValidYear(query.year);

  const aliasEn = resolveEnglishAlias(
    query.nameRu || (hasCyrillic(query.title) ? query.title : null),
    query.origTitle,
  );

  // Put English title / alias FIRST before origTitle so English names ("Oldboy", "Money Heist")
  // are prioritized over romanized/foreign original titles ("Oldeuboi", "La casa de papel").
  const rawCandidateTitles = [aliasEn, query.title, query.origTitle]
    .map((t) => cleanSearchTitle(t))
    .filter(
      (t): t is string =>
        Boolean(t) &&
        t.toLowerCase() !== "unknown" &&
        !hasCyrillic(t) &&
        t.length >= 2,
    );

  // If only a Cyrillic title was available, translate it on the server
  if (rawCandidateTitles.length === 0) {
    const cyrSource = query.nameRu || query.title || query.origTitle;
    const translated = await translateCyrillicToEnglishServer(cyrSource);
    if (translated) {
      const cleaned = cleanSearchTitle(translated);
      if (cleaned && cleaned.length >= 2) {
        rawCandidateTitles.push(cleaned);
      }
    }
  }

  const uniqueTitles = Array.from(new Set(rawCandidateTitles));

  const cacheSignature = cleanImdbId
    ? `imdb:${cleanImdbId}:y=${validYear || ""}`
    : uniqueTitles.length > 0
      ? `title:${uniqueTitles.map((t) => normalizeTitleForMatch(t)).join("|")}:y=${validYear || "noyear"}:t=${query.type || ""}`
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
        const res: PosterLookupResult = {
          posterUrl: exact.i!.imageUrl!,
          imdbId: exact.id!.toLowerCase(),
          matchedTitle: exact.l || null,
          matchedYear: extractItemStartYear(exact),
        };
        setCachedResult(cacheSignature, res);
        return res;
      }

      // Strict IMDb ID lock: never fall through to title search when an exact IMDb ID is known
      const fallbackCdn: PosterLookupResult = {
        posterUrl: `https://images.metahub.space/poster/large/${cleanImdbId}/img`,
        imdbId: cleanImdbId,
      };
      setCachedResult(cacheSignature, fallbackCdn);
      return fallbackCdn;
    }

    // 2. Title + Year resolution (strictly distinguishing same-name remakes by year)
    if (uniqueTitles.length > 0) {
      const searchQueries: { q: string; hasYear: boolean }[] = [];

      for (const t of uniqueTitles.slice(0, 2)) {
        if (validYear) {
          searchQueries.push({ q: `${t} ${validYear}`, hasYear: true });
        }
        searchQueries.push({ q: t, hasYear: false });
      }

      let bestCandidate: ImdbSuggestionItem | null = null;
      let bestScore = -999;

      for (const { q: qStr } of searchQueries) {
        const suggestions = await fetchImdbSuggestions(qStr);
        for (const item of suggestions) {
          if (cleanImdbId && item.id?.toLowerCase() === cleanImdbId) {
            if (isValidPosterUrl(item.i?.imageUrl)) {
              const res: PosterLookupResult = {
                posterUrl: item.i!.imageUrl!,
                imdbId: cleanImdbId,
                matchedTitle: item.l || null,
                matchedYear: extractItemStartYear(item),
              };
              setCachedResult(cacheSignature, res);
              return res;
            }
          }

          const s = scoreCandidate(
            item,
            uniqueTitles,
            validYear,
            query.type,
          );
          if (s > bestScore) {
            bestScore = s;
            bestCandidate = item;
          }
        }

        // Stop early only if we found an exact title + exact year match
        if (bestScore >= 135 && bestCandidate) {
          break;
        }
      }

      const minRequiredScore = validYear ? 95 : 74;
      if (
        bestCandidate &&
        bestScore >= minRequiredScore &&
        isValidPosterUrl(bestCandidate.i?.imageUrl)
      ) {
        const res: PosterLookupResult = {
          posterUrl: bestCandidate.i!.imageUrl!,
          imdbId: bestCandidate.id
            ? bestCandidate.id.toLowerCase()
            : cleanImdbId,
          matchedTitle: bestCandidate.l || null,
          matchedYear: extractItemStartYear(bestCandidate),
        };
        setCachedResult(cacheSignature, res);
        return res;
      }
    }

    // 3. Final fallback if cleanImdbId was provided
    if (cleanImdbId) {
      const fallbackCdn: PosterLookupResult = {
        posterUrl: `https://images.metahub.space/poster/large/${cleanImdbId}/img`,
        imdbId: cleanImdbId,
      };
      setCachedResult(cacheSignature, fallbackCdn);
      return fallbackCdn;
    }

    const miss: PosterLookupResult = { posterUrl: null, imdbId: null };
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

// ─── Route Handlers (Single GET + Search Bridge + Micro-Batched POST) ────────

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const mode = sp.get("mode");

  // Search Bridge Mode: Resolves English titles, typos, and international aliases via IMDb Suggestions
  if (mode === "search") {
    const rawQ = (sp.get("q") || "").trim();
    if (!rawQ || rawQ.length < 2) {
      return NextResponse.json({ items: [] }, { status: 200 });
    }
    const suggestions = await fetchImdbSuggestions(rawQ);
    const items: ImdbSearchBridgeItem[] = [];
    let personHint: string | null = null;
    for (let i = 0; i < suggestions.length; i++) {
      const s = suggestions[i];
      if (!s.id || !s.l) continue;
      const qid = (s.qid || s.q || "").toLowerCase();
      if (
        qid.includes("videogame") ||
        qid.includes("video game") ||
        qid.includes("podcast")
      ) {
        continue;
      }
      // Capture top-ranked actor/director name hint (0 Kinopoisk tokens) without mixing person cards into items
      if (i <= 1 && /^nm\d+$/i.test(s.id) && !personHint) {
        personHint = s.l.trim();
        continue;
      }
      const isTitle = /^tt\d+$/i.test(s.id);
      if (!isTitle) continue;
      items.push({
        imdbId: s.id.toLowerCase(),
        title: s.l,
        year: extractItemStartYear(s),
        kind:
          qid.includes("series") || qid.includes("tv") ? "series" : "movie",
        posterUrl: isValidPosterUrl(s.i?.imageUrl) ? s.i!.imageUrl! : null,
      });
      if (items.length >= 10) break;
    }
    return NextResponse.json(
      { items, personHint },
      {
        status: 200,
        headers: {
          "Cache-Control": "public, max-age=86400, stale-while-revalidate=86400",
        },
      },
    );
  }

  const query: PosterLookupQuery = {
    key: sp.get("key") || "single",
    imdbId: sp.get("imdbId"),
    title: sp.get("title"),
    origTitle: sp.get("origTitle"),
    nameRu: sp.get("nameRu"),
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