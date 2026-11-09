/**
 * Preferences facade — delegates to lib/session.ts.
 */

import {
  SessionPreferences,
  ContentRegionMode,
  ProfileSectionKey,
  UserListSortOption,
  DEFAULT_PROFILE_SECTION_ORDER,
  DEFAULT_PREFERENCES as SESSION_DEFAULTS,
  getApiKeys as sessionGetApiKeys,
  getRawApiKeys as sessionGetRawApiKeys,
  hasApiKeys as sessionHasApiKeys,
  hasVerifiedApiKey as sessionHasVerifiedApiKey,
  markKeyInvalid,
  markKeyValid,
  isKeyInvalid,
  getSession,
  saveSession,
} from "./session";
import { SavedExplorePreset } from "@/types/kinopoisk";

export type { ContentRegionMode, ProfileSectionKey, UserListSortOption };
export { DEFAULT_PROFILE_SECTION_ORDER };

export type Preferences = {
  apiKeys: string[];
  searchSuggestionsEnabled: boolean;
  suggestionDebounceMs: number;
  suggestionLimit: number;
  autoTranslateEnabled: boolean;
  historyEnabled: boolean;
  safeModeEnabled: boolean;
  contentRegionMode: ContentRegionMode;
  infiniteScrollEnabled: boolean;
  homeSections: {
    popular: boolean;
    top250: boolean;
    recentReleases: boolean;
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
  defaultExploreOrder: "TRENDING" | "RATING" | "NUM_VOTE" | "YEAR";
  savedExplorePresets: SavedExplorePreset[];
  listSortOrders: Record<ProfileSectionKey, UserListSortOption>;
  profileSectionOrder: ProfileSectionKey[];
  profileSectionSorts: Record<
    ProfileSectionKey,
    "RECENT" | "RATING" | "YEAR" | "TITLE"
  >;
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
  infiniteScrollEnabled: SESSION_DEFAULTS.infiniteScrollEnabled,
  homeSections: SESSION_DEFAULTS.homeSections as Preferences["homeSections"],
  filmSections: SESSION_DEFAULTS.filmSections as Preferences["filmSections"],
  defaultExploreType:
    SESSION_DEFAULTS.defaultExploreType as Preferences["defaultExploreType"],
  defaultExploreOrder:
    SESSION_DEFAULTS.defaultExploreOrder as Preferences["defaultExploreOrder"],
  savedExplorePresets: SESSION_DEFAULTS.savedExplorePresets,
  listSortOrders: { ...SESSION_DEFAULTS.listSortOrders },
  profileSectionOrder: [...SESSION_DEFAULTS.profileSectionOrder],
  profileSectionSorts: { ...SESSION_DEFAULTS.profileSectionSorts },
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
    infiniteScrollEnabled: prefs.infiniteScrollEnabled ?? true,
    homeSections: {
      popular: prefs.homeSections?.popular ?? true,
      top250: prefs.homeSections?.top250 ?? true,
      recentReleases: prefs.homeSections?.recentReleases ?? true,
      series: prefs.homeSections?.series ?? true,
      action: prefs.homeSections?.action ?? true,
      drama: prefs.homeSections?.drama ?? true,
      scifi: prefs.homeSections?.scifi ?? true,
      upcoming: prefs.homeSections?.upcoming ?? true,
      comedy: prefs.homeSections?.comedy ?? true,
      horror: prefs.homeSections?.horror ?? true,
      premieres: prefs.homeSections?.premieres ?? true,
    },
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
      "TRENDING",
    savedExplorePresets: Array.isArray(prefs.savedExplorePresets)
      ? prefs.savedExplorePresets
      : [],
    listSortOrders: {
      ...SESSION_DEFAULTS.listSortOrders,
      ...(prefs.listSortOrders ?? {}),
    },
    profileSectionOrder: Array.isArray(prefs.profileSectionOrder)
      ? prefs.profileSectionOrder
      : [...DEFAULT_PROFILE_SECTION_ORDER],
    profileSectionSorts: {
      ...SESSION_DEFAULTS.profileSectionSorts,
      ...(prefs.profileSectionSorts ?? {}),
    },
  };
}

/**
 * Atomically saves both preferences and API keys in a single localStorage write
 * and single `cinemix-session-change` event dispatch (resolves Bug #14).
 */
export function savePreferences(prefs: Preferences): void {
  const { apiKeys, ...rest } = prefs;
  const cleanedKeys = apiKeys.map((k) => k.trim()).filter(Boolean);
  const s = getSession();
  s.preferences = rest as SessionPreferences;
  s.api_keys.keys = cleanedKeys;
  s.api_keys.saved_at = new Date().toISOString();
  saveSession(s);
}

export function getListSortPreference(
  listType: ProfileSectionKey,
): UserListSortOption {
  return getPreferences().listSortOrders?.[listType] || "ADDED";
}

export function saveListSortPreference(
  listType: ProfileSectionKey,
  sort: UserListSortOption,
): void {
  const s = getSession();
  s.preferences.listSortOrders = {
    ...SESSION_DEFAULTS.listSortOrders,
    ...(s.preferences.listSortOrders ?? {}),
    [listType]: sort,
  };
  saveSession(s);
}

export function getProfileSectionOrder(): ProfileSectionKey[] {
  return getPreferences().profileSectionOrder;
}

export function saveProfileSectionOrder(order: ProfileSectionKey[]): void {
  const s = getSession();
  s.preferences.profileSectionOrder = order;
  saveSession(s);
}

export function getProfileSectionSort(
  section: ProfileSectionKey,
): "RECENT" | "RATING" | "YEAR" | "TITLE" {
  return getPreferences().profileSectionSorts?.[section] || "RECENT";
}

export function saveProfileSectionSort(
  section: ProfileSectionKey,
  sort: "RECENT" | "RATING" | "YEAR" | "TITLE",
): void {
  const s = getSession();
  s.preferences.profileSectionSorts = {
    ...SESSION_DEFAULTS.profileSectionSorts,
    ...(s.preferences.profileSectionSorts ?? {}),
    [section]: sort,
  };
  saveSession(s);
}

export function getApiKeys(): string[] {
  return sessionGetApiKeys();
}

export function getRawApiKeys(): string[] {
  return sessionGetRawApiKeys();
}

export function hasApiKeys(): boolean {
  return sessionHasApiKeys();
}

export function hasVerifiedApiKey(): boolean {
  return sessionHasVerifiedApiKey();
}

export { markKeyInvalid, markKeyValid, isKeyInvalid };

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