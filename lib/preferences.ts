/**
 * Preferences facade — delegates to lib/session.ts.
 */

import {
  SessionPreferences,
  ContentRegionMode,
  DEFAULT_PREFERENCES as SESSION_DEFAULTS,
  getApiKeys as sessionGetApiKeys,
  hasApiKeys as sessionHasApiKeys,
  getSession,
  saveSession,
} from "./session";
import { SavedExplorePreset } from "@/types/kinopoisk";

export type { ContentRegionMode };

export type Preferences = {
  apiKeys: string[];
  searchSuggestionsEnabled: boolean;
  suggestionDebounceMs: number;
  suggestionLimit: number;
  autoTranslateEnabled: boolean;
  historyEnabled: boolean;
  safeModeEnabled: boolean;
  contentRegionMode: ContentRegionMode;
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
    parentalGuide: boolean;
  };
  defaultExploreType: "ALL" | "FILM" | "TV_SERIES" | "TV_SHOW" | "MINI_SERIES";
  defaultExploreOrder: "RATING" | "NUM_VOTE" | "YEAR";
  savedExplorePresets: SavedExplorePreset[];
};

export const DEFAULT_PREFERENCES: Preferences = {
  apiKeys: [],
  searchSuggestionsEnabled: SESSION_DEFAULTS.searchSuggestionsEnabled,
  suggestionDebounceMs: SESSION_DEFAULTS.suggestionDebounceMs,
  suggestionLimit: SESSION_DEFAULTS.suggestionLimit,
  autoTranslateEnabled: SESSION_DEFAULTS.autoTranslateEnabled,
  historyEnabled: SESSION_DEFAULTS.historyEnabled,
  safeModeEnabled: SESSION_DEFAULTS.safeModeEnabled,
  contentRegionMode: SESSION_DEFAULTS.contentRegionMode,
  homeSections: SESSION_DEFAULTS.homeSections as Preferences["homeSections"],
  filmSections: SESSION_DEFAULTS.filmSections as Preferences["filmSections"],
  defaultExploreType:
    SESSION_DEFAULTS.defaultExploreType as Preferences["defaultExploreType"],
  defaultExploreOrder:
    SESSION_DEFAULTS.defaultExploreOrder as Preferences["defaultExploreOrder"],
  savedExplorePresets: SESSION_DEFAULTS.savedExplorePresets,
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
    safeModeEnabled: prefs.safeModeEnabled ?? true,
    contentRegionMode: prefs.contentRegionMode ?? "GLOBAL_FIRST",
    homeSections: prefs.homeSections as Preferences["homeSections"],
    filmSections: {
      cast: prefs.filmSections?.cast ?? true,
      awards: prefs.filmSections?.awards ?? true,
      gallery: prefs.filmSections?.gallery ?? true,
      facts: prefs.filmSections?.facts ?? true,
      boxOffice: prefs.filmSections?.boxOffice ?? true,
      similars: prefs.filmSections?.similars ?? true,
      sequels: prefs.filmSections?.sequels ?? true,
      reviews: prefs.filmSections?.reviews ?? true,
      distributions: prefs.filmSections?.distributions ?? true,
      parentalGuide: prefs.filmSections?.parentalGuide ?? true,
    },
    defaultExploreType:
      (prefs.defaultExploreType as Preferences["defaultExploreType"]) || "ALL",
    defaultExploreOrder:
      (prefs.defaultExploreOrder as Preferences["defaultExploreOrder"]) ||
      "NUM_VOTE",
    savedExplorePresets: Array.isArray(prefs.savedExplorePresets)
      ? prefs.savedExplorePresets
      : [],
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

export function getSavedExplorePresets(): SavedExplorePreset[] {
  return getPreferences().savedExplorePresets ?? [];
}

export function saveExplorePreset(
  preset: SavedExplorePreset,
): SavedExplorePreset[] {
  const prefs = getPreferences();
  const existing = prefs.savedExplorePresets ?? [];
  const updated = [
    preset,
    ...existing.filter((p) => p.id !== preset.id && p.name !== preset.name),
  ].slice(0, 15);
  savePreferences({ ...prefs, savedExplorePresets: updated });
  return updated;
}

export function deleteExplorePreset(id: string): SavedExplorePreset[] {
  const prefs = getPreferences();
  const existing = prefs.savedExplorePresets ?? [];
  const updated = existing.filter((p) => p.id !== id);
  savePreferences({ ...prefs, savedExplorePresets: updated });
  return updated;
}