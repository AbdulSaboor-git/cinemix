"use client";
import { useState, useRef, useCallback, useEffect } from "react";
import { searchFilms } from "@/lib/kinopoisk";
import { Film } from "@/types/kinopoisk";
import { getPreferences } from "@/lib/preferences";

export function useSearchSuggestions() {
  const [suggestions, setSuggestions] = useState<Film[]>([]);
  const [sugLoading, setSugLoading] = useState(false);
  const [sugVisible, setSugVisible] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(-1);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reqIdRef = useRef(0);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      reqIdRef.current += 1;
    };
  }, []);

  const fetchSuggestions = useCallback((q: string, _limit?: number) => {
    const prefs = getPreferences();
    if (!prefs.searchSuggestionsEnabled) return;
    const limit = _limit ?? prefs.suggestionLimit;
    const debounce = prefs.suggestionDebounceMs;

    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (q.trim().length < 2) {
      reqIdRef.current += 1;
      setSuggestions([]);
      setSugVisible(false);
      setSugLoading(false);
      return;
    }

    const currentReqId = ++reqIdRef.current;
    debounceRef.current = setTimeout(async () => {
      setSugLoading(true);
      try {
        const res = await searchFilms(q.trim(), 1);
        if (reqIdRef.current !== currentReqId) return;
        setSuggestions(res.items.slice(0, limit));
        setSugVisible(true);
        setSelectedIdx(-1);
      } catch {
        if (reqIdRef.current === currentReqId) {
          setSuggestions([]);
        }
      } finally {
        if (reqIdRef.current === currentReqId) {
          setSugLoading(false);
        }
      }
    }, debounce);
  }, []);

  const clearSuggestions = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    reqIdRef.current += 1;
    setSuggestions([]);
    setSugVisible(false);
    setSelectedIdx(-1);
    setSugLoading(false);
  }, []);

  const handleKeyNav = useCallback(
    (e: React.KeyboardEvent, total: number) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIdx((i) => Math.min(i + 1, total - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIdx((i) => Math.max(i - 1, -1));
      } else if (e.key === "Escape") {
        setSugVisible(false);
        setSelectedIdx(-1);
      }
    },
    [],
  );

  return {
    suggestions,
    sugLoading,
    sugVisible,
    selectedIdx,
    setSugVisible,
    fetchSuggestions,
    clearSuggestions,
    handleKeyNav,
  };
}