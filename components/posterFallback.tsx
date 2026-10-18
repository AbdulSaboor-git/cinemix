"use client";
import { Film } from "lucide-react";

export function FilmPosterFallback({ title }: { title?: string }) {
  return (
    <div className="w-full h-full flex flex-col items-center justify-center gap-2 p-3 text-center bg-gradient-to-br from-[#1a1a2e] to-[#16213e]">
      <Film
        size={34}
        stroke="var(--accent)"
        strokeWidth={1.5}
        className="opacity-80 flex-shrink-0"
      />

      {title && (
        <p className="text-[10px] text-[var(--text-dim)] font-medium leading-[1.3] line-clamp-2">
          {title}
        </p>
      )}

      <span className="text-[9px] text-[var(--text-muted)]">
        No preview available
      </span>
    </div>
  );
}
