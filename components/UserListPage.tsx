"use client";
import { useState, useEffect, useMemo, useRef } from "react";
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
  ArrowUpDown,
} from "lucide-react";
import {
  getList,
  removeFromHistory,
  toggleFavorite,
  toggleWatchLater,
  ListType,
} from "@/lib/userLists";
import { getSessionName, FilmListEntry } from "@/lib/session";
import { formatDateSafe, translateGenre } from "@/lib/translate";
import { useAutoTranslate, useFilmTitle } from "@/hooks/useTranslate";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { useToast } from "@/lib/toast";
import { Film } from "@/types/kinopoisk";
import FilmCard, {
  useHydratedFilm,
  useFilmLongPress,
  FilmLongPressPortal,
  resolveRating,
} from "@/components/FilmCard";
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

function entryToFilm(entry: FilmListEntry): Film {
  return {
    kinopoiskId: entry.film_id,
    filmId: entry.film_id,
    nameEn: entry.film_name,
    nameRu: entry.film_name,
    posterUrl: entry.poster_url || "",
    posterUrlPreview: entry.poster_url || "",
    year: entry.year ?? undefined,
    ratingKinopoisk: entry.rating ?? undefined,
  };
}

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
  const autoTranslate = useAutoTranslate();
  const rowRef = useRef<HTMLDivElement>(null);
  const posterWrapRef = useRef<HTMLDivElement>(null);

  const rawFilm = useMemo(() => entryToFilm(entry), [entry]);
  const film = useHydratedFilm(rawFilm, rowRef);
  const displayName = useFilmTitle(film, autoTranslate);

  const {
    popupOpen,
    popupEntered,
    originDelta,
    closePopup,
    setPopupOpen,
    setPopupEntered,
    historyPushedRef,
    bindLongPress,
  } = useFilmLongPress(entry.film_id, posterWrapRef);

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

  const year = film.year || film.startYear || entry.year;
  const rating = resolveRating(film) ?? entry.rating;
  const primaryGenre = film.genres?.[0]
    ? translateGenre(film.genres[0].genre, autoTranslate)
    : null;

  return (
    <>
      <div
        ref={rowRef}
        className={`flex items-center gap-3 py-3 sm:py-3.5 border-b border-[var(--border)] last:border-b-0 transition-all duration-200 select-none [-webkit-touch-callout:none] ${
          removing || popupOpen
            ? "opacity-0 scale-[0.97] pointer-events-none"
            : "opacity-100"
        }`}
        onTouchStart={bindLongPress.onTouchStart}
        onTouchMove={bindLongPress.onTouchMove}
        onTouchEnd={bindLongPress.onTouchEnd}
        onTouchCancel={bindLongPress.onTouchCancel}
        onMouseDown={bindLongPress.onMouseDown}
        onMouseMove={bindLongPress.onMouseMove}
        onMouseUp={bindLongPress.onMouseUp}
        onMouseLeave={bindLongPress.onMouseLeave}
        onClickCapture={bindLongPress.onClickCapture}
        onContextMenu={bindLongPress.onContextMenu}
      >
        <Link
          href={`/film/${entry.film_id}`}
          className="no-underline flex items-center gap-3 flex-1 min-w-0 group active:opacity-80 transition-opacity"
        >
          <div
            ref={posterWrapRef}
            className="w-12 h-[68px] sm:w-14 sm:h-[80px] rounded-[8px] overflow-hidden bg-[var(--bg-elevated)] flex-shrink-0 relative"
          >
            <PosterImage
              src={film.posterUrlPreview || film.posterUrl || entry.poster_url}
              alt={displayName}
              title={displayName}
              size="sm"
              fallbackType="mini"
            />
          </div>

          <div className="flex-1 min-w-0 flex flex-col gap-[4px]">
            <p className="text-[13px] sm:text-[14px] font-semibold text-[var(--text)] group-hover:text-white truncate transition-colors leading-[1.3] m-0">
              {displayName}
            </p>

            <div className="flex items-center gap-[7px] flex-wrap">
              {year && (
                <span className="text-[11px] text-[var(--text-muted)]">
                  {year}
                </span>
              )}
              {primaryGenre && (
                <span className="tag tag-dim !text-[9px] sm:!text-[10px] !py-[1px] !px-[6px] capitalize">
                  {primaryGenre}
                </span>
              )}
              {rating !== null && rating !== undefined && (
                <span className="flex items-center gap-[3px]">
                  <Star size={9} fill="#f5c518" stroke="#f5c518" />
                  <span className="text-[11px] text-[#f5c518] font-medium">
                    {typeof rating === "number" ? rating.toFixed(1) : rating}
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

      <FilmLongPressPortal
        film={film}
        popupOpen={popupOpen}
        popupEntered={popupEntered}
        originDelta={originDelta}
        closePopup={closePopup}
        setPopupOpen={setPopupOpen}
        setPopupEntered={setPopupEntered}
        historyPushedRef={historyPushedRef}
      />
    </>
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
      setEntries([...getList(type)]);
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
    setEntries([...getList(type)]);
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
    <PageContainer variant="narrow" className="sm:pb-28">
      <BackButton fallbackHref="/profile" />

      <div className="mb-5 pb-4 border-b border-[var(--border)] flex justify-between items-center gap-3 flex-wrap">
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
          {entries.length > 1 && !(type === "history") && (
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
            {query && (
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] bg-transparent border-none cursor-pointer p-1 hover:text-[var(--text)] transition-colors"
                aria-label="Clear search"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* <ArrowUpDown size={18} /> */}

            <select
              value={sortBy}
              onChange={(e) =>
                setSortBy(
                  e.target.value as "ADDED" | "RATING" | "YEAR" | "TITLE",
                )
              }
              className="select text-[12px] py-2 px-3 rounded-[8px] flex-1 sm:flex-initial"
            >
              <option value="ADDED">Recently Added</option>
              <option value="RATING">Highest Rated</option>
              <option value="YEAR">Release Year</option>
              <option value="TITLE">Title (A–Z)</option>
            </select>

            {/* <div className="inline-flex items-center rounded-[8px] border border-[var(--border)] bg-[var(--bg-elevated)] p-0.5">
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
            </div> */}
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
        <div className="film-grid">
          {filteredEntries.map((e, i) => (
            <div key={e.film_id} className="relative group">
              <FilmCard film={entryToFilm(e)} priority={i < 6} size="sm" />
              <button
                type="button"
                onClick={(ev) => {
                  ev.preventDefault();
                  ev.stopPropagation();
                  handleRemove(e.film_id);
                }}
                className="absolute top-1.5 left-1.5 z-20 w-7 h-7 rounded-full bg-black/80 border border-white/20 text-white flex items-center justify-center cursor-pointer active:scale-90 transition-transform"
                aria-label="Remove"
                title="Remove from list"
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-lg)] px-3.5 sm:px-5">
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
