// ─── Types ────────────────────────────────────────────────────────────────────

export interface Preferences {
  apiKeys: string[];

  // API load reduction
  searchSuggestionsEnabled: boolean;
  suggestionDebounceMs: number;
  suggestionLimit: number;
  autoTranslateEnabled: boolean;

  // Home page sections (which rows to render)
  homeSections: {
    popular: boolean;
    top250: boolean;
    series: boolean;
    action: boolean;
    drama: boolean;
    scifi: boolean;
    upcoming: boolean;
    comedy: boolean;
    horror: boolean;
    premieres: boolean;
  };

  // Explore defaults
  defaultExploreType: "ALL" | "FILM" | "TV_SERIES" | "TV_SHOW" | "MINI_SERIES";
  defaultExploreOrder: "RATING" | "NUM_VOTE" | "YEAR";
}

export const DEFAULT_PREFERENCES: Preferences = {
  apiKeys: [],
  searchSuggestionsEnabled: true,
  suggestionDebounceMs: 300,
  suggestionLimit: 6,
  autoTranslateEnabled: true,
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
  defaultExploreType: "ALL",
  defaultExploreOrder: "RATING",
};

const STORAGE_KEY = "cinemix_preferences";

// ─── Read / Write ─────────────────────────────────────────────────────────────

// In-memory cache — avoids re-parsing localStorage on every apiFetch call
let _cache: Preferences | null = null;

export function getPreferences(): Preferences {
  if (_cache) return _cache;
  if (typeof window === "undefined") return DEFAULT_PREFERENCES;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PREFERENCES;
    const parsed = JSON.parse(raw) as Partial<Preferences>;
    _cache = {
      ...DEFAULT_PREFERENCES,
      ...parsed,
      homeSections: {
        ...DEFAULT_PREFERENCES.homeSections,
        ...(parsed.homeSections ?? {}),
      },
    };
    return _cache;
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export function savePreferences(prefs: Preferences): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  _cache = prefs;
}

// ─── Key helpers (used by lib/kinopoisk.ts) ───────────────────────────────────

export function getApiKeys(): string[] {
  const prefs = getPreferences();
  if (prefs.apiKeys.length > 0) return prefs.apiKeys;
  // Fallback to env (for self-hosted deployments)
  const env = process.env.NEXT_PUBLIC_KINOPOISK_API_KEYS ?? "";
  return env
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean);
}

export function hasApiKeys(): boolean {
  return getApiKeys().length > 0;
}
