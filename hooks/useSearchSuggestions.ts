"use client";
import { useState, useRef, useCallback, useEffect } from "react";
import {
  searchFilms,
  analyzeSemanticQuery,
  SemanticSearchAnalysis,
  deduplicateFilms,
} from "@/lib/kinopoisk";
import { Film } from "@/types/kinopoisk";
import { getPreferences } from "@/lib/preferences";

const RECENT_SEARCHES_KEY = "cinemix_recent_searches_v1";
const MAX_RECENT_SEARCHES = 6;

// In-memory LRU cache so re-typing or backspacing in the search bar is 0ms instant
const suggestionQueryCache = new Map<
  string,
  { items: Film[]; ts: number }
>();
const CACHE_TTL_MS = 5 * 60 * 1000;

export function getRecentSearches(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(RECENT_SEARCHES_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed)
      ? parsed.filter((x): x is string => typeof x === "string" && x.trim().length > 0)
      : [];
  } catch {
    return [];
  }
}

export function saveRecentSearch(term: string): string[] {
  if (typeof window === "undefined") return [];
  const clean = term.trim();
  if (clean.length < 2) return getRecentSearches();
  try {
    const prev = getRecentSearches();
    const updated = [
      clean,
      ...prev.filter((x) => x.toLowerCase() !== clean.toLowerCase()),
    ].slice(0, MAX_RECENT_SEARCHES);
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
    return updated;
  } catch {
    return [];
  }
}

export function clearRecentSearches(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(RECENT_SEARCHES_KEY);
  } catch {
    // ignore
  }
}

export function useSearchSuggestions() {
  const [suggestions, setSuggestions] = useState<Film[]>([]);
  const [semanticMeta, setSemanticMeta] =
    useState<SemanticSearchAnalysis | null>(null);
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
    const debounce = Math.min(prefs.suggestionDebounceMs || 220, 220);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    const trimmed = q.trim();
    if (trimmed.length < 2) {
      reqIdRef.current += 1;
      setSuggestions([]);
      setSemanticMeta(null);
      setSugVisible(false);
      setSugLoading(false);
      return;
    }

    // Step 1 (0ms Instant): Run client-side semantic + fuzzy local catalog analysis immediately
    const analysis = analyzeSemanticQuery(trimmed);
    setSemanticMeta(analysis);

    const cacheKey = `${trimmed.toLowerCase()}:${limit}`;
    const cached = suggestionQueryCache.get(cacheKey);
    if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
      setSuggestions(cached.items);
      setSugVisible(true);
      setSugLoading(false);
      setSelectedIdx(-1);
      return;
    }

    // Show local fuzzy/semantic matches immediately in 0ms while network request is debounced
    if (
      analysis.localMatches.length > 0 ||
      analysis.correctedQuery ||
      analysis.matchedConcept ||
      analysis.relatedTerms.length > 0
    ) {
      if (analysis.localMatches.length > 0) {
        setSuggestions(analysis.localMatches.slice(0, limit));
      }
      setSugVisible(true);
    }

    const currentReqId = ++reqIdRef.current;
    setSugLoading(true);

    debounceRef.current = setTimeout(async () => {
      try {
        const res = await searchFilms(trimmed, 1);
        if (reqIdRef.current !== currentReqId) return;
        const merged = deduplicateFilms([
          ...res.items,
          ...analysis.localMatches,
        ]).slice(0, limit);

        suggestionQueryCache.set(cacheKey, {
          items: merged,
          ts: Date.now(),
        });

        setSuggestions(merged);
        setSugVisible(true);
        setSelectedIdx(-1);
      } catch {
        if (reqIdRef.current === currentReqId && analysis.localMatches.length === 0) {
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
    setSemanticMeta(null);
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
    semanticMeta,
    sugLoading,
    sugVisible,
    selectedIdx,
    setSugVisible,
    fetchSuggestions,
    clearSuggestions,
    handleKeyNav,
  };
}