"use client";
import { useState, useEffect } from "react";
import { translateText, isRussian } from "@/lib/translate";

export function useTranslate(text: string | undefined): string {
  const [translated, setTranslated] = useState<string>(text || "");

  useEffect(() => {
    if (!text) return;
    if (!isRussian(text)) { setTranslated(text); return; }
    translateText(text).then(setTranslated).catch(() => setTranslated(text));
  }, [text]);

  return translated;
}
