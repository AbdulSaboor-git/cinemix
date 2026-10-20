import {
  Film,
  FilmsResponse,
  Staff,
  VideosResponse,
  PersonDetail,
  FiltersResponse,
  FactsResponse,
  BoxOfficeResponse,
  SeasonsResponse,
  SimilarsResponse,
  ReviewsResponse,
  AwardResponse,
  DistributionResponse,
  ApiKeyResponse,
  CollectionType,
} from "@/types/kinopoisk";
import { getApiKeys } from "@/lib/preferences";

const BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  "https://kinopoiskapiunofficial.tech/api";

const CACHE_PREFIX = "cinemix_api_cache_v1:";
const EXHAUSTED_KEYS_STORAGE = "cinemix_exhausted_keys";
const DAY_MS = 24 * 60 * 60 * 1000;

const memoryCache = new Map<string, { data: unknown; expiresAt: number }>();
const inflightApi = new Map<string, Promise<unknown>>();
const exhausted = new Map<string, number>();

// Hydrate exhausted keys from localStorage
function syncExhaustedFromStorage() {
  if (typeof window === "undefined") return;
  try {
    const raw = localStorage.getItem(EXHAUSTED_KEYS_STORAGE);
    if (!raw) return;
    const parsed = JSON.parse(raw) as Record<string, number>;
    const now = Date.now();
    let changed = false;
    for (const [k, ts] of Object.entries(parsed)) {
      if (now - ts < DAY_MS) {
        exhausted.set(k, ts);
      } else {
        changed = true;
      }
    }
    if (changed) persistExhaustedToStorage();
  } catch {
    // ignore storage errors
  }
}

function persistExhaustedToStorage() {
  if (typeof window === "undefined") return;
  try {
    const obj: Record<string, number> = {};
    const now = Date.now();
    for (const [k, ts] of exhausted.entries()) {
      if (now - ts < DAY_MS) obj[k] = ts;
    }
    localStorage.setItem(EXHAUSTED_KEYS_STORAGE, JSON.stringify(obj));
  } catch {
    // ignore storage errors
  }
}

function getKey(): string {
  syncExhaustedFromStorage();
  const now = Date.now();
  for (const [k, t] of exhausted) {
    if (now - t > DAY_MS) exhausted.delete(k);
  }
  const keys = getApiKeys();
  const available = keys.filter((k) => !exhausted.has(k));
  if (!available.length) {
    // If all keys were marked exhausted, fall back to the first key as a last resort
    if (keys.length > 0) return keys[0];
    throw new Error("All API keys exhausted for today.");
  }
  return available[0];
}

function markExhausted(key: string) {
  exhausted.set(key, Date.now());
  persistExhaustedToStorage();
  const keys = getApiKeys();
  console.warn(
    `[CineMix] Daily quota exhausted for key ${key.slice(0, 8)}… (${keys.filter((k) => !exhausted.has(k)).length} remaining).`,
  );
}

export function clearApiCache(): void {
  memoryCache.clear();
  exhausted.clear();
  if (typeof window !== "undefined") {
    try {
      localStorage.removeItem(EXHAUSTED_KEYS_STORAGE);
      const toRemove: string[] = [];
      for (let i = 0; i < sessionStorage.length; i++) {
        const k = sessionStorage.key(i);
        if (k && k.startsWith(CACHE_PREFIX)) toRemove.push(k);
      }
      toRemove.forEach((k) => sessionStorage.removeItem(k));
    } catch {
      // ignore
    }
  }
}

function getCachedApi<T>(path: string): T | null {
  const now = Date.now();
  const mem = memoryCache.get(path);
  if (mem && mem.expiresAt > now) return mem.data as T;

  if (typeof window !== "undefined") {
    try {
      const raw = sessionStorage.getItem(CACHE_PREFIX + path);
      if (raw) {
        const parsed = JSON.parse(raw) as { data: T; expiresAt: number };
        if (parsed.expiresAt > now) {
          memoryCache.set(path, parsed);
          return parsed.data;
        }
        sessionStorage.removeItem(CACHE_PREFIX + path);
      }
    } catch {
      // ignore storage errors
    }
  }
  return null;
}

function setCachedApi<T>(path: string, data: T, ttlSeconds: number) {
  const entry = { data, expiresAt: Date.now() + ttlSeconds * 1000 };
  memoryCache.set(path, entry);
  if (typeof window !== "undefined") {
    try {
      sessionStorage.setItem(CACHE_PREFIX + path, JSON.stringify(entry));
    } catch {
      // sessionStorage full — evict old cache entries
      try {
        sessionStorage.clear();
        sessionStorage.setItem(CACHE_PREFIX + path, JSON.stringify(entry));
      } catch {
        // ignore
      }
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Lightweight rate-limit spacer: ensures at most 4 uncached requests fire per second (250ms spacing)
let nextAvailableSlot = 0;
async function waitRateLimitSlot(): Promise<void> {
  const now = Date.now();
  if (now < nextAvailableSlot) {
    const waitMs = nextAvailableSlot - now;
    nextAvailableSlot += 250;
    await sleep(waitMs);
  } else {
    nextAvailableSlot = now + 250;
  }
}

async function apiFetch<T>(path: string, revalidate = 3600): Promise<T> {
  const cached = getCachedApi<T>(path);
  if (cached !== null) return cached;

  const existing = inflightApi.get(path);
  if (existing) return existing as Promise<T>;

  const requestPromise = (async (): Promise<T> => {
    const keys = getApiKeys();
    let lastError: Error | null = null;
    const maxAttempts = Math.max(keys.length * 2, 3);

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      await waitRateLimitSlot();
      const key = getKey();
      const res = await fetch(`${BASE_URL}${path}`, {
        headers: { "X-API-KEY": key, "Content-Type": "application/json" },
      });

      // 402 = Daily quota exceeded for this key -> mark key exhausted for 24h and rotate
      if (res.status === 402) {
        markExhausted(key);
        lastError = new Error(
          `Daily quota exhausted for key ${key.slice(0, 8)}…`,
        );
        continue;
      }

      // 429 = Per-second rate limit exceeded -> backoff and retry WITHOUT blacklisting the key
      if (res.status === 429) {
        await sleep(350 * (attempt + 1));
        lastError = new Error("Rate limit reached, retrying…");
        continue;
      }

      if (!res.ok) throw new Error(`API error: ${res.status} ${path}`);
      const data = (await res.json()) as T;
      setCachedApi(path, data, revalidate);
      return data;
    }
    throw lastError ?? new Error("All API keys exhausted.");
  })();

  inflightApi.set(path, requestPromise);
  try {
    return await requestPromise;
  } finally {
    inflightApi.delete(path);
  }
}

export function parseFilmLengthToMinutes(
  rawLength?: number | string | null,
  rawDuration?: number | null,
): number | undefined {
  if (typeof rawLength === "number" && !isNaN(rawLength) && rawLength > 0) {
    return rawLength;
  }
  if (typeof rawDuration === "number" && !isNaN(rawDuration) && rawDuration > 0) {
    return rawDuration;
  }
  if (typeof rawLength === "string" && rawLength.includes(":")) {
    const [h, m] = rawLength.split(":").map(Number);
    if (!isNaN(h) && !isNaN(m)) {
      const total = h * 60 + m;
      return total > 0 ? total : undefined;
    }
  }
  if (typeof rawLength === "string") {
    const parsed = parseInt(rawLength, 10);
    if (!isNaN(parsed) && parsed > 0) return parsed;
  }
  return undefined;
}

function normalizeFilmItem(f: Film & Record<string, unknown>): Film {
  const id = (f.kinopoiskId ?? f.filmId ?? 0) as number;
  const rawRatingStr =
    f.rating !== undefined && f.rating !== null && f.rating !== "null"
      ? String(f.rating).trim()
      : "";
  const isPercentage = rawRatingStr.endsWith("%");
  const numericRating = rawRatingStr ? parseFloat(rawRatingStr) : undefined;

  const ratingKinopoisk =
    typeof f.ratingKinopoisk === "number" && f.ratingKinopoisk > 0
      ? f.ratingKinopoisk
      : !isPercentage &&
          numericRating !== undefined &&
          !isNaN(numericRating) &&
          numericRating > 0 &&
          numericRating <= 10
        ? numericRating
        : undefined;

  const ratingAwait =
    typeof f.ratingAwait === "number" && f.ratingAwait > 0
      ? f.ratingAwait
      : isPercentage && numericRating !== undefined && !isNaN(numericRating)
        ? numericRating
        : undefined;

  const filmLength = parseFilmLengthToMinutes(
    f.filmLength as number | string | undefined,
    f.duration as number | undefined,
  );

  const premiereRu =
    typeof f.premiereRu === "string"
      ? f.premiereRu
      : typeof (f as { premiere?: string }).premiere === "string"
        ? (f as { premiere?: string }).premiere
        : undefined;

  return {
    ...f,
    kinopoiskId: id,
    filmId: f.filmId ?? id,
    ratingKinopoisk,
    ratingAwait,
    rating: ratingKinopoisk ?? f.ratingImdb,
    filmLength,
    premiereRu,
  };
}

function normalizeFilmsResponse(raw: Record<string, unknown>): FilmsResponse {
  const items = ((raw.items ?? raw.films ?? []) as (Film & Record<string, unknown>)[]);
  const normalized = items.map(normalizeFilmItem);

  return {
    items: normalized,
    total: (raw.total as number) ?? normalized.length,
    totalPages:
      (raw.totalPages as number) ??
      (raw.pagesCount as number) ??
      1,
  };
}

const COLLECTION_TYPE_MAP: Record<string, string> = {
  TOP_100_POPULAR_FILMS: "TOP_POPULAR_ALL",
  TOP_250_BEST_FILMS: "TOP_250_MOVIES",
  TOP_AWAIT_FILMS: "CLOSES_RELEASES",
};

// ─── Films & Collections ──────────────────────────────────────────────────────

export async function getTopFilms(
  type: CollectionType = "TOP_POPULAR_ALL",
  page = 1,
): Promise<FilmsResponse> {
  const resolvedType = COLLECTION_TYPE_MAP[type] ?? type;
  const raw = await apiFetch<Record<string, unknown>>(
    `/v2.2/films/collections?type=${encodeURIComponent(resolvedType)}&page=${page}`,
  );
  return normalizeFilmsResponse(raw);
}

export async function getFilmsByFilter(params: {
  genres?: number;
  countries?: number;
  order?: "RATING" | "NUM_VOTE" | "YEAR";
  type?: "ALL" | "FILM" | "TV_SHOW" | "TV_SERIES" | "MINI_SERIES";
  ratingFrom?: number;
  ratingTo?: number;
  yearFrom?: number;
  yearTo?: number;
  keyword?: string;
  page?: number;
}): Promise<FilmsResponse> {
  const cap = new Date().getFullYear();
  const yearTo =
    params.yearTo !== undefined ? Math.min(params.yearTo, cap) : cap;

  const q = new URLSearchParams();
  Object.entries({ ...params, yearTo }).forEach(
    ([k, v]) => v !== undefined && q.set(k, String(v)),
  );

  const raw = await apiFetch<Record<string, unknown>>(
    `/v2.2/films?${q.toString()}`,
  );
  return normalizeFilmsResponse(raw);
}

export async function getFilm(id: number): Promise<Film> {
  const raw = await apiFetch<Film & Record<string, unknown>>(`/v2.2/films/${id}`);
  return normalizeFilmItem(raw);
}

export async function getFilmStaff(filmId: number): Promise<Staff[]> {
  return apiFetch(`/v1/staff?filmId=${filmId}`);
}

export async function getFilmVideos(filmId: number): Promise<VideosResponse> {
  return apiFetch(`/v2.2/films/${filmId}/videos`);
}

export async function searchFilms(
  keyword: string,
  page = 1,
): Promise<FilmsResponse> {
  const raw = await apiFetch<Record<string, unknown>>(
    `/v2.1/films/search-by-keyword?keyword=${encodeURIComponent(keyword)}&page=${page}`,
  );
  return normalizeFilmsResponse(raw);
}

export async function getRelatedFilms(filmId: number): Promise<Film[]> {
  const items = await apiFetch<(Film & Record<string, unknown>)[]>(
    `/v2.1/films/${filmId}/sequels_and_prequels`,
  );
  return (items ?? []).map(normalizeFilmItem);
}

export async function getSimilarFilms(
  filmId: number,
): Promise<SimilarsResponse> {
  return apiFetch(`/v2.2/films/${filmId}/similars`);
}

export async function getPerson(personId: number): Promise<PersonDetail> {
  return apiFetch(`/v1/staff/${personId}`, 86400);
}

export async function getFilters(): Promise<FiltersResponse> {
  return apiFetch(`/v2.2/films/filters`, 86400);
}

export async function getFilmFacts(filmId: number): Promise<FactsResponse> {
  return apiFetch(`/v2.2/films/${filmId}/facts`);
}

export async function getFilmBoxOffice(
  filmId: number,
): Promise<BoxOfficeResponse> {
  return apiFetch(`/v2.2/films/${filmId}/box_office`);
}

export async function getFilmSeasons(
  filmId: number,
): Promise<SeasonsResponse> {
  return apiFetch(`/v2.2/films/${filmId}/seasons`);
}

export async function getFilmImages(
  filmId: number,
  type = "STILL",
  page = 1,
): Promise<{
  total: number;
  totalPages: number;
  items: { imageUrl: string; previewUrl: string }[];
}> {
  return apiFetch(`/v2.2/films/${filmId}/images?type=${type}&page=${page}`);
}

export async function getFilmReviews(
  filmId: number,
  page = 1,
  order:
    | "DATE_DESC"
    | "DATE_ASC"
    | "USER_POSITIVE_RATING_DESC"
    | "USER_POSITIVE_RATING_ASC"
    | "USER_NEGATIVE_RATING_DESC"
    | "USER_NEGATIVE_RATING_ASC" = "DATE_DESC",
): Promise<ReviewsResponse> {
  return apiFetch(
    `/v2.2/films/${filmId}/reviews?page=${page}&order=${order}`,
  );
}

export async function getPremieres(
  year: number,
  month: string,
): Promise<FilmsResponse> {
  const raw = await apiFetch<Record<string, unknown>>(
    `/v2.2/films/premieres?year=${year}&month=${month}`,
  );
  return normalizeFilmsResponse(raw);
}

export async function getFilmAwards(filmId: number): Promise<AwardResponse> {
  return apiFetch(`/v2.2/films/${filmId}/awards`);
}

export async function getFilmDistributions(
  filmId: number,
): Promise<DistributionResponse> {
  return apiFetch(`/v2.2/films/${filmId}/distributions`);
}

export async function getApiKeyInfo(apiKey: string): Promise<ApiKeyResponse> {
  const res = await fetch(`${BASE_URL}/v1/api_keys/${apiKey}`, {
    headers: { "X-API-KEY": apiKey, "Content-Type": "application/json" },
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}
