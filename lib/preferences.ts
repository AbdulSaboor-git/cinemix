/**
 * Preferences facade — delegates to lib/session.ts.
 */

import {
  SessionPreferences,
  CustomPlayerServer,
  DEFAULT_PREFERENCES as SESSION_DEFAULTS,
  getApiKeys as sessionGetApiKeys,
  hasApiKeys as sessionHasApiKeys,
  getSession,
  saveSession,
} from "./session";

export type Preferences = {
  apiKeys: string[];
  searchSuggestionsEnabled: boolean;
  suggestionDebounceMs: number;
  suggestionLimit: number;
  autoTranslateEnabled: boolean;
  historyEnabled: boolean;
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
  filmSections: {
    cast: boolean;
    awards: boolean;
    gallery: boolean;
    facts: boolean;
    boxOffice: boolean;
    similars: boolean;
    sequels: boolean;
    reviews: boolean;
    distributions: boolean;
    videos: boolean;
  };
  defaultExploreType: "ALL" | "FILM" | "TV_SERIES" | "TV_SHOW" | "MINI_SERIES";
  defaultExploreOrder: "RATING" | "NUM_VOTE" | "YEAR";
  preferredPlayerId: string;
  alwaysAskPlayer: boolean;
  customPlayers: CustomPlayerServer[];
};

export const DEFAULT_PREFERENCES: Preferences = {
  apiKeys: [],
  searchSuggestionsEnabled: SESSION_DEFAULTS.searchSuggestionsEnabled,
  suggestionDebounceMs: SESSION_DEFAULTS.suggestionDebounceMs,
  suggestionLimit: SESSION_DEFAULTS.suggestionLimit,
  autoTranslateEnabled: SESSION_DEFAULTS.autoTranslateEnabled,
  historyEnabled: SESSION_DEFAULTS.historyEnabled,
  homeSections: SESSION_DEFAULTS.homeSections as Preferences["homeSections"],
  filmSections: SESSION_DEFAULTS.filmSections as Preferences["filmSections"],
  defaultExploreType: SESSION_DEFAULTS.defaultExploreType as Preferences["defaultExploreType"],
  defaultExploreOrder: SESSION_DEFAULTS.defaultExploreOrder as Preferences["defaultExploreOrder"],
  preferredPlayerId: SESSION_DEFAULTS.preferredPlayerId,
  alwaysAskPlayer: SESSION_DEFAULTS.alwaysAskPlayer,
  customPlayers: SESSION_DEFAULTS.customPlayers,
};

export function getPreferences(): Preferences {
  const s = getSession();
  const prefs = s.preferences;
  return {
    apiKeys: s.api_keys.keys,
    searchSuggestionsEnabled: prefs.searchSuggestionsEnabled,
    suggestionDebounceMs: prefs.suggestionDebounceMs,
    suggestionLimit: prefs.suggestionLimit,
    autoTranslateEnabled: prefs.autoTranslateEnabled,
    historyEnabled: prefs.historyEnabled ?? true,
    homeSections: prefs.homeSections as Preferences["homeSections"],
    filmSections: prefs.filmSections as Preferences["filmSections"],
    defaultExploreType: prefs.defaultExploreType as Preferences["defaultExploreType"],
    defaultExploreOrder: prefs.defaultExploreOrder as Preferences["defaultExploreOrder"],
    preferredPlayerId: prefs.preferredPlayerId || "flcksbr",
    alwaysAskPlayer: prefs.alwaysAskPlayer ?? true,
    customPlayers: prefs.customPlayers ?? [],
  };
}

export function savePreferences(prefs: Preferences): void {
  const { apiKeys, ...rest } = prefs;
  const s = getSession();
  s.preferences = rest as SessionPreferences;
  s.api_keys.keys = apiKeys.filter(Boolean);
  saveSession(s);
}

export function getApiKeys(): string[] {
  return sessionGetApiKeys();
}

export function hasApiKeys(): boolean {
  return sessionHasApiKeys();
}
