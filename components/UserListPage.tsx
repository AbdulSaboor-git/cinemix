"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { Heart, Clock, History, Star, Calendar, X } from "lucide-react";
import {
  getList,
  removeFromHistory,
  toggleFavorite,
  toggleWatchLater,
  ListType,
} from "@/lib/userLists";
import { getSessionName, FilmListEntry } from "@/lib/session";
import { useTranslate } from "@/hooks/useTranslate";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { useToast } from "@/lib/toast";
import BackButton from "@/components/BackButton";
import PageContainer from "@/components/ui/PageContainer";
import PosterImage from "@/components/ui/PosterImage";
import EmptyState from "@/components/ui/EmptyState";

const CONFIG = {
  favorites: {
    label: "Favorites",
    icon: (
      <Heart
        size={18}
        fill="var(--accent)"
        stroke="var(--accent)"
        strokeWidth={2}
      />
    ),
    emptyMsg: "No favorites yet. Find a film you love and hit the heart!",
    accentColor: "var(--accent)",
  },
  watchlater: {
    label: "Watch Later",
    icon: <Clock size={18} stroke="#60a5fa" strokeWidth={2} />,
    emptyMsg:
      "Your watch-later list is empty. Save films to watch when you're ready.",
    accentColor: "#60a5fa",
  },
  history: {
    label: "Watch History",
    icon: <History size={18} stroke="#22c55e" strokeWidth={2} />,
    emptyMsg: "Nothing watched yet. Start a film from its page!",
    accentColor: "#22c55e",
  },
};

function UserListRow({
  entry,
  type,
  onRemove,
}: {
  entry: FilmListEntry;
  type: ListType;
  onRemove: (id: number) => void;
}) {
  const [removing, setRemoving] = useState(false);
  const translatedTitle = useTranslate(entry.film_name);
  const displayName = translatedTitle || entry.film_name;

  const handleRemove = (e: React.MouseEvent) => {
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
      className={`flex items-center gap-3 py-3 sm:py-4 border-b border-[var(--border)] last:border-b-0 transition-all duration-200 ${
        removing ? "opacity-0 scale-[0.97]" : "opacity-100"
      }`}
    >
      <Link
        href={`/film/${entry.film_id}`}
        className="no-underline flex items-center gap-3 flex-1 min-w-0 group active:opacity-80 transition-opacity"
      >
        <PosterImage
          src={entry.poster_url}
          alt={displayName}
          title={displayName}
          fallbackType="mini"
          className="w-12 h-[68px] sm:w-14 sm:h-[80px] rounded-[8px] overflow-hidden bg-[var(--bg-elevated)] flex-shrink-0 relative"
        />

        <div className="flex-1 min-w-0 flex flex-col gap-[5px]">
          <p className="text-[13px] sm:text-[14px] font-semibold text-[var(--text)] group-hover:text-white truncate transition-colors leading-[1.3]">
            {displayName}
          </p>

          <div className="flex items-center gap-[8px] flex-wrap">
            {entry.year && (
              <span className="text-[11px] text-[var(--text-muted)]">
                {entry.year}
              </span>
            )}
            {entry.rating && (
              <span className="flex items-center gap-[3px]">
                <Star size={9} fill="#f5c518" stroke="#f5c518" />
                <span className="text-[11px] text-[#f5c518] font-medium">
                  {entry.rating.toFixed(1)}
                </span>
              </span>
            )}
          </div>

          <div className="flex items-center gap-[5px]">
            <Calendar size={10} stroke="var(--text-muted)" strokeWidth={2} />
            <span className="text-[10px] sm:text-[11px] text-[var(--text-muted)]">
              {dateLabel}
            </span>
          </div>
        </div>
      </Link>

      <button
        type="button"
        onClick={handleRemove}
        className="flex-shrink-0 w-9 h-9 flex items-center justify-center bg-transparent border border-[var(--border)] rounded-[8px] cursor-pointer text-[var(--text-muted)] hover:text-[var(--accent)] hover:border-[rgba(229,9,20,0.4)] active:scale-90 transition-all"
        aria-label="Remove"
      >
        <X size={13} strokeWidth={2.2} />
      </button>
    </div>
  );
}

export default function UserListPage({ type }: { type: ListType }) {
  const cfg = CONFIG[type];
  useDocumentTitle(cfg.label);

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
    <PageContainer variant="narrow" className="pb-28">
      <BackButton fallbackHref="/profile" />

      <div className="mb-6 pb-5 border-b border-[var(--border)] flex justify-between items-center gap-3">
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
          className="text-[12px] font-medium px-2.5 py-[3px] rounded-[6px]"
          style={{
            background: `${cfg.accentColor}18`,
            color: cfg.accentColor,
          }}
        >
          {entries.length} {entries.length === 1 ? "film" : "films"}
        </span>
      </div>

      {entries.length === 0 ? (
        <EmptyState
          icon={cfg.icon}
          title={`No ${cfg.label} Yet`}
          description={cfg.emptyMsg}
          actionLabel="Browse Films"
          actionHref="/"
        />
      ) : (
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-lg)] px-4 sm:px-5">
          {entries.map((e) => (
            <UserListRow
              key={e.film_id}
              entry={e}
              type={type}
              onRemove={handleRemove}
            />
          ))}
        </div>
      )}
    </PageContainer>
  );
}
