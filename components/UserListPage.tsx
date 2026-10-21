"use client";
import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Heart,
  Clock,
  History,
  Star,
  Calendar,
  X,
  Search,
  Shuffle,
  LayoutGrid,
  List as ListIcon,
} from "lucide-react";
import {
  getList,
  removeFromHistory,
  toggleFavorite,
  toggleWatchLater,
  ListType,
} from "@/lib/userLists";
import { getSessionName, FilmListEntry } from "@/lib/session";
import { formatDateSafe } from "@/lib/translate";
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

  const formattedDate =
    formatDateSafe(entry.added_at, {
      month: "short",
      day: "numeric",
      year: "numeric",
    }) || "Recently";

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
  const router = useRouter();

  const [entries, setEntries] = useState<FilmListEntry[]>([]);
  const [userName, setUserName] = useState("");
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState<"ADDED" | "RATING" | "YEAR" | "TITLE">(
    "ADDED",
  );
  const [viewMode, setViewMode] = useState<"LIST" | "GRID">("LIST");

  const { toast } = useToast();

  useEffect(() => {
    const sync = () => {
      setEntries(getList(type));
      setUserName(getSessionName());
    };
    sync();
    window.addEventListener("cinemix-session-change", sync);
    return () => window.removeEventListener("cinemix-session-change", sync);
  }, [type]);

  const filteredEntries = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = entries.filter((e) => {
      if (!q) return true;
      return (
        e.film_name.toLowerCase().includes(q) ||
        (e.year ? String(e.year).includes(q) : false)
      );
    });

    return [...list].sort((a, b) => {
      if (sortBy === "RATING") {
        return (b.rating ?? 0) - (a.rating ?? 0);
      }
      if (sortBy === "YEAR") {
        return (b.year ?? 0) - (a.year ?? 0);
      }
      if (sortBy === "TITLE") {
        return a.film_name.localeCompare(b.film_name);
      }
      return (
        (new Date(b.added_at).getTime() || 0) -
        (new Date(a.added_at).getTime() || 0)
      );
    });
  }, [entries, query, sortBy]);

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

  const handlePickRandom = () => {
    if (filteredEntries.length === 0) return;
    const pick =
      filteredEntries[Math.floor(Math.random() * filteredEntries.length)];
    router.push(`/film/${pick.film_id}`);
  };

  const listTitle = userName ? `${userName}'s ${cfg.label}` : cfg.label;

  return (
    <PageContainer variant="narrow" className="pb-28">
      <BackButton fallbackHref="/profile" />

      <div className="mb-5 pb-5 border-b border-[var(--border)] flex justify-between items-center gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          {cfg.icon}
          <h1
            className="font-display tracking-[2px] text-[var(--text)] m-0 text-[clamp(22px,4vw,34px)]"
            style={{ color: cfg.accentColor }}
          >
            {listTitle.toUpperCase()}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          {entries.length > 1 && (
            <button
              type="button"
              onClick={handlePickRandom}
              className="btn btn-ghost py-1.5 px-3 text-[12px]"
            >
              <Shuffle size={13} />
              Pick Random
            </button>
          )}
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
      </div>

      {/* Toolbar: Search + Sort + Grid/List View */}
      {entries.length > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 mb-5">
          <div className="relative flex-1">
            <Search
              size={13}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none"
            />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Search in ${cfg.label}…`}
              className="input w-full pl-8 pr-3 py-2 text-[12px] rounded-[8px]"
            />
          </div>

          <div className="flex items-center gap-2">
            <select
              value={sortBy}
              onChange={(e) =>
                setSortBy(
                  e.target.value as "ADDED" | "RATING" | "YEAR" | "TITLE",
                )
              }
              className="select text-[12px] py-2 px-3 rounded-[8px]"
            >
              <option value="ADDED">Sort: Recently Added</option>
              <option value="RATING">Sort: Highest Rated</option>
              <option value="YEAR">Sort: Release Year</option>
              <option value="TITLE">Sort: Title (A–Z)</option>
            </select>

            <div className="inline-flex items-center rounded-[8px] border border-[var(--border)] bg-[var(--bg-elevated)] p-0.5">
              <button
                type="button"
                onClick={() => setViewMode("LIST")}
                className={`p-1.5 rounded-[6px] border-none cursor-pointer ${
                  viewMode === "LIST"
                    ? "bg-[var(--accent)] text-white"
                    : "bg-transparent text-[var(--text-muted)]"
                }`}
              >
                <ListIcon size={14} />
              </button>
              <button
                type="button"
                onClick={() => setViewMode("GRID")}
                className={`p-1.5 rounded-[6px] border-none cursor-pointer ${
                  viewMode === "GRID"
                    ? "bg-[var(--accent)] text-white"
                    : "bg-transparent text-[var(--text-muted)]"
                }`}
              >
                <LayoutGrid size={14} />
              </button>
            </div>
          </div>
        </div>
      )}

      {entries.length === 0 ? (
        <EmptyState
          icon={cfg.icon}
          title={`No ${cfg.label} Yet`}
          description={cfg.emptyMsg}
          actionLabel="Browse Films"
          actionHref="/"
        />
      ) : viewMode === "GRID" ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3.5">
          {filteredEntries.map((e) => (
            <div
              key={e.film_id}
              className="bg-[var(--bg-card)] border border-[var(--border)] rounded-[10px] overflow-hidden relative group"
            >
              <Link href={`/film/${e.film_id}`} className="no-underline block">
                <PosterImage
                  src={e.poster_url}
                  alt={e.film_name}
                  title={e.film_name}
                  className="w-full aspect-[2/3] relative bg-[var(--surface)]"
                />
                <div className="p-2.5">
                  <p className="text-[12px] font-semibold text-white truncate m-0">
                    {e.film_name}
                  </p>
                  <div className="flex items-center justify-between text-[11px] text-[var(--text-muted)] mt-1">
                    <span>{e.year || "—"}</span>
                    {e.rating && (
                      <span className="text-[#f5c518] font-bold">
                        ★ {e.rating.toFixed(1)}
                      </span>
                    )}
                  </div>
                </div>
              </Link>
              <button
                type="button"
                onClick={() => handleRemove(e.film_id)}
                className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/75 border border-white/15 text-white flex items-center justify-center cursor-pointer opacity-80 hover:opacity-100"
                aria-label="Remove"
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-lg)] px-4 sm:px-5">
          {filteredEntries.map((e) => (
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
