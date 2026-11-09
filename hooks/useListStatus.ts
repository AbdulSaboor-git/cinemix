"use client";
import { useState, useEffect, useCallback } from "react";
import { isInList, getUserRating, RatedFilmEntry } from "@/lib/userLists";
import { SESSION_KEY } from "@/lib/session";

export interface ListStatus {
  isFav: boolean;
  isWL: boolean;
  isWatched: boolean;
  isRated: boolean;
  userRating: number | null;
  ratingEntry: RatedFilmEntry | null;
  mounted: boolean;
  refresh: () => void;
}

/**
 * Reactive hook that keeps Favorites, Watch Later, Watched, and Custom Rating states
 * synchronized across all cards, rows, and modals whenever the session changes.
 */
export function useListStatus(filmId?: number | null): ListStatus {
  const validId =
    typeof filmId === "number" && !isNaN(filmId) && filmId > 0 ? filmId : 0;

  const [mounted, setMounted] = useState(false);
  const [isFav, setIsFav] = useState(false);
  const [isWL, setIsWL] = useState(false);
  const [isWatched, setIsWatched] = useState(false);
  const [ratingEntry, setRatingEntry] = useState<RatedFilmEntry | null>(null);

  const sync = useCallback(() => {
    if (!validId) {
      setIsFav(false);
      setIsWL(false);
      setIsWatched(false);
      setRatingEntry(null);
      return;
    }
    setIsFav(isInList("favorites", validId));
    setIsWL(isInList("watchlater", validId));
    setIsWatched(isInList("history", validId));
    setRatingEntry(getUserRating(validId));
  }, [validId]);

  useEffect(() => {
    setMounted(true);
    sync();
    const onSessionChange = () => sync();
    const onStorageChange = (e: StorageEvent) => {
      if (!e.key || e.key === SESSION_KEY) {
        sync();
      }
    };
    window.addEventListener("cinemix-session-change", onSessionChange);
    window.addEventListener("storage", onStorageChange);
    return () => {
      window.removeEventListener("cinemix-session-change", onSessionChange);
      window.removeEventListener("storage", onStorageChange);
    };
  }, [sync]);

  return {
    isFav,
    isWL,
    isWatched,
    isRated: ratingEntry !== null,
    userRating: ratingEntry ? ratingEntry.user_rating : null,
    ratingEntry,
    mounted,
    refresh: sync,
  };
}