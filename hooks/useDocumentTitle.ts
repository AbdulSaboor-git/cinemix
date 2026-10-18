"use client";
import { useEffect } from "react";

export function useDocumentTitle(title?: string | null) {
  useEffect(() => {
    if (typeof document === "undefined") return;
    document.title = title
      ? `${title} — CineMix`
      : "CineMix — Discover Films & Series";
  }, [title]);
}
