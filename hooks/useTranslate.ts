"use client";
import { useState, useEffect } from "react";
import { translateText, translateHtml, isRussian, stripHtml } from "@/lib/translate";
import { getPreferences } from "@/lib/preferences";

/** Translate plain text (description, slogan, etc.) */
export function useTranslate(text: string | undefined): string {
  const [translated, setTranslated] = useState<string>(text || "");

  useEffect(() => {
    if (!text) { setTranslated(""); return; }
    const prefs = getPreferences();
    if (!prefs.autoTranslateEnabled || !isRussian(text)) { setTranslated(text); return; }
    translateText(text).then(setTranslated).catch(() => setTranslated(text));
  }, [text]);

  return translated;
}

/**
 * Strips HTML tags from content, then translates Russian text.
 * Use this instead of dangerouslySetInnerHTML to avoid XSS.
 * When autoTranslateEnabled is false, still strips HTML safely but doesn't translate.
 */
export function useTranslateHtml(html: string | undefined): string {
  const [translated, setTranslated] = useState<string>(html ? stripHtml(html) : "");

  useEffect(() => {
    if (!html) { setTranslated(""); return; }
    const plain = stripHtml(html);
    const prefs = getPreferences();
    if (!prefs.autoTranslateEnabled || !isRussian(plain)) { setTranslated(plain); return; }
    translateHtml(html).then(setTranslated).catch(() => setTranslated(plain));
  }, [html]);

  return translated;
}

/**
 * Returns the current autoTranslateEnabled preference, reactive to storage events.
 * Use this in components that call translateGenre/translateCountry/getEnglishName
 * directly (synchronously) so they can re-render when the preference changes.
 */
export function useAutoTranslate(): boolean {
  const [enabled, setEnabled] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    return getPreferences().autoTranslateEnabled;
  });

  useEffect(() => {
    // Sync on mount (handles SSR→client hydration gap)
    setEnabled(getPreferences().autoTranslateEnabled);

    // Cross-tab sync via storage event
    const onStorage = (e: StorageEvent) => {
      if (e.key === "cinemix_preferences" && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (typeof parsed.autoTranslateEnabled === "boolean") {
            setEnabled(parsed.autoTranslateEnabled);
          }
        } catch {
          // ignore malformed
        }
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  return enabled;
}
