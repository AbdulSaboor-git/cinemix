/**
 * CineMix Session Management
 * --------------------------
 * Stores a single anonymous session in localStorage under `cinemix_session`.
 * Designed so that every field maps 1-to-1 with the SQL schema, making
 * future DB sync trivial — just POST the session object and you're done.
 *
 * SQL schema (reference):
 *   sessions      (id, name, ip, country, city, device, browser, user_agent, created_at, updated_at)
 *   log_events    (id, session_id, type, payload, created_at)
 *   user_lists    (session_id, list_type, film_id, film_name, poster_url, added_at)
 *   api_key_store (code, session_id, keys_json, created_at, revoked_at)
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type DeviceType = "mobile" | "tablet" | "desktop" | "unknown";

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

/** Mirrors the `user_lists` SQL table */
export interface UserLists {
  favorites: FilmListEntry[];
  watchlater: FilmListEntry[];
  history: FilmListEntry[];
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
  homeSections: Record<string, boolean>;
  filmSections: Record<string, boolean>;
  defaultExploreType: string;
  defaultExploreOrder: string;
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
export const MAX_HISTORY = 200;
export const MAX_LIST = 500;

// ─── Defaults ────────────────────────────────────────────────────────────────

export const DEFAULT_PREFERENCES: SessionPreferences = {
  searchSuggestionsEnabled: true,
  suggestionDebounceMs: 300,
  suggestionLimit: 6,
  autoTranslateEnabled: true,
  historyEnabled: true,
  homeSections: {
    popular: true,
    top250: true,
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
    videos: true,
  },
  defaultExploreType: "FILM",
  defaultExploreOrder: "RATING",
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

/** Fetch public IP + geo info from ip-api.com (free, no key needed, non-EU friendly) */
export async function fetchGeo(): Promise<GeoInfo> {
  try {
    const r = await fetch("https://ip-api.com/json/?fields=status,country,city,query", {
      signal: AbortSignal.timeout(4000),
    });
    const d = await r.json();
    if (d.status === "success") {
      return { ip: d.query ?? null, country: d.country ?? null, city: d.city ?? null };
    }
  } catch {
    // silently fail — geo is best-effort
  }
  return { ip: null, country: null, city: null };
}

// ─── In-memory cache ──────────────────────────────────────────────────────────

let _cache: CineMixSession | null = null;

if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === SESSION_KEY) _cache = null;
  });
}

// ─── Core read/write ──────────────────────────────────────────────────────────

export function getSession(): CineMixSession {
  if (_cache) return _cache;
  if (typeof window === "undefined") return createDefaultSession();

  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as CineMixSession;
      // Deep-merge preferences so new keys get defaults
      parsed.preferences = {
        ...DEFAULT_PREFERENCES,
        ...parsed.preferences,
        homeSections: { ...DEFAULT_PREFERENCES.homeSections, ...(parsed.preferences?.homeSections ?? {}) },
        filmSections: { ...DEFAULT_PREFERENCES.filmSections, ...(parsed.preferences?.filmSections ?? {}) },
      };
      // Ensure lists exist (migration safety)
      if (!parsed.lists) parsed.lists = { favorites: [], watchlater: [], history: [] };
      if (!parsed.lists.favorites) parsed.lists.favorites = [];
      if (!parsed.lists.watchlater) parsed.lists.watchlater = [];
      if (!parsed.lists.history) parsed.lists.history = [];
      if (!parsed.api_keys) parsed.api_keys = { sync_code: null, keys: [], saved_at: null };
      _cache = parsed;
      return _cache;
    }
  } catch {
    // corrupt storage — nuke and start fresh
    localStorage.removeItem(SESSION_KEY);
  }

  const fresh = createDefaultSession();
  _cache = fresh;
  saveSession(fresh);
  return fresh;
}

export function saveSession(session: CineMixSession): void {
  if (typeof window === "undefined") return;
  session.meta.updated_at = new Date().toISOString();
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  _cache = session;
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
    lists: { favorites: [], watchlater: [], history: [] },
    api_keys: { sync_code: null, keys: [], saved_at: null },
    preferences: DEFAULT_PREFERENCES,
  };
}

/** Initialize session and (async) backfill geo info if missing */
export async function initSession(): Promise<void> {
  if (typeof window === "undefined") return;
  const session = getSession();
  if (!session.meta.ip) {
    const geo = await fetchGeo();
    const s = getSession();
    s.meta.ip = geo.ip;
    s.meta.country = geo.country;
    s.meta.city = geo.city;
    saveSession(s);
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

export function getApiKeys(): string[] {
  const s = getSession();
  if (s.api_keys.keys.length > 0) return s.api_keys.keys;
  const env = process.env.NEXT_PUBLIC_KINOPOISK_API_KEYS ?? "";
  return env.split(",").map((k) => k.trim()).filter(Boolean);
}

export function saveApiKeys(keys: string[]): void {
  const s = getSession();
  s.api_keys.keys = keys.filter(Boolean);
  s.api_keys.saved_at = new Date().toISOString();
  saveSession(s);
}

export function hasApiKeys(): boolean {
  return getApiKeys().length > 0;
}
