"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { getList, removeFromHistory, toggleFavorite, toggleWatchLater, ListType } from "@/lib/userLists";
import { getSessionName } from "@/lib/session";
import { FilmListEntry } from "@/lib/session";
import { useToast } from "@/lib/toast";

const CONFIG = {
  favorites: {
    label: "Favorites",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="var(--accent)" stroke="var(--accent)" strokeWidth="2">
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
      </svg>
    ),
    emptyMsg: "No favorites yet. Find a film you love and hit the heart!",
    accentColor: "var(--accent)",
  },
  watchlater: {
    label: "Watch Later",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="2">
        <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
      </svg>
    ),
    emptyMsg: "Your watch-later list is empty. Save films to watch when you're ready.",
    accentColor: "#60a5fa",
  },
  history: {
    label: "Watch History",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2">
        <path d="M3 3v5h5" /><path d="M3.05 13A9 9 0 1 0 6 5.3L3 8" />
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
  return (
    <div className="flex items-center gap-3 sm:gap-4 py-3 border-b border-[var(--border)] last:border-b-0 group">
      <Link href={`/film/${entry.film_id}`} className="no-underline flex items-center gap-3 flex-1 min-w-0">
        <div className="w-10 h-14 sm:w-12 sm:h-16 rounded-[8px] overflow-hidden bg-[var(--bg-elevated)] flex-shrink-0">
          {entry.poster_url && !imgErr ? (
            <img src={entry.poster_url} alt={entry.film_name} className="w-full h-full object-cover" onError={() => setImgErr(true)} />
          ) : (
            <div className="w-full h-full bg-[var(--surface)] flex items-center justify-center">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2">
                <rect x="2" y="2" width="20" height="20" rx="2" /><path d="M7 2v20M17 2v20M2 12h20" />
              </svg>
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] sm:text-[14px] font-semibold text-[var(--text)] group-hover:text-white truncate transition-colors">
            {entry.film_name}
          </p>
          <div className="flex items-center gap-2 mt-[3px]">
            {entry.year && <span className="text-[11px] text-[var(--text-muted)]">{entry.year}</span>}
            {entry.rating && (
              <span className="flex items-center gap-[3px] text-[11px] text-[#f5c518]">
                <svg width="9" height="9" viewBox="0 0 24 24" fill="#f5c518"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>
                {entry.rating.toFixed(1)}
              </span>
            )}
          </div>
          <p className="text-[10px] text-[var(--text-muted)] mt-[2px]">
            {new Date(entry.added_at).toLocaleDateString()}
          </p>
        </div>
      </Link>
      <button
        onClick={() => onRemove(entry.film_id)}
        className="flex-shrink-0 bg-transparent border border-[var(--border)] rounded-[6px] p-[6px] cursor-pointer text-[var(--text-muted)] hover:text-[var(--accent)] hover:border-[rgba(229,9,20,0.4)] transition-colors opacity-0 group-hover:opacity-100 sm:opacity-100"
        title="Remove"
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
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
      // Pass minimal entry — toggleFavorite will remove it if present
      toggleFavorite({ film_id: filmId, film_name: "", poster_url: null, year: null, rating: null });
    } else if (type === "watchlater") {
      toggleWatchLater({ film_id: filmId, film_name: "", poster_url: null, year: null, rating: null });
    }
    setEntries(getList(type));
    toast.info("Removed.");
  };

  const listTitle = userName
    ? `${userName}'s ${cfg.label}`
    : cfg.label;

  return (
    <div className="min-h-screen px-4 sm:px-[clamp(16px,5vw,48px)] py-8 sm:py-12 pb-24">
      <div className="max-w-[760px] mx-auto">
        {/* Header */}
        <div className="mb-7 pb-5 border-b border-[var(--border)]">
          <div className="flex items-center gap-3 mb-1">
            {cfg.icon}
            <h1 className="font-display tracking-[2px] text-[var(--text)] m-0 text-[clamp(20px,4vw,34px)]">
              {listTitle.toUpperCase()}
            </h1>
          </div>
          <div className="flex items-center gap-3 ml-7 sm:ml-8">
            <p className="text-[12px] sm:text-[13px] text-[var(--text-muted)]">
              {entries.length} {entries.length === 1 ? "film" : "films"}
            </p>
            <Link href="/profile" className="text-[11px] text-[var(--accent)] no-underline hover:underline">
              ← Profile
            </Link>
          </div>
        </div>

        {entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
            <div className="w-16 h-16 rounded-full bg-[var(--bg-card)] border border-[var(--border)] flex items-center justify-center">
              {cfg.icon}
            </div>
            <p className="text-[14px] text-[var(--text-muted)] max-w-[280px]">{cfg.emptyMsg}</p>
            <Link href="/" className="bg-[var(--accent)] text-white no-underline rounded-[var(--radius)] px-5 py-[9px] text-[13px] font-semibold hover:opacity-90 transition-opacity">
              Browse Films
            </Link>
          </div>
        ) : (
          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-lg)] px-4 sm:px-5">
            {entries.map((e) => (
              <FilmRow key={e.film_id} entry={e} type={type} onRemove={handleRemove} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
