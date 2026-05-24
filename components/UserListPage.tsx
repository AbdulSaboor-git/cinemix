// UserListPage.tsx
"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import {
  getList,
  removeFromHistory,
  toggleFavorite,
  toggleWatchLater,
  ListType,
} from "@/lib/userLists";
import { getSessionName } from "@/lib/session";
import { FilmListEntry } from "@/lib/session";
import { useToast } from "@/lib/toast";
import BackButton from "./BackButton";

const CONFIG = {
  favorites: {
    label: "Favorites",
    icon: (
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="var(--accent)"
        stroke="var(--accent)"
        strokeWidth="2"
      >
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
      </svg>
    ),
    emptyMsg: "No favorites yet. Find a film you love and hit the heart!",
    accentColor: "var(--accent)",
  },
  watchlater: {
    label: "Watch Later",
    icon: (
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#60a5fa"
        strokeWidth="2"
      >
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
    ),
    emptyMsg:
      "Your watch-later list is empty. Save films to watch when you're ready.",
    accentColor: "#60a5fa",
  },
  history: {
    label: "Watch History",
    icon: (
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#22c55e"
        strokeWidth="2"
      >
        <path d="M3 3v5h5" />
        <path d="M3.05 13A9 9 0 1 0 6 5.3L3 8" />
      </svg>
    ),
    emptyMsg: "Nothing watched yet. Start a film from its page!",
    accentColor: "#22c55e",
  },
};

function FilmRow({
  entry,
  type,
  onRemove,
}: {
  entry: FilmListEntry;
  type: ListType;
  onRemove: (id: number) => void;
}) {
  const [imgErr, setImgErr] = useState(false);
  const [removing, setRemoving] = useState(false);

  const handleRemove = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setRemoving(true);
    setTimeout(() => onRemove(entry.film_id), 180);
  };

  const formattedDate = new Date(entry.added_at).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  const dateLabel =
    type === "history"
      ? `Watched ${formattedDate}`
      : type === "favorites"
        ? `Saved ${formattedDate}`
        : `Added ${formattedDate}`;

  return (
    <div
      className={`flex items-center gap-3 py-3 sm:py-4 border-b border-[var(--border)] last:border-b-0 transition-all duration-200
        ${removing ? "opacity-0 scale-[0.97]" : "opacity-100"}`}
    >
      <Link
        href={`/film/${entry.film_id}`}
        className="no-underline flex items-center gap-3 flex-1 min-w-0 group active:opacity-80 transition-opacity"
      >
        {/* Poster — taller on mobile now */}
        <div className="w-12 h-[68px] sm:w-14 sm:h-[80px] rounded-[8px] overflow-hidden bg-[var(--bg-elevated)] flex-shrink-0 relative">
          {entry.poster_url && !imgErr ? (
            <img
              src={entry.poster_url}
              alt={entry.film_name}
              className="w-full h-full object-cover"
              onError={() => setImgErr(true)}
            />
          ) : (
            <div className="w-full h-full bg-[var(--surface)] flex items-center justify-center">
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--text-muted)"
                strokeWidth="2"
              >
                <rect x="2" y="2" width="20" height="20" rx="2" />
                <path d="M7 2v20M17 2v20M2 12h20" />
              </svg>
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0 flex flex-col gap-[5px]">
          {/* Title */}
          <p className="text-[13px] sm:text-[14px] font-semibold text-[var(--text)] group-hover:text-white truncate transition-colors leading-[1.3]">
            {entry.film_name}
          </p>

          {/* Year + Rating row */}
          <div className="flex items-center gap-[8px] flex-wrap">
            {entry.year && (
              <span className="text-[11px] text-[var(--text-muted)]">
                {entry.year}
              </span>
            )}
            {entry.rating && (
              <span className="flex items-center gap-[3px]">
                <svg width="9" height="9" viewBox="0 0 24 24" fill="#f5c518">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                </svg>
                <span className="text-[11px] text-[#f5c518] font-medium">
                  {entry.rating.toFixed(1)}
                </span>
              </span>
            )}
          </div>

          {/* Date label */}
          <div className="flex items-center gap-[5px] ">
            <svg
              width="10"
              height="10"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--text-muted)"
              strokeWidth="2"
            >
              <rect x="3" y="4" width="18" height="18" rx="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            <span className="text-[10px] sm:text-[11px] text-[var(--text-muted)] ">
              {dateLabel}
            </span>
          </div>
        </div>
      </Link>

      {/* Remove button */}
      <button
        onClick={handleRemove}
        onTouchEnd={handleRemove}
        className="flex-shrink-0 w-9 h-9 flex items-center justify-center
          bg-transparent border border-[var(--border)] rounded-[8px] cursor-pointer
          text-[var(--text-muted)] hover:text-[var(--accent)] hover:border-[rgba(229,9,20,0.4)]
          active:scale-90 transition-all"
        aria-label="Remove"
      >
        <svg
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
        >
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  );
}

export default function UserListPage({ type }: { type: ListType }) {
  const cfg = CONFIG[type];
  const [entries, setEntries] = useState<FilmListEntry[]>([]);
  const [userName, setUserName] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    setEntries(getList(type));
    setUserName(getSessionName());
  }, [type]);

  const handleRemove = (filmId: number) => {
    if (type === "history") {
      removeFromHistory(filmId);
    } else if (type === "favorites") {
      toggleFavorite({
        film_id: filmId,
        film_name: "",
        poster_url: null,
        year: null,
        rating: null,
      });
    } else if (type === "watchlater") {
      toggleWatchLater({
        film_id: filmId,
        film_name: "",
        poster_url: null,
        year: null,
        rating: null,
      });
    }
    setEntries(getList(type));
    toast.info("Removed.");
  };

  const listTitle = userName ? `${userName}'s ${cfg.label}` : cfg.label;

  return (
    <div className="min-h-screen max-w-[780px] mx-auto sm:px-[clamp(16px,5vw,48px)] py-8 sm:py-10 pb-28">
      <BackButton />
      <div className="px-4 lg:px-6">
        {/* Header */}
        <div className="mb-6 pb-5 border-b border-[var(--border)]">
          <div className="flex justify-between items-center gap-3">
            <div className="flex items-center gap-3">
              {cfg.icon}
              <h1
                className="font-display tracking-[2px] text-[var(--text)] m-0 text-[clamp(22px,4vw,34px)]"
                style={{ color: cfg.accentColor }}
              >
                {listTitle.toUpperCase()}
              </h1>
            </div>
            <span
              className="text-[12px] font-medium px-2 py-[2px] rounded-[4px]"
              style={{
                background: `${cfg.accentColor}18`,
                color: cfg.accentColor,
              }}
            >
              {entries.length} {entries.length === 1 ? "film" : "films"}
            </span>
          </div>
          <div />
          <div className="flex items-center gap-3 ml-7 sm:ml-8"></div>
        </div>

        {entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center gap-4">
            <div
              className="w-[72px] h-[72px] rounded-full border flex items-center justify-center mb-2"
              style={{
                background: `${cfg.accentColor}10`,
                borderColor: `${cfg.accentColor}30`,
              }}
            >
              {cfg.icon}
            </div>
            <p className="text-[14px] text-[var(--text-muted)] max-w-[260px] leading-[1.6]">
              {cfg.emptyMsg}
            </p>
            <Link
              href="/"
              className="mt-2 bg-[var(--accent)] text-white no-underline rounded-[var(--radius)] px-5 py-[10px] text-[13px] font-semibold hover:opacity-90 transition-opacity active:scale-[0.97]"
            >
              Browse Films
            </Link>
          </div>
        ) : (
          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-lg)] px-4 sm:px-5">
            {entries.map((e) => (
              <FilmRow
                key={e.film_id}
                entry={e}
                type={type}
                onRemove={handleRemove}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
