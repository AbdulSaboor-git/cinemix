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