import {
  Film,
  FilmsResponse,
  Staff,
  VideosResponse,
  PersonDetail,
  PersonSearchItem,
  PersonSearchResponse,
  MatchedPersonSummary,
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
import {
  getApiKeys,
  getRawApiKeys,
  hasApiKeys,
  hasVerifiedApiKey,
  markKeyInvalid,
  markKeyValid,
  getPreferences,
} from "@/lib/preferences";
import { getList, getRatedFilms } from "@/lib/userLists";
import {
  translateCountry,
  translateGenre,
  isRussian,
  getEnglishName,
  resolveEnglishAlias,
  getSearchQueryAliases,
  translateQueryToRussian,
  getCachedTranslation,
} from "@/lib/translate";
import { sanitizePosterUrl } from "@/components/posterFallback";

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
 * Safely parses a year field (which may arrive as a number or string like "2003" or "null")
 * into a valid 4-digit release year.
 */
export function parseYearNumber(raw?: unknown): number | undefined {
  if (raw === undefined || raw === null || raw === "" || raw === "null") {
    return undefined;
  }
  if (typeof raw === "number") {
    return !isNaN(raw) && raw >= 1888 && raw <= 2035 ? raw : undefined;
  }
  if (typeof raw === "string") {
    const m = raw.match(/\b(18\d{2}|19\d{2}|20\d{2})\b/);
    if (m) {
      const n = parseInt(m[1], 10);
      return !isNaN(n) && n >= 1888 && n <= 2035 ? n : undefined;
    }
  }
  return undefined;
}

/**
 * Checks whether a film object is tagged as Adult (id 28) or Erotic (id 25) or NC-17.
 */
export function isAdultContentFilm(
  film?: Partial<Film> | { genres?: { genre: string }[]; ratingMpaa?: string; ratingAgeLimits?: string } | null,
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
  updatedAt?: number;
}

let memoryFilmMetaCache: Record<number, CompactFilmMeta> | null = null;
const attemptedHydrationIds = new Set<number>();
const hydrationQueue: number[] = [];
let hydrationWorkerRunning = false;
let persistMetaTimer: ReturnType<typeof setTimeout> | null = null;
const pendingMetaEventIds = new Set<number>();
let metaEventRaf: number | null = null;

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

export function getAllCachedFilms(): CompactFilmMeta[] {
  return Object.values(getFilmMetaStore());
}

/**
 * Evicts the OLDEST entries by `updatedAt` timestamp rather than V8 ascending integer key order
 * (resolves Bug #5 where low-ID classics like ID 301 The Matrix were repeatedly evicted first).
 */
function schedulePersistFilmMetaStore(): void {
  if (typeof window === "undefined" || persistMetaTimer) return;
  persistMetaTimer = setTimeout(() => {
    persistMetaTimer = null;
    try {
      const store = getFilmMetaStore();
      const keys = Object.keys(store);
      if (keys.length > 1000) {
        const sortedByAge = keys.sort(
          (a, b) =>
            (store[Number(a)]?.updatedAt ?? 0) -
            (store[Number(b)]?.updatedAt ?? 0),
        );
        for (let i = 0; i < 180; i++) {
          delete store[Number(sortedByAge[i])];
        }
      }
      localStorage.setItem(FILM_META_CACHE_KEY, JSON.stringify(store));
    } catch {
      // ignore storage quota errors
    }
  }, 400);
}

function queueMetaUpdatedEvent(filmId: number): void {
  if (typeof window === "undefined") return;
  pendingMetaEventIds.add(filmId);
  if (metaEventRaf !== null) return;
  metaEventRaf = requestAnimationFrame(() => {
    metaEventRaf = null;
    if (pendingMetaEventIds.size === 0) return;
    const ids = Array.from(pendingMetaEventIds);
    pendingMetaEventIds.clear();
    window.dispatchEvent(
      new CustomEvent("cinemix-meta-updated", {
        detail: {
          filmId: ids.length === 1 ? ids[0] : undefined,
          filmIds: ids,
        },
      }),
    );
  });
}

/**
 * Synchronously merges a partial Film object (e.g. from SimilarFilms, Sequels, or UserLists)
 * with any cached metadata in localStorage so year, genres, countries, rating, and age badges
 * display immediately without waiting for a click.
 */
export function hydrateFilmWithCache(
  film: Partial<Film> & { filmId?: number; kinopoiskId?: number },
): Film {
  const id = film.kinopoiskId ?? film.filmId ?? 0;
  const cached = id > 0 ? getCachedFilmMeta(id) : undefined;
  const parsedFilmYear = parseYearNumber(film.year);
  const parsedStartYear = parseYearNumber(film.startYear);
  const parsedEndYear = parseYearNumber(film.endYear);

  if (!cached) {
    return {
      ...film,
      kinopoiskId: id,
      filmId: film.filmId ?? id,
      year: parsedFilmYear,
      startYear: parsedStartYear,
      endYear: parsedEndYear,
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
    posterUrlPreview:
      film.posterUrlPreview || cached.posterUrlPreview || film.posterUrl || "",
    year: parsedFilmYear ?? cached.year,
    startYear: parsedStartYear ?? cached.startYear,
    endYear: parsedEndYear ?? cached.endYear,
    filmLength,
    duration: filmLength ?? film.duration ?? cached.duration,
    premiereRu: film.premiereRu || cached.premiereRu,
    ratingKinopoisk,
    ratingImdb,
    ratingAwait,
    rating: ratingImdb ?? ratingKinopoisk ?? film.rating ?? cached.rating,
    ratingAgeLimits,
    ratingMpaa,
    genres:
      film.genres && film.genres.length > 0 ? film.genres : cached.genres,
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
  const prev = store[id];
  const hadPrev = Boolean(prev);
  const safePrev = prev ?? {};

  const nextYear = parseYearNumber(film.year) ?? safePrev.year;
  const nextStartYear = parseYearNumber(film.startYear) ?? safePrev.startYear;
  const nextEndYear = parseYearNumber(film.endYear) ?? safePrev.endYear;
  const nextGenres =
    film.genres && film.genres.length > 0
      ? film.genres.slice(0, 4)
      : safePrev.genres;
  const nextCountries =
    film.countries && film.countries.length > 0
      ? film.countries.slice(0, 3)
      : safePrev.countries;
  const nextLength =
    (typeof film.filmLength === "number" && film.filmLength > 0
      ? film.filmLength
      : undefined) ??
    (typeof film.duration === "number" && film.duration > 0
      ? film.duration
      : undefined) ??
    safePrev.filmLength;
  const nextAgeLimits =
    (film.ratingAgeLimits && String(film.ratingAgeLimits).trim()
      ? film.ratingAgeLimits
      : undefined) ?? safePrev.ratingAgeLimits;
  const nextMpaa =
    (film.ratingMpaa && String(film.ratingMpaa).trim()
      ? film.ratingMpaa
      : undefined) ?? safePrev.ratingMpaa;
  const nextKp =
    (typeof film.ratingKinopoisk === "number" && film.ratingKinopoisk > 0
      ? film.ratingKinopoisk
      : undefined) ?? safePrev.ratingKinopoisk;
  const nextImdb =
    (typeof film.ratingImdb === "number" && film.ratingImdb > 0
      ? film.ratingImdb
      : undefined) ?? safePrev.ratingImdb;
  const nextAwait =
    (typeof film.ratingAwait === "number" && film.ratingAwait > 0
      ? film.ratingAwait
      : undefined) ?? safePrev.ratingAwait;

  const wasMissingCore =
    hadPrev &&
    ((!safePrev.year && Boolean(nextYear)) ||
      ((!safePrev.genres || safePrev.genres.length === 0) &&
        Boolean(nextGenres && nextGenres.length > 0)) ||
      (!safePrev.ratingAgeLimits && Boolean(nextAgeLimits)) ||
      (!safePrev.ratingMpaa && Boolean(nextMpaa)) ||
      (!safePrev.ratingKinopoisk && Boolean(nextKp)) ||
      (!safePrev.ratingImdb && Boolean(nextImdb)) ||
      (!safePrev.ratingAwait && Boolean(nextAwait)) ||
      (!safePrev.filmLength && Boolean(nextLength)) ||
      (fromFullDetail && !safePrev.enriched));

  store[id] = {
    kinopoiskId: id,
    filmId: id,
    imdbId: film.imdbId || safePrev.imdbId,
    nameRu: film.nameRu ?? safePrev.nameRu,
    nameEn: film.nameEn ?? safePrev.nameEn,
    nameOriginal: film.nameOriginal ?? safePrev.nameOriginal,
    posterUrl: film.posterUrl || safePrev.posterUrl || "",
    posterUrlPreview: film.posterUrlPreview || safePrev.posterUrlPreview || "",
    year: nextYear,
    startYear: nextStartYear,
    endYear: nextEndYear,
    serial: film.serial ?? safePrev.serial,
    completed: film.completed ?? safePrev.completed,
    type: film.type ?? safePrev.type,
    ratingKinopoisk: nextKp,
    ratingKinopoiskVoteCount:
      film.ratingKinopoiskVoteCount ?? safePrev.ratingKinopoiskVoteCount,
    ratingImdb: nextImdb,
    ratingImdbVoteCount:
      film.ratingImdbVoteCount ?? safePrev.ratingImdbVoteCount,
    ratingAwait: nextAwait,
    votes:
      Math.max(
        film.ratingImdbVoteCount ?? 0,
        film.ratingKinopoiskVoteCount ?? 0,
      ) || safePrev.votes,
    ratingFilmCritics: film.ratingFilmCritics ?? safePrev.ratingFilmCritics,
    ratingAgeLimits: nextAgeLimits,
    ratingMpaa: nextMpaa,
    filmLength: nextLength,
    premiereRu: film.premiereRu || safePrev.premiereRu,
    countries: nextCountries,
    genres: nextGenres,
    enriched: Boolean(fromFullDetail || safePrev.enriched),
    updatedAt: Date.now(),
  };

  schedulePersistFilmMetaStore();

  if (fromFullDetail || wasMissingCore) {
    queueMetaUpdatedEvent(id);
  }
}

// ─── Dual-Priority Rate Scheduler (Eliminates Navigation Priority Inversion) ──

let activeHighPriorityCount = 0;
let nextHighSlot = 0;
let nextLowSlot = 0;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitRateLimitSlot(
  priority: "high" | "low" = "high",
): Promise<void> {
  if (priority === "high") {
    const now = Date.now();
    if (now < nextHighSlot) {
      const waitMs = nextHighSlot - now;
      nextHighSlot += 75;
      await sleep(waitMs);
    } else {
      nextHighSlot = now + 75;
    }
    return;
  }

  // Low-priority background requests yield whenever foreground requests are active
  // and re-verify their slot after waking so they never burst simultaneously.
  for (;;) {
    while (activeHighPriorityCount > 0) {
      await sleep(140);
    }
    const now = Date.now();
    const earliest = Math.max(now, nextHighSlot, nextLowSlot);
    const waitMs = earliest - now;
    if (waitMs <= 0) {
      nextLowSlot = now + 220;
      return;
    }
    nextLowSlot = earliest + 220;
    await sleep(waitMs);
    if (activeHighPriorityCount === 0) {
      return;
    }
  }
}

async function processHydrationQueue(): Promise<void> {
  if (hydrationWorkerRunning) return;
  hydrationWorkerRunning = true;
  try {
    while (hydrationQueue.length > 0) {
      if (activeHighPriorityCount > 0) {
        await sleep(200);
        continue;
      }
      const nextId = hydrationQueue.shift();
      if (!nextId) continue;
      const existing = getCachedFilmMeta(nextId);
      if (existing?.enriched) {
        continue;
      }
      try {
        await getFilmLowPriority(nextId);
      } catch {
        attemptedHydrationIds.delete(nextId);
      }
    }
  } finally {
    hydrationWorkerRunning = false;
  }
}

/**
 * Queues a low-priority background metadata fetch for any film card missing core fields
 * (year, genres, rating) without ever blocking foreground route or tab navigation.
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
  if (hydrationQueue.length > 36 && !priority) {
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

let exhaustedSynced = false;

function syncExhaustedFromStorage() {
  if (typeof window === "undefined" || exhaustedSynced) return;
  exhaustedSynced = true;
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
  pendingSessionWrites.clear();
  if (sessionWriteTimer) {
    clearTimeout(sessionWriteTimer);
    sessionWriteTimer = null;
  }
  exhausted.clear();
  exhaustedSynced = false;
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
    window.dispatchEvent(new CustomEvent("cinemix-cache-clear"));
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

const pendingSessionWrites = new Map<string, { data: unknown; expiresAt: number }>();
let sessionWriteTimer: ReturnType<typeof setTimeout> | null = null;

function flushSessionWrites() {
  sessionWriteTimer = null;
  if (typeof window === "undefined" || pendingSessionWrites.size === 0) return;
  const entries = Array.from(pendingSessionWrites.entries());
  pendingSessionWrites.clear();

  for (const [path, entry] of entries) {
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

function setCachedApi<T>(path: string, data: T, ttlSeconds: number) {
  const entry = { data, expiresAt: Date.now() + ttlSeconds * 1000 };
  memoryCache.set(path, entry);
  if (typeof window !== "undefined") {
    pendingSessionWrites.set(path, entry);
    if (!sessionWriteTimer) {
      sessionWriteTimer = setTimeout(flushSessionWrites, 250);
    }
  }
}

async function apiFetch<T>(
  path: string,
  revalidate = 3600,
  priority: "high" | "low" = "high",
): Promise<T> {
  if (!hasApiKeys()) {
    throw new Error("No valid API key configured.");
  }

  if (hasVerifiedApiKey()) {
    const cached = getCachedApi<T>(path);
    if (cached !== null) return cached;
  }

  const existing = inflightApi.get(path);
  if (existing) return existing as Promise<T>;

  if (priority === "high") {
    activeHighPriorityCount += 1;
  }

  const requestPromise = (async (): Promise<T> => {
    const keys = getApiKeys();
    if (keys.length === 0) {
      throw new Error("No valid API key configured.");
    }
    let lastError: Error | null = null;
    const maxAttempts = Math.max(keys.length * 2, 3);

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      let key: string;
      try {
        key = getKey();
      } catch (err) {
        throw err instanceof Error ? err : new Error("All API keys exhausted.");
      }

      await waitRateLimitSlot(priority);
      let res: Response;
      try {
        res = await fetch(`${BASE_URL}${path}`, {
          headers: { "X-API-KEY": key, "Content-Type": "application/json" },
        });
      } catch (err) {
        if (err instanceof TypeError && !/^[ -~]+$/.test(key)) {
          markKeyInvalid(key);
          lastError = new Error("Invalid API key.");
          continue;
        }
        throw err;
      }

      if (res.status === 401 || res.status === 403) {
        markKeyInvalid(key);
        lastError = new Error("Invalid API key.");
        continue;
      }

      if (res.status === 402) {
        markKeyValid(key);
        markExhausted(key);
        lastError = new Error(
          `Daily quota exhausted for key ${key.slice(0, 8)}…`,
        );
        continue;
      }

      if (res.status === 429) {
        markKeyValid(key);
        await sleep(240 * (attempt + 1));
        lastError = new Error("Rate limit reached, retrying…");
        continue;
      }

      if (!res.ok) throw new Error(`API error: ${res.status} ${path}`);
      markKeyValid(key);
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
    if (priority === "high") {
      activeHighPriorityCount = Math.max(0, activeHighPriorityCount - 1);
    }
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
  const posterUrl = sanitizePosterUrl(f.posterUrl as string | undefined) || "";
  const posterUrlPreview =
    sanitizePosterUrl(f.posterUrlPreview as string | undefined) || posterUrl;

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

  const parsedYear = parseYearNumber(f.year);
  const parsedStartYear = parseYearNumber(f.startYear);
  const parsedEndYear = parseYearNumber(f.endYear);

  // Enrich nameEn with known international English release title if missing
  const resolvedAliasEn =
    (!f.nameEn || isRussian(f.nameEn as string))
      ? resolveEnglishAlias(f.nameRu as string | undefined, f.nameOriginal as string | undefined)
      : null;

  const normalized: Film = {
    ...f,
    kinopoiskId: id,
    filmId: f.filmId ?? id,
    nameEn: (f.nameEn as string | undefined) || resolvedAliasEn || undefined,
    year: parsedYear,
    startYear: parsedStartYear,
    endYear: parsedEndYear,
    posterUrlPreview,
    posterUrl,
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
  const items = (raw.items ?? raw.films ?? []) as (Film & Record<string, unknown>)[];
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

export function getCachedTopFilms(
  type: CollectionType = "TOP_POPULAR_ALL",
  page = 1,
): FilmsResponse | null {
  if (!hasVerifiedApiKey()) return null;
  const resolvedType = COLLECTION_TYPE_MAP[type] ?? type;
  const path = `/v2.2/films/collections?type=${encodeURIComponent(resolvedType)}&page=${page}`;
  const raw = getCachedApi<Record<string, unknown>>(path);
  if (!raw) return null;
  return normalizeFilmsResponse(raw);
}

export async function getTopFilms(
  type: CollectionType = "TOP_POPULAR_ALL",
  page = 1,
  priority: "high" | "low" = "high",
): Promise<FilmsResponse> {
  const resolvedType = COLLECTION_TYPE_MAP[type] ?? type;
  if (resolvedType === "CLOSES_RELEASES") {
    return getUpcomingPremieres();
  }
  const raw = await apiFetch<Record<string, unknown>>(
    `/v2.2/films/collections?type=${encodeURIComponent(resolvedType)}&page=${page}`,
    3600,
    priority,
  );
  return normalizeFilmsResponse(raw);
}

export async function getFilmsByFilter(
  params: {
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
  },
  priority: "high" | "low" = "high",
): Promise<FilmsResponse> {
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
    3600,
    priority,
  );
  return normalizeFilmsResponse(raw);
}

/**
 * Curates Hollywood & Global hits for the Home page.
 */
export async function getCuratedHomeSection(
  options: {
    type?: "FILM" | "TV_SERIES";
    genreId?: number;
    collection?: CollectionType;
    ratingFrom?: number;
  },
  priority: "high" | "low" = "high",
): Promise<Film[]> {
  const prefs =
    typeof window !== "undefined"
      ? getPreferences()
      : { contentRegionMode: "GLOBAL_FIRST" as const };
  const regionMode = prefs.contentRegionMode ?? "GLOBAL_FIRST";

  if (options.collection) {
    const [p1, p2] = await Promise.allSettled([
      getTopFilms(options.collection, 1, priority),
      regionMode === "GLOBAL_FIRST"
        ? getFilmsByFilter(
            {
              type: options.type ?? "FILM",
              countries: 1, // USA
              order: "NUM_VOTE",
              ratingFrom: options.ratingFrom ?? 7,
              page: 1,
            },
            priority,
          )
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
    getFilmsByFilter(
      {
        type: options.type,
        genres: options.genreId,
        order: "NUM_VOTE",
        ratingFrom: options.ratingFrom ?? 6.8,
        page: 1,
      },
      priority,
    ),
    regionMode !== "ALL"
      ? getFilmsByFilter(
          {
            type: options.type,
            genres: options.genreId,
            countries: 1,
            order: "NUM_VOTE",
            ratingFrom: options.ratingFrom ?? 6.6,
            page: 1,
          },
          priority,
        )
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
  trendingWindow?: boolean;
  hideWatched?: boolean;
  hideFavorites?: boolean;
  hideWatchLater?: boolean;
  page?: number;
  randomSeed?: number;
  allGenresList?: { id: number; genre: string }[];
  allCountriesList?: { id: number; country: string }[];
}

function getEffectiveRating(film: Film, source: RatingSource = "AUTO"): number {
  const imdb =
    typeof film.ratingImdb === "number" && film.ratingImdb > 0
      ? film.ratingImdb
      : undefined;
  const kp =
    typeof film.ratingKinopoisk === "number" && film.ratingKinopoisk > 0
      ? film.ratingKinopoisk
      : undefined;
  const critics =
    typeof film.ratingFilmCritics === "number" && film.ratingFilmCritics > 0
      ? film.ratingFilmCritics
      : undefined;

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

/**
 * Computes a professional composite Trending score combining:
 * 1. Multi-source weighted rating (IMDb 50%, Kinopoisk 35%, Critics 15%)
 * 2. IMDb-style Bayesian vote credibility damping (prevents 15-vote flukes)
 * 3. Vote velocity & logarithmic popularity momentum
 * 4. Smooth recency decay across the rolling past-year window
 * 5. Real-time live-popularity collection boost (TOP_POPULAR_ALL / POPULAR_SERIES)
 */
export function computeTrendingScore(
  film: Film,
  livePopularIds?: Set<number>,
  ratingSource: RatingSource = "AUTO",
): number {
  const id = film.kinopoiskId ?? film.filmId ?? 0;
  const now = new Date();
  const curYear = now.getFullYear();

  const imdb =
    typeof film.ratingImdb === "number" && film.ratingImdb > 0
      ? film.ratingImdb
      : undefined;
  const kp =
    typeof film.ratingKinopoisk === "number" && film.ratingKinopoisk > 0
      ? film.ratingKinopoisk
      : undefined;

  let critics: number | undefined;
  if (typeof film.ratingFilmCritics === "number" && film.ratingFilmCritics > 0) {
    critics =
      film.ratingFilmCritics > 10
        ? film.ratingFilmCritics / 10
        : film.ratingFilmCritics;
  } else if (
    typeof film.ratingGoodReview === "number" &&
    film.ratingGoodReview > 0
  ) {
    critics =
      film.ratingGoodReview > 10
        ? film.ratingGoodReview / 10
        : film.ratingGoodReview;
  }

  let weightedSum = 0;
  let weightTotal = 0;
  if (imdb !== undefined) {
    weightedSum += imdb * 0.5;
    weightTotal += 0.5;
  }
  if (kp !== undefined) {
    weightedSum += kp * 0.35;
    weightTotal += 0.35;
  }
  if (critics !== undefined) {
    weightedSum += critics * 0.15;
    weightTotal += 0.15;
  }

  let compositeRating =
    weightTotal > 0
      ? weightedSum / weightTotal
      : getEffectiveRating(film, ratingSource);

  if (ratingSource !== "AUTO") {
    const explicitSourceRating = getEffectiveRating(film, ratingSource);
    if (explicitSourceRating > 0) {
      compositeRating = explicitSourceRating * 0.7 + compositeRating * 0.3;
    }
  }

  const rawVotes = getEffectiveVotes(film);
  const reviewProxyVotes = (film.reviewsCount ?? 0) * 45;
  const criticProxyVotes = (film.ratingFilmCriticsVoteCount ?? 0) * 25;
  const effectiveVotes = Math.max(rawVotes, reviewProxyVotes, criticProxyVotes);

  if (compositeRating <= 0 && effectiveVotes < 30) {
    return 0.1;
  }

  // Bayesian credibility damping (m = 1200 votes, C = 6.7 baseline mean)
  const m = 1200;
  const C = 6.7;
  const safeR = compositeRating > 0 ? compositeRating : C;
  const bayesianRating =
    (effectiveVotes / (effectiveVotes + m)) * safeR +
    (m / (effectiveVotes + m)) * C;

  // Estimate age in months for vote velocity calculation
  const yr = parseYearNumber(film.year) ?? parseYearNumber(film.startYear) ?? curYear;
  let monthsOld = 8;
  if (film.premiereRu) {
    const pTime = new Date(film.premiereRu).getTime();
    if (!isNaN(pTime)) {
      const diffDays = Math.max(7, (now.getTime() - pTime) / DAY_MS);
      monthsOld = Math.max(0.4, diffDays / 30);
    }
  } else if (yr >= curYear) {
    monthsOld = 3.5;
  } else if (yr === curYear - 1) {
    monthsOld = 11;
  } else {
    monthsOld = Math.max(18, (curYear - yr) * 12);
  }

  const voteVelocity = effectiveVotes / monthsOld;
  const velocityBoost =
    1 +
    0.16 * Math.log10(1 + voteVelocity / 150) +
    0.06 * Math.log10(1 + effectiveVotes / 500);

  // Smooth recency multiplier
  let recencyMultiplier = 1.0;
  if (monthsOld <= 2.2) {
    recencyMultiplier = 1.18;
  } else if (monthsOld <= 6.5 || yr >= curYear) {
    recencyMultiplier = 1.1;
  } else if (yr === curYear - 1) {
    recencyMultiplier = 1.02;
  } else {
    recencyMultiplier = Math.max(0.72, 1.0 - (curYear - 1 - yr) * 0.035);
  }

  const liveBoost = id > 0 && livePopularIds?.has(id) ? 1.12 : 1.0;

  return bayesianRating * velocityBoost * recencyMultiplier * liveBoost;
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
      [
        "детский",
        "семейный",
        "мультфильм",
        "family",
        "children",
        "animation",
      ].includes(g),
    )
  ) {
    return "FAMILY";
  }
  return null;
}

/**
 * Partitioned & Multi-Constraint Discovery Engine that breaks past the 100-item
 * single-query ceiling, supports 3+ simultaneous genres (AND/OR), negative filters,
 * bidirectional ASC/DESC sorting, rating brackets, personalized "For You" taste matching,
 * "Recent Releases" lens, and unified Smart Search when `keyword` is provided.
 */
export async function discoverFilms(
  opts: DiscoverFilmsOptions,
): Promise<FilmsResponse> {
  const page = Math.max(1, opts.page ?? 1);
  const direction: SortDirection = opts.direction ?? "DESC";
  const order: ExploreSortOrder = opts.order ?? "NUM_VOTE";
  const ratingSource: RatingSource = opts.ratingSource ?? "AUTO";

  // 1. Handle Personalized "FOR_YOU" Taste-Match Lens
  if (opts.lens === "FOR_YOU") {
    return discoverTasteMatchedFilms(opts, page);
  }

  // 2. Handle "RECENT_RELEASES" / "recent_releases" Smart Lens (Already-released recent titles, fully sortable & filterable)
  if (
    opts.lens === "RECENT_RELEASES" ||
    opts.lens === "recent_releases"
  ) {
    const curYear = new Date().getFullYear();
    const baseType =
      opts.type === "ALL" || !opts.type
        ? undefined
        : (opts.type as "FILM" | "TV_SHOW" | "TV_SERIES" | "MINI_SERIES");
    const primaryGenre = (opts.includeGenres ?? [])[0];
    const primaryCountry = (opts.includeCountries ?? [])[0];

    const [recentPremieresRes, recentByYearRes, recentByVotesRes] =
      await Promise.allSettled([
        page <= 2 && !primaryGenre && !primaryCountry && (!baseType || baseType === "FILM")
          ? getRecentReleases("high")
          : Promise.resolve({ items: [] as Film[], total: 0, totalPages: 1 }),
        getFilmsByFilter({
          type: baseType,
          genres: primaryGenre,
          countries: primaryCountry,
          yearFrom: curYear - 1,
          yearTo: curYear,
          ratingFrom: opts.ratingFrom ?? 5.5,
          ratingTo: opts.ratingTo,
          order: "YEAR",
          page: ((page - 1) % 5) + 1,
        }),
        getFilmsByFilter({
          type: baseType,
          genres: primaryGenre,
          countries: primaryCountry,
          yearFrom: curYear - 1,
          yearTo: curYear,
          ratingFrom: opts.ratingFrom ?? 5.8,
          ratingTo: opts.ratingTo,
          order: "NUM_VOTE",
          page: ((page - 1) % 5) + 1,
        }),
      ]);

    const pool: Film[] = [];
    if (recentPremieresRes.status === "fulfilled") {
      pool.push(...recentPremieresRes.value.items);
    }
    if (recentByYearRes.status === "fulfilled") {
      pool.push(...recentByYearRes.value.items);
    }
    if (recentByVotesRes.status === "fulfilled") {
      pool.push(...recentByVotesRes.value.items);
    }

    const todayStr = new Date().toISOString().slice(0, 10);
    const nonFuturePool = deduplicateFilms(pool).filter((f) => {
      const yr = parseYearNumber(f.year) ?? parseYearNumber(f.startYear);
      if (yr && yr > curYear) return false;
      if (f.premiereRu && f.premiereRu.slice(0, 10) > todayStr) return false;
      return true;
    });

    const filtered = applyClientDiscoveryFilters(
      nonFuturePool,
      opts,
      ratingSource,
    );

    // Respect user's selected sort order within Recent Releases scope
    const sorted =
      opts.order && opts.order !== "YEAR"
        ? sortDiscoveryPool(
            filtered,
            opts.order,
            direction,
            ratingSource,
            opts.randomSeed,
          )
        : [...filtered].sort((a, b) => {
            const dirMult = direction === "ASC" ? 1 : -1;
            const dA = a.premiereRu
              ? new Date(a.premiereRu).getTime() || 0
              : (a.year ?? a.startYear ?? 0) * 31536000000;
            const dB = b.premiereRu
              ? new Date(b.premiereRu).getTime() || 0
              : (b.year ?? b.startYear ?? 0) * 31536000000;
            if (dA !== dB) return (dA - dB) * dirMult;
            return (
              (computeTrendingScore(a, undefined, ratingSource) -
                computeTrendingScore(b, undefined, ratingSource)) *
              dirMult
            );
          });

    return {
      items: sorted.slice(0, 24),
      total: Math.max(sorted.length, 120),
      totalPages: 10,
    };
  }

  // 3. Handle Curated Theme Collection Presets (Bug #13 Fixed: returns 24 items per page)
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
    const sorted = sortDiscoveryPool(
      filtered,
      order,
      direction,
      ratingSource,
      opts.randomSeed,
    );
    return {
      items: sorted.slice(0, 24),
      total: reportedTotal,
      totalPages: Math.max(reportedPages, page + (sorted.length >= 24 ? 1 : 0)),
    };
  }

  // 4. Unified Smart Search when `opts.keyword` is active on Explore:
  // Uses the exact same smart search pipeline (year parsing, typo tolerance, cross-language
  // translation, IMDb bridge, and actor credits) as the main Search bar, then applies Explore filters!
  const rawKeyword = opts.keyword?.trim();
  const parsedKeyword = rawKeyword ? parseQueryWithYear(rawKeyword) : null;
  const effectiveKeyword = parsedKeyword ? parsedKeyword.cleanQuery : undefined;

  // 5. Determine base API order, Trending Rolling Window (currentYear - 1 .. currentYear), & Year Cap
  const currentYear = new Date().getFullYear();
  const isTrendingScope =
    !rawKeyword &&
    opts.yearFrom === undefined &&
    opts.yearTo === undefined &&
    (order === "TRENDING" ||
      opts.lens === "TRENDING" ||
      Boolean(opts.trendingWindow));

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
  const minY =
    opts.yearFrom !== undefined
      ? opts.yearFrom
      : isTrendingScope
        ? currentYear - 1
        : (parsedKeyword?.targetYear ?? undefined);
  const maxY =
    opts.yearTo !== undefined
      ? opts.yearTo
      : isTrendingScope || order === "YEAR" || order === "TRENDING"
        ? currentYear
        : (parsedKeyword?.targetYear ?? undefined);

  let queryRatingFrom: number | undefined =
    opts.ratingFrom ?? (isTrendingScope ? 5.8 : undefined);
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

  // Bug #9 Fixed: Fan out across both multiple genres AND multiple countries when selected
  const countryTargets =
    incCountries.length > 1 ? incCountries.slice(0, 3) : [incCountries[0]];

  if (incGenres.length > 1 && opts.genreMatchMode === "OR") {
    for (const gId of incGenres.slice(0, 4)) {
      for (const cId of countryTargets.slice(0, 2)) {
        queriesToRun.push({
          type: baseType,
          genres: gId,
          countries: cId,
          order: apiOrder,
          ratingFrom: queryRatingFrom,
          ratingTo: queryRatingTo,
          yearFrom: queryYearFrom,
          yearTo: queryYearTo,
          keyword: effectiveKeyword,
          page: apiPage,
        });
      }
    }
  } else if (incGenres.length > 1 && opts.genreMatchMode !== "OR") {
    for (const gId of incGenres.slice(0, 2)) {
      for (const cId of countryTargets.slice(0, 2)) {
        queriesToRun.push({
          type: baseType,
          genres: gId,
          countries: cId,
          order: apiOrder,
          ratingFrom: queryRatingFrom,
          ratingTo: queryRatingTo,
          yearFrom: queryYearFrom,
          yearTo: queryYearTo,
          keyword: effectiveKeyword,
          page: apiPage,
        });
        if (apiPage < 5 && countryTargets.length === 1) {
          queriesToRun.push({
            type: baseType,
            genres: gId,
            countries: cId,
            order: apiOrder,
            ratingFrom: queryRatingFrom,
            ratingTo: queryRatingTo,
            yearFrom: queryYearFrom,
            yearTo: queryYearTo,
            keyword: effectiveKeyword,
            page: apiPage + 1,
          });
        }
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
        keyword: effectiveKeyword,
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
      keyword: effectiveKeyword,
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
        keyword: effectiveKeyword,
        page: apiPage + 1,
      });
    }
  }

  // When in Trending scope, also query RATING order & live Popular collections for real-time buzz
  if (isTrendingScope && incGenres.length <= 1 && incCountries.length <= 1) {
    queriesToRun.push({
      type: baseType,
      genres: incGenres[0],
      countries: incCountries[0],
      order: apiOrder === "RATING" ? "NUM_VOTE" : "RATING",
      ratingFrom: opts.ratingFrom ?? 6.4,
      ratingTo: queryRatingTo,
      yearFrom: queryYearFrom,
      yearTo: queryYearTo,
      page: apiPage,
    });
  }

  const livePopularCollectionPromises: Promise<FilmsResponse | null>[] = [];
  if (isTrendingScope && page <= 3 && incGenres.length === 0 && incCountries.length === 0) {
    if (!baseType || baseType === "FILM") {
      livePopularCollectionPromises.push(
        getTopFilms(
          baseType === "FILM" ? "TOP_POPULAR_MOVIES" : "TOP_POPULAR_ALL",
          page,
          "high",
        ).catch(() => null),
      );
    }
    if (!baseType || baseType === "TV_SERIES" || baseType === "MINI_SERIES" || baseType === "TV_SHOW") {
      livePopularCollectionPromises.push(
        getTopFilms("POPULAR_SERIES", page, "high").catch(() => null),
      );
    }
    if (page === 1 && (!baseType || baseType === "FILM")) {
      livePopularCollectionPromises.push(
        getRecentReleases("low").catch(() => null),
      );
    }
  }

  // Run smart search & live trending collections in parallel with filter queries
  const [smartSearchRes, liveColResults, ...settled] = await Promise.all([
    rawKeyword
      ? searchFilms(rawKeyword, page).catch(() => null)
      : Promise.resolve(null),
    Promise.all(livePopularCollectionPromises),
    ...queriesToRun.map((q) =>
      getFilmsByFilter(q).then(
        (v) => ({ status: "fulfilled" as const, value: v }),
        () => ({ status: "rejected" as const, value: null }),
      ),
    ),
  ]);

  const pool: Film[] = [];
  const livePopularIds = new Set<number>();
  let maxApiTotal = 0;
  let maxApiPages = 1;

  // Put smartSearchRes items first so exact title/typo/translated/actor matches lead the pool
  if (smartSearchRes) {
    pool.push(...smartSearchRes.items);
    maxApiTotal = Math.max(maxApiTotal, smartSearchRes.total ?? 0);
    maxApiPages = Math.max(maxApiPages, smartSearchRes.totalPages ?? 1);
  }

  for (const colRes of liveColResults) {
    if (colRes && colRes.items) {
      for (const item of colRes.items) {
        const fid = item.kinopoiskId ?? item.filmId ?? 0;
        if (fid > 0) livePopularIds.add(fid);
        const yr = parseYearNumber(item.year) ?? parseYearNumber(item.startYear);
        if (!yr || (yr >= currentYear - 1 && yr <= currentYear)) {
          pool.push(item);
        }
      }
    }
  }

  for (const res of settled) {
    if (res.status === "fulfilled" && res.value) {
      pool.push(...res.value.items);
      maxApiTotal = Math.max(maxApiTotal, res.value.total ?? 0);
      maxApiPages = Math.max(maxApiPages, res.value.totalPages ?? 1);
    }
  }

  const uniquePool = deduplicateFilms(pool);
  const effectiveOptsForClientFilter: DiscoverFilmsOptions =
    parsedKeyword?.targetYear &&
    opts.yearFrom === undefined &&
    opts.yearTo === undefined
      ? {
          ...opts,
          yearFrom: parsedKeyword.targetYear,
          yearTo: parsedKeyword.targetYear,
        }
      : opts;

  let filteredPool = applyClientDiscoveryFilters(
    uniquePool,
    effectiveOptsForClientFilter,
    ratingSource,
  );

  // If strict year from keyword yielded 0 due to unhydrated years on partial cards, fallback to base opts
  if (
    filteredPool.length === 0 &&
    parsedKeyword?.targetYear &&
    opts.yearFrom === undefined &&
    opts.yearTo === undefined
  ) {
    filteredPool = applyClientDiscoveryFilters(uniquePool, opts, ratingSource);
  }

  // When a keyword is active, keep smart search relevance order unless the user chose a specific sort
  const sortedPool =
    rawKeyword && (order === "NUM_VOTE" || order === "TRENDING") && direction === "DESC"
      ? filteredPool
      : sortDiscoveryPool(
          filteredPool,
          order,
          direction,
          ratingSource,
          opts.randomSeed,
          livePopularIds,
        );

  const canPartitionDeep =
    !rawKeyword && (maxApiPages >= 5 || maxApiTotal >= 80 || page > 1);
  const effectiveTotalPages = canPartitionDeep
    ? Math.max(25, page + (sortedPool.length >= 12 ? 2 : 0))
    : Math.max(1, maxApiPages);
  const effectiveTotal = canPartitionDeep
    ? Math.max(maxApiTotal, effectiveTotalPages * 20)
    : Math.max(filteredPool.length, maxApiTotal);

  return {
    items: sortedPool.slice(0, 24),
    total: sortedPool.length === 0 && page === 1 ? 0 : effectiveTotal,
    totalPages: sortedPool.length === 0 && page === 1 ? 1 : effectiveTotalPages,
    matchedPerson: smartSearchRes?.matchedPerson ?? null,
    correctedQuery: smartSearchRes?.correctedQuery ?? null,
    targetYear:
      smartSearchRes?.targetYear ?? parsedKeyword?.targetYear ?? null,
  };
}

// ─── Stratified, Shuffled & Paginated "For You" Recommendation Engine ─────────

const SESSION_SHUFFLE_SEED = Math.floor(Math.random() * 100000) + 17;

const GENRE_NAME_TO_ID: Record<string, number> = {
  триллер: 1,
  thriller: 1,
  драма: 2,
  drama: 2,
  криминал: 3,
  crime: 3,
  мелодрама: 4,
  romance: 4,
  детектив: 5,
  detective: 5,
  фантастика: 6,
  "sci-fi": 6,
  приключения: 7,
  adventure: 7,
  биография: 8,
  biography: 8,
  вестерн: 10,
  western: 10,
  боевик: 11,
  action: 11,
  фэнтези: 12,
  fantasy: 12,
  комедия: 13,
  comedy: 13,
  военный: 14,
  war: 14,
  история: 15,
  history: 15,
  ужасы: 17,
  horror: 17,
  мультфильм: 18,
  animation: 18,
  семейный: 19,
  family: 19,
  аниме: 24,
  anime: 24,
};

function seededShuffle<T>(items: T[], seedInput: number): T[] {
  const arr = [...items];
  let seed = (Math.abs(Math.floor(seedInput)) % 2147483646) + 1;
  for (let i = arr.length - 1; i > 0; i--) {
    seed = (seed * 16807) % 2147483647;
    const j = seed % (i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function interleaveBuckets<T>(buckets: T[][]): T[] {
  const result: T[] = [];
  const maxLen = buckets.reduce((max, b) => Math.max(max, b.length), 0);
  for (let idx = 0; idx < maxLen; idx++) {
    for (let b = 0; b < buckets.length; b++) {
      if (idx < buckets[b].length) {
        result.push(buckets[b][idx]);
      }
    }
  }
  return result;
}

const VIBE_TAG_GENRE_BOOST: Record<string, { genreId: number; weight: number }[]> = {
  Masterpiece: [
    { genreId: 2, weight: 1.5 },
    { genreId: 6, weight: 1.0 },
    { genreId: 15, weight: 1.0 },
  ],
  "Comfort Watch": [
    { genreId: 13, weight: 2.5 },
    { genreId: 19, weight: 2.0 },
    { genreId: 4, weight: 1.5 },
    { genreId: 18, weight: 1.5 },
  ],
  "Mind-Bending": [
    { genreId: 6, weight: 3.0 },
    { genreId: 1, weight: 2.5 },
    { genreId: 5, weight: 2.0 },
  ],
  "Visual Spectacle": [
    { genreId: 6, weight: 2.5 },
    { genreId: 12, weight: 2.5 },
    { genreId: 7, weight: 2.0 },
    { genreId: 11, weight: 1.5 },
  ],
  "Peak Acting": [
    { genreId: 2, weight: 3.0 },
    { genreId: 8, weight: 2.0 },
    { genreId: 3, weight: 1.5 },
  ],
  "Great Pacing": [
    { genreId: 11, weight: 2.5 },
    { genreId: 1, weight: 2.5 },
    { genreId: 7, weight: 1.5 },
  ],
  "Killer Soundtrack": [
    { genreId: 7, weight: 1.5 },
    { genreId: 6, weight: 1.5 },
    { genreId: 11, weight: 1.5 },
  ],
  Emotional: [
    { genreId: 2, weight: 3.0 },
    { genreId: 4, weight: 2.5 },
    { genreId: 8, weight: 1.5 },
  ],
  "Hidden Gem": [
    { genreId: 5, weight: 2.0 },
    { genreId: 1, weight: 1.5 },
    { genreId: 2, weight: 1.5 },
  ],
  "Guilty Pleasure": [
    { genreId: 11, weight: 2.0 },
    { genreId: 13, weight: 2.0 },
    { genreId: 17, weight: 1.5 },
  ],
  "Slow Burn": [
    { genreId: 2, weight: 2.5 },
    { genreId: 1, weight: 2.0 },
    { genreId: 5, weight: 2.0 },
    { genreId: 10, weight: 1.0 },
  ],
};

export async function discoverTasteMatchedFilms(
  opts: DiscoverFilmsOptions = {},
  page = 1,
  priority: "high" | "low" = "high",
): Promise<FilmsResponse> {
  if (!hasApiKeys()) {
    throw new Error("No valid API key configured.");
  }
  const safePage = Math.max(1, page);
  const randomSeed = (opts.randomSeed ?? 1) + SESSION_SHUFFLE_SEED;

  const ratedList = getRatedFilms();
  const favList = getList("favorites");
  const wlList = getList("watchlater");
  const histList = getList("history");

  // Exclude all library & already-rated films from "For You" recommendations
  const libraryAll = [...ratedList, ...favList, ...wlList, ...histList];
  const libraryIds = new Set(libraryAll.map((e) => e.film_id));

  // Separate user ratings into positive taste signals vs. disliked titles
  const dislikedIds = new Set<number>();
  const positiveRated = ratedList
    .filter((entry) => {
      const isOverhyped = entry.taste_tags?.includes("Overhyped");
      if (entry.user_rating < 6.0 || (isOverhyped && entry.user_rating < 7.5)) {
        dislikedIds.add(entry.film_id);
        return false;
      }
      return entry.user_rating >= 6.5;
    })
    .sort((a, b) => b.user_rating - a.user_rating);

  const highRatedSeedIds = new Set(
    positiveRated.filter((r) => r.user_rating >= 8.0).map((r) => r.film_id),
  );

  // Build deduplicated seed list prioritizing user's highest-rated titles first
  const uniqueSeeds: number[] = [];
  const seenSeed = new Set<number>();
  const seedCandidates = [
    ...positiveRated,
    ...favList.filter((e) => !dislikedIds.has(e.film_id)),
    ...wlList.filter((e) => !dislikedIds.has(e.film_id)),
    ...histList.filter((e) => !dislikedIds.has(e.film_id)),
  ];

  for (const entry of seedCandidates) {
    if (entry.film_id && !seenSeed.has(entry.film_id)) {
      seenSeed.add(entry.film_id);
      uniqueSeeds.push(entry.film_id);
      if (uniqueSeeds.length >= 18) break;
    }
  }

  // Compute weighted genre affinities from My Ratings (scores + breakdown + vibe tags) & library
  const genreFreq = new Map<number, number>();
  const addGenreWeight = (filmId: number, weight: number) => {
    const meta = getCachedFilmMeta(filmId);
    if (!meta?.genres) return;
    for (const g of meta.genres) {
      const gLower = g.genre.trim().toLowerCase();
      const gEn = translateGenre(g.genre, true).trim().toLowerCase();
      const gId = GENRE_NAME_TO_ID[gLower] ?? GENRE_NAME_TO_ID[gEn];
      if (gId && (!isSafeModeActive() || (gId !== 28 && gId !== 25))) {
        genreFreq.set(gId, (genreFreq.get(gId) ?? 0) + weight);
      }
    }
  };

  let prefersHighAcclaim = false;
  for (const rated of ratedList) {
    const isOverhyped = rated.taste_tags?.includes("Overhyped");
    if (rated.user_rating <= 5.0 || (isOverhyped && rated.user_rating < 6.5)) {
      addGenreWeight(rated.film_id, -2.0);
      continue;
    }
    if (rated.user_rating >= 6.5) {
      let weight =
        rated.user_rating >= 9.0
          ? 4.0
          : rated.user_rating >= 8.0
            ? 3.0
            : rated.user_rating >= 7.5
              ? 2.2
              : 1.4;

      if (rated.taste_breakdown) {
        const dims = Object.values(rated.taste_breakdown).filter(
          (v): v is number => typeof v === "number",
        );
        if (dims.some((v) => v >= 8.5)) weight += 0.6;
        if (
          (rated.taste_breakdown.story ?? 0) >= 8.5 ||
          (rated.taste_breakdown.acting ?? 0) >= 8.5
        ) {
          prefersHighAcclaim = true;
        }
      }

      addGenreWeight(rated.film_id, weight);

      for (const tag of rated.taste_tags ?? []) {
        if (tag === "Masterpiece" || tag === "Peak Acting") {
          prefersHighAcclaim = true;
        }
        const boosts = VIBE_TAG_GENRE_BOOST[tag];
        if (boosts) {
          const tagMultiplier = rated.user_rating >= 8.5 ? 1.25 : 1.0;
          for (const b of boosts) {
            if (!isSafeModeActive() || (b.genreId !== 28 && b.genreId !== 25)) {
              genreFreq.set(
                b.genreId,
                (genreFreq.get(b.genreId) ?? 0) + b.weight * tagMultiplier,
              );
            }
          }
        }
      }
    }
  }

  const ratedIdSet = new Set(ratedList.map((r) => r.film_id));
  for (const fav of favList) {
    if (!dislikedIds.has(fav.film_id)) {
      addGenreWeight(fav.film_id, ratedIdSet.has(fav.film_id) ? 1.0 : 2.0);
    }
  }
  for (const wl of wlList) {
    if (!dislikedIds.has(wl.film_id) && !ratedIdSet.has(wl.film_id)) {
      addGenreWeight(wl.film_id, 1.2);
    }
  }
  for (const hist of histList.slice(0, 20)) {
    if (!dislikedIds.has(hist.film_id) && !ratedIdSet.has(hist.film_id)) {
      addGenreWeight(hist.film_id, 0.8);
    }
  }

  const topUserGenres = Array.from(genreFreq.entries())
    .filter(([, score]) => score > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([id]) => id)
    .slice(0, 3);

  const effectiveGenres =
    opts.includeGenres && opts.includeGenres.length > 0
      ? opts.includeGenres
      : topUserGenres.length > 0
        ? topUserGenres
        : [11, 6, 1, 2];

  // Keep highest-rated seeds anchored at the front while rotating across pages
  const topRatedAnchorSeeds = positiveRated
    .slice(0, 6)
    .map((r) => r.film_id);
  const remainingSeeds = uniqueSeeds.filter(
    (id) => !topRatedAnchorSeeds.includes(id),
  );
  const shuffledSeeds = [
    ...seededShuffle(topRatedAnchorSeeds, randomSeed),
    ...seededShuffle(remainingSeeds, randomSeed + 7),
  ];
  const pageSeedOffset =
    ((safePage - 1) * 4) % Math.max(1, shuffledSeeds.length);
  const rotatedSeeds = [
    ...shuffledSeeds.slice(pageSeedOffset),
    ...shuffledSeeds.slice(0, pageSeedOffset),
  ].slice(0, 5);

  const seedBucketPromises: Promise<Film[]>[] = [];

  if (safePage <= 3 && rotatedSeeds.length > 0) {
    for (let i = 0; i < rotatedSeeds.length; i++) {
      const seedId = rotatedSeeds[i];
      const isTopRatedSeed = highRatedSeedIds.has(seedId);
      const reqPriority = priority === "high" && i < 3 ? "high" : "low";
      seedBucketPromises.push(
        Promise.allSettled([
          getSimilarFilms(seedId, reqPriority),
          i < 2 || isTopRatedSeed
            ? getRelatedFilms(seedId, reqPriority)
            : Promise.resolve([]),
        ]).then(([simRes, relRes]) => {
          const items: Film[] = [];
          if (simRes.status === "fulfilled" && simRes.value.items) {
            for (const sf of simRes.value.items) {
              items.push(
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
          if (relRes.status === "fulfilled" && Array.isArray(relRes.value)) {
            items.push(...relRes.value);
          }
          return seededShuffle(items, randomSeed + seedId + safePage * 13);
        }),
      );
    }
  }

  const baseType =
    opts.type && opts.type !== "ALL"
      ? (opts.type as "FILM" | "TV_SHOW" | "TV_SERIES" | "MINI_SERIES")
      : undefined;

  const dynamicRatingFloor =
    opts.ratingFrom ?? (prefersHighAcclaim ? 7.1 : 6.9);

  const genrePoolPromises = effectiveGenres.slice(0, 3).map((gId, idx) =>
    getFilmsByFilter(
      {
        genres: gId,
        type: baseType,
        countries: opts.includeCountries?.[0],
        order: idx % 2 === 0 ? "NUM_VOTE" : "RATING",
        ratingFrom: dynamicRatingFloor,
        ratingTo: opts.ratingTo,
        yearFrom: opts.yearFrom,
        yearTo: opts.yearTo,
        page: ((safePage + idx - 1) % 5) + 1,
      },
      priority === "high" && idx < 2 ? "high" : "low",
    )
      .then((r) =>
        seededShuffle(r.items ?? [], randomSeed + gId * 31 + safePage * 17),
      )
      .catch(() => [] as Film[]),
  );

  const fallbackCuratedPromise =
    uniqueSeeds.length === 0 || safePage > 1
      ? getTopFilms(
          safePage % 2 === 1 ? "TOP_POPULAR_MOVIES" : "TOP_250_MOVIES",
          ((safePage - 1) % 5) + 1,
          "low",
        )
          .then((r) =>
            seededShuffle(r.items ?? [], randomSeed + safePage * 29),
          )
          .catch(() => [] as Film[])
      : Promise.resolve([] as Film[]);

  const [seedBuckets, genreBuckets, fallbackBucket] = await Promise.all([
    Promise.all(seedBucketPromises),
    Promise.all(genrePoolPromises),
    fallbackCuratedPromise,
  ]);

  const interleavedSeeds = interleaveBuckets(seedBuckets);
  const seedOriginSet = new Set(
    interleavedSeeds.map((f) => f.kinopoiskId ?? f.filmId ?? 0).filter(Boolean),
  );
  const interleavedGenres = interleaveBuckets([
    ...genreBuckets,
    ...(fallbackBucket.length > 0 ? [fallbackBucket] : []),
  ]);

  const combinedRaw = deduplicateFilms([
    ...interleavedSeeds,
    ...interleavedGenres,
  ]).filter((f) => {
    const fid = f.kinopoiskId ?? f.filmId ?? 0;
    return fid > 0 && !libraryIds.has(fid);
  });

  const filtered = applyClientDiscoveryFilters(
    combinedRaw,
    {
      ...opts,
      hideWatched: opts.hideWatched ?? true,
    },
    opts.ratingSource ?? "AUTO",
  );

  let finalOrdered: Film[];
  if (
    (opts.order && opts.order !== "TRENDING") ||
    (opts.direction && opts.direction === "ASC")
  ) {
    finalOrdered = sortDiscoveryPool(
      filtered,
      opts.order ?? "TRENDING",
      opts.direction ?? "DESC",
      opts.ratingSource ?? "AUTO",
      randomSeed + safePage,
    );
  } else if (positiveRated.length > 0 && genreFreq.size > 0) {
    // Score candidates by taste affinity (matching weighted genres + similarity seed origin)
    // and shuffle within affinity bands for fresh yet taste-accurate recommendations
    const maxGenreWeight = Math.max(1, ...Array.from(genreFreq.values()));
    const scored = filtered.map((film) => {
      const fid = film.kinopoiskId ?? film.filmId ?? 0;
      let affinity = seedOriginSet.has(fid) ? 2.5 : 0;
      if (film.genres) {
        for (const g of film.genres) {
          const gLower = g.genre.trim().toLowerCase();
          const gEn = translateGenre(g.genre, true).trim().toLowerCase();
          const gId = GENRE_NAME_TO_ID[gLower] ?? GENRE_NAME_TO_ID[gEn];
          if (gId && genreFreq.has(gId)) {
            affinity += (genreFreq.get(gId) ?? 0) / maxGenreWeight;
          }
        }
      }
      if (prefersHighAcclaim) {
        const effR = getEffectiveRating(film, "AUTO");
        if (effR >= 8.0) affinity += 1.0;
      }
      // Group into coarse tiers so seeded shuffle preserves variety inside each tier
      const tier = Math.round(affinity * 2);
      return { film, tier };
    });

    const tierBuckets = new Map<number, Film[]>();
    for (const item of scored) {
      const list = tierBuckets.get(item.tier) ?? [];
      list.push(item.film);
      tierBuckets.set(item.tier, list);
    }
    const sortedTiers = Array.from(tierBuckets.keys()).sort((a, b) => b - a);
    finalOrdered = [];
    for (const t of sortedTiers) {
      finalOrdered.push(
        ...seededShuffle(
          tierBuckets.get(t) ?? [],
          randomSeed + safePage * 101 + t * 19,
        ),
      );
    }
  } else {
    finalOrdered = seededShuffle(filtered, randomSeed + safePage * 101);
  }

  const pageSlice = finalOrdered.slice(0, 24);

  for (let i = 0; i < Math.min(8, pageSlice.length); i++) {
    const f = pageSlice[i];
    const fid = f.kinopoiskId ?? f.filmId;
    if (fid && (!f.year || !f.genres || f.genres.length === 0)) {
      queueFilmMetaHydration(fid, i < 4);
    }
  }

  return {
    items: pageSlice,
    total: Math.max(finalOrdered.length, 300),
    totalPages: 15,
  };
}

function applyClientDiscoveryFilters(
  films: Film[],
  opts: DiscoverFilmsOptions,
  ratingSource: RatingSource,
): Film[] {
  const watchedSet = opts.hideWatched
    ? new Set([
        ...getList("history").map((e) => e.film_id),
        ...(opts.lens === "FOR_YOU"
          ? getRatedFilms().map((e) => e.film_id)
          : []),
      ])
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
    const id = film.kinopoiskId ?? film.filmId ?? 0;

    // 1. Safe Mode guard
    if (isSafeModeActive() && isAdultContentFilm(film)) return false;

    // 2. Personal Library exclusions
    if (watchedSet && watchedSet.has(id)) return false;
    if (favSet && favSet.has(id)) return false;
    if (wlSet && wlSet.has(id)) return false;

    // 3. Selected Media Type
    if (opts.type && opts.type !== "ALL" && film.type && film.type !== opts.type) {
      return false;
    }

    // 4. Excluded Media Types
    if (
      opts.excludeTypes &&
      opts.excludeTypes.length > 0 &&
      film.type &&
      opts.excludeTypes.includes(film.type)
    ) {
      return false;
    }

    // 5. Silent Regional Priority (from Preferences) unless user explicitly included Russia/USSR in Countries filter
    const userExplicitlyIncludedRussia = (opts.includeCountries ?? []).some(
      (cId) => {
        const names = countryIdToNames.get(cId) ?? [];
        return names.some((n) => RUSSIAN_COUNTRIES.has(n));
      },
    );
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

    // 6. Multi-Genre Include (AND mode when >1 genre selected)
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

    // 7. Negative Genre Exclusions
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

    // 8. Country Include & Exclude (Bug #9 Fixed: enforces includeCountries in client filter)
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
      opts.includeCountries &&
      opts.includeCountries.length > 0 &&
      countryIdToNames.size > 0 &&
      allFilmCountries.size > 0
    ) {
      const matchesIncludedCountry = opts.includeCountries.some((cId) => {
        const candidates = countryIdToNames.get(cId);
        if (!candidates) return true;
        return candidates.some((name) => allFilmCountries.has(name));
      });
      if (!matchesIncludedCountry) return false;
    }

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

    // 9. Require IMDb Score
    if (opts.requireImdb && (!film.ratingImdb || film.ratingImdb <= 0)) {
      return false;
    }

    // 10. Exact Rating Band Check
    const effRating = getEffectiveRating(film, ratingSource);
    if (effRating > 0) {
      if (opts.ratingFrom !== undefined && effRating < opts.ratingFrom - 0.1) {
        return false;
      }
      if (opts.ratingTo !== undefined && effRating > opts.ratingTo + 0.1) {
        return false;
      }
    }

    // 11. Vote Confidence ("Anti-Fluke" / Cult Filter)
    const votes = getEffectiveVotes(film);
    if (opts.minVotes !== undefined && opts.minVotes !== 0 && votes > 0) {
      if (opts.minVotes > 0 && votes < opts.minVotes) return false;
      if (opts.minVotes < 0 && votes > Math.abs(opts.minVotes)) return false;
    }

    // 12. Year Range Check & Future Release Cap (prevents 2029/2031 unfilmed entries unless Upcoming is explicitly requested)
    const curYr = new Date().getFullYear();
    const userRequestedFutureYears =
      (opts.yearFrom !== undefined && opts.yearFrom > curYr) ||
      (opts.yearTo !== undefined && opts.yearTo > curYr);
    const yr = parseYearNumber(film.year) ?? parseYearNumber(film.startYear);
    if (yr) {
      if (!userRequestedFutureYears && yr > curYr) return false;
      if (opts.yearFrom !== undefined && yr < opts.yearFrom) return false;
      if (opts.yearTo !== undefined && yr > opts.yearTo) return false;
    }
    if (!userRequestedFutureYears && film.premiereRu) {
      const todayIso = new Date().toISOString().slice(0, 10);
      if (film.premiereRu.slice(0, 10) > todayIso && (!yr || yr >= curYr)) {
        return false;
      }
    }
    if (
      (opts.order === "TRENDING" || opts.lens === "TRENDING" || opts.trendingWindow) &&
      !userRequestedFutureYears
    ) {
      if (yr && yr < (opts.yearFrom ?? curYr - 1)) return false;
      if (effRating <= 0 && votes < 20) return false;
    }

    // 13. Runtime Bucket Filter
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

    // 14. Age Suitability Tiers (Include & Exclude)
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

    // 15. Series Completion Status
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
  livePopularIds?: Set<number>,
): Film[] {
  const copy = [...films];
  const dirMult = direction === "ASC" ? 1 : -1;

  if (order === "RANDOM") {
    return seededShuffle(copy, randomSeed + 1337);
  }

  if (order === "TRENDING") {
    const scoreMap = new Map<Film, number>();
    for (const f of copy) {
      scoreMap.set(f, computeTrendingScore(f, livePopularIds, ratingSource));
    }
    copy.sort((a, b) => {
      const sA = scoreMap.get(a) ?? 0;
      const sB = scoreMap.get(b) ?? 0;
      if (Math.abs(sA - sB) > 0.001) return (sA - sB) * dirMult;
      const vA = getEffectiveVotes(a);
      const vB = getEffectiveVotes(b);
      return (vA - vB) * dirMult;
    });
    return copy;
  }

  copy.sort((a, b) => {
    if (order === "TITLE") {
      const titleA = getEnglishName(
        a.nameRu,
        a.nameEn,
        a.nameOriginal,
        true,
      ).toLowerCase();
      const titleB = getEnglishName(
        b.nameRu,
        b.nameEn,
        b.nameOriginal,
        true,
      ).toLowerCase();
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
      const cA =
        a.ratingFilmCritics ??
        a.ratingGoodReview ??
        a.ratingImdb ??
        a.ratingKinopoisk ??
        0;
      const cB =
        b.ratingFilmCritics ??
        b.ratingGoodReview ??
        b.ratingImdb ??
        b.ratingKinopoisk ??
        0;
      if (cA !== cB) return (cA - cB) * dirMult;
    }

    if (order === "HIDDEN_GEMS") {
      const scoreGem = (f: Film) => {
        const r = getEffectiveRating(f, ratingSource);
        const v = getEffectiveVotes(f);
        const voteSweetSpot =
          v > 0 && v < 45000 ? 1.15 : v >= 45000 ? 0.85 : 1.0;
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

// ─── Semantic, Cross-Language, Year-Aware & Actor-Aware Smart Search Engine ───

const CANONICAL_TITLES: string[] = [
  "Interstellar",
  "Inception",
  "The Dark Knight",
  "Oppenheimer",
  "Dune",
  "Dune: Part Two",
  "Spider-Man",
  "Spider-Man: Across the Spider-Verse",
  "Breaking Bad",
  "Better Call Saul",
  "Game of Thrones",
  "House of the Dragon",
  "Stranger Things",
  "The Shawshank Redemption",
  "Pulp Fiction",
  "Fight Club",
  "Forrest Gump",
  "The Matrix",
  "The Godfather",
  "The Lord of the Rings",
  "The Avengers",
  "Avengers: Endgame",
  "Avengers: Infinity War",
  "Guardians of the Galaxy",
  "Iron Man",
  "Batman",
  "The Batman",
  "Joker",
  "Deadpool",
  "John Wick",
  "Mad Max: Fury Road",
  "Blade Runner 2049",
  "Arrival",
  "Whiplash",
  "Parasite",
  "Everything Everywhere All at Once",
  "The Prestige",
  "Memento",
  "Shutter Island",
  "Se7en",
  "Gone Girl",
  "Zodiac",
  "Prisoners",
  "Sicario",
  "No Country for Old Men",
  "There Will Be Blood",
  "Inglourious Basterds",
  "Django Unchained",
  "Once Upon a Time in Hollywood",
  "Kill Bill",
  "The Wolf of Wall Street",
  "Goodfellas",
  "Taxi Driver",
  "Gladiator",
  "Alien",
  "Aliens",
  "Terminator 2: Judgment Day",
  "Back to the Future",
  "Jurassic Park",
  "Indiana Jones",
  "Star Wars",
  "The Mandalorian",
  "Andor",
  "Harry Potter",
  "Pirates of the Caribbean",
  "The Truman Show",
  "Eternal Sunshine of the Spotless Mind",
  "Her",
  "Ex Machina",
  "Black Mirror",
  "Severance",
  "Succession",
  "The Bear",
  "Chernobyl",
  "True Detective",
  "Fargo",
  "Mindhunter",
  "Peaky Blinders",
  "Sherlock",
  "The Boys",
  "Invincible",
  "Arcane",
  "The Last of Us",
  "Fallout",
  "Shogun",
  "Squid Game",
  "Money Heist",
  "Pan's Labyrinth",
  "The Platform",
  "The Invisible Guest",
  "Wild Tales",
  "Society of the Snow",
  "Dark",
  "Mr. Robot",
  "Westworld",
  "The Sopranos",
  "The Wire",
  "Friends",
  "The Office",
  "Rick and Morty",
  "Attack on Titan",
  "Death Note",
  "Fullmetal Alchemist: Brotherhood",
  "One Piece",
  "Demon Slayer",
  "Jujutsu Kaisen",
  "Spirited Away",
  "Your Name",
  "Princess Mononoke",
  "Howl's Moving Castle",
  "Toy Story",
  "WALL-E",
  "Coco",
  "Inside Out",
  "Up",
  "Ratatouille",
  "The Lion King",
  "La La Land",
  "Green Book",
  "1917",
  "Saving Private Ryan",
  "Schindler's List",
  "The Pianist",
  "Apocalypse Now",
  "Top Gun: Maverick",
  "Mission: Impossible",
  "James Bond",
  "Skyfall",
  "Casino Royale",
  "Knives Out",
  "The Grand Budapest Hotel",
  "The Social Network",
  "Moneyball",
  "Ford v Ferrari",
  "Catch Me If You Can",
  "The Departed",
  "Heat",
  "Scarface",
  "American Psycho",
  "Requiem for a Dream",
  "Oldboy",
  "Memories of Murder",
  "Train to Busan",
  "The Handmaiden",
  "I Saw the Devil",
  "The Intouchables",
  "Amélie",
  "Anatomy of a Fall",
  "City of God",
  "The Silence of the Lambs",
  "The Shining",
  "Hereditary",
  "Get Out",
  "A Quiet Place",
  "The Conjuring",
  "It",
  "Avatar",
  "Titanic",
];

export interface SemanticConceptRule {
  label: string;
  triggers: string[];
  keywords: string[];
  genreIds?: number[];
  collection?: CollectionType;
  type?: "FILM" | "TV_SERIES";
}

const SEMANTIC_CONCEPTS: SemanticConceptRule[] = [
  {
    label: "Time Travel & Loops",
    triggers: ["time travel", "timetravel", "time loop", "timeloop", "paradox", "chronos"],
    keywords: ["Interstellar", "Back to the Future", "Tenet", "Predestination", "About Time"],
    genreIds: [6, 1],
  },
  {
    label: "Mind-Bending & Plot Twists",
    triggers: [
      "mind bending",
      "mindbending",
      "mindfuck",
      "plot twist",
      "plottwist",
      "psychological",
      "dream",
      "illusion",
    ],
    keywords: ["Inception", "Shutter Island", "Fight Club", "The Prestige", "Memento"],
    genreIds: [1, 6, 5],
  },
  {
    label: "Space & Sci-Fi Odyssey",
    triggers: [
      "space",
      "astronaut",
      "cosmos",
      "galaxy",
      "mars",
      "planet",
      "black hole",
      "sci fi",
      "scifi",
      "alien",
    ],
    keywords: ["Interstellar", "Dune", "The Martian", "Arrival", "Alien"],
    genreIds: [6],
  },
  {
    label: "Superheroes & Comics",
    triggers: [
      "superhero",
      "superheroes",
      "marvel",
      "mcu",
      "dc comics",
      "avengers",
      "mutant",
      "x-men",
      "xmen",
    ],
    keywords: ["Spider-Man", "The Dark Knight", "The Avengers", "Guardians of the Galaxy", "The Boys"],
    collection: "COMICS_THEME",
    genreIds: [11, 6],
  },
  {
    label: "Zombie & Outbreak Survival",
    triggers: ["zombie", "zombies", "undead", "outbreak", "virus", "infected"],
    keywords: ["Train to Busan", "The Last of Us", "28 Days Later", "World War Z"],
    collection: "ZOMBIE_THEME",
    genreIds: [17, 11],
  },
  {
    label: "Post-Apocalyptic & Disaster",
    triggers: [
      "apocalypse",
      "post apocalyptic",
      "dystopian",
      "dystopia",
      "survival",
      "wasteland",
      "disaster",
      "catastrophe",
    ],
    keywords: ["Mad Max", "Fallout", "The Road", "A Quiet Place", "Children of Men"],
    collection: "CATASTROPHE_THEME",
    genreIds: [6, 11],
  },
  {
    label: "Heist & Crime Masterminds",
    triggers: ["heist", "bank robbery", "robbery", "con artist", "casino", "mafia", "gangster", "mob"],
    keywords: ["Money Heist", "Heat", "The Wolf of Wall Street", "Goodfellas", "The Godfather"],
    genreIds: [3, 1],
  },
  {
    label: "Cyberpunk, AI & Robots",
    triggers: ["cyberpunk", "artificial intelligence", "ai", "robot", "android", "hacker", "virtual reality", "cyborg"],
    keywords: ["Blade Runner 2049", "The Matrix", "Ex Machina", "Her", "Mr. Robot"],
    genreIds: [6, 1],
  },
  {
    label: "Detective, Mystery & Serial Killer",
    triggers: [
      "serial killer",
      "detective",
      "murder mystery",
      "whodunit",
      "investigation",
      "crime thriller",
      "fbi",
    ],
    keywords: ["Se7en", "Zodiac", "Prisoners", "Memories of Murder", "True Detective"],
    genreIds: [5, 3, 1],
  },
  {
    label: "Vampires & Gothic Horror",
    triggers: ["vampire", "vampires", "dracula", "gothic", "werewolf"],
    keywords: ["Dracula", "Interview with the Vampire", "Blade", "Van Helsing"],
    collection: "VAMPIRE_THEME",
    genreIds: [17, 12],
  },
  {
    label: "Anime & Studio Ghibli",
    triggers: ["anime", "ghibli", "miyazaki", "manga", "shonen", "japanese animation"],
    keywords: ["Spirited Away", "Attack on Titan", "Your Name", "Death Note", "Arcane"],
    genreIds: [24, 18],
  },
  {
    label: "Oscar Winners & Masterpieces",
    triggers: ["oscar", "oscars", "academy award", "best picture", "masterpiece", "acclaimed"],
    keywords: ["Oppenheimer", "Parasite", "Green Book", "The Shawshank Redemption", "The Godfather"],
    collection: "OSKAR_WINNERS_2021",
    genreIds: [2],
  },
  {
    label: "Family & Feel-Good Animation",
    triggers: ["family", "kids", "children", "pixar", "disney", "dreamworks", "feel good", "wholesome"],
    keywords: ["Coco", "WALL-E", "Inside Out", "Ratatouille", "Toy Story"],
    collection: "FAMILY",
    genreIds: [18, 19, 13],
  },
  {
    label: "Scary & Supernatural Horror",
    triggers: ["scary", "horror", "creepy", "haunted", "ghost", "demon", "exorcism", "slasher"],
    keywords: ["The Conjuring", "Hereditary", "The Shining", "Get Out", "A Quiet Place"],
    genreIds: [17],
  },
  {
    label: "Epic Fantasy & Magic",
    triggers: ["fantasy", "magic", "wizard", "wizards", "dragon", "dragons", "medieval", "sword"],
    keywords: ["The Lord of the Rings", "Harry Potter", "Game of Thrones", "Pan's Labyrinth"],
    genreIds: [12, 7],
  },
  {
    label: "War & Historical Epics",
    triggers: ["war", "ww2", "world war", "military", "soldier", "battlefield", "historical"],
    keywords: ["1917", "Saving Private Ryan", "All Quiet on the Western Front", "Dunkirk", "Inglourious Basterds"],
    genreIds: [14, 15, 2],
  },
  {
    label: "True Story & Biopics",
    triggers: ["true story", "based on a true story", "biopic", "biography", "real life"],
    keywords: ["Oppenheimer", "Society of the Snow", "Green Book", "The Social Network", "Ford v Ferrari"],
    genreIds: [8, 2],
  },
  {
    label: "Romance & Love Stories",
    triggers: ["romance", "romantic", "love story", "heartbreak", "date night", "romcom", "rom-com"],
    keywords: ["La La Land", "Eternal Sunshine of the Spotless Mind", "Titanic", "About Time"],
    collection: "LOVE_THEME",
    genreIds: [4, 13],
  },
];

/**
 * Extracts a 4-digit release year from queries like "oldboy 2003", "oldboy (2003)", or "2003 oldboy"
 * while preserving standalone 4-digit movie titles like "1917", "2012", "1408", "2046".
 */
const parsedQueryYearCache = new Map<
  string,
  { cleanQuery: string; targetYear: number | null; rawQuery: string }
>();

export function parseQueryWithYear(rawQuery: string): {
  cleanQuery: string;
  targetYear: number | null;
  rawQuery: string;
} {
  const hit = parsedQueryYearCache.get(rawQuery);
  if (hit) return hit;
  if (parsedQueryYearCache.size > 2000) parsedQueryYearCache.clear();

  const trimmed = rawQuery.trim();
  if (!trimmed) {
    return { cleanQuery: "", targetYear: null, rawQuery: "" };
  }

  // If the entire query is just a 4-digit number (e.g. "1917", "2012"), treat it as a title
  if (/^\d{4}$/.test(trimmed)) {
    return { cleanQuery: trimmed, targetYear: null, rawQuery: trimmed };
  }

  // Match trailing year: "oldboy 2003", "oldboy (2003)", "oldboy [2003]", "oldboy - 2003"
  const trailingMatch = trimmed.match(
    /^(.*?)(?:[\s\-–—]+|\s*[\(\[])(188[89]|189\d|19\d{2}|20[0-3]\d)[\)\]]?\s*$/,
  );
  if (trailingMatch && trailingMatch[1].trim().length >= 2) {
    const clean = trailingMatch[1].trim();
    const year = parseInt(trailingMatch[2], 10);
    // Avoid stripping "Blade Runner 2049" or "Wonder Woman 1984" where year is part of canonical title
    const lowerFull = trimmed.toLowerCase().replace(/\s+/g, " ");
    if (
      !lowerFull.includes("blade runner 2049") &&
      !lowerFull.includes("wonder woman 1984") &&
      !lowerFull.includes("space odyssey")
    ) {
      return { cleanQuery: clean, targetYear: year, rawQuery: trimmed };
    }
  }

  // Match leading year: "2003 oldboy"
  const leadingMatch = trimmed.match(
    /^[\(\[]?(188[89]|189\d|19\d{2}|20[0-3]\d)[\)\]]?\s+(.{2,})$/,
  );
  if (leadingMatch && leadingMatch[2].trim().length >= 2) {
    return {
      cleanQuery: leadingMatch[2].trim(),
      targetYear: parseInt(leadingMatch[1], 10),
      rawQuery: trimmed,
    };
  }

  const fallbackRes = { cleanQuery: trimmed, targetYear: null, rawQuery: trimmed };
  parsedQueryYearCache.set(rawQuery, fallbackRes);
  return fallbackRes;
}

interface PreparedSearchToken {
  norm: string;
  bare: string;
  compact: string;
  bareCompact: string;
  phon: string;
  cons: string;
  words: string[];
  wordPhons: string[];
  charMask: number;
}

const preparedTokenCache = new Map<string, PreparedSearchToken>();

function stripLeadingArticles(s: string): string {
  return s.replace(/^(the|a|an|el|la|los|las|le|les)\s+/i, "").trim();
}

function normalizeSearchToken(str: string): string {
  return str
    .toLowerCase()
    .replace(/ё/g, "е")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .normalize("NFC")
    .replace(/['’`]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildPhoneticFromNorm(norm: string): string {
  return norm
    .replace(/ph/g, "f")
    .replace(/ck/g, "k")
    .replace(/qu/g, "kw")
    .replace(/sh/g, "s")
    .replace(/ch/g, "c")
    .replace(/th/g, "t")
    .replace(/y/g, "i")
    .replace(/([a-zа-яё])\1+/gi, "$1")
    .replace(/\s+/g, "");
}

function computeCharBitmask(s: string): number {
  let mask = 0;
  for (let i = 0; i < s.length; i++) {
    mask |= 1 << (s.charCodeAt(i) & 31);
  }
  return mask;
}

function popcount32(n: number): number {
  n = n - ((n >>> 1) & 0x55555555);
  n = (n & 0x33333333) + ((n >>> 2) & 0x33333333);
  return (((n + (n >>> 4)) & 0x0f0f0f0f) * 0x01010101) >>> 24;
}

function getPreparedSearchToken(raw: string): PreparedSearchToken {
  const existing = preparedTokenCache.get(raw);
  if (existing) return existing;
  if (preparedTokenCache.size > 8000) {
    preparedTokenCache.clear();
  }
  const norm = normalizeSearchToken(raw);
  const rawBare = stripLeadingArticles(norm);
  // Only strip leading article when the remaining title/query is at least 3 chars
  const bare = rawBare.length >= 3 ? rawBare : norm;
  const compact = norm.replace(/\s+/g, "");
  const bareCompact = bare.replace(/\s+/g, "");
  const phon = buildPhoneticFromNorm(bare || norm);
  const cons = phon.replace(/[aeiouаеёиоуыэюя]/gi, "");
  const words = (bare || norm).split(" ").filter(Boolean);
  const wordPhons = words.map(buildPhoneticFromNorm);
  const charMask = computeCharBitmask(compact);

  const prepared: PreparedSearchToken = {
    norm,
    bare,
    compact,
    bareCompact,
    phon,
    cons,
    words,
    wordPhons,
    charMask,
  };
  preparedTokenCache.set(raw, prepared);
  return prepared;
}

// Reusable flat typed arrays for Damerau-Levenshtein (zero heap allocations per call)
const DL_MAX_LEN = 128;
const dlBuf0 = new Int32Array(DL_MAX_LEN);
const dlBuf1 = new Int32Array(DL_MAX_LEN);
const dlBuf2 = new Int32Array(DL_MAX_LEN);

function damerauLevenshtein(a: string, b: string, maxDist = 3): number {
  if (a === b) return 0;
  const lenA = a.length;
  const lenB = b.length;
  if (lenA === 0) return lenB;
  if (lenB === 0) return lenA;
  if (Math.abs(lenA - lenB) > maxDist) return maxDist + 1;
  if (lenB + 1 >= DL_MAX_LEN) return maxDist + 1;

  let prev2 = dlBuf0;
  let prev1 = dlBuf1;
  let curr = dlBuf2;

  for (let j = 0; j <= lenB; j++) prev1[j] = j;

  for (let i = 1; i <= lenA; i++) {
    curr[0] = i;
    let rowMin = i;
    const chA = a.charCodeAt(i - 1);
    const chAPrev = i > 1 ? a.charCodeAt(i - 2) : -1;

    for (let j = 1; j <= lenB; j++) {
      const chB = b.charCodeAt(j - 1);
      const cost = chA === chB ? 0 : 1;
      let val = Math.min(prev1[j] + 1, curr[j - 1] + 1, prev1[j - 1] + cost);
      if (i > 1 && j > 1 && chA === b.charCodeAt(j - 2) && chAPrev === chB) {
        val = Math.min(val, prev2[j - 2] + 1);
      }
      curr[j] = val;
      if (val < rowMin) rowMin = val;
    }

    if (rowMin > maxDist) return maxDist + 1;
    const tmp = prev2;
    prev2 = prev1;
    prev1 = curr;
    curr = tmp;
  }
  return prev1[lenB];
}

function trigramSimilarity(a: string, b: string): number {
  const lenA = a.length;
  const lenB = b.length;
  if (lenA < 3 || lenB < 3 || Math.abs(lenA - lenB) > 6) return 0;
  if (a === b) return 1;
  const s1 = `  ${a} `;
  const s2 = `  ${b} `;
  const n1 = s1.length - 2;
  const n2 = s2.length - 2;
  let inter = 0;
  for (let i = 0; i < n1; i++) {
    const c0 = s1.charCodeAt(i);
    const c1 = s1.charCodeAt(i + 1);
    const c2 = s1.charCodeAt(i + 2);
    for (let j = 0; j < n2; j++) {
      if (
        s2.charCodeAt(j) === c0 &&
        s2.charCodeAt(j + 1) === c1 &&
        s2.charCodeAt(j + 2) === c2
      ) {
        inter++;
        break;
      }
    }
  }
  return (2 * inter) / (n1 + n2);
}

/**
 * Computes a fuzzy relevance score (0..100) between a user query and a candidate title.
 * Uses memoized token skeletons and zero-allocation Damerau-Levenshtein so 1,000+ titles
 * evaluate in <2ms without blocking the main thread.
 */
export function computeFuzzyMatchScore(
  query: string,
  candidate?: string | null,
): number {
  if (!query || !candidate) return 0;
  const parsed = parseQueryWithYear(query);
  const q = getPreparedSearchToken(parsed.cleanQuery || query);
  const c = getPreparedSearchToken(candidate);
  if (!q.norm || !c.norm) return 0;

  if (c.norm === q.norm) return 100;
  if (q.bare.length >= 3 && c.bare.length >= 3 && q.bare === c.bare) return 98;
  if (
    c.norm.startsWith(q.norm) ||
    (q.bare.length >= 3 && c.bare.startsWith(q.bare))
  ) {
    return 92;
  }
  if (c.norm.includes(` ${q.norm}`)) return 86;
  if (q.norm.length >= 4 && c.norm.includes(q.norm)) return 78;

  // Compact space-insensitive check (e.g. "old boy" vs "oldboy", "spiderman" vs "spider man")
  if (
    c.compact === q.compact ||
    (q.bareCompact.length >= 3 && c.bareCompact === q.bareCompact)
  ) {
    return 96;
  }
  if (
    c.compact.startsWith(q.compact) ||
    (q.bareCompact.length >= 3 && c.bareCompact.startsWith(q.bareCompact))
  ) {
    return 88;
  }
  if (q.compact.length >= 4 && c.compact.includes(q.compact)) return 76;

  // Fast bitmask filter before running phonetic/edit-distance/trigrams
  const sharedBits = popcount32(q.charMask & c.charMask);
  const qBits = popcount32(q.charMask);
  if (qBits >= 4 && sharedBits < Math.ceil(qBits * 0.65)) return 0;

  // Phonetic & consonant skeleton match (e.g. "interstelar", "opppenheimer", "shawshenk", "pans labirinth")
  if (q.phon.length >= 4 && (c.phon === q.phon || c.phon.startsWith(q.phon))) {
    return 85;
  }
  if (q.cons.length >= 4 && c.cons === q.cons) {
    return 80;
  }

  // Whole-title & word-level edit distance
  if (q.compact.length >= 4) {
    const qFull = q.bareCompact.length >= 4 ? q.bareCompact : q.compact;
    const cFull =
      q.bareCompact.length >= 4 ? c.bareCompact || c.compact : c.compact;
    const maxFullAllowed =
      qFull.length >= 10 ? 3 : qFull.length >= 6 ? 2 : 1;
    if (Math.abs(qFull.length - cFull.length) <= maxFullAllowed) {
      const fullDist = damerauLevenshtein(qFull, cFull, maxFullAllowed);
      if (fullDist <= maxFullAllowed) {
        return 86 - fullDist * 7;
      }
    }

    const maxPrefixAllowed = q.compact.length >= 8 ? 2 : 1;
    if (
      c.compact.length >= q.compact.length - maxPrefixAllowed &&
      q.compact.charCodeAt(0) === c.compact.charCodeAt(0)
    ) {
      const prefixDist = damerauLevenshtein(
        q.compact,
        c.compact.slice(0, Math.min(c.compact.length, q.compact.length + 2)),
        maxPrefixAllowed,
      );
      if (prefixDist <= maxPrefixAllowed) {
        return 82 - prefixDist * 8;
      }
    }

    if (q.words.length > 0 && c.words.length > 0) {
      const maxMisses = q.words.length >= 3 ? 1 : 0;
      let matchedWords = 0;
      let missedWords = 0;

      for (let i = 0; i < q.words.length; i++) {
        const qw = q.words[i];
        const qwp = q.wordPhons[i];
        const maxWordDist = qw.length >= 6 ? 2 : qw.length >= 4 ? 1 : 0;
        let hit = false;

        for (let j = 0; j < c.words.length; j++) {
          const cw = c.words[j];
          if (
            cw === qw ||
            (qw.length >= 3 && cw.startsWith(qw)) ||
            (qwp.length >= 4 && c.wordPhons[j] === qwp) ||
            (maxWordDist > 0 &&
              Math.abs(qw.length - cw.length) <= maxWordDist &&
              (qw.charCodeAt(0) === cw.charCodeAt(0) ||
                qw.charCodeAt(1) === cw.charCodeAt(1) ||
                qw.charCodeAt(0) === cw.charCodeAt(1)) &&
              damerauLevenshtein(qw, cw, maxWordDist) <= maxWordDist)
          ) {
            hit = true;
            break;
          }
        }

        if (hit) {
          matchedWords++;
        } else {
          missedWords++;
          if (missedWords > maxMisses) break;
        }
      }

      if (
        matchedWords === q.words.length &&
        (q.words.length >= 2 || c.words.length <= 3)
      ) {
        return 78;
      }
      if (q.words.length >= 3 && matchedWords >= q.words.length - 1) {
        return 64;
      }
    }
  }

  if (
    Math.abs(q.compact.length - c.compact.length) <= 4 &&
    (q.compact.charCodeAt(0) === c.compact.charCodeAt(0) ||
      q.phon.charCodeAt(0) === c.phon.charCodeAt(0))
  ) {
    const tri = Math.max(
      trigramSimilarity(q.compact, c.compact),
      trigramSimilarity(q.phon, c.phon),
    );
    if (tri >= 0.52) {
      return Math.round(tri * 88);
    }
  }

  return 0;
}

/**
 * Computes the best fuzzy match score for a Film across its deduplicated title representations.
 */
export function computeFilmMatchScore(
  query: string,
  film: Partial<Film>,
  extraQueries: string[] = [],
): number {
  const aliasEn = resolveEnglishAlias(film.nameRu, film.nameOriginal);
  const cachedRuTrans = film.nameRu
    ? getCachedTranslation(film.nameRu)
    : undefined;

  const t0 = film.nameEn;
  const t1 = aliasEn && aliasEn !== t0 ? aliasEn : undefined;
  const t2 =
    cachedRuTrans && cachedRuTrans !== t0 && cachedRuTrans !== t1
      ? cachedRuTrans
      : undefined;
  const t3 =
    film.nameOriginal &&
    film.nameOriginal !== t0 &&
    film.nameOriginal !== t1 &&
    film.nameOriginal !== t2
      ? film.nameOriginal
      : undefined;
  const t4 =
    film.nameRu &&
    film.nameRu !== t0 &&
    film.nameRu !== t3
      ? film.nameRu
      : undefined;

  let best = 0;
  const totalQ = 1 + Math.min(3, extraQueries.length);
  for (let qi = 0; qi < totalQ; qi++) {
    const q = qi === 0 ? query : extraQueries[qi - 1];
    if (!q) continue;
    if (t0) {
      const s = computeFuzzyMatchScore(q, t0);
      if (s > best) {
        best = s;
        if (best === 100) return 100;
      }
    }
    if (t1) {
      const s = computeFuzzyMatchScore(q, t1);
      if (s > best) {
        best = s;
        if (best === 100) return 100;
      }
    }
    if (t2) {
      const s = computeFuzzyMatchScore(q, t2);
      if (s > best) {
        best = s;
        if (best === 100) return 100;
      }
    }
    if (t3) {
      const s = computeFuzzyMatchScore(q, t3);
      if (s > best) {
        best = s;
        if (best === 100) return 100;
      }
    }
    if (t4) {
      const s = computeFuzzyMatchScore(q, t4);
      if (s > best) {
        best = s;
        if (best === 100) return 100;
      }
    }
  }
  return best;
}

export interface SemanticSearchAnalysis {
  originalQuery: string;
  cleanQuery: string;
  targetYear: number | null;
  correctedQuery: string | null;
  matchedConcept: SemanticConceptRule | null;
  relatedTerms: string[];
  localMatches: Film[];
}

/**
 * Analyzes a user's search query in <2ms:
 * 1. Parses any release year token (e.g. "oldboy 2003" -> cleanQuery: "oldboy", targetYear: 2003)
 * 2. Detects typos against canonical global titles, international aliases, & cached catalog
 * 3. Detects semantic concepts, moods, themes, and franchises
 * 4. Returns instant local matches from the client metadata cache
 */
export function analyzeSemanticQuery(rawQuery: string): SemanticSearchAnalysis {
  const parsed = parseQueryWithYear(rawQuery);
  const q = parsed.cleanQuery;
  const targetYear = parsed.targetYear;
  const qNorm = getPreparedSearchToken(q).norm;

  if (qNorm.length < 2) {
    return {
      originalQuery: rawQuery.trim(),
      cleanQuery: q,
      targetYear,
      correctedQuery: null,
      matchedConcept: null,
      relatedTerms: [],
      localMatches: [],
    };
  }

  // 1. Check Semantic Concept / Theme rules
  let matchedConcept: SemanticConceptRule | null = null;
  for (const rule of SEMANTIC_CONCEPTS) {
    const isHit = rule.triggers.some((t) => {
      const tNorm = getPreparedSearchToken(t).norm;
      return (
        qNorm === tNorm ||
        (tNorm.length >= 4 && qNorm.includes(tNorm)) ||
        (qNorm.length >= 4 && tNorm.startsWith(qNorm)) ||
        (qNorm.length >= 5 && damerauLevenshtein(qNorm, tNorm, 1) <= 1)
      );
    });
    if (isHit) {
      matchedConcept = rule;
      break;
    }
  }

  const aliasTerms = getSearchQueryAliases(q);

  // 2. Check Local Metadata Cache + Canonical Titles for Typo Correction & Instant Completions
  const cachedFilms = getAllCachedFilms();
  const scoredLocal: { film: Film; score: number }[] = [];

  for (const meta of cachedFilms) {
    if (isSafeModeActive() && isAdultContentFilm(meta)) continue;
    const titleScore = computeFilmMatchScore(q, meta, aliasTerms);
    const genreMatch = (meta.genres ?? []).some((g) => {
      const enG = translateGenre(g.genre, true).toLowerCase();
      return enG === qNorm || g.genre.toLowerCase() === qNorm;
    })
      ? 62
      : 0;

    let best = Math.max(titleScore, genreMatch);
    if (best >= 56) {
      const filmYear =
        parseYearNumber(meta.year) ?? parseYearNumber(meta.startYear);
      if (targetYear && filmYear) {
        if (filmYear === targetYear) best += 45;
        else if (Math.abs(filmYear - targetYear) <= 1) best += 15;
        else best -= 35;
      }
      if (best >= 55) {
        scoredLocal.push({
          film: hydrateFilmWithCache(meta),
          score: best + (meta.ratingImdb ?? meta.ratingKinopoisk ?? 0) * 0.5,
        });
      }
    }
  }

  scoredLocal.sort((a, b) => b.score - a.score);
  const localMatches = deduplicateFilms(
    scoredLocal.slice(0, 8).map((x) => x.film),
  );

  // 3. Find closest canonical or matched cached title for typo correction & autocomplete pills
  const candidatePool = new Set<string>(CANONICAL_TITLES);
  for (const matched of scoredLocal) {
    const m = matched.film;
    const aliasEn = resolveEnglishAlias(m.nameRu, m.nameOriginal);
    if (aliasEn) candidatePool.add(aliasEn);
    if (m.nameEn && !isRussian(m.nameEn)) candidatePool.add(m.nameEn);
    else if (m.nameOriginal && !isRussian(m.nameOriginal)) {
      candidatePool.add(m.nameOriginal);
    }
  }

  const scoredTitles: { title: string; score: number }[] = [];
  for (const cand of candidatePool) {
    const s = computeFuzzyMatchScore(q, cand);
    if (s >= 60) {
      scoredTitles.push({ title: cand, score: s });
    }
  }
  scoredTitles.sort((a, b) => b.score - a.score);

  let correctedQuery: string | null = null;
  if (scoredTitles.length > 0) {
    const top = scoredTitles[0];
    const topNorm = getPreparedSearchToken(top.title).norm;
    if (top.score >= 68 && topNorm !== qNorm && !topNorm.startsWith(qNorm)) {
      correctedQuery = targetYear ? `${top.title} ${targetYear}` : top.title;
    }
  }

  const relatedTerms: string[] = [];
  if (correctedQuery) {
    relatedTerms.push(correctedQuery);
  }
  for (const st of scoredTitles.slice(0, 4)) {
    if (
      !relatedTerms.includes(st.title) &&
      getPreparedSearchToken(st.title).norm !== qNorm
    ) {
      relatedTerms.push(st.title);
    }
  }
  if (matchedConcept) {
    for (const kw of matchedConcept.keywords) {
      if (!relatedTerms.includes(kw)) relatedTerms.push(kw);
    }
  }

  return {
    originalQuery: rawQuery.trim(),
    cleanQuery: q,
    targetYear,
    correctedQuery,
    matchedConcept,
    relatedTerms: relatedTerms.slice(0, 5),
    localMatches,
  };
}

interface ImdbSearchBridgeResponse {
  items?: {
    imdbId: string;
    title: string;
    year: number | null;
    kind: "movie" | "series" | "person" | "other";
    posterUrl: string | null;
  }[];
}

async function fetchImdbSearchBridge(
  query: string,
  timeoutMs = 2200,
): Promise<NonNullable<ImdbSearchBridgeResponse["items"]>> {
  if (typeof window === "undefined" || !query.trim()) return [];
  try {
    const res = await fetch(
      `/api/poster?mode=search&q=${encodeURIComponent(query.trim())}`,
      { signal: AbortSignal.timeout(timeoutMs) },
    );
    if (!res.ok) return [];
    const data = (await res.json()) as ImdbSearchBridgeResponse;
    return Array.isArray(data.items) ? data.items : [];
  } catch {
    return [];
  }
}

/**
 * Searches Kinopoisk `/v1/persons` by actor/director name.
 */
export async function searchPeople(
  name: string,
  page = 1,
  priority: "high" | "low" = "high",
): Promise<PersonSearchItem[]> {
  const clean = name.trim();
  if (!clean || clean.length < 2) return [];
  try {
    const res = await apiFetch<PersonSearchResponse>(
      `/v1/persons?name=${encodeURIComponent(clean)}&page=${page}`,
      3600,
      priority,
    );
    return Array.isArray(res?.items) ? res.items : [];
  } catch {
    return [];
  }
}

/**
 * Resolves an actor/director match and converts their filmography credits into
 * hydrated `Film[]` items so searching an actor lists their top credits without
 * overwhelming the DOM or firing false positives on movie title queries.
 */
async function resolvePersonCreditsForSearch(
  cleanQuery: string,
  ruQuery?: string | null,
  imdbPersonTitle?: string | null,
  isSuggestionMode = false,
): Promise<{ matchedPerson: MatchedPersonSummary | null; credits: Film[] }> {
  const qToken = getPreparedSearchToken(cleanQuery);
  if (qToken.norm.length < 4) {
    return { matchedPerson: null, credits: [] };
  }

  // In suggestion mode, only query /v1/persons if IMDb bridge flagged a person or query is 2+ words (first + last name)
  if (isSuggestionMode && !imdbPersonTitle && qToken.words.length < 2) {
    return { matchedPerson: null, credits: [] };
  }

  const candidateNames = Array.from(
    new Set(
      [imdbPersonTitle, cleanQuery, ruQuery].filter(
        (x): x is string => Boolean(x && x.trim().length >= 3),
      ),
    ),
  );

  const maxPeopleQueries = isSuggestionMode ? 1 : 2;
  const searchResults = await Promise.all(
    candidateNames
      .slice(0, maxPeopleQueries)
      .map((n) => searchPeople(n, 1, "high")),
  );
  const allPeople = searchResults.flat();
  if (allPeople.length === 0) {
    return { matchedPerson: null, credits: [] };
  }

  let bestPerson: PersonSearchItem | null = null;
  let bestScore = 0;

  for (const p of allPeople) {
    const s = Math.max(
      computeFuzzyMatchScore(cleanQuery, p.nameEn),
      computeFuzzyMatchScore(cleanQuery, p.nameRu),
      imdbPersonTitle ? computeFuzzyMatchScore(imdbPersonTitle, p.nameEn) : 0,
      ruQuery ? computeFuzzyMatchScore(ruQuery, p.nameRu) : 0,
    );
    if (s > bestScore) {
      bestScore = s;
      bestPerson = p;
    }
  }

  // Require a high-confidence person name match (>= 84, or >= 76 if IMDb bridge explicitly identified a person)
  const minPersonScore = imdbPersonTitle ? 76 : 84;
  if (!bestPerson || bestScore < minPersonScore) {
    return { matchedPerson: null, credits: [] };
  }

  try {
    const detail = await getPerson(bestPerson.kinopoiskId, "high");
    const rawCredits = detail.films ?? [];
    if (rawCredits.length === 0) {
      return { matchedPerson: null, credits: [] };
    }

    // Deduplicate credits by filmId and prioritize main roles + rated titles
    const byFilmId = new Map<
      number,
      {
        filmId: number;
        nameRu?: string;
        nameEn?: string;
        ratingNum: number;
        general: boolean;
        professionKey?: string;
      }
    >();

    for (const pf of rawCredits) {
      if (!pf.filmId) continue;
      if (pf.professionKey === "HIMSELF" || pf.professionKey === "HERSELF") {
        continue;
      }
      const parsedRating =
        pf.rating && !pf.rating.endsWith("%") ? parseFloat(pf.rating) : 0;
      const ratingNum =
        !isNaN(parsedRating) && parsedRating > 0 && parsedRating <= 10
          ? parsedRating
          : 0;
      const existing = byFilmId.get(pf.filmId);
      if (
        !existing ||
        (pf.general && !existing.general) ||
        ratingNum > existing.ratingNum
      ) {
        byFilmId.set(pf.filmId, {
          filmId: pf.filmId,
          nameRu: pf.nameRu,
          nameEn: pf.nameEn,
          ratingNum,
          general: Boolean(pf.general),
          professionKey: pf.professionKey,
        });
      }
    }

    const sortedCredits = Array.from(byFilmId.values()).sort((a, b) => {
      if (a.general !== b.general) return a.general ? -1 : 1;
      return b.ratingNum - a.ratingNum;
    });

    const totalCreditsCount = sortedCredits.length;
    const maxCreditsToReturn = isSuggestionMode ? 8 : 48;
    const convertedFilms: Film[] = [];

    for (const c of sortedCredits) {
      const hydrated = hydrateFilmWithCache({
        kinopoiskId: c.filmId,
        filmId: c.filmId,
        nameRu: c.nameRu,
        nameEn: c.nameEn,
        nameOriginal: c.nameEn,
        ratingKinopoisk: c.ratingNum > 0 ? c.ratingNum : undefined,
        rating: c.ratingNum > 0 ? c.ratingNum : undefined,
        posterUrl: `https://kinopoiskapiunofficial.tech/images/posters/kp/${c.filmId}.jpg`,
        posterUrlPreview: `https://kinopoiskapiunofficial.tech/images/posters/kp_small/${c.filmId}.jpg`,
      });
      if (isSafeModeActive() && isAdultContentFilm(hydrated)) continue;
      convertedFilms.push(hydrated);
      if (convertedFilms.length >= maxCreditsToReturn) break;
    }

    // Only queue background metadata hydration on full search page (not on every suggestion keystroke)
    if (!isSuggestionMode) {
      for (let i = 0; i < Math.min(8, convertedFilms.length); i++) {
        const fid = convertedFilms[i].kinopoiskId;
        if (
          fid &&
          (!convertedFilms[i].year || !convertedFilms[i].genres?.length)
        ) {
          queueFilmMetaHydration(fid, i < 4);
        }
      }
    }

    const matchedPerson: MatchedPersonSummary = {
      personId: detail.personId || bestPerson.kinopoiskId,
      nameRu: detail.nameRu || bestPerson.nameRu,
      nameEn: detail.nameEn || bestPerson.nameEn,
      posterUrl: detail.posterUrl || bestPerson.posterUrl,
      profession: detail.profession,
      creditsCount: totalCreditsCount,
    };

    return {
      matchedPerson,
      credits: convertedFilms,
    };
  } catch {
    return { matchedPerson: null, credits: [] };
  }
}

export interface SearchFilmsOptions {
  mode?: "suggestions" | "full";
}

/**
 * Semantic, Cross-Language, Year-Aware & Actor-Aware Film Search:
 * - Extracts release year tokens (e.g. "oldboy 2003" -> searches "oldboy" & boosts/filters year 2003)
 * - Resolves non-English/Spanish/Korean/French titles to English & Russian via alias dictionary,
 *   Google Translate (`en -> ru`), and IMDb Suggestion Bridge (`/api/poster?mode=search`)
 * - Detects actor/director searches and lists their credits
 * - Supports fast `"suggestions"` mode for live autocomplete without API storms
 */
export async function searchFilms(
  keyword: string,
  page = 1,
  options?: SearchFilmsOptions,
): Promise<FilmsResponse> {
  const rawKeyword = keyword.trim();
  if (!rawKeyword) {
    return { items: [], total: 0, totalPages: 1 };
  }

  const isSuggestionMode = options?.mode === "suggestions";
  const analysis = analyzeSemanticQuery(rawKeyword);
  const cleanQuery = analysis.cleanQuery || rawKeyword;
  const targetYear = analysis.targetYear;
  const aliasQueries = getSearchQueryAliases(cleanQuery);

  const searchByKeywordApi = (kw: string, pg = 1) =>
    apiFetch<Record<string, unknown>>(
      `/v2.1/films/search-by-keyword?keyword=${encodeURIComponent(kw)}&page=${pg}`,
    )
      .then((raw) => normalizeFilmsResponse(raw))
      .catch(() => ({ items: [] as Film[], total: 0, totalPages: 1 }));

  // 1. Primary query using cleanQuery (stripped of trailing year like "2003" so Kinopoisk matches the title!)
  const primaryQueryPromise = searchByKeywordApi(cleanQuery, page);

  const secondaryPromises: Promise<FilmsResponse>[] = [];

  // 2. If user specified a release year (e.g. "oldboy 2003"), also query /v2.2/films with yearFrom/yearTo
  if (targetYear !== null) {
    secondaryPromises.push(
      getFilmsByFilter({
        keyword: cleanQuery,
        yearFrom: targetYear,
        yearTo: targetYear,
        page: 1,
      }).catch(() => ({ items: [], total: 0, totalPages: 1 })),
    );
  }

  // 3. Cross-language alias queries (e.g. "Money Heist" -> also queries "La casa de papel" & "Бумажный дом")
  if (page === 1 && aliasQueries.length > 0) {
    const maxAliases = isSuggestionMode ? 1 : 2;
    for (const alias of aliasQueries.slice(0, maxAliases)) {
      if (alias.toLowerCase() !== cleanQuery.toLowerCase()) {
        secondaryPromises.push(searchByKeywordApi(alias, 1));
      }
    }
  }

  // 4. High-confidence local typo correction query
  const cleanCorrected = analysis.correctedQuery
    ? parseQueryWithYear(analysis.correctedQuery).cleanQuery
    : null;
  if (
    page === 1 &&
    cleanCorrected &&
    cleanCorrected.toLowerCase() !== cleanQuery.toLowerCase()
  ) {
    secondaryPromises.push(searchByKeywordApi(cleanCorrected, 1));
  }

  // 5. Semantic concept / theme expansion
  if (analysis.matchedConcept && !isSuggestionMode) {
    const concept = analysis.matchedConcept;
    if (concept.collection) {
      secondaryPromises.push(
        getTopFilms(concept.collection, page).catch(() => ({
          items: [],
          total: 0,
          totalPages: 1,
        })),
      );
    } else if (concept.genreIds && concept.genreIds.length > 0) {
      secondaryPromises.push(
        getFilmsByFilter({
          genres: concept.genreIds[0],
          type: concept.type,
          order: "NUM_VOTE",
          ratingFrom: 6.8,
          page,
        }).catch(() => ({ items: [], total: 0, totalPages: 1 })),
      );
    }
  }

  // 6. Parallel IMDb Search Bridge + Russian Translation Bridge
  const imdbBridgePromise =
    page === 1
      ? fetchImdbSearchBridge(rawKeyword, isSuggestionMode ? 1400 : 2400)
      : Promise.resolve([]);
  const ruTranslationPromise =
    page === 1 && !isRussian(cleanQuery) && (!isSuggestionMode || aliasQueries.length === 0)
      ? translateQueryToRussian(cleanQuery)
      : Promise.resolve(null);

  const [primaryRes, secondaryResList, imdbBridgeItems, ruTranslated] =
    await Promise.all([
      primaryQueryPromise,
      Promise.all(secondaryPromises),
      imdbBridgePromise,
      ruTranslationPromise,
    ]);

  let combinedItems = [...primaryRes.items];
  for (const sec of secondaryResList) {
    combinedItems.push(...sec.items);
  }

  // 7. Follow-up queries from IMDb Search Bridge & Russian Translation Bridge
  const bridgeFollowupPromises: Promise<FilmsResponse>[] = [];
  let imdbCorrectedTitle: string | null = null;
  let imdbPersonName: string | null = null;

  if (page === 1) {
    // Only run secondary bridge follow-ups in suggestion mode if primary + secondary returned < 3 hits
    const needsDeepBridge = !isSuggestionMode || combinedItems.length < 3;

    if (
      needsDeepBridge &&
      ruTranslated &&
      ruTranslated.toLowerCase() !== cleanQuery.toLowerCase() &&
      !aliasQueries.includes(ruTranslated)
    ) {
      bridgeFollowupPromises.push(searchByKeywordApi(ruTranslated, 1));
    }

    const maxBridgeItems = isSuggestionMode ? 1 : 2;
    for (const bridgeItem of imdbBridgeItems.slice(0, 3)) {
      if (bridgeItem.kind === "person") {
        if (!imdbPersonName) imdbPersonName = bridgeItem.title;
        continue;
      }
      if (
        targetYear !== null &&
        bridgeItem.year !== null &&
        Math.abs(bridgeItem.year - targetYear) > 1
      ) {
        continue;
      }

      if (!imdbCorrectedTitle && bridgeItem.title) {
        imdbCorrectedTitle = bridgeItem.title;
      }

      if (!needsDeepBridge || bridgeFollowupPromises.length >= maxBridgeItems * 2) {
        continue;
      }

      if (bridgeItem.imdbId.startsWith("tt")) {
        bridgeFollowupPromises.push(
          getFilmsByFilter({ imdbId: bridgeItem.imdbId, page: 1 }).catch(
            () => ({
              items: [],
              total: 0,
              totalPages: 1,
            }),
          ),
        );
      }

      if (
        !isSuggestionMode &&
        bridgeItem.title &&
        bridgeItem.title.toLowerCase() !== cleanQuery.toLowerCase() &&
        bridgeItem.title.toLowerCase() !== (cleanCorrected || "").toLowerCase()
      ) {
        bridgeFollowupPromises.push(searchByKeywordApi(bridgeItem.title, 1));
      }
    }
  }

  // 8. Actor / Director Credit Resolution in parallel with bridge followups
  const [bridgeFollowupResults, personSearchResult] = await Promise.all([
    Promise.all(bridgeFollowupPromises),
    page === 1
      ? resolvePersonCreditsForSearch(
          cleanQuery,
          ruTranslated,
          imdbPersonName,
          isSuggestionMode,
        )
      : Promise.resolve({ matchedPerson: null, credits: [] as Film[] }),
  ]);

  for (const bRes of bridgeFollowupResults) {
    combinedItems.push(...bRes.items);
  }

  // 9. Fallback root token search if still sparse
  if (
    page === 1 &&
    !isSuggestionMode &&
    combinedItems.length < 3 &&
    personSearchResult.credits.length === 0
  ) {
    const fallbackTerm =
      cleanCorrected ||
      imdbCorrectedTitle ||
      analysis.relatedTerms[0] ||
      cleanQuery
        .replace(/[-:.'"]/g, " ")
        .split(/\s+/)
        .sort((a, b) => b.length - a.length)[0];

    if (
      fallbackTerm &&
      fallbackTerm.length >= 3 &&
      fallbackTerm.toLowerCase() !== cleanQuery.toLowerCase()
    ) {
      const fbRes = await searchByKeywordApi(fallbackTerm, 1);
      combinedItems.push(...fbRes.items);
    }
  }

  if (page === 1 && analysis.localMatches.length > 0) {
    combinedItems = [...analysis.localMatches, ...combinedItems];
  }

  // Merge actor credits if an actor/director was matched
  if (personSearchResult.credits.length > 0) {
    combinedItems = [...personSearchResult.credits, ...combinedItems];
  }

  const unique = deduplicateFilms(combinedItems);

  // Determine effective corrected query for UI banner
  const effectiveCorrectedQuery =
    analysis.correctedQuery ||
    (imdbCorrectedTitle &&
    getPreparedSearchToken(imdbCorrectedTitle).norm !==
      getPreparedSearchToken(cleanQuery).norm
      ? targetYear
        ? `${imdbCorrectedTitle} (${targetYear})`
        : imdbCorrectedTitle
      : null);

  const extraComparisonQueries = [
    cleanCorrected,
    imdbCorrectedTitle,
    ruTranslated,
    ...aliasQueries,
  ].filter((x): x is string => Boolean(x));

  const actorCreditIds = new Set(
    personSearchResult.credits.map((f) => f.kinopoiskId ?? f.filmId ?? 0),
  );

  // Precompute relevance score once per film (O(N)) rather than inside .sort() comparator (O(N log N))
  const scoredItems = unique.map((f) => {
    let s = computeFilmMatchScore(cleanQuery, f, extraComparisonQueries);

    const fid = f.kinopoiskId ?? f.filmId ?? 0;
    if (actorCreditIds.has(fid)) {
      s = Math.max(s, 82);
    }

    const fYear = parseYearNumber(f.year) ?? parseYearNumber(f.startYear);
    if (targetYear !== null) {
      if (fYear === targetYear) {
        s += 80;
      } else if (fYear && Math.abs(fYear - targetYear) === 1) {
        s += 25;
      } else if (fYear) {
        s -= 50;
      } else {
        s -= 20;
      }
    }
    const rating = f.ratingImdb ?? f.ratingKinopoisk ?? 0;
    return { film: f, score: s, rating };
  });

  scoredItems.sort((a, b) => {
    if (Math.abs(a.score - b.score) >= 10) return b.score - a.score;
    return b.score + b.rating * 1.5 - (a.score + a.rating * 1.5);
  });

  const ranked = scoredItems.map((entry) => entry.film);

  // If user explicitly searched with a release year (e.g. "oldboy 2003"), prioritize matching years
  let finalItems = ranked;
  if (targetYear !== null) {
    const yearMatched = ranked.filter((f) => {
      const fy = parseYearNumber(f.year) ?? parseYearNumber(f.startYear);
      return fy !== undefined && Math.abs(fy - targetYear) <= 1;
    });
    if (yearMatched.length > 0) {
      const others = ranked.filter((f) => !yearMatched.includes(f));
      finalItems = [...yearMatched, ...others];
    }
  }

  const maxTotal = Math.max(
    primaryRes.total,
    ...secondaryResList.map((s) => s.total),
    personSearchResult.matchedPerson?.creditsCount ?? 0,
    finalItems.length,
  );
  const maxPages = Math.max(
    primaryRes.totalPages,
    ...secondaryResList.map((s) => s.totalPages),
    1,
  );

  return {
    items: finalItems,
    total: maxTotal,
    totalPages: maxPages,
    matchedPerson: personSearchResult.matchedPerson,
    correctedQuery: effectiveCorrectedQuery,
    targetYear,
  };
}

// ─── Single Film & Detail Endpoints ───────────────────────────────────────────

export async function getFilm(
  id: number,
  priority: "high" | "low" = "high",
): Promise<Film> {
  const raw = await apiFetch<Film & Record<string, unknown>>(
    `/v2.2/films/${id}`,
    3600,
    priority,
  );
  return normalizeFilmItem(raw, true);
}

async function getFilmLowPriority(id: number): Promise<Film> {
  const raw = await apiFetch<Film & Record<string, unknown>>(
    `/v2.2/films/${id}`,
    3600,
    "low",
  );
  return normalizeFilmItem(raw, true);
}

export async function getFilmStaff(
  filmId: number,
  priority: "high" | "low" = "high",
): Promise<Staff[]> {
  return apiFetch(`/v1/staff?filmId=${filmId}`, 3600, priority);
}

export const getStaff = getFilmStaff;

export async function getFilmVideos(filmId: number): Promise<VideosResponse> {
  return apiFetch(`/v2.2/films/${filmId}/videos`);
}

export async function getRelatedFilms(
  filmId: number,
  priority: "high" | "low" = "high",
): Promise<Film[]> {
  const items = await apiFetch<(Film & Record<string, unknown>)[]>(
    `/v2.1/films/${filmId}/sequels_and_prequels`,
    3600,
    priority,
  );
  return sanitizeFilmsForSafeMode(
    (items ?? []).map((item) => normalizeFilmItem(item, false)),
  );
}

export async function getSimilarFilms(
  filmId: number,
  priority: "high" | "low" = "high",
): Promise<SimilarsResponse> {
  return apiFetch(`/v2.2/films/${filmId}/similars`, 3600, priority);
}

export async function getPerson(
  personId: number,
  priority: "high" | "low" = "high",
): Promise<PersonDetail> {
  return apiFetch(`/v1/staff/${personId}`, 86400, priority);
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

export async function getFilmFacts(
  filmId: number,
  priority: "high" | "low" = "low",
): Promise<FactsResponse> {
  return apiFetch(`/v2.2/films/${filmId}/facts`, 3600, priority);
}

export async function getFilmBoxOffice(
  filmId: number,
  priority: "high" | "low" = "high",
): Promise<BoxOfficeResponse> {
  return apiFetch(`/v2.2/films/${filmId}/box_office`, 3600, priority);
}

export async function getFilmSeasons(
  filmId: number,
  priority: "high" | "low" = "high",
): Promise<SeasonsResponse> {
  return apiFetch(`/v2.2/films/${filmId}/seasons`, 3600, priority);
}

export async function getFilmImages(
  filmId: number,
  type: GalleryImageType = "STILL",
  page = 1,
  priority: "high" | "low" = "low",
): Promise<{
  total: number;
  totalPages: number;
  items: { imageUrl: string; previewUrl: string }[];
}> {
  return apiFetch(
    `/v2.2/films/${filmId}/images?type=${type}&page=${page}`,
    3600,
    priority,
  );
}

export async function getFilmReviews(
  filmId: number,
  pageOrPriority: number | "high" | "low" = 1,
  order:
    | "DATE_DESC"
    | "DATE_ASC"
    | "USER_POSITIVE_RATING_DESC"
    | "USER_POSITIVE_RATING_ASC"
    | "USER_NEGATIVE_RATING_DESC"
    | "USER_NEGATIVE_RATING_ASC" = "DATE_DESC",
  priority: "high" | "low" = "low",
): Promise<ReviewsResponse> {
  const page = typeof pageOrPriority === "number" ? pageOrPriority : 1;
  const resolvedPriority =
    typeof pageOrPriority === "string" ? pageOrPriority : priority;
  return apiFetch(
    `/v2.2/films/${filmId}/reviews?page=${page}&order=${order}`,
    3600,
    resolvedPriority,
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

export function getCachedPremieres(
  year: number,
  month: string,
): FilmsResponse | null {
  if (!hasVerifiedApiKey()) return null;
  const path = `/v2.2/films/premieres?year=${year}&month=${month}`;
  const raw = getCachedApi<Record<string, unknown>>(path);
  if (!raw) return null;
  return normalizeFilmsResponse(raw);
}

export async function getPremieres(
  year: number,
  month: string,
  priority: "high" | "low" = "high",
): Promise<FilmsResponse> {
  const raw = await apiFetch<Record<string, unknown>>(
    `/v2.2/films/premieres?year=${year}&month=${month}`,
    3600,
    priority,
  );
  return normalizeFilmsResponse(raw);
}

/**
 * Fetches already-released recent films from the past 90 days across the current month
 * and previous 2 calendar months, strictly excluding unreleased future dates (`premiereRu > todayStr`).
 */
export async function getRecentReleases(
  priority: "high" | "low" = "low",
): Promise<FilmsResponse> {
  const now = new Date();
  const curYear = now.getFullYear();
  const curMonthIdx = now.getMonth();
  const todayStr = `${curYear}-${String(curMonthIdx + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const cutoffDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
  const cutoffStr = `${cutoffDate.getFullYear()}-${String(cutoffDate.getMonth() + 1).padStart(2, "0")}-${String(cutoffDate.getDate()).padStart(2, "0")}`;

  const targets: { year: number; month: string }[] = [
    {
      year: curYear,
      month: PREMIERE_MONTH_NAMES[curMonthIdx],
    },
    {
      year: curMonthIdx - 1 < 0 ? curYear - 1 : curYear,
      month: PREMIERE_MONTH_NAMES[(curMonthIdx + 11) % 12],
    },
    {
      year: curMonthIdx - 2 < 0 ? curYear - 1 : curYear,
      month: PREMIERE_MONTH_NAMES[(curMonthIdx + 10) % 12],
    },
  ];

  const settled = await Promise.allSettled(
    targets.map((t) => getPremieres(t.year, t.month, priority)),
  );

  const recentPool: Film[] = [];
  for (const res of settled) {
    if (res.status !== "fulfilled" || !res.value?.items) continue;
    for (const film of res.value.items) {
      const filmYear = film.year ?? film.startYear;
      if (filmYear && filmYear < curYear - 1) continue;
      if (!film.premiereRu) continue;
      const pDate = film.premiereRu.slice(0, 10);
      if (pDate > todayStr || pDate < cutoffStr) continue;
      recentPool.push(film);
    }
  }

  const unique = deduplicateFilms(recentPool);
  unique.sort((a, b) => {
    const dA = a.premiereRu ? new Date(a.premiereRu).getTime() || 0 : 0;
    const dB = b.premiereRu ? new Date(b.premiereRu).getTime() || 0 : 0;
    if (dB !== dA) return dB - dA;
    const rA = a.ratingImdb ?? a.ratingKinopoisk ?? 0;
    const rB = b.ratingImdb ?? b.ratingKinopoisk ?? 0;
    return rB - rA;
  });

  return {
    items: unique,
    total: unique.length,
    totalPages: 1,
  };
}

/**
 * Fetches genuine upcoming premieres across the remaining days of the current month
 * and the next 2 calendar months, strictly excluding old theatrical re-releases
 * (film.year < currentYear) and already-released past dates.
 */
export async function getUpcomingPremieres(
  priority: "high" | "low" = "high",
): Promise<FilmsResponse> {
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
    targets.map((t) => getPremieres(t.year, t.month, priority)),
  );

  const upcomingPool: Film[] = [];
  settled.forEach((res, idx) => {
    if (res.status !== "fulfilled" || !res.value?.items) return;
    const isCurrentMonth = targets[idx].isCurrentMonth;

    for (const film of res.value.items) {
      const filmYear = film.year ?? film.startYear;
      if (filmYear && filmYear < curYear) continue;

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

export async function getFilmAwards(
  filmId: number,
  priority: "high" | "low" = "low",
): Promise<AwardResponse> {
  return apiFetch(`/v2.2/films/${filmId}/awards`, 3600, priority);
}

export async function getFilmDistributions(
  filmId: number,
  priority: "high" | "low" = "low",
): Promise<DistributionResponse> {
  return apiFetch(`/v2.2/films/${filmId}/distributions`, 3600, priority);
}

export async function getApiKeyInfo(apiKey: string): Promise<ApiKeyResponse> {
  const clean = apiKey.trim();
  if (!clean || !/^[ -~]+$/.test(clean)) {
    if (clean) markKeyInvalid(clean);
    throw new Error("Invalid API key");
  }
  const res = await fetch(
    `${BASE_URL}/v1/api_keys/${encodeURIComponent(clean)}`,
    {
      headers: { "X-API-KEY": clean, "Content-Type": "application/json" },
    },
  );
  if (!res.ok) {
    if (
      res.status === 401 ||
      res.status === 403 ||
      res.status === 400 ||
      res.status === 404
    ) {
      markKeyInvalid(clean);
    }
    throw new Error(`API error: ${res.status}`);
  }
  markKeyValid(clean);
  return res.json();
}

let inflightKeyVerification: Promise<boolean> | null = null;

export async function validateConfiguredApiKeys(
  keysToValidate?: string[],
): Promise<boolean> {
  const rawKeys = (keysToValidate ?? getRawApiKeys())
    .map((k) => k.trim())
    .filter(Boolean);
  if (rawKeys.length === 0) {
    clearApiCache();
    return false;
  }

  let anyValid = false;
  await Promise.all(
    rawKeys.map(async (k) => {
      try {
        await getApiKeyInfo(k);
        markKeyValid(k);
        anyValid = true;
      } catch {
        markKeyInvalid(k);
      }
    }),
  );

  if (!anyValid) {
    clearApiCache();
  }
  return anyValid;
}

export async function verifyApiKeys(): Promise<boolean> {
  if (!hasApiKeys()) return false;
  if (hasVerifiedApiKey()) return true;
  if (inflightKeyVerification) return inflightKeyVerification;

  inflightKeyVerification = validateConfiguredApiKeys(getApiKeys()).finally(
    () => {
      inflightKeyVerification = null;
    },
  );
  return inflightKeyVerification;
}