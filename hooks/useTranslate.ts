"use client";
import { useState, useEffect } from "react";
import {
  translateText,
  translateHtml,
  isRussian,
  stripHtml,
  getCachedTranslation,
  getEnglishName,
} from "@/lib/translate";
import { getPreferences } from "@/lib/preferences";
import { SESSION_KEY } from "@/lib/session";

/**
 * Returns the current autoTranslateEnabled preference, SSR-safe to prevent
 * React 19 hydration mismatches while staying reactive to storage/session changes.
 */
export function useAutoTranslate(): boolean {
  const [enabled, setEnabled] = useState<boolean>(true);

  useEffect(() => {
    const sync = () => {
      setEnabled(getPreferences().autoTranslateEnabled);
    };
    sync();

    const onStorage = (e: StorageEvent) => {
      if (e.key === SESSION_KEY && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          const next = parsed?.preferences?.autoTranslateEnabled;
          if (typeof next === "boolean") setEnabled(next);
        } catch {
          // ignore malformed
        }
      }
    };

    window.addEventListener("storage", onStorage);
    window.addEventListener("cinemix-session-change", sync);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("cinemix-session-change", sync);
    };
  }, []);

  return enabled;
}

/**
 * Translate plain text (description, slogan, names, etc.) without blank-text flash
 * or SSR hydration mismatch.
 */
export function useTranslate(text: string | undefined | null): string {
  const autoTranslate = useAutoTranslate();
  const [translated, setTranslated] = useState<string>(text ?? "");

  useEffect(() => {
    if (!text) {
      setTranslated("");
      return;
    }
    if (!autoTranslate || !isRussian(text)) {
      setTranslated(text);
      return;
    }
    const cached = getCachedTranslation(text);
    if (cached) {
      setTranslated(cached);
      return;
    }

    // Show original text immediately so UI is never blank while translating
    setTranslated(text);

    let active = true;
    translateText(text)
      .then((res) => {
        if (active && res) setTranslated(res);
      })
      .catch(() => {
        if (active) setTranslated(text);
      });
    return () => {
      active = false;
    };
  }, [text, autoTranslate]);

  return translated || text || "";
}

/**
 * Strips HTML tags from content, then translates Russian text.
 * Never returns blank string while waiting on network.
 */
export function useTranslateHtml(html: string | undefined | null): string {
  const autoTranslate = useAutoTranslate();
  const plainInitial = html ? stripHtml(html) : "";
  const [translated, setTranslated] = useState<string>(plainInitial);

  useEffect(() => {
    if (!html) {
      setTranslated("");
      return;
    }
    const plain = stripHtml(html);
    if (!autoTranslate || !isRussian(plain)) {
      setTranslated(plain);
      return;
    }
    const cached = getCachedTranslation(plain);
    if (cached) {
      setTranslated(cached);
      return;
    }

    setTranslated(plain);

    let active = true;
    translateHtml(html)
      .then((res) => {
        if (active && res) setTranslated(res);
      })
      .catch(() => {
        if (active) setTranslated(plain);
      });
    return () => {
      active = false;
    };
  }, [html, autoTranslate]);

  return translated || plainInitial;
}

/**
 * Resolves the best film/episode title and automatically translates it if only
 * a Russian title is available and autoTranslate is enabled.
 */
export function useFilmTitle(
  film?: {
    nameRu?: string;
    nameEn?: string;
    nameOriginal?: string;
  } | null,
  autoTranslateOverride?: boolean,
): string {
  const autoTranslateHook = useAutoTranslate();
  const autoTranslate = autoTranslateOverride ?? autoTranslateHook;
  const baseName = film
    ? getEnglishName(
        film.nameRu,
        film.nameEn,
        film.nameOriginal,
        autoTranslate,
      )
    : "Unknown";
  const translated = useTranslate(baseName);
  return translated || baseName;
}
