"use client";
import { useState, useRef, useCallback, useEffect } from "react";
import {
  analyzeSemanticQuery,
  SemanticSearchAnalysis,
} from "@/lib/kinopoisk";
import { MatchedPersonSummary } from "@/types/kinopoisk";
import { getPreferences } from "@/lib/preferences";
import { isRussian } from "@/lib/translate";

const RECENT_SEARCHES_KEY = "cinemix_recent_searches_v1";
const MAX_RECENT_SEARCHES = 6;

export interface SearchSuggestionItem {
  key: string;
  title: string;
  year?: number | null;
  kind?: "movie" | "series" | "person";
  /** Present only when already matched in local cached catalog (0 API tokens). */
  filmId?: number;
}

// In-memory LRU cache so re-typing or backspacing in the search bar is 0ms instant (0 Kinopoisk tokens)
const suggestionQueryCache = new Map<
  string,
  {
    items: SearchSuggestionItem[];
    ts: number;
  }
>();
const CACHE_TTL_MS = 10 * 60 * 1000;

if (typeof window !== "undefined") {
  window.addEventListener("cinemix-cache-clear", () => {
    suggestionQueryCache.clear();
  });
}

export function getRecentSearches(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(RECENT_SEARCHES_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed)
      ? parsed.filter(
          (x): x is string => typeof x === "string" && x.trim().length > 0,
        )
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

function normKey(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9а-яё]+/gi, " ").trim();
}

export function useSearchSuggestions() {
  const [suggestions, setSuggestions] = useState<SearchSuggestionItem[]>([]);
  const [matchedPerson, setMatchedPerson] =
    useState<MatchedPersonSummary | null>(null);
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
    const limit = _limit ?? prefs.suggestionLimit ?? 6;
    const debounce = Math.max(
      120,
      Math.min(prefs.suggestionDebounceMs || 280, 1000),
    );

    if (debounceRef.current) clearTimeout(debounceRef.current);
    const trimmed = q.trim();
    if (trimmed.length < 2) {
      reqIdRef.current += 1;
      setSuggestions([]);
      setMatchedPerson(null);
      setSemanticMeta(null);
      setSugVisible(false);
      setSugLoading(false);
      return;
    }

    // Step 1 (0ms, 0 Kinopoisk tokens): Run local fuzzy/semantic analysis on cached catalog
    const analysis = analyzeSemanticQuery(trimmed);
    setSemanticMeta(analysis);

    const localItems: SearchSuggestionItem[] = [];
    const seenNorm = new Set<string>();
    for (const f of analysis.localMatches) {
      const title =
        (f.nameEn && !isRussian(f.nameEn) ? f.nameEn : null) ||
        (f.nameOriginal && !isRussian(f.nameOriginal) ? f.nameOriginal : null) ||
        f.nameRu ||
        "";
      const cleanTitle = title.trim();
      if (!cleanTitle) continue;
      const nk = normKey(cleanTitle);
      if (!nk || seenNorm.has(nk)) continue;
      seenNorm.add(nk);
      const isSeries =
        Boolean(f.serial) ||
        f.type === "TV_SERIES" ||
        f.type === "MINI_SERIES" ||
        f.type === "TV_SHOW";
      localItems.push({
        key: `local:${f.kinopoiskId ?? f.filmId ?? nk}`,
        title: cleanTitle,
        year: f.year ?? f.startYear ?? null,
        kind: isSeries ? "series" : "movie",
        filmId: f.kinopoiskId ?? f.filmId,
      });
      if (localItems.length >= limit) break;
    }

    const cacheKey = `${trimmed.toLowerCase()}:${limit}`;
    const cached = suggestionQueryCache.get(cacheKey);
    if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
      setSuggestions(cached.items);
      setMatchedPerson(null);
      setSugVisible(cached.items.length > 0);
      setSugLoading(false);
      setSelectedIdx(-1);
      return;
    }

    if (localItems.length > 0) {
      setSuggestions(localItems);
      setSugVisible(true);
    }

    // Step 2 (Debounced, 0 Kinopoisk tokens): Query free IMDb Suggestion Bridge (/api/poster?mode=search)
    const currentReqId = ++reqIdRef.current;
    setSugLoading(true);

    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/poster?mode=search&q=${encodeURIComponent(trimmed)}`,
          { signal: AbortSignal.timeout(2200) },
        );
        if (reqIdRef.current !== currentReqId) return;

        const merged: SearchSuggestionItem[] = [];
        const usedNorm = new Set<string>();

        if (res.ok) {
          const data = (await res.json()) as {
            items?: {
              imdbId: string;
              title: string;
              year: number | null;
              kind: "movie" | "series" | "person" | "other";
            }[];
            personHint?: string | null;
          };

          // Include top actor/director name as a minimal searchable suggestion (tapping lists their credits)
          if (data.personHint && data.personHint.trim()) {
            const pNorm = normKey(data.personHint);
            if (pNorm && !usedNorm.has(pNorm)) {
              usedNorm.add(pNorm);
              merged.push({
                key: `person:${pNorm}`,
                title: data.personHint.trim(),
                kind: "person",
              });
            }
          }

          for (const it of data.items ?? []) {
            const t = (it.title || "").trim();
            if (!t) continue;
            const nk = normKey(t);
            if (!nk || usedNorm.has(nk)) continue;
            usedNorm.add(nk);
            // Reuse local filmId if already in local cached matches
            const localMatch = localItems.find((l) => normKey(l.title) === nk);
            merged.push({
              key: `imdb:${it.imdbId}`,
              title: t,
              year: it.year ?? localMatch?.year ?? null,
              kind: it.kind === "series" ? "series" : "movie",
              filmId: localMatch?.filmId,
            });
            if (merged.length >= limit) break;
          }
        }

        // Fill remaining slots from local cached matches
        for (const l of localItems) {
          if (merged.length >= limit) break;
          const nk = normKey(l.title);
          if (!usedNorm.has(nk)) {
            usedNorm.add(nk);
            merged.push(l);
          }
        }

        const finalItems = merged.slice(0, limit);
        suggestionQueryCache.set(cacheKey, {
          items: finalItems,
          ts: Date.now(),
        });

        setSuggestions(finalItems);
        setMatchedPerson(null);
        setSugVisible(finalItems.length > 0);
        setSelectedIdx(-1);
      } catch {
        if (reqIdRef.current === currentReqId) {
          setSuggestions(localItems);
          setSugVisible(localItems.length > 0);
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
    setMatchedPerson(null);
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
    matchedPerson,
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