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
  ExploreSortOrder,
  SortDirection,
  RatingSource,
  RuntimeBucket,
  AgeTierFilter,
  SeriesStatusFilter,
  GalleryImageType,
} from "@/types/kinopoisk";
import { getApiKeys, getPreferences } from "@/lib/preferences";
import { getList } from "@/lib/userLists";
import { translateCountry, translateGenre, isRussian } from "@/lib/translate";

const BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  "https://kinopoiskapiunofficial.tech/api";

const CACHE_PREFIX = "cinemix_api_cache_v1:";
const FILM_META_CACHE_KEY = "cinemix_film_meta_v2";
const EXHAUSTED_KEYS_STORAGE = "cinemix_exhausted_keys";
const DAY_MS = 24 * 60 * 60 * 1000;

const memoryCache = new Map<string, { data: unknown; expiresAt: number }>();
const inflightApi = new Map<string, Promise<unknown>>();
const exhausted = new Map<string, number>();

// ─── Safe Mode & Region Classification Helpers ────────────────────────────────

const ADULT_GENRE_NAMES = new Set([
  "для взрослых",
  "эротика",
  "adult",
  "erotic",
]);

const RUSSIAN_COUNTRIES = new Set([
  "россия",
  "ссср",
  "российская империя",
  "беларусь",
  "белоруссия",
  "russia",
  "ussr",
  "russian empire",
  "belarus",
]);

const WESTERN_GLOBAL_COUNTRIES = new Set([
  "сша",
  "великобритания",
  "канада",
  "австралия",
  "новая зеландия",
  "франция",
  "германия",
  "италия",
  "испания",
  "южная корея",
  "корея южная",
  "япония",
  "usa",
  "uk",
  "canada",
  "australia",
  "france",
  "germany",
  "south korea",
  "japan",
]);

/**
 * Checks whether a film object is tagged as Adult (id 28) or Erotic (id 25) or NC-17.
 */
export function isAdultContentFilm(
  film?: Partial<Film> | { genres?: { genre: string }[]; ratingMpaa?: string } | null,
): boolean {
  if (!film) return false;
  if (film.genres && Array.isArray(film.genres)) {
    for (const g of film.genres) {
      const name = (g?.genre || "").trim().toLowerCase();
      if (ADULT_GENRE_NAMES.has(name)) return true;
    }
  }
  const mpaa = (film.ratingMpaa || "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");
  if (mpaa === "nc17") return true;
  return false;
}

/**
 * Checks whether a film is primarily a Russian/Soviet domestic production without
 * a major Western/International co-production.
 */
export function isRussianDomesticFilm(film?: Partial<Film> | null): boolean {
  if (!film) return false;
  const countries = (film.countries ?? []).map((c) =>
    (c.country || "").trim().toLowerCase(),
  );
  if (countries.length === 0) {
    const hasLatinTitle =
      (film.nameEn && !isRussian(film.nameEn)) ||
      (film.nameOriginal && !isRussian(film.nameOriginal));
    return !hasLatinTitle && Boolean(film.nameRu);
  }
  const hasRussian = countries.some((c) => RUSSIAN_COUNTRIES.has(c));
  if (!hasRussian) return false;
  const hasWesternCoProd = countries.some((c) => WESTERN_GLOBAL_COUNTRIES.has(c));
  return !hasWesternCoProd;
}

export function isSafeModeActive(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return getPreferences().safeModeEnabled ?? true;
  } catch {
    return true;
  }
}

export function sanitizeFilmsForSafeMode<T extends Partial<Film>>(items: T[]): T[] {
  if (!isSafeModeActive()) return items;
  return items.filter((item) => !isAdultContentFilm(item));
}

// ─── Persistent Compact Film Metadata Cache & Live Card Hydration ────────────

export interface CompactFilmMeta extends Partial<Film> {
  votes?: number;
  enriched?: boolean;
}

let memoryFilmMetaCache: Record<number, CompactFilmMeta> | null = null;
const attemptedHydrationIds = new Set<number>();
const hydrationQueue: number[] = [];
let hydrationWorkerRunning = false;

function getFilmMetaStore(): Record<number, CompactFilmMeta> {
  if (memoryFilmMetaCache) return memoryFilmMetaCache;
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(FILM_META_CACHE_KEY);
    memoryFilmMetaCache = raw ? (JSON.parse(raw) as Record<number, CompactFilmMeta>) : {};
  } catch {
    memoryFilmMetaCache = {};
  }
  return memoryFilmMetaCache!;
}

export function getCachedFilmMeta(filmId: number): CompactFilmMeta | undefined {
  if (!filmId || filmId <= 0) return undefined;
  return getFilmMetaStore()[filmId];
}

/**
 * Synchronously merges a partial Film object (e.g. from SimilarFilms, Sequels, or UserLists)
 * with any cached metadata in localStorage so year, genres, countries, rating, and age badges
 * display immediately without waiting for a click.
 */
export function hydrateFilmWithCache(film: Partial<Film> & { filmId?: number; kinopoiskId?: number }): Film {
  const id = film.kinopoiskId ?? film.filmId ?? 0;
  const cached = id > 0 ? getCachedFilmMeta(id) : undefined;
  if (!cached) {
    return {
      ...film,
      kinopoiskId: id,
      filmId: film.filmId ?? id,
      posterUrl: film.posterUrl || film.posterUrlPreview || "",
      posterUrlPreview: film.posterUrlPreview || film.posterUrl || "",
    } as Film;
  }

  const filmLength =
    (typeof film.filmLength === "number" && film.filmLength > 0
      ? film.filmLength
      : undefined) ??
    (typeof film.duration === "number" && film.duration > 0
      ? film.duration
      : undefined) ??
    cached.filmLength;

  const ratingKinopoisk =
    (typeof film.ratingKinopoisk === "number" && film.ratingKinopoisk > 0
      ? film.ratingKinopoisk
      : undefined) ?? cached.ratingKinopoisk;

  const ratingImdb =
    (typeof film.ratingImdb === "number" && film.ratingImdb > 0
      ? film.ratingImdb
      : undefined) ?? cached.ratingImdb;

  const ratingAwait =
    (typeof film.ratingAwait === "number" && film.ratingAwait > 0
      ? film.ratingAwait
      : undefined) ?? cached.ratingAwait;

  const ratingAgeLimits =
    (film.ratingAgeLimits && String(film.ratingAgeLimits).trim()
      ? film.ratingAgeLimits
      : undefined) ?? cached.ratingAgeLimits;

  const ratingMpaa =
    (film.ratingMpaa && String(film.ratingMpaa).trim()
      ? film.ratingMpaa
      : undefined) ?? cached.ratingMpaa;

  return {
    ...cached,
    ...film,
    kinopoiskId: id,
    filmId: film.filmId ?? id,
    imdbId: film.imdbId || cached.imdbId,
    nameRu: film.nameRu || cached.nameRu,
    nameEn: film.nameEn || cached.nameEn,
    nameOriginal: film.nameOriginal || cached.nameOriginal,
    posterUrl: film.posterUrl || cached.posterUrl || film.posterUrlPreview || "",
    posterUrlPreview: film.posterUrlPreview || cached.posterUrlPreview || film.posterUrl || "",
    year: film.year ?? cached.year,
    startYear: film.startYear ?? cached.startYear,
    endYear: film.endYear ?? cached.endYear,
    filmLength,
    duration: filmLength ?? film.duration ?? cached.duration,
    premiereRu: film.premiereRu || cached.premiereRu,
    ratingKinopoisk,
    ratingImdb,
    ratingAwait,
    rating:
      ratingImdb ??
      ratingKinopoisk ??
      film.rating ??
      cached.rating,
    ratingAgeLimits,
    ratingMpaa,
    genres:
      film.genres && film.genres.length > 0
        ? film.genres
        : cached.genres,
    countries:
      film.countries && film.countries.length > 0
        ? film.countries
        : cached.countries,
  } as Film;
}

export function saveCompactFilmMeta(film: Film, fromFullDetail = false): void {
  if (typeof window === "undefined") return;
  const id = film.kinopoiskId ?? film.filmId;
  if (!id) return;
  const store = getFilmMetaStore();
  const prev = store[id] ?? {};

  const nextYear = film.year ?? prev.year;
  const nextGenres =
    film.genres && film.genres.length > 0
      ? film.genres.slice(0, 4)
      : prev.genres;
  const nextCountries =
    film.countries && film.countries.length > 0
      ? film.countries.slice(0, 3)
      : prev.countries;
  const nextLength =
    (typeof film.filmLength === "number" && film.filmLength > 0
      ? film.filmLength
      : undefined) ??
    (typeof film.duration === "number" && film.duration > 0
      ? film.duration
      : undefined) ??
    prev.filmLength;
  const nextAgeLimits =
    (film.ratingAgeLimits && String(film.ratingAgeLimits).trim()
      ? film.ratingAgeLimits
      : undefined) ?? prev.ratingAgeLimits;
  const nextMpaa =
    (film.ratingMpaa && String(film.ratingMpaa).trim()
      ? film.ratingMpaa
      : undefined) ?? prev.ratingMpaa;
  const nextKp =
    (typeof film.ratingKinopoisk === "number" && film.ratingKinopoisk > 0
      ? film.ratingKinopoisk
      : undefined) ?? prev.ratingKinopoisk;
  const nextImdb =
    (typeof film.ratingImdb === "number" && film.ratingImdb > 0
      ? film.ratingImdb
      : undefined) ?? prev.ratingImdb;
  const nextAwait =
    (typeof film.ratingAwait === "number" && film.ratingAwait > 0
      ? film.ratingAwait
      : undefined) ?? prev.ratingAwait;

  const wasMissingCore =
    (!prev.year && Boolean(nextYear)) ||
    ((!prev.genres || prev.genres.length === 0) &&
      Boolean(nextGenres && nextGenres.length > 0)) ||
    (!prev.ratingAgeLimits && Boolean(nextAgeLimits)) ||
    (!prev.ratingMpaa && Boolean(nextMpaa)) ||
    (!prev.ratingKinopoisk && Boolean(nextKp)) ||
    (!prev.ratingImdb && Boolean(nextImdb)) ||
    (!prev.ratingAwait && Boolean(nextAwait)) ||
    (!prev.filmLength && Boolean(nextLength)) ||
    (fromFullDetail && !prev.enriched);

  // IMPORTANT: Only mark `enriched = true` when full detail (`/v2.2/films/{id}`) was fetched!
  // List endpoints (such as `/v2.2/films/premieres`) include year & genres but omit age rating,
  // IMDb/KP rating, and duration, so marking them `enriched` prematurely blocked background hydration.
  store[id] = {
    kinopoiskId: id,
    filmId: id,
    imdbId: film.imdbId || prev.imdbId,
    nameRu: film.nameRu ?? prev.nameRu,
    nameEn: film.nameEn ?? prev.nameEn,
    nameOriginal: film.nameOriginal ?? prev.nameOriginal,
    posterUrl: film.posterUrl || prev.posterUrl || "",
    posterUrlPreview: film.posterUrlPreview || prev.posterUrlPreview || "",
    year: nextYear,
    startYear: film.startYear ?? prev.startYear,
    endYear: film.endYear ?? prev.endYear,
    serial: film.serial ?? prev.serial,
    completed: film.completed ?? prev.completed,
    type: film.type ?? prev.type,
    ratingKinopoisk: nextKp,
    ratingKinopoiskVoteCount:
      film.ratingKinopoiskVoteCount ?? prev.ratingKinopoiskVoteCount,
    ratingImdb: nextImdb,
    ratingImdbVoteCount: film.ratingImdbVoteCount ?? prev.ratingImdbVoteCount,
    ratingAwait: nextAwait,
    votes:
      Math.max(
        film.ratingImdbVoteCount ?? 0,
        film.ratingKinopoiskVoteCount ?? 0,
      ) || prev.votes,
    ratingFilmCritics: film.ratingFilmCritics ?? prev.ratingFilmCritics,
    ratingAgeLimits: nextAgeLimits,
    ratingMpaa: nextMpaa,
    filmLength: nextLength,
    premiereRu: film.premiereRu || prev.premiereRu,
    countries: nextCountries,
    genres: nextGenres,
    enriched: Boolean(fromFullDetail || prev.enriched),
  };

  const keys = Object.keys(store);
  if (keys.length > 900) {
    for (let i = 0; i < 150; i++) {
      delete store[Number(keys[i])];
    }
  }

  try {
    localStorage.setItem(FILM_META_CACHE_KEY, JSON.stringify(store));
  } catch {
    // ignore storage quota errors
  }

  if (wasMissingCore) {
    window.dispatchEvent(
      new CustomEvent("cinemix-meta-updated", { detail: { filmId: id } }),
    );
  }
}

async function processHydrationQueue(): Promise<void> {
  if (hydrationWorkerRunning) return;
  hydrationWorkerRunning = true;
  try {
    while (hydrationQueue.length > 0) {
      const nextId = hydrationQueue.shift();
      if (!nextId) continue;
      const existing = getCachedFilmMeta(nextId);
      if (existing?.enriched) {
        continue;
      }
      try {
        await getFilm(nextId);
      } catch {
        attemptedHydrationIds.delete(nextId);
      }
    }
  } finally {
    hydrationWorkerRunning = false;
  }
}

/**
 * Queues a background metadata fetch for any film card missing year, genres, rating, duration,
 * or age certification so cards in "Premieres", "For You", "Watch Later", "Favorites", and "Similars"
 * self-populate automatically without requiring the user to click and navigate back.
 */
export function queueFilmMetaHydration(filmId: number, priority = false): void {
  if (typeof window === "undefined" || !filmId || filmId <= 0) return;
  const cached = getCachedFilmMeta(filmId);
  if (cached?.enriched) {
    return;
  }
  if (attemptedHydrationIds.has(filmId)) {
    if (priority) {
      const idx = hydrationQueue.indexOf(filmId);
      if (idx > 0) {
        hydrationQueue.splice(idx, 1);
        hydrationQueue.unshift(filmId);
      }
    }
    return;
  }
  attemptedHydrationIds.add(filmId);
  if (priority) {
    hydrationQueue.unshift(filmId);
  } else {
    hydrationQueue.push(filmId);
  }
  void processHydrationQueue();
}

// ─── API Key Rotation & Exhaustion Tracking ───────────────────────────────────

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
  if (keys.length === 0) {
    throw new Error("No API key configured.");
  }
  const available = keys.filter((k) => !exhausted.has(k));
  if (!available.length) {
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

function evictOldestSessionCacheEntries(count = 25) {
  if (typeof window === "undefined") return;
  try {
    const entries: { key: string; expiresAt: number }[] = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i);
      if (k && k.startsWith(CACHE_PREFIX)) {
        try {
          const parsed = JSON.parse(sessionStorage.getItem(k) || "{}") as {
            expiresAt?: number;
          };
          entries.push({ key: k, expiresAt: parsed.expiresAt ?? 0 });
        } catch {
          entries.push({ key: k, expiresAt: 0 });
        }
      }
    }
    entries.sort((a, b) => a.expiresAt - b.expiresAt);
    entries.slice(0, count).forEach((e) => sessionStorage.removeItem(e.key));
  } catch {
    // ignore
  }
}

function setCachedApi<T>(path: string, data: T, ttlSeconds: number) {
  const entry = { data, expiresAt: Date.now() + ttlSeconds * 1000 };
  memoryCache.set(path, entry);
  if (typeof window !== "undefined") {
    try {
      sessionStorage.setItem(CACHE_PREFIX + path, JSON.stringify(entry));
    } catch {
      evictOldestSessionCacheEntries(35);
      try {
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

// Lightweight rate-limit spacer: ensures at most 4.5 uncached requests fire per second (220ms spacing)
let nextAvailableSlot = 0;
async function waitRateLimitSlot(): Promise<void> {
  const now = Date.now();
  if (now < nextAvailableSlot) {
    const waitMs = nextAvailableSlot - now;
    nextAvailableSlot += 220;
    await sleep(waitMs);
  } else {
    nextAvailableSlot = now + 220;
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
      let key: string;
      try {
        key = getKey();
      } catch (err) {
        throw err instanceof Error ? err : new Error("All API keys exhausted.");
      }

      await waitRateLimitSlot();
      const res = await fetch(`${BASE_URL}${path}`, {
        headers: { "X-API-KEY": key, "Content-Type": "application/json" },
      });

      if (res.status === 402) {
        markExhausted(key);
        lastError = new Error(
          `Daily quota exhausted for key ${key.slice(0, 8)}…`,
        );
        continue;
      }

      if (res.status === 429) {
        await sleep(320 * (attempt + 1));
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

function normalizeFilmItem(
  f: Film & Record<string, unknown>,
  fromFullDetail = false,
): Film {
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

  const normalized: Film = {
    ...f,
    kinopoiskId: id,
    filmId: f.filmId ?? id,
    ratingKinopoisk,
    ratingAwait,
    rating: f.ratingImdb ?? ratingKinopoisk,
    filmLength,
    premiereRu,
  };

  saveCompactFilmMeta(normalized, fromFullDetail);
  return hydrateFilmWithCache(normalized);
}

function normalizeFilmsResponse(raw: Record<string, unknown>): FilmsResponse {
  const items = ((raw.items ?? raw.films ?? []) as (Film & Record<string, unknown>)[]);
  const normalized = items.map((item) => normalizeFilmItem(item, false));
  const safeItems = sanitizeFilmsForSafeMode(normalized);

  return {
    items: safeItems,
    total: (raw.total as number) ?? safeItems.length,
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
  if (resolvedType === "CLOSES_RELEASES") {
    return getUpcomingPremieres();
  }
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
  imdbId?: string;
  page?: number;
}): Promise<FilmsResponse> {
  if (
    isSafeModeActive() &&
    (params.genres === 28 || params.genres === 25)
  ) {
    return { items: [], total: 0, totalPages: 1 };
  }

  const q = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") {
      q.set(k, String(v));
    }
  });

  const raw = await apiFetch<Record<string, unknown>>(
    `/v2.2/films?${q.toString()}`,
  );
  return normalizeFilmsResponse(raw);
}

/**
 * Curates Hollywood & Global hits for the Home page.
 */
export async function getCuratedHomeSection(options: {
  type?: "FILM" | "TV_SERIES";
  genreId?: number;
  collection?: CollectionType;
  ratingFrom?: number;
}): Promise<Film[]> {
  const prefs =
    typeof window !== "undefined"
      ? getPreferences()
      : { contentRegionMode: "GLOBAL_FIRST" as const };
  const regionMode = prefs.contentRegionMode ?? "GLOBAL_FIRST";

  if (options.collection) {
    const [p1, p2] = await Promise.allSettled([
      getTopFilms(options.collection, 1),
      regionMode === "GLOBAL_FIRST"
        ? getFilmsByFilter({
            type: options.type ?? "FILM",
            countries: 1, // USA
            order: "NUM_VOTE",
            ratingFrom: options.ratingFrom ?? 7,
            page: 1,
          })
        : Promise.resolve(null),
    ]);
    const list1 = p1.status === "fulfilled" ? p1.value.items : [];
    const list2 = p2.status === "fulfilled" && p2.value ? p2.value.items : [];

    const combined = deduplicateFilms([...list2, ...list1]);
    if (regionMode === "GLOBAL_FIRST") {
      const globalOnly = combined.filter((f) => !isRussianDomesticFilm(f));
      return globalOnly.length >= 8 ? globalOnly : combined;
    }
    if (regionMode === "BALANCED") {
      const global = combined.filter((f) => !isRussianDomesticFilm(f));
      const domestic = combined.filter((f) => isRussianDomesticFilm(f));
      return [...global, ...domestic.slice(0, 3)];
    }
    return combined;
  }

  const [globalVotes, usaVotes] = await Promise.allSettled([
    getFilmsByFilter({
      type: options.type,
      genres: options.genreId,
      order: "NUM_VOTE",
      ratingFrom: options.ratingFrom ?? 6.8,
      page: 1,
    }),
    regionMode !== "ALL"
      ? getFilmsByFilter({
          type: options.type,
          genres: options.genreId,
          countries: 1,
          order: "NUM_VOTE",
          ratingFrom: options.ratingFrom ?? 6.6,
          page: 1,
        })
      : Promise.resolve(null),
  ]);

  const gItems = globalVotes.status === "fulfilled" ? globalVotes.value.items : [];
  const uItems =
    usaVotes.status === "fulfilled" && usaVotes.value ? usaVotes.value.items : [];

  const merged = deduplicateFilms([...uItems, ...gItems]);
  if (regionMode === "GLOBAL_FIRST") {
    const filtered = merged.filter((f) => !isRussianDomesticFilm(f));
    return filtered.length >= 6 ? filtered : merged;
  }
  if (regionMode === "BALANCED") {
    const global = merged.filter((f) => !isRussianDomesticFilm(f));
    const domestic = merged.filter((f) => isRussianDomesticFilm(f));
    return [...global, ...domestic.slice(0, 3)];
  }
  return merged;
}

export function deduplicateFilms(films: Film[]): Film[] {
  const seen = new Set<number>();
  const out: Film[] = [];
  for (const f of films) {
    const id = f.kinopoiskId ?? f.filmId;
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(f);
  }
  return out;
}

// ─── State-of-the-Art Explore Discovery Engine ────────────────────────────────

export interface DiscoverFilmsOptions {
  type?: "ALL" | "FILM" | "TV_SHOW" | "TV_SERIES" | "MINI_SERIES";
  excludeTypes?: string[];
  includeGenres?: number[];
  genreMatchMode?: "AND" | "OR";
  excludeGenres?: number[];
  includeCountries?: number[];
  excludeCountries?: number[];
  excludeRussian?: boolean;
  order?: ExploreSortOrder;
  direction?: SortDirection;
  ratingSource?: RatingSource;
  ratingFrom?: number;
  ratingTo?: number;
  requireImdb?: boolean;
  minVotes?: number;
  yearFrom?: number;
  yearTo?: number;
  runtimeBucket?: RuntimeBucket;
  includeAgeTiers?: AgeTierFilter[];
  excludeAgeTiers?: AgeTierFilter[];
  seriesStatus?: SeriesStatusFilter;
  keyword?: string;
  collectionPreset?: CollectionType;
  lens?: string;
  hideWatched?: boolean;
  hideFavorites?: boolean;
  hideWatchLater?: boolean;
  page?: number;
  randomSeed?: number;
  allGenresList?: { id: number; genre: string }[];
  allCountriesList?: { id: number; country: string }[];
}

function getEffectiveRating(film: Film, source: RatingSource = "AUTO"): number {
  const imdb = typeof film.ratingImdb === "number" && film.ratingImdb > 0 ? film.ratingImdb : undefined;
  const kp = typeof film.ratingKinopoisk === "number" && film.ratingKinopoisk > 0 ? film.ratingKinopoisk : undefined;
  const critics = typeof film.ratingFilmCritics === "number" && film.ratingFilmCritics > 0 ? film.ratingFilmCritics : undefined;

  if (source === "IMDB") return imdb ?? 0;
  if (source === "KP") return kp ?? 0;
  if (source === "CRITICS") return critics ?? imdb ?? kp ?? 0;
  if (source === "AVERAGE") {
    if (imdb && kp) return (imdb + kp) / 2;
    return imdb ?? kp ?? 0;
  }
  return imdb ?? kp ?? (typeof film.rating === "number" ? film.rating : 0);
}

function getEffectiveVotes(film: Film): number {
  const kpVotes = film.ratingKinopoiskVoteCount ?? 0;
  const imdbVotes = film.ratingImdbVoteCount ?? 0;
  return Math.max(kpVotes, imdbVotes);
}

function getFilmAgeTier(film: Film): AgeTierFilter | null {
  const mpaa = (film.ratingMpaa || "").trim().toUpperCase();
  const ageRaw = film.ratingAgeLimits
    ? parseInt(film.ratingAgeLimits.replace(/[^0-9]/g, ""), 10)
    : NaN;

  if (mpaa === "R" || mpaa === "NC-17" || mpaa === "NC17" || ageRaw >= 18) {
    return "MATURE";
  }
  if (mpaa === "PG-13" || mpaa === "PG13" || ageRaw === 12 || ageRaw === 16) {
    return "TEEN";
  }
  if (mpaa === "G" || mpaa === "PG" || ageRaw === 0 || ageRaw === 6) {
    return "FAMILY";
  }
  const genres = (film.genres ?? []).map((g) => g.genre.toLowerCase());
  if (
    genres.some((g) =>
      ["детский", "семейный", "мультфильм", "family", "children", "animation"].includes(g),
    )
  ) {
    return "FAMILY";
  }
  return null;
}

/**
 * Partitioned & Multi-Constraint Discovery Engine that breaks past the 100-item
 * single-query ceiling, supports 3+ simultaneous genres (AND/OR), negative filters,
 * bidirectional ASC/DESC sorting, rating brackets, and personalized "For You" taste matching.
 */
export async function discoverFilms(
  opts: DiscoverFilmsOptions,
): Promise<FilmsResponse> {
  const page = Math.max(1, opts.page ?? 1);
  const direction: SortDirection = opts.direction ?? "DESC";
  const order: ExploreSortOrder = opts.order ?? "NUM_VOTE";
  const ratingSource: RatingSource = opts.ratingSource ?? "AUTO";

  // 1. Handle Personalized "FOR_YOU" Taste-Match Lens (shared by Home "For You" row & Explore "For You" preset)
  if (opts.lens === "FOR_YOU") {
    return discoverTasteMatchedFilms(opts, page);
  }

  // 2. Handle Curated Theme Collection Presets
  if (opts.collectionPreset) {
    const pagesToFetch = [page, Math.min(25, page + 1)];
    const responses = await Promise.allSettled(
      pagesToFetch.map((p) => getTopFilms(opts.collectionPreset!, p)),
    );
    const rawPool: Film[] = [];
    let reportedTotal = 250;
    let reportedPages = 13;

    for (const r of responses) {
      if (r.status === "fulfilled") {
        rawPool.push(...r.value.items);
        reportedTotal = Math.max(reportedTotal, r.value.total || 250);
        reportedPages = Math.max(reportedPages, r.value.totalPages || 13);
      }
    }

    const filtered = applyClientDiscoveryFilters(
      deduplicateFilms(rawPool),
      opts,
      ratingSource,
    );
    const sorted = sortDiscoveryPool(filtered, order, direction, ratingSource, opts.randomSeed);
    return {
      items: sorted.slice(0, 20),
      total: reportedTotal,
      totalPages: Math.max(reportedPages, page + (sorted.length >= 20 ? 1 : 0)),
    };
  }

  // 3. Determine base API order & server-side window slicing to break the 100-item limit
  const apiOrder: "RATING" | "NUM_VOTE" | "YEAR" =
    order === "YEAR"
      ? "YEAR"
      : order === "RATING" ||
          order === "KP_RATING" ||
          order === "IMDB_RATING" ||
          order === "CRITICS"
        ? "RATING"
        : "NUM_VOTE";

  const minR = opts.ratingFrom !== undefined ? Math.max(0, opts.ratingFrom) : 0;
  const maxR = opts.ratingTo !== undefined ? Math.min(10, opts.ratingTo) : 10;
  const currentYear = new Date().getFullYear();
  const minY = opts.yearFrom !== undefined ? opts.yearFrom : undefined;
  const maxY = opts.yearTo !== undefined ? opts.yearTo : undefined;

  let queryRatingFrom: number | undefined = opts.ratingFrom;
  let queryRatingTo: number | undefined = opts.ratingTo;
  let queryYearFrom: number | undefined = minY;
  let queryYearTo: number | undefined = maxY;
  let apiPage = ((page - 1) % 5) + 1;
  const sliceIndex = Math.floor((page - 1) / 5);

  if (order === "RANDOM") {
    const seed = (opts.randomSeed ?? 1) + page * 7;
    apiPage = (seed % 5) + 1;
    const randomBands: [number, number][] = [
      [7.5, 10],
      [6.8, 8.2],
      [6.0, 7.5],
      [7.0, 9.0],
    ];
    const band = randomBands[seed % randomBands.length];
    if (queryRatingFrom === undefined) queryRatingFrom = band[0];
    if (queryRatingTo === undefined) queryRatingTo = band[1];
  } else if (direction === "ASC") {
    if (
      order === "RATING" ||
      order === "IMDB_RATING" ||
      order === "KP_RATING"
    ) {
      const baseFloor = minR > 0 ? minR : 1;
      const span = Math.max(1.5, (maxR - baseFloor) / 4);
      const bandLow = Math.min(maxR - 0.5, baseFloor + sliceIndex * span);
      const bandHigh = Math.min(maxR, bandLow + span + 0.5);
      queryRatingFrom = Math.round(bandLow * 10) / 10;
      queryRatingTo = Math.round(bandHigh * 10) / 10;
    } else if (order === "YEAR") {
      const startFloor = minY ?? 1950;
      const endCeil = maxY ?? currentYear;
      const decadeSpan = Math.max(8, Math.ceil((endCeil - startFloor) / 5));
      queryYearFrom = Math.min(endCeil, startFloor + sliceIndex * decadeSpan);
      queryYearTo = Math.min(endCeil, queryYearFrom + decadeSpan);
    }
  } else if (sliceIndex > 0) {
    if (order === "YEAR") {
      const topYear = maxY ?? currentYear;
      const bottomYear = minY ?? 1950;
      const step = 6;
      queryYearTo = Math.max(bottomYear + 2, topYear - sliceIndex * step);
      queryYearFrom = Math.max(bottomYear, queryYearTo - step * 2);
    } else {
      const topR = maxR;
      const ratingBands: [number, number][] = [
        [Math.max(minR, topR - 2.2), topR],
        [Math.max(minR, topR - 3.0), Math.max(minR + 0.5, topR - 1.2)],
        [Math.max(minR, topR - 3.8), Math.max(minR + 0.5, topR - 2.0)],
        [Math.max(minR, topR - 4.6), Math.max(minR + 0.5, topR - 2.8)],
        [Math.max(minR, topR - 5.5), Math.max(minR + 0.5, topR - 3.5)],
        [minR, Math.max(minR + 1.0, topR - 4.2)],
      ];
      const band = ratingBands[Math.min(sliceIndex, ratingBands.length - 1)];
      queryRatingFrom = Math.round(band[0] * 10) / 10;
      queryRatingTo = Math.round(band[1] * 10) / 10;
    }
  }

  if (order === "HIDDEN_GEMS") {
    if (queryRatingFrom === undefined || queryRatingFrom < 7) {
      queryRatingFrom = 7;
    }
  }

  const incGenres = (opts.includeGenres ?? []).filter(
    (id) => !isSafeModeActive() || (id !== 28 && id !== 25),
  );
  const incCountries = opts.includeCountries ?? [];

  const needsExtraClientFiltering =
    incGenres.length > 1 ||
    (opts.excludeGenres && opts.excludeGenres.length > 0) ||
    incCountries.length > 1 ||
    (opts.excludeCountries && opts.excludeCountries.length > 0) ||
    opts.excludeRussian ||
    opts.hideWatched ||
    opts.hideFavorites ||
    opts.hideWatchLater ||
    opts.requireImdb ||
    Boolean(opts.minVotes) ||
    (opts.runtimeBucket && opts.runtimeBucket !== "ANY") ||
    (opts.includeAgeTiers && opts.includeAgeTiers.length > 0) ||
    (opts.excludeAgeTiers && opts.excludeAgeTiers.length > 0) ||
    (opts.seriesStatus && opts.seriesStatus !== "ALL") ||
    order === "HIDDEN_GEMS";

  const baseType =
    opts.type === "ALL" || !opts.type
      ? undefined
      : (opts.type as "FILM" | "TV_SHOW" | "TV_SERIES" | "MINI_SERIES");

  const queriesToRun: Parameters<typeof getFilmsByFilter>[0][] = [];

  if (incGenres.length > 1 && opts.genreMatchMode === "OR") {
    for (const gId of incGenres.slice(0, 4)) {
      queriesToRun.push({
        type: baseType,
        genres: gId,
        countries: incCountries[0],
        order: apiOrder,
        ratingFrom: queryRatingFrom,
        ratingTo: queryRatingTo,
        yearFrom: queryYearFrom,
        yearTo: queryYearTo,
        keyword: opts.keyword,
        page: apiPage,
      });
    }
  } else if (incGenres.length > 1 && opts.genreMatchMode !== "OR") {
    for (const gId of incGenres.slice(0, 2)) {
      queriesToRun.push({
        type: baseType,
        genres: gId,
        countries: incCountries[0],
        order: apiOrder,
        ratingFrom: queryRatingFrom,
        ratingTo: queryRatingTo,
        yearFrom: queryYearFrom,
        yearTo: queryYearTo,
        keyword: opts.keyword,
        page: apiPage,
      });
      if (apiPage < 5) {
        queriesToRun.push({
          type: baseType,
          genres: gId,
          countries: incCountries[0],
          order: apiOrder,
          ratingFrom: queryRatingFrom,
          ratingTo: queryRatingTo,
          yearFrom: queryYearFrom,
          yearTo: queryYearTo,
          keyword: opts.keyword,
          page: apiPage + 1,
        });
      }
    }
  } else if (incCountries.length > 1) {
    for (const cId of incCountries.slice(0, 3)) {
      queriesToRun.push({
        type: baseType,
        genres: incGenres[0],
        countries: cId,
        order: apiOrder,
        ratingFrom: queryRatingFrom,
        ratingTo: queryRatingTo,
        yearFrom: queryYearFrom,
        yearTo: queryYearTo,
        keyword: opts.keyword,
        page: apiPage,
      });
    }
  } else {
    queriesToRun.push({
      type: baseType,
      genres: incGenres[0],
      countries: incCountries[0],
      order: apiOrder,
      ratingFrom: queryRatingFrom,
      ratingTo: queryRatingTo,
      yearFrom: queryYearFrom,
      yearTo: queryYearTo,
      keyword: opts.keyword,
      page: apiPage,
    });
    if (needsExtraClientFiltering && apiPage < 5) {
      queriesToRun.push({
        type: baseType,
        genres: incGenres[0],
        countries: incCountries[0],
        order: apiOrder,
        ratingFrom: queryRatingFrom,
        ratingTo: queryRatingTo,
        yearFrom: queryYearFrom,
        yearTo: queryYearTo,
        keyword: opts.keyword,
        page: apiPage + 1,
      });
    }
  }

  const settled = await Promise.allSettled(
    queriesToRun.map((q) => getFilmsByFilter(q)),
  );

  const pool: Film[] = [];
  let maxApiTotal = 0;
  let maxApiPages = 1;

  for (const res of settled) {
    if (res.status === "fulfilled") {
      pool.push(...res.value.items);
      maxApiTotal = Math.max(maxApiTotal, res.value.total ?? 0);
      maxApiPages = Math.max(maxApiPages, res.value.totalPages ?? 1);
    }
  }

  const uniquePool = deduplicateFilms(pool);
  const filteredPool = applyClientDiscoveryFilters(
    uniquePool,
    opts,
    ratingSource,
  );
  const sortedPool = sortDiscoveryPool(
    filteredPool,
    order,
    direction,
    ratingSource,
    opts.randomSeed,
  );

  const canPartitionDeep =
    maxApiPages >= 5 || maxApiTotal >= 80 || page > 1;
  const effectiveTotalPages = canPartitionDeep
    ? Math.max(25, page + (sortedPool.length >= 12 ? 2 : 0))
    : Math.max(1, maxApiPages);
  const effectiveTotal = canPartitionDeep
    ? Math.max(maxApiTotal, effectiveTotalPages * 20)
    : filteredPool.length;

  return {
    items: sortedPool.slice(0, 24),
    total: sortedPool.length === 0 && page === 1 ? 0 : effectiveTotal,
    totalPages: sortedPool.length === 0 && page === 1 ? 1 : effectiveTotalPages,
  };
}

/**
 * Unified "For You" Taste-Match Engine (used by both Home "For You" row and Explore "For You" preset).
 * Utilises Favorites, Watch Later, and Recently Watched films — including their
 * Sequels & Prequels (`getRelatedFilms`) and Similar Films (`getSimilarFilms`).
 */
export async function discoverTasteMatchedFilms(
  opts: DiscoverFilmsOptions = {},
  page = 1,
): Promise<FilmsResponse> {
  const favs = getList("favorites");
  const watchLater = getList("watchlater");
  const history = getList("history");

  // Interleave seeds from Favorites, Watch Later, and Recently Watched so all 3 lists drive recommendations
  const rawSeeds = [...favs, ...watchLater, ...history];
  const seenSeedIds = new Set<number>();
  const uniqueSeeds: typeof rawSeeds = [];
  for (const entry of rawSeeds) {
    if (!entry.film_id || seenSeedIds.has(entry.film_id)) continue;
    seenSeedIds.add(entry.film_id);
    uniqueSeeds.push(entry);
    if (uniqueSeeds.length >= 6) break;
  }

  const pool: Film[] = [];

  if (uniqueSeeds.length > 0) {
    // Fetch both Sequels/Prequels (`getRelatedFilms`) and Similar Films (`getSimilarFilms`) in parallel
    const activeSeeds = uniqueSeeds.slice(0, 4);
    const [relatedResults, similarResults] = await Promise.all([
      Promise.allSettled(activeSeeds.map((s) => getRelatedFilms(s.film_id))),
      Promise.allSettled(activeSeeds.map((s) => getSimilarFilms(s.film_id))),
    ]);

    // 1. Sequels & Prequels of Favorites, Watch Later, and Recently Watched
    for (const rel of relatedResults) {
      if (rel.status === "fulfilled" && Array.isArray(rel.value)) {
        for (const rf of rel.value) {
          pool.push(hydrateFilmWithCache(rf));
        }
      }
    }

    // 2. Similar Films of Favorites, Watch Later, and Recently Watched
    for (const sim of similarResults) {
      if (sim.status === "fulfilled" && sim.value?.items) {
        for (const sf of sim.value.items) {
          pool.push(
            hydrateFilmWithCache({
              kinopoiskId: sf.filmId,
              filmId: sf.filmId,
              nameRu: sf.nameRu,
              nameEn: sf.nameEn,
              nameOriginal: sf.nameOriginal,
              posterUrl: sf.posterUrl,
              posterUrlPreview: sf.posterUrlPreview,
            }),
          );
        }
      }
    }

    // 3. Also include unwatched Watch Later & Favorite items so user's saved titles are part of the taste pool
    for (const item of [...watchLater, ...favs].slice(0, 10)) {
      pool.push(
        hydrateFilmWithCache({
          kinopoiskId: item.film_id,
          filmId: item.film_id,
          nameEn: item.film_name,
          nameRu: item.film_name,
          posterUrl: item.poster_url || "",
          posterUrlPreview: item.poster_url || "",
          year: item.year ?? undefined,
          ratingKinopoisk: item.rating ?? undefined,
        }),
      );
    }
  }

  // Supplement with top global movies & series so For You always has a deep multi-page catalog
  const supplement = await getFilmsByFilter({
    type: opts.type === "ALL" ? undefined : opts.type,
    countries: 1,
    order: "NUM_VOTE",
    ratingFrom: 7.2,
    page: ((page - 1) % 5) + 1,
  }).catch(() => ({ items: [], total: 0, totalPages: 1 }));

  pool.push(...supplement.items);

  const filtered = applyClientDiscoveryFilters(
    deduplicateFilms(pool),
    { ...opts, hideWatched: opts.hideWatched ?? true },
    opts.ratingSource ?? "AUTO",
  );

  const pageSlice = filtered.slice(0, 24);

  // Proactively queue background metadata hydration for any card in the slice missing year or genres
  for (const f of pageSlice) {
    const fid = f.kinopoiskId ?? f.filmId;
    if (fid && (!f.year || !f.genres || f.genres.length === 0)) {
      queueFilmMetaHydration(fid, true);
    }
  }

  return {
    items: pageSlice,
    total: Math.max(filtered.length, 120),
    totalPages: 6,
  };
}

function applyClientDiscoveryFilters(
  films: Film[],
  opts: DiscoverFilmsOptions,
  ratingSource: RatingSource,
): Film[] {
  const watchedSet = opts.hideWatched
    ? new Set(getList("history").map((e) => e.film_id))
    : null;
  const favSet = opts.hideFavorites
    ? new Set(getList("favorites").map((e) => e.film_id))
    : null;
  const wlSet = opts.hideWatchLater
    ? new Set(getList("watchlater").map((e) => e.film_id))
    : null;

  const genreIdToNames = new Map<number, string[]>();
  for (const g of opts.allGenresList ?? []) {
    const ru = g.genre.trim().toLowerCase();
    const en = translateGenre(g.genre, true).trim().toLowerCase();
    genreIdToNames.set(g.id, [ru, en]);
  }

  const countryIdToNames = new Map<number, string[]>();
  for (const c of opts.allCountriesList ?? []) {
    const ru = c.country.trim().toLowerCase();
    const en = translateCountry(c.country, true).trim().toLowerCase();
    countryIdToNames.set(c.id, [ru, en]);
  }

  return films.filter((film) => {
    const id = film.kinopoiskId ?? film.filmId;

    // 1. Safe Mode guard
    if (isSafeModeActive() && isAdultContentFilm(film)) return false;

    // 2. Personal Library exclusions
    if (watchedSet && watchedSet.has(id)) return false;
    if (favSet && favSet.has(id)) return false;
    if (wlSet && wlSet.has(id)) return false;

    // 3. Excluded Media Types
    if (
      opts.excludeTypes &&
      opts.excludeTypes.length > 0 &&
      film.type &&
      opts.excludeTypes.includes(film.type)
    ) {
      return false;
    }

    // 4. Silent Regional Priority (from Preferences) unless user explicitly included Russia/USSR in Countries filter
    const userExplicitlyIncludedRussia = (opts.includeCountries ?? []).some((cId) => {
      const names = countryIdToNames.get(cId) ?? [];
      return names.some((n) => RUSSIAN_COUNTRIES.has(n));
    });
    const prefRegionMode =
      typeof window !== "undefined"
        ? (getPreferences().contentRegionMode ?? "GLOBAL_FIRST")
        : "GLOBAL_FIRST";
    const shouldExcludeRussianSilent =
      !userExplicitlyIncludedRussia &&
      (opts.excludeRussian !== undefined
        ? opts.excludeRussian
        : prefRegionMode === "GLOBAL_FIRST");

    if (shouldExcludeRussianSilent && isRussianDomesticFilm(film)) {
      return false;
    }

    const filmGenreNames = (film.genres ?? []).map((g) =>
      g.genre.trim().toLowerCase(),
    );
    const filmGenreEnNames = (film.genres ?? []).map((g) =>
      translateGenre(g.genre, true).trim().toLowerCase(),
    );
    const allFilmGenres = new Set([...filmGenreNames, ...filmGenreEnNames]);

    // 5. Multi-Genre Include (AND mode when >1 genre selected)
    if (
      opts.includeGenres &&
      opts.includeGenres.length > 1 &&
      opts.genreMatchMode !== "OR" &&
      genreIdToNames.size > 0 &&
      allFilmGenres.size > 0
    ) {
      const matchesAll = opts.includeGenres.every((gId) => {
        const candidates = genreIdToNames.get(gId);
        if (!candidates) return true;
        return candidates.some((name) => allFilmGenres.has(name));
      });
      if (!matchesAll) return false;
    }

    // 6. Negative Genre Exclusions
    if (
      opts.excludeGenres &&
      opts.excludeGenres.length > 0 &&
      genreIdToNames.size > 0 &&
      allFilmGenres.size > 0
    ) {
      const hasExcludedGenre = opts.excludeGenres.some((gId) => {
        const candidates = genreIdToNames.get(gId);
        if (!candidates) return false;
        return candidates.some((name) => allFilmGenres.has(name));
      });
      if (hasExcludedGenre) return false;
    }

    // 7. Country Include / Exclude
    const filmCountryNames = (film.countries ?? []).map((c) =>
      c.country.trim().toLowerCase(),
    );
    const filmCountryEnNames = (film.countries ?? []).map((c) =>
      translateCountry(c.country, true).trim().toLowerCase(),
    );
    const allFilmCountries = new Set([
      ...filmCountryNames,
      ...filmCountryEnNames,
    ]);

    if (
      opts.excludeCountries &&
      opts.excludeCountries.length > 0 &&
      countryIdToNames.size > 0 &&
      allFilmCountries.size > 0
    ) {
      const hasExcludedCountry = opts.excludeCountries.some((cId) => {
        const candidates = countryIdToNames.get(cId);
        if (!candidates) return false;
        return candidates.some((name) => allFilmCountries.has(name));
      });
      if (hasExcludedCountry) return false;
    }

    // 8. Require IMDb Score
    if (opts.requireImdb && (!film.ratingImdb || film.ratingImdb <= 0)) {
      return false;
    }

    // 9. Exact Rating Band Check
    const effRating = getEffectiveRating(film, ratingSource);
    if (effRating > 0) {
      if (opts.ratingFrom !== undefined && effRating < opts.ratingFrom - 0.1) {
        return false;
      }
      if (opts.ratingTo !== undefined && effRating > opts.ratingTo + 0.1) {
        return false;
      }
    }

    // 10. Vote Confidence ("Anti-Fluke" / Cult Filter)
    const votes = getEffectiveVotes(film);
    if (opts.minVotes !== undefined && opts.minVotes !== 0 && votes > 0) {
      if (opts.minVotes > 0 && votes < opts.minVotes) return false;
      if (opts.minVotes < 0 && votes > Math.abs(opts.minVotes)) return false;
    }

    // 11. Year Range Check
    const yr = film.year ?? film.startYear;
    if (yr) {
      if (opts.yearFrom !== undefined && yr < opts.yearFrom) return false;
      if (opts.yearTo !== undefined && yr > opts.yearTo) return false;
    }

    // 12. Runtime Bucket Filter
    if (
      opts.runtimeBucket &&
      opts.runtimeBucket !== "ANY" &&
      film.filmLength &&
      film.filmLength > 0
    ) {
      if (opts.runtimeBucket === "SHORT" && film.filmLength >= 95) return false;
      if (
        (opts.runtimeBucket === "MEDIUM" || opts.runtimeBucket === "STANDARD") &&
        (film.filmLength < 95 || film.filmLength > 130)
      ) {
        return false;
      }
      if (
        (opts.runtimeBucket === "LONG" || opts.runtimeBucket === "EPIC") &&
        film.filmLength <= 130
      ) {
        return false;
      }
    }

    // 13. Age Suitability Tiers (Include & Exclude)
    const tier = getFilmAgeTier(film);
    if (
      opts.includeAgeTiers &&
      opts.includeAgeTiers.length > 0 &&
      tier !== null &&
      !opts.includeAgeTiers.includes(tier)
    ) {
      return false;
    }
    if (
      opts.excludeAgeTiers &&
      opts.excludeAgeTiers.length > 0 &&
      tier !== null &&
      opts.excludeAgeTiers.includes(tier)
    ) {
      return false;
    }

    // 14. Series Completion Status
    if (opts.seriesStatus && opts.seriesStatus !== "ALL") {
      if (opts.seriesStatus === "COMPLETED" && film.completed === false) {
        return false;
      }
      if (opts.seriesStatus === "ONGOING" && film.completed === true) {
        return false;
      }
    }

    return true;
  });
}

function sortDiscoveryPool(
  films: Film[],
  order: ExploreSortOrder,
  direction: SortDirection,
  ratingSource: RatingSource,
  randomSeed = 1,
): Film[] {
  const copy = [...films];
  const dirMult = direction === "ASC" ? 1 : -1;

  if (order === "RANDOM") {
    let s = randomSeed + 1337;
    for (let i = copy.length - 1; i > 0; i--) {
      s = (s * 16807) % 2147483647;
      const j = s % (i + 1);
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  copy.sort((a, b) => {
    if (order === "TITLE") {
      const titleA = (a.nameEn || a.nameOriginal || a.nameRu || "").toLowerCase();
      const titleB = (b.nameEn || b.nameOriginal || b.nameRu || "").toLowerCase();
      return titleA.localeCompare(titleB) * (direction === "ASC" ? 1 : -1);
    }

    if (order === "YEAR") {
      const yA = a.year ?? a.startYear ?? (direction === "ASC" ? 9999 : 0);
      const yB = b.year ?? b.startYear ?? (direction === "ASC" ? 9999 : 0);
      if (yA !== yB) return (yA - yB) * dirMult;
    }

    if (order === "IMDB_RATING") {
      const rA = a.ratingImdb ?? a.ratingKinopoisk ?? 0;
      const rB = b.ratingImdb ?? b.ratingKinopoisk ?? 0;
      if (rA !== rB) return (rA - rB) * dirMult;
    }

    if (order === "KP_RATING") {
      const rA = a.ratingKinopoisk ?? a.ratingImdb ?? 0;
      const rB = b.ratingKinopoisk ?? b.ratingImdb ?? 0;
      if (rA !== rB) return (rA - rB) * dirMult;
    }

    if (order === "CRITICS") {
      const cA = a.ratingFilmCritics ?? a.ratingGoodReview ?? a.ratingImdb ?? a.ratingKinopoisk ?? 0;
      const cB = b.ratingFilmCritics ?? b.ratingGoodReview ?? b.ratingImdb ?? b.ratingKinopoisk ?? 0;
      if (cA !== cB) return (cA - cB) * dirMult;
    }

    if (order === "HIDDEN_GEMS") {
      const scoreGem = (f: Film) => {
        const r = getEffectiveRating(f, ratingSource);
        const v = getEffectiveVotes(f);
        const voteSweetSpot = v > 0 && v < 45000 ? 1.15 : v >= 45000 ? 0.85 : 1.0;
        return r * voteSweetSpot;
      };
      return (scoreGem(a) - scoreGem(b)) * dirMult;
    }

    if (order === "NUM_VOTE") {
      const vA = getEffectiveVotes(a);
      const vB = getEffectiveVotes(b);
      if (vA !== vB && (vA > 0 || vB > 0)) return (vA - vB) * dirMult;
    }

    const effA = getEffectiveRating(a, ratingSource);
    const effB = getEffectiveRating(b, ratingSource);
    return (effA - effB) * dirMult;
  });

  return copy;
}

// ─── Single Film & Detail Endpoints ───────────────────────────────────────────

export async function getFilm(id: number): Promise<Film> {
  const raw = await apiFetch<Film & Record<string, unknown>>(`/v2.2/films/${id}`);
  return normalizeFilmItem(raw, true);
}

export async function getFilmStaff(filmId: number): Promise<Staff[]> {
  return apiFetch(`/v1/staff?filmId=${filmId}`);
}

export const getStaff = getFilmStaff;

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
  return sanitizeFilmsForSafeMode(
    (items ?? []).map((item) => normalizeFilmItem(item, false)),
  );
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
  const res = await apiFetch<FiltersResponse>(`/v2.2/films/filters`, 86400);
  if (isSafeModeActive()) {
    return {
      genres: (res.genres ?? []).filter(
        (g) =>
          g.id !== 28 &&
          g.id !== 25 &&
          !ADULT_GENRE_NAMES.has(g.genre.trim().toLowerCase()),
      ),
      countries: res.countries ?? [],
    };
  }
  return res;
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
  type: GalleryImageType = "STILL",
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

const PREMIERE_MONTH_NAMES = [
  "JANUARY",
  "FEBRUARY",
  "MARCH",
  "APRIL",
  "MAY",
  "JUNE",
  "JULY",
  "AUGUST",
  "SEPTEMBER",
  "OCTOBER",
  "NOVEMBER",
  "DECEMBER",
] as const;

export async function getPremieres(
  year: number,
  month: string,
): Promise<FilmsResponse> {
  const raw = await apiFetch<Record<string, unknown>>(
    `/v2.2/films/premieres?year=${year}&month=${month}`,
  );
  return normalizeFilmsResponse(raw);
}

/**
 * Fetches genuine upcoming premieres across the remaining days of the current month
 * and the next 2 calendar months, strictly excluding old theatrical re-releases
 * (film.year < currentYear) and already-released past dates.
 */
export async function getUpcomingPremieres(): Promise<FilmsResponse> {
  const now = new Date();
  const curYear = now.getFullYear();
  const curMonthIdx = now.getMonth();
  const yyyy = curYear;
  const mm = String(curMonthIdx + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const todayStr = `${yyyy}-${mm}-${dd}`;

  const targets: { year: number; month: string; isCurrentMonth: boolean }[] = [
    {
      year: curYear,
      month: PREMIERE_MONTH_NAMES[curMonthIdx],
      isCurrentMonth: true,
    },
    {
      year: curMonthIdx + 1 > 11 ? curYear + 1 : curYear,
      month: PREMIERE_MONTH_NAMES[(curMonthIdx + 1) % 12],
      isCurrentMonth: false,
    },
    {
      year: curMonthIdx + 2 > 11 ? curYear + 1 : curYear,
      month: PREMIERE_MONTH_NAMES[(curMonthIdx + 2) % 12],
      isCurrentMonth: false,
    },
  ];

  const settled = await Promise.allSettled(
    targets.map((t) => getPremieres(t.year, t.month)),
  );

  const upcomingPool: Film[] = [];
  settled.forEach((res, idx) => {
    if (res.status !== "fulfilled" || !res.value?.items) return;
    const isCurrentMonth = targets[idx].isCurrentMonth;

    for (const film of res.value.items) {
      // 1. Strictly exclude old films getting theatrical re-releases
      const filmYear = film.year ?? film.startYear;
      if (filmYear && filmYear < curYear) continue;

      // 2. Require a future premiere date (strictly > today for current month, >= today for upcoming months)
      if (film.premiereRu) {
        const pDate = film.premiereRu.slice(0, 10);
        if (isCurrentMonth ? pDate <= todayStr : pDate < todayStr) {
          continue;
        }
      } else if (isCurrentMonth) {
        continue;
      }

      upcomingPool.push(film);
    }
  });

  const unique = deduplicateFilms(upcomingPool);
  unique.sort((a, b) => {
    const dA = a.premiereRu
      ? new Date(a.premiereRu).getTime() || Number.MAX_SAFE_INTEGER
      : Number.MAX_SAFE_INTEGER;
    const dB = b.premiereRu
      ? new Date(b.premiereRu).getTime() || Number.MAX_SAFE_INTEGER
      : Number.MAX_SAFE_INTEGER;
    return dA - dB;
  });

  return {
    items: unique,
    total: unique.length,
    totalPages: 1,
  };
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