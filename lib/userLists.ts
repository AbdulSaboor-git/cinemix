/**
 * CineMix User Lists
 * ------------------
 * Manages favorites, watch-later and watch history.
 * All writes go through the session layer (lib/session.ts).
 */

import { getSession, saveSession, FilmListEntry, MAX_HISTORY, MAX_LIST } from "./session";

export type ListType = "favorites" | "watchlater" | "history";

// ─── Generic helpers ──────────────────────────────────────────────────────────

function now(): string {
  return new Date().toISOString();
}

function dedupe(entries: FilmListEntry[]): FilmListEntry[] {
  const seen = new Set<number>();
  return entries.filter((e) => {
    if (seen.has(e.film_id)) return false;
    seen.add(e.film_id);
    return true;
  });
}

export function getList(type: ListType): FilmListEntry[] {
  return getSession().lists[type];
}

export function isInList(type: ListType, filmId: number): boolean {
  return getSession().lists[type].some((e) => e.film_id === filmId);
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
