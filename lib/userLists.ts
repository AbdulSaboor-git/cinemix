/**
 * CineMix User Lists & Custom Taste Ratings
 * -----------------------------------------
 * Manages favorites, watch-later, watch history, and custom user movie ratings.
 * All writes go through the session layer (lib/session.ts).
 */

import {
  getSession,
  saveSession,
  FilmListEntry,
  RatedFilmEntry,
  TasteBreakdown,
  MAX_HISTORY,
  MAX_LIST,
} from "./session";

export type ListType = "favorites" | "watchlater" | "history" | "ratings";

export type { RatedFilmEntry, TasteBreakdown };

// ─── Taste Rating Constants & Metadata ───────────────────────────────────────

export const TASTE_DIMENSIONS: {
  key: keyof TasteBreakdown;
  label: string;
  shortLabel: string;
}[] = [
  { key: "story", label: "Story & Pacing", shortLabel: "Story" },
  { key: "acting", label: "Acting & Cast", shortLabel: "Acting" },
  { key: "visuals", label: "Visuals & Direction", shortLabel: "Visuals" },
  { key: "soundtrack", label: "Soundtrack & Atmosphere", shortLabel: "Sound" },
];

export const TASTE_TAGS: readonly string[] = [
  "Masterpiece",
  "Comfort Watch",
  "Mind-Bending",
  "Visual Spectacle",
  "Peak Acting",
  "Great Pacing",
  "Killer Soundtrack",
  "Emotional",
  "Hidden Gem",
  "Guilty Pleasure",
  "Slow Burn",
  "Overhyped",
] as const;

export interface RatingVerdict {
  label: string;
  color: string;
  bg: string;
  border: string;
}

export function getRatingVerdict(score: number): RatingVerdict {
  if (score >= 9.5) {
    return {
      label: "Masterpiece",
      color: "#f5c518",
      bg: "rgba(245, 197, 24, 0.14)",
      border: "rgba(245, 197, 24, 0.4)",
    };
  }
  if (score >= 8.5) {
    return {
      label: "Must Watch",
      color: "#4ade80",
      bg: "rgba(34, 197, 94, 0.14)",
      border: "rgba(34, 197, 94, 0.38)",
    };
  }
  if (score >= 7.5) {
    return {
      label: "Great",
      color: "#60a5fa",
      bg: "rgba(96, 165, 250, 0.14)",
      border: "rgba(96, 165, 250, 0.38)",
    };
  }
  if (score >= 6.0) {
    return {
      label: "Worth a Watch",
      color: "#c084fc",
      bg: "rgba(192, 132, 252, 0.14)",
      border: "rgba(192, 132, 252, 0.38)",
    };
  }
  if (score >= 4.5) {
    return {
      label: "Mixed Bag",
      color: "#fb923c",
      bg: "rgba(251, 146, 60, 0.14)",
      border: "rgba(251, 146, 60, 0.38)",
    };
  }
  return {
    label: "Not My Taste",
    color: "#ff4d57",
    bg: "rgba(229, 9, 20, 0.14)",
    border: "rgba(229, 9, 20, 0.38)",
  };
}

// ─── Generic helpers ──────────────────────────────────────────────────────────

function now(): string {
  return new Date().toISOString();
}

function dedupe<T extends FilmListEntry>(entries: T[]): T[] {
  const seen = new Set<number>();
  return entries.filter((e) => {
    if (seen.has(e.film_id)) return false;
    seen.add(e.film_id);
    return true;
  });
}

export function getList(type: "ratings"): RatedFilmEntry[];
export function getList(type: ListType): FilmListEntry[];
export function getList(type: ListType): FilmListEntry[] {
  const lists = getSession().lists;
  return lists[type] ?? [];
}

export function isInList(type: ListType, filmId: number): boolean {
  const list = getSession().lists[type] ?? [];
  return list.some((e) => e.film_id === filmId);
}

// ─── Favorites ────────────────────────────────────────────────────────────────

export function toggleFavorite(entry: Omit<FilmListEntry, "added_at">): boolean {
  const s = getSession();
  const existing = s.lists.favorites.findIndex((e) => e.film_id === entry.film_id);
  if (existing !== -1) {
    s.lists.favorites.splice(existing, 1);
    saveSession(s);
    return false; // removed
  }
  s.lists.favorites = dedupe([
    { ...entry, added_at: now() },
    ...s.lists.favorites,
  ]).slice(0, MAX_LIST);
  saveSession(s);
  return true; // added
}

// ─── Watch Later ──────────────────────────────────────────────────────────────

export function toggleWatchLater(entry: Omit<FilmListEntry, "added_at">): boolean {
  const s = getSession();
  const existing = s.lists.watchlater.findIndex((e) => e.film_id === entry.film_id);
  if (existing !== -1) {
    s.lists.watchlater.splice(existing, 1);
    saveSession(s);
    return false;
  }
  s.lists.watchlater = dedupe([
    { ...entry, added_at: now() },
    ...s.lists.watchlater,
  ]).slice(0, MAX_LIST);
  saveSession(s);
  return true;
}

// ─── History ─────────────────────────────────────────────────────────────────

/**
 * Add or bump a film in watch history.
 * If already present, moves it to the top (most recently watched).
 * Respects the historyEnabled preference.
 */
export function addToHistory(entry: Omit<FilmListEntry, "added_at">): void {
  const s = getSession();
  if (!s.preferences.historyEnabled) return;

  // Remove existing occurrence (so we can re-insert at top)
  s.lists.history = s.lists.history.filter((e) => e.film_id !== entry.film_id);

  s.lists.history = [
    { ...entry, added_at: now() },
    ...s.lists.history,
  ].slice(0, MAX_HISTORY);

  saveSession(s);
}

export function clearHistory(): void {
  const s = getSession();
  s.lists.history = [];
  saveSession(s);
}

export function removeFromHistory(filmId: number): void {
  const s = getSession();
  s.lists.history = s.lists.history.filter((e) => e.film_id !== filmId);
  saveSession(s);
}

export function clearFavorites(): void {
  const s = getSession();
  s.lists.favorites = [];
  saveSession(s);
}

export function clearWatchLater(): void {
  const s = getSession();
  s.lists.watchlater = [];
  saveSession(s);
}

// ─── Custom User Movie Ratings ───────────────────────────────────────────────

function clampRatingScore(score: number): number {
  if (typeof score !== "number" || isNaN(score)) return 7;
  const clamped = Math.min(10, Math.max(1, score));
  return Math.round(clamped * 2) / 2;
}

function sanitizeBreakdown(
  breakdown?: TasteBreakdown | null,
): TasteBreakdown | undefined {
  if (!breakdown || typeof breakdown !== "object") return undefined;
  const cleaned: TasteBreakdown = {};
  for (const { key } of TASTE_DIMENSIONS) {
    const val = breakdown[key];
    if (typeof val === "number" && !isNaN(val) && val >= 1 && val <= 10) {
      cleaned[key] = Math.round(val * 2) / 2;
    }
  }
  return Object.keys(cleaned).length > 0 ? cleaned : undefined;
}

export function getRatedFilms(): RatedFilmEntry[] {
  return getSession().lists.ratings ?? [];
}

export function getUserRating(filmId: number): RatedFilmEntry | null {
  if (!filmId || isNaN(filmId)) return null;
  const ratings = getSession().lists.ratings ?? [];
  return ratings.find((e) => e.film_id === filmId) ?? null;
}

/**
 * Add or update a user's custom rating for a film.
 * Preserves the original `added_at` timestamp if editing an existing rating,
 * updates `updated_at`, and moves the updated entry to the top of the ratings list.
 */
export function setUserRating(
  input: Omit<RatedFilmEntry, "added_at" | "updated_at"> & {
    added_at?: string;
    updated_at?: string;
  },
): { entry: RatedFilmEntry; isUpdate: boolean } {
  const s = getSession();
  const currentList = s.lists.ratings ?? [];
  const existingIdx = currentList.findIndex((e) => e.film_id === input.film_id);
  const isUpdate = existingIdx !== -1;
  const existing = isUpdate ? currentList[existingIdx] : null;

  const timestamp = now();
  const normalizedScore = clampRatingScore(input.user_rating);
  const cleanedBreakdown = sanitizeBreakdown(input.taste_breakdown);
  const cleanedTags = Array.isArray(input.taste_tags)
    ? Array.from(
        new Set(
          input.taste_tags
            .filter((t): t is string => typeof t === "string" && t.trim().length > 0)
            .map((t) => t.trim()),
        ),
      ).slice(0, 6)
    : undefined;
  const cleanedNote =
    typeof input.review_note === "string" && input.review_note.trim().length > 0
      ? input.review_note.trim().slice(0, 500)
      : undefined;

  const nextEntry: RatedFilmEntry = {
    film_id: input.film_id,
    film_name: input.film_name || existing?.film_name || "Unknown",
    poster_url:
      input.poster_url !== undefined
        ? input.poster_url
        : (existing?.poster_url ?? null),
    year: input.year !== undefined ? input.year : (existing?.year ?? null),
    rating:
      input.rating !== undefined ? input.rating : (existing?.rating ?? null),
    added_at: input.added_at ?? existing?.added_at ?? timestamp,
    updated_at: input.updated_at ?? timestamp,
    user_rating: normalizedScore,
    ...(cleanedBreakdown ? { taste_breakdown: cleanedBreakdown } : {}),
    ...(cleanedTags && cleanedTags.length > 0 ? { taste_tags: cleanedTags } : {}),
    ...(cleanedNote ? { review_note: cleanedNote } : {}),
  };

  s.lists.ratings = dedupe([
    nextEntry,
    ...currentList.filter((e) => e.film_id !== input.film_id),
  ]).slice(0, MAX_LIST);

  saveSession(s);
  return { entry: nextEntry, isUpdate };
}

export function removeUserRating(filmId: number): RatedFilmEntry | null {
  const s = getSession();
  const currentList = s.lists.ratings ?? [];
  const existing = currentList.find((e) => e.film_id === filmId) ?? null;
  if (!existing) return null;
  s.lists.ratings = currentList.filter((e) => e.film_id !== filmId);
  saveSession(s);
  return existing;
}

export function clearRatings(): void {
  const s = getSession();
  s.lists.ratings = [];
  saveSession(s);
}

export interface TasteStats {
  count: number;
  avgRating: number;
  topTags: { tag: string; count: number }[];
  highestRated: RatedFilmEntry | null;
}

export function getTasteStats(): TasteStats {
  const ratings = getRatedFilms();
  const count = ratings.length;
  if (count === 0) {
    return { count: 0, avgRating: 0, topTags: [], highestRated: null };
  }

  const sum = ratings.reduce((acc, r) => acc + r.user_rating, 0);
  const avgRating = Math.round((sum / count) * 10) / 10;

  const tagCounts = new Map<string, number>();
  for (const r of ratings) {
    for (const tag of r.taste_tags ?? []) {
      tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
    }
  }

  const topTags = Array.from(tagCounts.entries())
    .map(([tag, c]) => ({ tag, count: c }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 4);

  const highestRated = [...ratings].sort(
    (a, b) => b.user_rating - a.user_rating,
  )[0];

  return { count, avgRating, topTags, highestRated };
}