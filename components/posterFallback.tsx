"use client";
import React from "react";
import { Film, User } from "lucide-react";

export type FallbackVariant = "film" | "person" | "mini";

export interface FilmPosterFallbackProps {
  title?: string;
  subtitle?: string;
  compact?: boolean;
  variant?: FallbackVariant;
  className?: string;
}

/**
 * Known placeholder / "no-poster" / "no-photo" URL substrings returned with
 * HTTP 200 OK by Kinopoisk Unofficial API and Yandex static servers when a
 * film or cast/crew member has no real image.
 */
const PLACEHOLDER_URL_PATTERNS = [
  "no-poster",
  "no_poster",
  "noposter",
  "no-photo",
  "no_photo",
  "nophoto",
  "empty_poster",
  "empty-poster",
  "empty_photo",
  "empty-photo",
  "placeholder",
  "default-avatar",
  "default_avatar",
  "/images/no-",
  "spacer.gif",
];

/**
 * Global detector: returns true when a poster/photo URL is empty or points to
 * a known Kinopoisk/Yandex "no-poster" or "no-photo" placeholder graphic.
 */
export function isPlaceholderPosterUrl(url?: string | null): boolean {
  if (!url || typeof url !== "string") return true;
  const trimmed = url.trim();
  if (!trimmed || trimmed === "null" || trimmed === "undefined") return true;
  const lower = trimmed.toLowerCase();
  return PLACEHOLDER_URL_PATTERNS.some((pat) => lower.includes(pat));
}

/**
 * Global URL sanitizer: returns a valid poster/photo URL or `null` if the URL
 * is missing or matches a known placeholder image.
 */
export function sanitizePosterUrl(url?: string | null): string | null {
  if (isPlaceholderPosterUrl(url)) return null;
  return url!.trim();
}

/**
 * Dedicated Person / Cast Portrait Fallback (`<User />` placeholder icon).
 * Used automatically when `<PosterImage fallbackType="person" />` or
 * `<FilmPosterFallback variant="person" />` is rendered.
 */
export function PersonPosterFallback({
  compact = false,
  className = "",
}: {
  title?: string;
  compact?: boolean;
  className?: string;
}) {
  if (compact) {
    return (
      <div
        className={`relative w-full h-full min-w-0 overflow-hidden flex items-center justify-center select-none bg-[radial-gradient(circle_at_50%_35%,rgba(255,255,255,0.07),transparent_65%),linear-gradient(155deg,#181822_0%,#101017_60%,#0a0a0e_100%)] ${className}`.trim()}
      >
        <div
          aria-hidden="true"
          className="absolute inset-[7%] rounded-[4px] border border-white/[0.07] pointer-events-none"
        />
        <User
          size={14}
          stroke="var(--text-muted)"
          strokeWidth={1.75}
          className="relative z-10 opacity-85"
        />
      </div>
    );
  }

  return (
    <div
      className={`relative w-full h-full min-w-0 overflow-hidden flex flex-col items-center justify-center p-3 text-center select-none bg-[radial-gradient(ellipse_at_50%_32%,rgba(255,255,255,0.06),rgba(229,9,20,0.08)_45%,transparent_72%),linear-gradient(160deg,#191924_0%,#101017_55%,#09090d_100%)] ${className}`.trim()}
    >
      {/* Subtle inner frame */}
      <div
        aria-hidden="true"
        className="absolute inset-[6%] rounded-[8px] border border-white/[0.06] pointer-events-none"
      />

      {/* Person avatar silhouette medallion */}
      <div className="relative z-10 w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-white/[0.04] border border-white/[0.1] shadow-[0_8px_24px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.08)] flex items-center justify-center mb-2.5">
        <User
          size={26}
          stroke="var(--text-muted)"
          strokeWidth={1.5}
          className="opacity-85"
        />
      </div>

      {/* Subtle status label */}
      <span className="relative z-10 text-[7px] sm:text-[8px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)] opacity-75">
        NO PHOTO
      </span>
    </div>
  );
}

export function FilmPosterFallback({
  title,
  subtitle,
  compact = false,
  variant = "film",
  className = "",
}: FilmPosterFallbackProps) {
  // Route person/cast fallbacks directly to the person placeholder icon UI
  if (variant === "person") {
    return (
      <PersonPosterFallback
        title={title}
        compact={compact}
        className={className}
      />
    );
  }

  const isMini = compact || variant === "mini";
  const cleanTitle =
    title && title.trim() && title.trim().toLowerCase() !== "unknown"
      ? title.trim()
      : undefined;

  // ── Compact / Mini Thumbnail Mode (Search rows, Top 250, Premieres list, Credits) ──
  if (isMini) {
    return (
      <div
        className={`relative min-h-[90px] w-full h-full min-w-0 overflow-hidden flex items-center justify-center select-none bg-[radial-gradient(circle_at_50%_35%,rgba(229,9,20,0.18),transparent_65%),linear-gradient(155deg,#181822_0%,#0f0f15_60%,#0a0a0e_100%)] ${className}`.trim()}
      >
        <div
          aria-hidden="true"
          className="absolute inset-[7%] rounded-[4px] border border-white/[0.07] pointer-events-none"
        />
        <div className="relative w-6 h-6 rounded-full bg-white/[0.04] border border-white/[0.08] flex items-center justify-center shadow-[0_2px_8px_rgba(0,0,0,0.45)]">
          <Film
            size={12}
            stroke="var(--accent)"
            strokeWidth={1.75}
            className="opacity-85"
          />
        </div>
      </div>
    );
  }

  // ── Full Film Card / Hero Poster Mode ──
  return (
    <div
      className={`z-0 relative w-full h-full min-w-0 overflow-hidden flex flex-col items-center justify-between p-3.5 sm:p-4 text-center select-none bg-[radial-gradient(ellipse_at_50%_28%,rgba(229,9,20,0.16),rgba(245,197,24,0.03)_42%,transparent_70%),linear-gradient(160deg,#191924_0%,#101017_55%,#09090d_100%)] ${className}`.trim()}
    >
      {/* Subtle diagonal studio light sheen */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.035)_0%,transparent_40%,rgba(0,0,0,0.35)_100%)] pointer-events-none"
      />

      {/* Inner architectural frame + corner crop hairlines */}
      <div
        aria-hidden="true"
        className="absolute inset-[5.5%] rounded-[4px] border border-white/[0.06] pointer-events-none"
      />
      <div
        aria-hidden="true"
        className="absolute top-[5.5%] left-[5.5%] w-2.5 h-2.5 border-t border-l border-[rgba(229,9,20,0.4)] rounded-tl-[4px] pointer-events-none"
      />
      <div
        aria-hidden="true"
        className="absolute top-[5.5%] right-[5.5%] w-2.5 h-2.5 border-t border-r border-[rgba(229,9,20,0.4)] rounded-tr-[4px] pointer-events-none"
      />
      <div
        aria-hidden="true"
        className="absolute bottom-[5.5%] left-[5.5%] w-2.5 h-2.5 border-b border-l border-white/15 rounded-bl-[4px] pointer-events-none"
      />
      <div
        aria-hidden="true"
        className="absolute bottom-[5.5%] right-[5.5%] w-2.5 h-2.5 border-b border-r border-white/15 rounded-br-[4px] pointer-events-none"
      />

      {/* Top micro header */}
      <div className="relative z-10 flex items-center gap-1.5 opacity-60 pt-0.5">
        <span className="w-1 h-1 rounded-full bg-[var(--accent)]" />
        <span className="text-[7px] sm:text-[8px] font-semibold uppercase tracking-[0.22em] text-[var(--text-muted)]">
          CineMix
        </span>
        <span className="w-1 h-1 rounded-full bg-[var(--accent)]" />
      </div>

      {/* Center Emblem + Title Block */}
      <div className="relative z-10 flex flex-col items-center justify-center my-auto px-1.5 w-full">
        <div className="relative w-11 h-11 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center mb-2.5 backdrop-blur-sm bg-[rgba(229,9,20,0.08)] border border-[rgba(229,9,20,0.28)] shadow-[0_8px_24px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.08)]">
          <Film
            size={22}
            stroke="var(--accent)"
            strokeWidth={1.5}
            className="opacity-90"
          />
        </div>

        {cleanTitle && (
          <p className="max-w-full px-1 text-[11px] sm:text-[12px] text-[var(--text)] font-semibold leading-[1.3] line-clamp-2 tracking-[0.01em] drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
            {cleanTitle}
          </p>
        )}

        {subtitle && (
          <p className="max-w-full px-1 mt-0.5 text-[9px] sm:text-[10px] text-[var(--text-muted)] leading-tight line-clamp-1">
            {subtitle}
          </p>
        )}
      </div>

      {/* Bottom status pill */}
      <div className="relative z-10 flex flex-col items-center gap-1 pb-0.5 mb-2">
        <div className="w-6 h-[1px] bg-gradient-to-r from-transparent via-white/15 to-transparent" />
        <span className="text-[7px] sm:text-[8px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)] opacity-80">
          NO POSTER
        </span>
      </div>
    </div>
  );
}

export default FilmPosterFallback;
