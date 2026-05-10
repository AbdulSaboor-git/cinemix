"use client";
import { useState, useRef, useCallback } from "react";
import { searchFilms } from "@/lib/kinopoisk";
import { Film } from "@/types/kinopoisk";

export function useSearchSuggestions() {
  const [suggestions, setSuggestions] = useState<Film[]>([]);
  const [sugLoading, setSugLoading]   = useState(false);
  const [sugVisible, setSugVisible]   = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(-1);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchSuggestions = useCallback((q: string, limit = 6) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (q.trim().length < 2) {
      setSuggestions([]);
      setSugVisible(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setSugLoading(true);
      try {
        const res = await searchFilms(q.trim(), 1);
        setSuggestions(res.items.slice(0, limit));
        setSugVisible(true);
        setSelectedIdx(-1);
      } catch {
        setSuggestions([]);
      } finally {
        setSugLoading(false);
      }
    }, 300);
  }, []);

  const clearSuggestions = useCallback(() => {
    setSuggestions([]);
    setSugVisible(false);
    setSelectedIdx(-1);
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
    []
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