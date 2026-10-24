"use client";
import { Film } from "lucide-react";

export function FilmPosterFallback({
  title,
  compact = false,
}: {
  title?: string;
  compact?: boolean;
}) {
  return (
    <div className="relative w-full h-full min-w-0 overflow-hidden flex flex-col items-center justify-center text-center bg-[radial-gradient(ellipse_at_50%_35%,rgba(229,9,20,0.14),transparent_55%),linear-gradient(145deg,#1b1b25,#101014_70%)]">
      <div
        aria-hidden="true"
        className={`absolute border border-white/[0.07] ${
          compact ? "inset-[6%] rounded-[4px]" : "inset-[5%] rounded-[8px]"
        }`}
      />
      <Film
        size={compact ? 16 : 34}
        stroke="var(--accent)"
        strokeWidth={1.5}
        className={`relative flex-shrink-0 opacity-75 ${
          compact ? "mb-1" : "mb-3"
        }`}
      />
      {!compact && title && (
        <p className="relative max-w-full px-3 text-[10px] text-[var(--text-dim)] font-medium leading-[1.3] line-clamp-2">
          {title}
        </p>
      )}
      <span
        className={`relative font-semibold tracking-[0.12em] text-[var(--text-muted)] ${
          compact ? "text-[5px]" : "mt-2 text-[8px]"
        }`}
      >
        NO POSTER
      </span>
    </div>
  );
}
