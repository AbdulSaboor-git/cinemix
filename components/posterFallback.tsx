"use client";

export function FilmPosterFallback({ title }: { title?: string }) {
  return (
    <div className="w-full h-full flex flex-col items-center justify-center gap-2 p-3 text-center bg-gradient-to-br from-[#1a1a2e] to-[#16213e]">
      {title && (
        <svg
          width="34"
          height="34"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--accent)"
          strokeWidth="1.5"
          className="opacity-80"
        >
          <rect x="2" y="2" width="20" height="20" rx="2" />
          <path d="M7 2v20M17 2v20M2 12h20M2 7h5M2 17h5M17 7h5M17 17h5" />
        </svg>
      )}

      {title && (
        <p className="text-[10px] text-[var(--text-dim)] font-medium leading-[1.3] line-clamp-2">
          {title || "Untitled"}
        </p>
      )}

      {title && (
        <span className="text-[9px] text-[var(--text-muted)]">
          No preview available
        </span>
      )}
    </div>
  );
}
