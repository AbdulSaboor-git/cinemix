/**
 * CineMix Session Management
 * --------------------------
 * Stores a single anonymous session in localStorage under `cinemix_session`.
 * Designed so that every field maps 1-to-1 with the SQL schema, making
 * future DB sync trivial — just POST the session object and you're done.
 */

import { SavedExplorePreset } from "@/types/kinopoisk";

// ─── Types ────────────────────────────────────────────────────────────────────

export type DeviceType = "mobile" | "tablet" | "desktop" | "unknown";

export type ContentRegionMode = "GLOBAL_FIRST" | "BALANCED" | "ALL";

export type ProfileSectionKey = "ratings" | "history" | "favorites" | "watchlater";

export type UserListSortOption =
  | "ADDED"
  | "USER_RATING_DESC"
  | "USER_RATING_ASC"
  | "RATING"
  | "YEAR"
  | "TITLE";

export interface GeoInfo {
  ip: string | null;
  country: string | null;
  city: string | null;
}

/** Mirrors the `sessions` SQL table */
export interface SessionMeta {
  id: string;             // 16-char alphanumeric — primary key in sessions table
  name: string;           // user display name (editable)
  ip: string | null;
  country: string | null;
  city: string | null;
  device: DeviceType;
  browser: string;
  user_agent: string;
  created_at: string;     // ISO-8601
  updated_at: string;     // ISO-8601
}

export interface FilmListEntry {
  film_id: number;
  film_name: string;
  poster_url: string | null;
  year: number | null;
  rating: number | null;
  added_at: string;       // ISO-8601
}

/** Optional category breakdown for a user's custom movie taste rating (1-10 scale) */
export interface TasteBreakdown {
  story?: number;
  acting?: number;
  visuals?: number;
  soundtrack?: number;
}

/** Mirrors user-rated movie entries in `user_lists` (list_type = 'ratings') */
export interface RatedFilmEntry extends FilmListEntry {
  /** User's personal custom rating on a 1.0 - 10.0 scale (0.5 step precision) */
  user_rating: number;
  /** Optional multi-dimension taste scores (1.0 - 10.0) */
  taste_breakdown?: TasteBreakdown;
  /** Optional personal vibe/taste tags chosen by the user */
  taste_tags?: string[];
  /** Optional personal note or mini-review */
  review_note?: string;
  /** ISO-8601 timestamp when the rating was last edited */
  updated_at?: string;
}

/** Mirrors the `user_lists` SQL table */
export interface UserLists {
  favorites: FilmListEntry[];
  watchlater: FilmListEntry[];
  history: FilmListEntry[];
  ratings: RatedFilmEntry[];
}

/** Mirrors the `api_key_store` SQL table */
export interface ApiKeyStore {
  /** 8-char sync code (null until user saves to DB in future) */
  sync_code: string | null;
  keys: string[];
  saved_at: string | null;
}

/** Preferences blob (kept flat for easy SQL jsonb column) */
export interface SessionPreferences {
  searchSuggestionsEnabled: boolean;
  suggestionDebounceMs: number;
  suggestionLimit: number;
  autoTranslateEnabled: boolean;
  historyEnabled: boolean;
  safeModeEnabled: boolean;
  contentRegionMode: ContentRegionMode;
  infiniteScrollEnabled: boolean;
  homeSections: Record<string, boolean>;
  filmSections: Record<string, boolean>;
  defaultExploreType: string;
  defaultExploreOrder: string;
  savedExplorePresets: SavedExplorePreset[];
  listSortOrders: Record<ProfileSectionKey, UserListSortOption>;
  profileSectionOrder: ProfileSectionKey[];
  profileSectionSorts: Record<ProfileSectionKey, "RECENT" | "RATING" | "YEAR" | "TITLE">;
}

/** The full local session object */
export interface CineMixSession {
  meta: SessionMeta;
  lists: UserLists;
  api_keys: ApiKeyStore;
  preferences: SessionPreferences;
}

// ─── Constants ────────────────────────────────────────────────────────────────

export const SESSION_KEY = "cinemix_session";
export const TRANSLATE_CACHE_KEY = "cinemix_translate_cache_v1";
export const MAX_HISTORY = 200;
export const MAX_LIST = 500;

export const DEFAULT_PROFILE_SECTION_ORDER: ProfileSectionKey[] = [
  "ratings",
  "history",
  "favorites",
  "watchlater",
];

// ─── Defaults ────────────────────────────────────────────────────────────────

export const DEFAULT_PREFERENCES: SessionPreferences = {
  searchSuggestionsEnabled: true,
  suggestionDebounceMs: 300,
  suggestionLimit: 6,
  autoTranslateEnabled: true,
  historyEnabled: true,
  safeModeEnabled: false,
  contentRegionMode: "GLOBAL_FIRST",
  infiniteScrollEnabled: true,
  homeSections: {
    popular: true,
    top250: true,
    recentReleases: true,
    digitalReleases: true,
    series: true,
    action: true,
    drama: true,
    scifi: true,
    upcoming: true,
    comedy: true,
    horror: true,
    premieres: true,
  },
  filmSections: {
    cast: true,
    awards: true,
    gallery: true,
    facts: true,
    boxOffice: true,
    similars: true,
    sequels: true,
    reviews: true,
    distributions: true,
    parentalGuide: true,
  },
  defaultExploreType: "ALL",
  defaultExploreOrder: "TRENDING",
  savedExplorePresets: [],
  listSortOrders: {
    favorites: "ADDED",
    watchlater: "ADDED",
    history: "ADDED",
    ratings: "ADDED",
  },
  profileSectionOrder: [...DEFAULT_PROFILE_SECTION_ORDER],
  profileSectionSorts: {
    ratings: "RECENT",
    history: "RECENT",
    favorites: "RECENT",
    watchlater: "RECENT",
  },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function generateId(len: number): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  const arr = new Uint8Array(len);
  crypto.getRandomValues(arr);
  arr.forEach((b) => (result += chars[b % chars.length]));
  return result;
}

function detectDevice(): DeviceType {
  if (typeof navigator === "undefined") return "unknown";
  const ua = navigator.userAgent;
  if (/Mobi|Android|iPhone|iPod/i.test(ua)) return "mobile";
  if (/iPad|Tablet/i.test(ua)) return "tablet";
  if (/Win|Mac|Linux/i.test(ua)) return "desktop";
  return "unknown";
}

function detectBrowser(): string {
  if (typeof navigator === "undefined") return "unknown";
  const ua = navigator.userAgent;
  if (/Edg\//i.test(ua)) return "Edge";
  if (/OPR\//i.test(ua) || /Opera/i.test(ua)) return "Opera";
  if (/Chrome\//i.test(ua) && !/Chromium/i.test(ua)) return "Chrome";
  if (/Firefox\//i.test(ua)) return "Firefox";
  if (/Safari\//i.test(ua)) return "Safari";
  if (/MSIE|Trident/i.test(ua)) return "IE";
  return "unknown";
}

/** Fetch public IP + geo info from geojs.io over HTTPS (free, CORS-enabled, no key needed) */
export async function fetchGeo(): Promise<GeoInfo> {
  try {
    const r = await fetch("https://get.geojs.io/v1/ip/geo.json", {
      signal: AbortSignal.timeout(3000),
    });
    if (!r.ok) return { ip: null, country: null, city: null };
    const d = (await r.json()) as { ip?: string; country?: string; city?: string };
    return {
      ip: d.ip ?? null,
      country: d.country ?? null,
      city: d.city ?? null,
    };
  } catch {
    return { ip: null, country: null, city: null };
  }
}

// ─── In-memory cache ──────────────────────────────────────────────────────────

export const INVALID_KEYS_STORAGE = "cinemix_invalid_keys_v1";
export const VALID_KEYS_STORAGE = "cinemix_valid_keys_v1";

let _cache: CineMixSession | null = null;
let _invalidKeys: Set<string> | null = null;
let _validKeys: Set<string> | null = null;

if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (!e.key || e.key === SESSION_KEY) _cache = null;
    if (!e.key || e.key === INVALID_KEYS_STORAGE) _invalidKeys = null;
    if (!e.key || e.key === VALID_KEYS_STORAGE) _validKeys = null;
  });
}

function getInvalidKeysSet(): Set<string> {
  if (_invalidKeys) return _invalidKeys;
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(INVALID_KEYS_STORAGE);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    _invalidKeys = new Set(
      Array.isArray(parsed)
        ? parsed.filter((k): k is string => typeof k === "string")
        : [],
    );
  } catch {
    _invalidKeys = new Set();
  }
  return _invalidKeys;
}

function getValidKeysSet(): Set<string> {
  if (_validKeys) return _validKeys;
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(VALID_KEYS_STORAGE);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    _validKeys = new Set(
      Array.isArray(parsed)
        ? parsed.filter((k): k is string => typeof k === "string")
        : [],
    );
  } catch {
    _validKeys = new Set();
  }
  return _validKeys;
}

export function isKeyInvalid(key: string): boolean {
  const clean = key.trim();
  if (!clean) return true;
  return getInvalidKeysSet().has(clean);
}

export function markKeyInvalid(key: string): void {
  const clean = key.trim();
  if (!clean || typeof window === "undefined") return;
  const inv = getInvalidKeysSet();
  const val = getValidKeysSet();
  if (val.has(clean)) {
    val.delete(clean);
    try {
      localStorage.setItem(VALID_KEYS_STORAGE, JSON.stringify(Array.from(val)));
    } catch {
      // ignore
    }
  }
  if (!inv.has(clean)) {
    inv.add(clean);
    try {
      localStorage.setItem(
        INVALID_KEYS_STORAGE,
        JSON.stringify(Array.from(inv)),
      );
    } catch {
      // ignore
    }
    window.dispatchEvent(new CustomEvent("cinemix-cache-clear"));
    window.dispatchEvent(new CustomEvent("cinemix-session-change"));
  }
}

export function markKeyValid(key: string): void {
  const clean = key.trim();
  if (!clean || typeof window === "undefined") return;
  const inv = getInvalidKeysSet();
  const val = getValidKeysSet();
  let changed = false;
  if (inv.has(clean)) {
    inv.delete(clean);
    changed = true;
    try {
      localStorage.setItem(
        INVALID_KEYS_STORAGE,
        JSON.stringify(Array.from(inv)),
      );
    } catch {
      // ignore
    }
  }
  if (!val.has(clean)) {
    val.add(clean);
    changed = true;
    try {
      localStorage.setItem(VALID_KEYS_STORAGE, JSON.stringify(Array.from(val)));
    } catch {
      // ignore
    }
  }
  if (changed) {
    window.dispatchEvent(new CustomEvent("cinemix-session-change"));
  }
}

// ─── Core read/write ──────────────────────────────────────────────────────────

function clampScore(val: unknown): number | undefined {
  if (typeof val !== "number" || isNaN(val)) return undefined;
  const clamped = Math.min(10, Math.max(1, val));
  return Math.round(clamped * 2) / 2;
}

function normalizeRatedEntries(raw: unknown): RatedFilmEntry[] {
  if (!Array.isArray(raw)) return [];
  const result: RatedFilmEntry[] = [];
  const seen = new Set<number>();

  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const rec = item as Partial<RatedFilmEntry>;
    const filmId = typeof rec.film_id === "number" ? rec.film_id : NaN;
    if (isNaN(filmId) || filmId <= 0 || seen.has(filmId)) continue;

    const userScore = clampScore(rec.user_rating ?? rec.rating);
    if (userScore === undefined) continue;
    seen.add(filmId);

    let breakdown: TasteBreakdown | undefined;
    if (rec.taste_breakdown && typeof rec.taste_breakdown === "object") {
      const b = rec.taste_breakdown;
      const story = clampScore(b.story);
      const acting = clampScore(b.acting);
      const visuals = clampScore(b.visuals);
      const soundtrack = clampScore(b.soundtrack);
      if (
        story !== undefined ||
        acting !== undefined ||
        visuals !== undefined ||
        soundtrack !== undefined
      ) {
        breakdown = {
          ...(story !== undefined ? { story } : {}),
          ...(acting !== undefined ? { acting } : {}),
          ...(visuals !== undefined ? { visuals } : {}),
          ...(soundtrack !== undefined ? { soundtrack } : {}),
        };
      }
    }

    const tags = Array.isArray(rec.taste_tags)
      ? rec.taste_tags
          .filter((t): t is string => typeof t === "string" && t.trim().length > 0)
          .map((t) => t.trim())
          .slice(0, 6)
      : undefined;

    const note =
      typeof rec.review_note === "string" && rec.review_note.trim().length > 0
        ? rec.review_note.trim().slice(0, 500)
        : undefined;

    const addedAt =
      typeof rec.added_at === "string" && rec.added_at
        ? rec.added_at
        : new Date().toISOString();

    result.push({
      film_id: filmId,
      film_name: typeof rec.film_name === "string" ? rec.film_name : "Unknown",
      poster_url: typeof rec.poster_url === "string" ? rec.poster_url : null,
      year: typeof rec.year === "number" ? rec.year : null,
      rating: typeof rec.rating === "number" ? rec.rating : null,
      added_at: addedAt,
      updated_at:
        typeof rec.updated_at === "string" && rec.updated_at
          ? rec.updated_at
          : addedAt,
      user_rating: userScore,
      ...(breakdown ? { taste_breakdown: breakdown } : {}),
      ...(tags && tags.length > 0 ? { taste_tags: tags } : {}),
      ...(note ? { review_note: note } : {}),
    });
  }

  return result;
}

const VALID_PROFILE_SECTIONS = new Set<ProfileSectionKey>([
  "ratings",
  "history",
  "favorites",
  "watchlater",
]);

function normalizeProfileSectionOrder(raw: unknown): ProfileSectionKey[] {
  if (!Array.isArray(raw)) return [...DEFAULT_PROFILE_SECTION_ORDER];
  const seen = new Set<ProfileSectionKey>();
  const out: ProfileSectionKey[] = [];
  for (const item of raw) {
    if (
      typeof item === "string" &&
      VALID_PROFILE_SECTIONS.has(item as ProfileSectionKey) &&
      !seen.has(item as ProfileSectionKey)
    ) {
      seen.add(item as ProfileSectionKey);
      out.push(item as ProfileSectionKey);
    }
  }
  for (const def of DEFAULT_PROFILE_SECTION_ORDER) {
    if (!seen.has(def)) out.push(def);
  }
  return out;
}

const VALID_LIST_SORTS = new Set<UserListSortOption>([
  "ADDED",
  "USER_RATING_DESC",
  "USER_RATING_ASC",
  "RATING",
  "YEAR",
  "TITLE",
]);

function normalizeListSortOrders(
  raw: unknown,
): Record<ProfileSectionKey, UserListSortOption> {
  const base = { ...DEFAULT_PREFERENCES.listSortOrders };
  if (!raw || typeof raw !== "object") return base;
  const rec = raw as Record<string, unknown>;
  for (const k of DEFAULT_PROFILE_SECTION_ORDER) {
    const val = rec[k];
    if (typeof val === "string" && VALID_LIST_SORTS.has(val as UserListSortOption)) {
      base[k] = val as UserListSortOption;
    }
  }
  return base;
}

function normalizeProfileSectionSorts(
  raw: unknown,
): Record<ProfileSectionKey, "RECENT" | "RATING" | "YEAR" | "TITLE"> {
  const base = { ...DEFAULT_PREFERENCES.profileSectionSorts };
  if (!raw || typeof raw !== "object") return base;
  const rec = raw as Record<string, unknown>;
  for (const k of DEFAULT_PROFILE_SECTION_ORDER) {
    const val = rec[k];
    if (val === "RECENT" || val === "RATING" || val === "YEAR" || val === "TITLE") {
      base[k] = val;
    }
  }
  return base;
}

function normalizeSession(parsed: Partial<CineMixSession>): CineMixSession {
  const fresh = createDefaultSession();
  const rawFilmSections = {
    ...DEFAULT_PREFERENCES.filmSections,
    ...(parsed.preferences?.filmSections ?? {}),
  };
  delete (rawFilmSections as Record<string, unknown>).videos;

  const rawRegion = parsed.preferences?.contentRegionMode;
  const contentRegionMode: ContentRegionMode =
    rawRegion === "GLOBAL_FIRST" || rawRegion === "BALANCED" || rawRegion === "ALL"
      ? rawRegion
      : DEFAULT_PREFERENCES.contentRegionMode;

  const validOrders = new Set(["TRENDING", "NUM_VOTE", "RATING", "YEAR"]);
  const rawOrder = parsed.preferences?.defaultExploreOrder;
  const defaultExploreOrder =
    typeof rawOrder === "string" && validOrders.has(rawOrder)
      ? rawOrder
      : DEFAULT_PREFERENCES.defaultExploreOrder;

  const mergedPrefs: SessionPreferences = {
    searchSuggestionsEnabled:
      typeof parsed.preferences?.searchSuggestionsEnabled === "boolean"
        ? parsed.preferences.searchSuggestionsEnabled
        : DEFAULT_PREFERENCES.searchSuggestionsEnabled,
    suggestionDebounceMs:
      typeof parsed.preferences?.suggestionDebounceMs === "number"
        ? parsed.preferences.suggestionDebounceMs
        : DEFAULT_PREFERENCES.suggestionDebounceMs,
    suggestionLimit:
      typeof parsed.preferences?.suggestionLimit === "number"
        ? parsed.preferences.suggestionLimit
        : DEFAULT_PREFERENCES.suggestionLimit,
    autoTranslateEnabled:
      typeof parsed.preferences?.autoTranslateEnabled === "boolean"
        ? parsed.preferences.autoTranslateEnabled
        : DEFAULT_PREFERENCES.autoTranslateEnabled,
    historyEnabled:
      typeof parsed.preferences?.historyEnabled === "boolean"
        ? parsed.preferences.historyEnabled
        : DEFAULT_PREFERENCES.historyEnabled,
    safeModeEnabled:
      typeof parsed.preferences?.safeModeEnabled === "boolean"
        ? parsed.preferences.safeModeEnabled
        : DEFAULT_PREFERENCES.safeModeEnabled,
    contentRegionMode,
    infiniteScrollEnabled:
      typeof parsed.preferences?.infiniteScrollEnabled === "boolean"
        ? parsed.preferences.infiniteScrollEnabled
        : DEFAULT_PREFERENCES.infiniteScrollEnabled,
    homeSections: {
      ...DEFAULT_PREFERENCES.homeSections,
      ...(parsed.preferences?.homeSections ?? {}),
    },
    filmSections: rawFilmSections,
    defaultExploreType:
      parsed.preferences?.defaultExploreType || DEFAULT_PREFERENCES.defaultExploreType,
    defaultExploreOrder,
    savedExplorePresets: Array.isArray(parsed.preferences?.savedExplorePresets)
      ? parsed.preferences.savedExplorePresets
      : [],
    listSortOrders: normalizeListSortOrders(parsed.preferences?.listSortOrders),
    profileSectionOrder: normalizeProfileSectionOrder(
      parsed.preferences?.profileSectionOrder,
    ),
    profileSectionSorts: normalizeProfileSectionSorts(
      parsed.preferences?.profileSectionSorts,
    ),
  };

  return {
    meta: {
      ...fresh.meta,
      ...(parsed.meta ?? {}),
    },
    lists: {
      favorites: Array.isArray(parsed.lists?.favorites) ? parsed.lists!.favorites : [],
      watchlater: Array.isArray(parsed.lists?.watchlater) ? parsed.lists!.watchlater : [],
      history: Array.isArray(parsed.lists?.history) ? parsed.lists!.history : [],
      ratings: normalizeRatedEntries(parsed.lists?.ratings),
    },
    api_keys: {
      sync_code: parsed.api_keys?.sync_code ?? null,
      keys: Array.isArray(parsed.api_keys?.keys) ? parsed.api_keys!.keys : [],
      saved_at: parsed.api_keys?.saved_at ?? null,
    },
    preferences: mergedPrefs,
  };
}

export function getSession(): CineMixSession {
  if (_cache) return _cache;
  if (typeof window === "undefined") return createDefaultSession();

  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<CineMixSession>;
      _cache = normalizeSession(parsed);
      return _cache;
    }
  } catch {
    localStorage.removeItem(SESSION_KEY);
  }

  const fresh = createDefaultSession();
  _cache = fresh;
  saveSession(fresh);
  return fresh;
}

export function saveSession(
  session: CineMixSession,
  options: { source?: "list-toggle" } = {},
): void {
  if (typeof window === "undefined") return;
  session.meta.updated_at = new Date().toISOString();
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  _cache = session;
  window.dispatchEvent(
    new CustomEvent("cinemix-session-change", { detail: options }),
  );
}

function createDefaultSession(): CineMixSession {
  const now = new Date().toISOString();
  return {
    meta: {
      id: generateId(16),
      name: "",
      ip: null,
      country: null,
      city: null,
      device: detectDevice(),
      browser: detectBrowser(),
      user_agent: typeof navigator !== "undefined" ? navigator.userAgent : "",
      created_at: now,
      updated_at: now,
    },
    lists: { favorites: [], watchlater: [], history: [], ratings: [] },
    api_keys: { sync_code: null, keys: [], saved_at: null },
    preferences: { ...DEFAULT_PREFERENCES },
  };
}

/** Initialize session and (async) backfill geo info if missing */
export async function initSession(): Promise<void> {
  if (typeof window === "undefined") return;
  const session = getSession();
  if (!session.meta.ip) {
    const geo = await fetchGeo();
    if (geo.ip || geo.country || geo.city) {
      const s = getSession();
      s.meta.ip = geo.ip;
      s.meta.country = geo.country;
      s.meta.city = geo.city;
      saveSession(s);
    }
  }
}

// ─── Backup Export / Import ───────────────────────────────────────────────────

export function exportSessionBackup(): string {
  const session = getSession();
  let translateCache: Record<string, string> | null = null;
  if (typeof window !== "undefined") {
    try {
      const rawCache = localStorage.getItem(TRANSLATE_CACHE_KEY);
      translateCache = rawCache ? JSON.parse(rawCache) : null;
    } catch {
      translateCache = null;
    }
  }
  return JSON.stringify(
    {
      version: 2,
      exportedAt: new Date().toISOString(),
      session,
      translateCache,
    },
    null,
    2,
  );
}

export function importSessionBackup(rawJson: string): { ok: boolean; error?: string } {
  if (typeof window === "undefined") {
    return { ok: false, error: "Window unavailable" };
  }
  try {
    const parsed = JSON.parse(rawJson) as {
      version?: number;
      session?: Partial<CineMixSession>;
      translateCache?: unknown;
      meta?: SessionMeta;
      lists?: UserLists;
      preferences?: SessionPreferences;
    };

    const candidateSession = parsed.session ?? (parsed.meta || parsed.lists ? parsed : null);
    if (!candidateSession || typeof candidateSession !== "object") {
      return { ok: false, error: "Invalid backup file structure." };
    }

    const normalized = normalizeSession(candidateSession);
    saveSession(normalized);

    if (parsed.translateCache && typeof parsed.translateCache === "object") {
      try {
        localStorage.setItem(TRANSLATE_CACHE_KEY, JSON.stringify(parsed.translateCache));
      } catch {
        // ignore storage quota errors
      }
    } else if (typeof parsed.translateCache === "string") {
      try {
        localStorage.setItem(TRANSLATE_CACHE_KEY, parsed.translateCache);
      } catch {
        // ignore
      }
    }

    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Failed to parse JSON backup.",
    };
  }
}

// ─── Convenience accessors (used widely across the app) ───────────────────────

export function getSessionMeta(): SessionMeta {
  return getSession().meta;
}

export function getSessionPreferences(): SessionPreferences {
  return getSession().preferences;
}

export function saveSessionPreferences(prefs: SessionPreferences): void {
  const s = getSession();
  s.preferences = prefs;
  saveSession(s);
}

export function getSessionName(): string {
  return getSession().meta.name;
}

export function saveSessionName(name: string): void {
  const s = getSession();
  s.meta.name = name.trim();
  saveSession(s);
}

export function getRawApiKeys(): string[] {
  const s = getSession();
  if (s.api_keys.keys.length > 0) {
    return s.api_keys.keys.map((k) => k.trim()).filter(Boolean);
  }
  const env =
    process.env.NEXT_PUBLIC_KINOPOISK_API_KEYS ||
    process.env.NEXT_PUBLIC_KINOPOISK_API_KEY ||
    "";
  return env
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean);
}

export function getApiKeys(): string[] {
  const raw = getRawApiKeys();
  if (typeof window === "undefined") return raw;
  const inv = getInvalidKeysSet();
  return raw.filter((k) => !inv.has(k));
}

export function saveApiKeys(keys: string[]): void {
  const cleaned = keys.map((k) => k.trim()).filter(Boolean);
  const s = getSession();
  s.api_keys.keys = cleaned;
  s.api_keys.saved_at = new Date().toISOString();
  saveSession(s);
}

export function hasApiKeys(): boolean {
  return getApiKeys().length > 0;
}

export function hasVerifiedApiKey(): boolean {
  const usable = getApiKeys();
  if (usable.length === 0) return false;
  if (typeof window === "undefined") return false;
  const val = getValidKeysSet();
  return usable.some((k) => val.has(k));
}