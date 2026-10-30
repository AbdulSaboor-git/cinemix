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

function schedulePersistFilmMetaStore(): void {
  if (typeof window === "undefined" || persistMetaTimer) return;
  persistMetaTimer = setTimeout(() => {
    persistMetaTimer = null;
    try {
      const store = getFilmMetaStore();
      const keys = Object.keys(store);
      if (keys.length > 1000) {
        for (let i = 0; i < 180; i++) {
          delete store[Number(keys[i])];
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
    posterUrlPreview:
      film.posterUrlPreview || cached.posterUrlPreview || film.posterUrl || "",
    year: film.year ?? cached.year,
    startYear: film.startYear ?? cached.startYear,
    endYear: film.endYear ?? cached.endYear,
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

  const nextYear = film.year ?? safePrev.year;
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
    startYear: film.startYear ?? safePrev.startYear,
    endYear: film.endYear ?? safePrev.endYear,
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
  while (activeHighPriorityCount > 0) {
    await sleep(140);
  }
  const now = Date.now();
  const base = Math.max(now, nextHighSlot, nextLowSlot);
  const waitMs = base - now;
  nextLowSlot = base + 240;
  if (waitMs > 0) {
    await sleep(waitMs);
  }
  while (activeHighPriorityCount > 0) {
    await sleep(140);
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
  // Cap background queue length so rapid scrolling never builds a huge backlog
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
  const cached = getCachedApi<T>(path);
  if (cached !== null) return cached;

  const existing = inflightApi.get(path);
  if (existing) return existing as Promise<T>;

  if (priority === "high") {
    activeHighPriorityCount += 1;
  }

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

      await waitRateLimitSlot(priority);
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
        await sleep(240 * (attempt + 1));
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

  const normalized: Film = {
    ...f,
    kinopoiskId: id,
    filmId: f.filmId ?? id,
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
    const sorted = sortDiscoveryPool(
      filtered,
      order,
      direction,
      ratingSource,
      opts.randomSeed,
    );
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

/**
 * Interleaves multiple arrays round-robin so items from a single seed
 * (e.g., all Spider-Man movies) are never grouped sequentially.
 */
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

/**
 * Unified "For You" Taste-Match Engine (used by both Home "For You" row and Explore "For You" preset).
 * - Uses up to 16 user seeds across Favorites, Watch Later, and Recently Watched.
 * - Eliminates sequential franchise clumping by shuffling each seed's recommendations into its own bucket,
 *   round-robin interleaving across all seed buckets + genre-affinity pools, and applying a stratified shuffle.
 * - Supports true multi-page pagination (`page = 1, 2, 3...`) so clicking "Load More" on Explore
 *   continuously streams fresh, non-duplicate recommendations.
 */
export async function discoverTasteMatchedFilms(
  opts: DiscoverFilmsOptions = {},
  page = 1,
): Promise<FilmsResponse> {
  const safePage = Math.max(1, page);
  const randomSeed = (opts.randomSeed ?? 1) + SESSION_SHUFFLE_SEED;

  const favs = getList("favorites");
  const watchLater = getList("watchlater");
  const history = getList("history");

  // Interleave seeds from Favorites (highest weight), Watch Later, and History so all 3 lists drive recommendations
  const maxSeedLen = Math.max(favs.length, watchLater.length, history.length);
  const interleavedRawSeeds: typeof favs = [];
  for (let i = 0; i < maxSeedLen; i++) {
    if (i < favs.length) interleavedRawSeeds.push(favs[i]);
    if (i < watchLater.length) interleavedRawSeeds.push(watchLater[i]);
    if (i < history.length) interleavedRawSeeds.push(history[i]);
  }

  const seenSeedIds = new Set<number>();
  const uniqueSeeds: typeof favs = [];
  for (const entry of interleavedRawSeeds) {
    if (!entry.film_id || seenSeedIds.has(entry.film_id)) continue;
    seenSeedIds.add(entry.film_id);
    uniqueSeeds.push(entry);
    if (uniqueSeeds.length >= 16) break;
  }

  // Shuffle seed order deterministically per session so no single favorite monopolizes the top slot
  const shuffledSeeds = seededShuffle(uniqueSeeds, randomSeed);

  // Extract user's top genre affinities from cached metadata of their seeds
  const genreWeights = new Map<number, number>();
  for (const s of uniqueSeeds) {
    const meta = getCachedFilmMeta(s.film_id);
    if (meta?.genres) {
      for (const g of meta.genres) {
        const gId = GENRE_NAME_TO_ID[(g.genre || "").trim().toLowerCase()];
        if (gId) {
          genreWeights.set(gId, (genreWeights.get(gId) ?? 0) + 1);
        }
      }
    }
  }
  const topUserGenres = Array.from(genreWeights.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([id]) => id);
  const affinityGenres =
    topUserGenres.length >= 2 ? topUserGenres.slice(0, 4) : [11, 6, 2, 1, 13];

  const seedBuckets: Film[][] = [];

  if (shuffledSeeds.length > 0) {
    // Rotate which seeds we query as `safePage` increases so deeper pages discover new branches
    const batchSize = Math.min(5, shuffledSeeds.length);
    const startOffset = ((safePage - 1) * 3) % shuffledSeeds.length;
    const activeSeeds: typeof favs = [];
    for (let i = 0; i < batchSize; i++) {
      activeSeeds.push(shuffledSeeds[(startOffset + i) % shuffledSeeds.length]);
    }

    const [relatedResults, similarResults] = await Promise.all([
      Promise.allSettled(activeSeeds.map((s) => getRelatedFilms(s.film_id))),
      Promise.allSettled(activeSeeds.map((s) => getSimilarFilms(s.film_id))),
    ]);

    for (let i = 0; i < activeSeeds.length; i++) {
      const bucket: Film[] = [];
      const rel = relatedResults[i];
      if (rel?.status === "fulfilled" && Array.isArray(rel.value)) {
        for (const rf of rel.value) {
          bucket.push(hydrateFilmWithCache(rf));
        }
      }

      const sim = similarResults[i];
      if (sim?.status === "fulfilled" && sim.value?.items) {
        for (const sf of sim.value.items) {
          bucket.push(
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

      if (bucket.length > 0) {
        // Shuffle within each seed's bucket so sequels and similars are mixed
        seedBuckets.push(
          seededShuffle(bucket, randomSeed + activeSeeds[i].film_id + safePage),
        );
      }
    }

    // Include unwatched Watch Later & Favorite items as their own shuffled bucket on page 1
    if (safePage === 1) {
      const savedBucket = seededShuffle(
        [...watchLater, ...favs].slice(0, 12).map((item) =>
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
        ),
        randomSeed + 99,
      );
      if (savedBucket.length > 0) {
        seedBuckets.push(savedBucket);
      }
    }
  }

  // Fetch page-specific genre-affinity & global acclaimed supplements so every "Load More" page has fresh items
  const primaryGenreId =
    affinityGenres[(safePage - 1) % affinityGenres.length];
  const secondaryGenreId =
    affinityGenres[safePage % affinityGenres.length];
  const apiPage = ((safePage - 1) % 5) + 1;
  const ratingBands: [number, number][] = [
    [7.2, 10],
    [6.8, 8.6],
    [7.0, 9.2],
    [6.5, 8.4],
  ];
  const activeBand =
    ratingBands[Math.floor((safePage - 1) / 2) % ratingBands.length];

  const baseType =
    opts.type === "ALL" || !opts.type
      ? undefined
      : (opts.type as "FILM" | "TV_SHOW" | "TV_SERIES" | "MINI_SERIES");

  const [genreSupp1, genreSupp2, globalSupp] = await Promise.allSettled([
    getFilmsByFilter({
      type: baseType,
      genres: primaryGenreId,
      countries: 1,
      order: safePage % 2 === 0 ? "RATING" : "NUM_VOTE",
      ratingFrom: activeBand[0],
      ratingTo: activeBand[1],
      page: apiPage,
    }),
    getFilmsByFilter({
      type: baseType,
      genres: secondaryGenreId,
      order: "NUM_VOTE",
      ratingFrom: activeBand[0],
      page: ((safePage) % 5) + 1,
    }),
    getFilmsByFilter({
      type: baseType,
      countries: 1,
      order: "NUM_VOTE",
      ratingFrom: 7.0,
      page: apiPage,
    }),
  ]);

  if (genreSupp1.status === "fulfilled" && genreSupp1.value.items.length > 0) {
    seedBuckets.push(
      seededShuffle(genreSupp1.value.items, randomSeed + safePage * 13),
    );
  }
  if (genreSupp2.status === "fulfilled" && genreSupp2.value.items.length > 0) {
    seedBuckets.push(
      seededShuffle(genreSupp2.value.items, randomSeed + safePage * 29),
    );
  }
  if (globalSupp.status === "fulfilled" && globalSupp.value.items.length > 0) {
    seedBuckets.push(
      seededShuffle(globalSupp.value.items, randomSeed + safePage * 47),
    );
  }

  // Round-robin interleave across all seed & genre-affinity buckets
  const interleavedPool = interleaveBuckets(seedBuckets);
  const uniquePool = deduplicateFilms(interleavedPool);

  const filtered = applyClientDiscoveryFilters(
    uniquePool,
    { ...opts, hideWatched: opts.hideWatched ?? true },
    opts.ratingSource ?? "AUTO",
  );

  // Stratified shuffle across the combined pool so related movies are organically distributed
  // Unless user explicitly chose a non-default sort order (like YEAR or IMDB_RATING)
  let finalOrdered: Film[];
  if (opts.order && opts.order !== "NUM_VOTE") {
    finalOrdered = sortDiscoveryPool(
      filtered,
      opts.order,
      opts.direction ?? "DESC",
      opts.ratingSource ?? "AUTO",
      randomSeed + safePage,
    );
  } else {
    finalOrdered = seededShuffle(filtered, randomSeed + safePage * 101);
  }

  const pageSlice = finalOrdered.slice(0, 24);

  // Queue low-priority hydration only for the first 8 visible cards missing year/genres
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

    // 8. Country Include / Exclude
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

    // 12. Year Range Check
    const yr = film.year ?? film.startYear;
    if (yr) {
      if (opts.yearFrom !== undefined && yr < opts.yearFrom) return false;
      if (opts.yearTo !== undefined && yr > opts.yearTo) return false;
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
): Film[] {
  const copy = [...films];
  const dirMult = direction === "ASC" ? 1 : -1;

  if (order === "RANDOM") {
    return seededShuffle(copy, randomSeed + 1337);
  }

  copy.sort((a, b) => {
    if (order === "TITLE") {
      const titleA = (
        a.nameEn ||
        a.nameOriginal ||
        a.nameRu ||
        ""
      ).toLowerCase();
      const titleB = (
        b.nameEn ||
        b.nameOriginal ||
        b.nameRu ||
        ""
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

// ─── Semantic & Typo-Tolerant Search Engine (Fuzzy + Concept Expansion) ───────

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
    keywords: ["Heat", "The Wolf of Wall Street", "Goodfellas", "The Godfather", "Catch Me If You Can"],
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
    keywords: ["Se7en", "Zodiac", "Prisoners", "Knives Out", "True Detective"],
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
    keywords: ["The Lord of the Rings", "Harry Potter", "Game of Thrones", "House of the Dragon"],
    genreIds: [12, 7],
  },
  {
    label: "War & Historical Epics",
    triggers: ["war", "ww2", "world war", "military", "soldier", "battlefield", "historical"],
    keywords: ["1917", "Saving Private Ryan", "Oppenheimer", "Dunkirk", "Inglourious Basterds"],
    genreIds: [14, 15, 2],
  },
  {
    label: "True Story & Biopics",
    triggers: ["true story", "based on a true story", "biopic", "biography", "real life"],
    keywords: ["Oppenheimer", "The Wolf of Wall Street", "Green Book", "The Social Network", "Ford v Ferrari"],
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

function normalizeSearchToken(str: string): string {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9а-яё\s]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function phoneticSkeleton(str: string): string {
  return normalizeSearchToken(str)
    .replace(/ph/g, "f")
    .replace(/ck/g, "k")
    .replace(/qu/g, "kw")
    .replace(/sh/g, "s")
    .replace(/th/g, "t")
    .replace(/([a-zа-яё])\1+/gi, "$1")
    .replace(/\s+/g, "");
}

function damerauLevenshtein(a: string, b: string): number {
  const lenA = a.length;
  const lenB = b.length;
  if (lenA === 0) return lenB;
  if (lenB === 0) return lenA;
  if (Math.abs(lenA - lenB) > 4) return Math.abs(lenA - lenB);

  const dp: number[][] = Array.from({ length: lenA + 1 }, () =>
    new Array(lenB + 1).fill(0),
  );
  for (let i = 0; i <= lenA; i++) dp[i][0] = i;
  for (let j = 0; j <= lenB; j++) dp[0][j] = j;

  for (let i = 1; i <= lenA; i++) {
    for (let j = 1; j <= lenB; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost,
      );
      if (
        i > 1 &&
        j > 1 &&
        a[i - 1] === b[j - 2] &&
        a[i - 2] === b[j - 1]
      ) {
        dp[i][j] = Math.min(dp[i][j], dp[i - 2][j - 2] + cost);
      }
    }
  }
  return dp[lenA][lenB];
}

function trigramSimilarity(a: string, b: string): number {
  const s1 = `  ${a} `;
  const s2 = `  ${b} `;
  if (s1 === s2) return 1;
  const set1 = new Set<string>();
  const set2 = new Set<string>();
  for (let i = 0; i < s1.length - 2; i++) set1.add(s1.slice(i, i + 3));
  for (let i = 0; i < s2.length - 2; i++) set2.add(s2.slice(i, i + 3));
  if (set1.size === 0 || set2.size === 0) return 0;
  let intersection = 0;
  set1.forEach((gram) => {
    if (set2.has(gram)) intersection++;
  });
  return (2 * intersection) / (set1.size + set2.size);
}

/**
 * Computes a fuzzy relevance score (0..100) between a user query and a candidate title.
 */
export function computeFuzzyMatchScore(query: string, candidate?: string | null): number {
  if (!query || !candidate) return 0;
  const qNorm = normalizeSearchToken(query);
  const cNorm = normalizeSearchToken(candidate);
  if (!qNorm || !cNorm) return 0;

  if (cNorm === qNorm) return 100;
  if (cNorm.startsWith(qNorm)) return 92;
  if (cNorm.includes(` ${qNorm}`)) return 86;
  if (cNorm.includes(qNorm)) return 78;

  // Compact space-insensitive check (e.g. "spiderman" vs "spider man")
  const qCompact = qNorm.replace(/\s+/g, "");
  const cCompact = cNorm.replace(/\s+/g, "");
  if (cCompact === qCompact) return 95;
  if (cCompact.startsWith(qCompact)) return 88;
  if (cCompact.includes(qCompact) && qCompact.length >= 4) return 76;

  // Phonetic skeleton match (e.g. "interstelar", "opppenheimer", "shawshenk")
  const qPhon = phoneticSkeleton(qNorm);
  const cPhon = phoneticSkeleton(cNorm);
  if (qPhon.length >= 4 && (cPhon === qPhon || cPhon.startsWith(qPhon))) {
    return 84;
  }

  // Word-level & whole-title edit distance
  if (qCompact.length >= 4) {
    const dist = damerauLevenshtein(
      qCompact,
      cCompact.slice(0, Math.min(cCompact.length, qCompact.length + 2)),
    );
    const maxAllowed = qCompact.length >= 8 ? 2 : 1;
    if (dist <= maxAllowed) {
      return 82 - dist * 8;
    }

    const cWords = cNorm.split(" ").filter((w) => w.length >= 3);
    const qWords = qNorm.split(" ").filter((w) => w.length >= 3);
    if (qWords.length > 0 && cWords.length > 0) {
      let matchedWords = 0;
      for (const qw of qWords) {
        const hit = cWords.some(
          (cw) =>
            cw.startsWith(qw) ||
            damerauLevenshtein(qw, cw) <= (qw.length >= 6 ? 2 : 1),
        );
        if (hit) matchedWords++;
      }
      if (matchedWords === qWords.length) {
        return 75;
      }
    }
  }

  const tri = trigramSimilarity(qCompact, cCompact);
  if (tri >= 0.52) {
    return Math.round(tri * 85);
  }

  return 0;
}

export interface SemanticSearchAnalysis {
  originalQuery: string;
  correctedQuery: string | null;
  matchedConcept: SemanticConceptRule | null;
  relatedTerms: string[];
  localMatches: Film[];
}

/**
 * Analyzes a user's search query in <2ms:
 * 1. Detects typos against canonical global titles + cached catalog ("Did you mean...")
 * 2. Detects semantic concepts, moods, themes, and franchises (e.g. "time travel", "mind bending")
 * 3. Returns instant local matches from the client metadata cache
 */
export function analyzeSemanticQuery(rawQuery: string): SemanticSearchAnalysis {
  const q = rawQuery.trim();
  const qNorm = normalizeSearchToken(q);

  if (qNorm.length < 2) {
    return {
      originalQuery: q,
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
      const tNorm = normalizeSearchToken(t);
      return (
        qNorm === tNorm ||
        qNorm.includes(tNorm) ||
        (qNorm.length >= 4 && tNorm.startsWith(qNorm)) ||
        (qNorm.length >= 5 && damerauLevenshtein(qNorm, tNorm) <= 1)
      );
    });
    if (isHit) {
      matchedConcept = rule;
      break;
    }
  }

  // 2. Check Local Metadata Cache + Canonical Titles for Typo Correction & Instant Completions
  const cachedFilms = getAllCachedFilms();
  const scoredLocal: { film: Film; score: number }[] = [];

  for (const meta of cachedFilms) {
    if (isSafeModeActive() && isAdultContentFilm(meta)) continue;
    const sEn = computeFuzzyMatchScore(q, meta.nameEn);
    const sOrig = computeFuzzyMatchScore(q, meta.nameOriginal);
    const sRu = computeFuzzyMatchScore(q, meta.nameRu);
    const genreMatch = (meta.genres ?? []).some((g) => {
      const enG = translateGenre(g.genre, true).toLowerCase();
      return enG === qNorm || g.genre.toLowerCase() === qNorm;
    })
      ? 62
      : 0;

    const best = Math.max(sEn, sOrig, sRu, genreMatch);
    if (best >= 58) {
      scoredLocal.push({
        film: hydrateFilmWithCache(meta),
        score: best + ((meta.ratingImdb ?? meta.ratingKinopoisk ?? 0) * 0.5),
      });
    }
  }

  scoredLocal.sort((a, b) => b.score - a.score);
  const localMatches = deduplicateFilms(scoredLocal.slice(0, 8).map((x) => x.film));

  // 3. Find closest canonical or cached title for typo correction & autocomplete pills
  const candidatePool = new Set<string>(CANONICAL_TITLES);
  for (const m of cachedFilms) {
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
    const topNorm = normalizeSearchToken(top.title);
    // If user typed a close typo (not an exact prefix), suggest the canonical spelling
    if (
      top.score >= 70 &&
      topNorm !== qNorm &&
      !topNorm.startsWith(qNorm)
    ) {
      correctedQuery = top.title;
    }
  }

  const relatedTerms: string[] = [];
  if (correctedQuery) {
    relatedTerms.push(correctedQuery);
  }
  for (const st of scoredTitles.slice(0, 4)) {
    if (!relatedTerms.includes(st.title) && normalizeSearchToken(st.title) !== qNorm) {
      relatedTerms.push(st.title);
    }
  }
  if (matchedConcept) {
    for (const kw of matchedConcept.keywords) {
      if (!relatedTerms.includes(kw)) relatedTerms.push(kw);
    }
  }

  return {
    originalQuery: q,
    correctedQuery,
    matchedConcept,
    relatedTerms: relatedTerms.slice(0, 5),
    localMatches,
  };
}

/**
 * Semantic & Typo-Tolerant Film Search:
 * - Combines direct keyword API search with automatic typo-corrected query fallback
 *   and semantic concept/genre/collection expansion when literal keyword matches are sparse.
 * - Re-ranks results by fuzzy title similarity + audience rating & vote confidence.
 */
export async function searchFilms(
  keyword: string,
  page = 1,
): Promise<FilmsResponse> {
  const cleanKeyword = keyword.trim();
  if (!cleanKeyword) {
    return { items: [], total: 0, totalPages: 1 };
  }

  const analysis = analyzeSemanticQuery(cleanKeyword);
  const primaryQueryPromise = apiFetch<Record<string, unknown>>(
    `/v2.1/films/search-by-keyword?keyword=${encodeURIComponent(cleanKeyword)}&page=${page}`,
  )
    .then((raw) => normalizeFilmsResponse(raw))
    .catch(() => ({ items: [] as Film[], total: 0, totalPages: 1 }));

  // If page 1 has a high-confidence typo correction or semantic concept, run in parallel!
  const secondaryPromises: Promise<FilmsResponse>[] = [];

  if (page === 1 && analysis.correctedQuery) {
    secondaryPromises.push(
      apiFetch<Record<string, unknown>>(
        `/v2.1/films/search-by-keyword?keyword=${encodeURIComponent(analysis.correctedQuery)}&page=1`,
      )
        .then((raw) => normalizeFilmsResponse(raw))
        .catch(() => ({ items: [], total: 0, totalPages: 1 })),
    );
  }

  if (analysis.matchedConcept) {
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

  const [primaryRes, ...secondaryRes] = await Promise.all([
    primaryQueryPromise,
    ...secondaryPromises,
  ]);

  let combinedItems = [...primaryRes.items];
  for (const sec of secondaryRes) {
    combinedItems.push(...sec.items);
  }

  // If literal + corrected API returned very few results on page 1, fallback to de-punctuated/root token
  if (page === 1 && combinedItems.length < 3) {
    const fallbackTerm =
      analysis.correctedQuery ||
      analysis.relatedTerms[0] ||
      cleanKeyword.replace(/[-:.'"]/g, " ").split(/\s+/).sort((a, b) => b.length - a.length)[0];

    if (
      fallbackTerm &&
      fallbackTerm.length >= 3 &&
      fallbackTerm.toLowerCase() !== cleanKeyword.toLowerCase()
    ) {
      const fbRes = await apiFetch<Record<string, unknown>>(
        `/v2.1/films/search-by-keyword?keyword=${encodeURIComponent(fallbackTerm)}&page=1`,
      )
        .then((raw) => normalizeFilmsResponse(raw))
        .catch(() => ({ items: [] as Film[], total: 0, totalPages: 1 }));
      combinedItems.push(...fbRes.items);
    }
  }

  if (page === 1 && analysis.localMatches.length > 0) {
    combinedItems = [...analysis.localMatches, ...combinedItems];
  }

  const unique = deduplicateFilms(combinedItems);

  // Rank results so exact/fuzzy title matches with strong ratings appear at the top
  const targetQuery = analysis.correctedQuery || cleanKeyword;
  const ranked = [...unique].sort((a, b) => {
    const scoreTitle = (f: Film) =>
      Math.max(
        computeFuzzyMatchScore(cleanKeyword, f.nameEn),
        computeFuzzyMatchScore(cleanKeyword, f.nameOriginal),
        computeFuzzyMatchScore(cleanKeyword, f.nameRu),
        computeFuzzyMatchScore(targetQuery, f.nameEn),
        computeFuzzyMatchScore(targetQuery, f.nameOriginal),
      );
    const sA = scoreTitle(a);
    const sB = scoreTitle(b);
    if (Math.abs(sA - sB) >= 12) return sB - sA;

    const rA = a.ratingImdb ?? a.ratingKinopoisk ?? 0;
    const rB = b.ratingImdb ?? b.ratingKinopoisk ?? 0;
    return sB + rB * 1.5 - (sA + rA * 1.5);
  });

  const maxTotal = Math.max(
    primaryRes.total,
    ...secondaryRes.map((s) => s.total),
    ranked.length,
  );
  const maxPages = Math.max(
    primaryRes.totalPages,
    ...secondaryRes.map((s) => s.totalPages),
    1,
  );

  return {
    items: ranked,
    total: maxTotal,
    totalPages: maxPages,
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
  const res = await fetch(`${BASE_URL}/v1/api_keys/${apiKey}`, {
    headers: { "X-API-KEY": apiKey, "Content-Type": "application/json" },
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}