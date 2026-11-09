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
  Pencil,
  Sparkles,
  ChevronDown,
} from "lucide-react";
import {
  getList,
  addToHistory,
  removeFromHistory,
  toggleFavorite,
  toggleWatchLater,
  setUserRating,
  removeUserRating,
  getTasteStats,
  getRatingVerdict,
  TASTE_DIMENSIONS,
  ListType,
  RatedFilmEntry,
} from "@/lib/userLists";
import {
  getSessionName,
  FilmListEntry,
  UserListSortOption,
} from "@/lib/session";
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
import {
  hasApiKeys,
  hasVerifiedApiKey,
  getListSortPreference,
  saveListSortPreference,
} from "@/lib/preferences";
import { verifyApiKeys } from "@/lib/kinopoisk";
import BackButton from "@/components/BackButton";
import PageContainer from "@/components/ui/PageContainer";
import PosterImage from "@/components/ui/PosterImage";
import EmptyState from "@/components/ui/EmptyState";
import NoKeyBanner from "@/components/ui/NoKeyBanner";
import RateFilmModal, { RateFilmTarget } from "@/components/RateFilmModal";

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
  ratings: {
    label: "My Ratings",
    icon: (
      <Star
        size={18}
        fill="var(--user-rating)"
        stroke="var(--user-rating)"
        strokeWidth={2}
      />
    ),
    emptyMsg:
      "You haven't rated any movies yet. Open any movie page and rate it according to your taste!",
    accentColor: "var(--user-rating)",
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

function isRatedEntry(entry: FilmListEntry): entry is RatedFilmEntry {
  return (
    "user_rating" in entry &&
    typeof (entry as RatedFilmEntry).user_rating === "number"
  );
}

function UserListRow({
  entry,
  type,
  onRemove,
  onEditRating,
}: {
  entry: FilmListEntry;
  type: ListType;
  onRemove: (entry: FilmListEntry) => void;
  onEditRating?: (entry: RatedFilmEntry) => void;
}) {
  const [removing, setRemoving] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const autoTranslate = useAutoTranslate();
  const rowRef = useRef<HTMLDivElement>(null);
  const posterWrapRef = useRef<HTMLDivElement>(null);

  const rawFilm = useMemo(() => entryToFilm(entry), [entry]);
  const film = useHydratedFilm(rawFilm, rowRef, false, true);
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
    setTimeout(() => onRemove(entry), 160);
  };

  const handleEdit = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isRatedEntry(entry)) {
      onEditRating?.(entry);
    }
  };

  const handleToggleDetails = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDetailsOpen((v) => !v);
  };

  const formattedDate =
    formatDateSafe(
      isRatedEntry(entry) && entry.updated_at
        ? entry.updated_at
        : entry.added_at,
      {
        month: "short",
        day: "numeric",
        year: "numeric",
      },
    ) || "Recently";

  const dateLabel =
    type === "history"
      ? `Watched ${formattedDate}`
      : type === "favorites"
        ? `Saved ${formattedDate}`
        : type === "ratings"
          ? `Rated ${formattedDate}`
          : `Added ${formattedDate}`;

  const year = film.year || film.startYear || entry.year;
  const rating = resolveRating(film) ?? entry.rating;
  const primaryGenre = film.genres?.[0]
    ? translateGenre(film.genres[0].genre, autoTranslate)
    : null;

  const ratedEntry = isRatedEntry(entry) ? entry : null;
  const verdict = ratedEntry ? getRatingVerdict(ratedEntry.user_rating) : null;
  const hasBreakdown = Boolean(
    ratedEntry?.taste_breakdown &&
    Object.keys(ratedEntry.taste_breakdown).length > 0,
  );
  const hasTags = Boolean(
    ratedEntry?.taste_tags && ratedEntry.taste_tags.length > 0,
  );
  const hasNote = Boolean(ratedEntry?.review_note);
  const hasDetails = Boolean(hasBreakdown || hasTags || hasNote);

  return (
    <>
      <div
        ref={rowRef}
        className={`border-b border-[var(--border)] last:border-b-0 transition-all duration-200 select-none [-webkit-touch-callout:none] ${
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
        <div className="flex items-center gap-3 py-3 sm:py-3.5">
          <Link
            href={`/film/${entry.film_id}`}
            className="no-underline flex items-center gap-3 flex-1 min-w-0 group active:opacity-80 transition-opacity"
          >
            <div
              ref={posterWrapRef}
              className="w-12 h-[68px] sm:w-14 sm:h-[80px] rounded-[8px] overflow-hidden bg-[var(--bg-elevated)] flex-shrink-0 relative"
            >
              <PosterImage
                src={
                  film.posterUrlPreview || film.posterUrl || entry.poster_url
                }
                alt={displayName}
                title={displayName}
                filmId={entry.film_id}
                imdbId={film.imdbId}
                year={year}
                size="sm"
                fallbackType="mini"
              />
            </div>

            <div className="flex-1 min-w-0 flex flex-col gap-[4px]">
              <p className="text-[13px] sm:text-[14px] font-semibold text-[var(--text)] group-hover:text-white truncate transition-colors leading-[1.3] m-0">
                {displayName}
              </p>

              <div className="flex items-center gap-[6px] flex-wrap">
                {ratedEntry && verdict && (
                  <span
                    className="inline-flex items-center gap-1 px-1.5 py-[1px] rounded-[5px] text-[10px] sm:text-[11px] font-bold"
                    style={{
                      color: "var(--user-rating)",
                      backgroundColor: "var(--user-rating-bg)",
                      border: "1px solid var(--user-rating-border)",
                    }}
                  >
                    <Star
                      size={9}
                      fill="var(--user-rating)"
                      stroke="var(--user-rating)"
                    />
                    {ratedEntry.user_rating.toFixed(1)}
                    <span
                      className="text-[9px] font-semibold opacity-90 hidden sm:inline"
                      style={{ color: verdict.color }}
                    >
                      · {verdict.label}
                    </span>
                  </span>
                )}

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
                    <span className="text-[11px] text-[var(--text-dim)] font-medium">
                      {typeof rating === "number" ? rating.toFixed(1) : rating}
                    </span>
                  </span>
                )}
              </div>

              <div className="flex items-center gap-[5px]">
                <Calendar
                  size={10}
                  stroke="var(--text-muted)"
                  strokeWidth={2}
                />
                <span className="text-[10px] sm:text-[11px] text-[var(--text-muted)]">
                  {dateLabel}
                </span>
              </div>
            </div>
          </Link>

          <div className="flex items-center gap-1.5 flex-shrink-0">
            {type === "ratings" && hasDetails && (
              <button
                type="button"
                onClick={handleToggleDetails}
                aria-expanded={detailsOpen}
                title={
                  detailsOpen ? "Hide rating details" : "Show rating details"
                }
                className="h-8 px-2 flex items-center justify-center gap-1 bg-transparent border border-[var(--border)] hover:border-[var(--border-hover)] rounded-[8px] cursor-pointer text-[10px] font-medium text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
              >
                <span className="hidden sm:inline">
                  {detailsOpen ? "Hide" : "Details"}
                </span>
                <ChevronDown
                  size={12}
                  className={`transition-transform duration-200 ${
                    detailsOpen ? "rotate-180" : ""
                  }`}
                />
              </button>
            )}
            {type === "ratings" && ratedEntry && (
              <button
                type="button"
                onClick={handleEdit}
                className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center bg-[var(--bg-elevated)] border border-[var(--border)] rounded-[8px] cursor-pointer text-[var(--text-dim)] hover:text-[var(--user-rating)] hover:border-[var(--user-rating-border)] active:scale-90 transition-all"
                aria-label={`Edit rating for ${displayName}`}
                title="Edit rating"
              >
                <Pencil size={13} strokeWidth={2.2} />
              </button>
            )}
            <button
              type="button"
              onClick={handleRemove}
              className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center bg-transparent border border-[var(--border)] rounded-[8px] cursor-pointer text-[var(--text-muted)] hover:text-[var(--accent)] hover:border-[rgba(229,9,20,0.4)] active:scale-90 transition-all"
              aria-label="Remove"
              title="Remove from list"
            >
              <X size={13} strokeWidth={2.2} />
            </button>
          </div>
        </div>

        {/* Expandable Taste Details Drawer */}
        {type === "ratings" && detailsOpen && ratedEntry && hasDetails && (
          <div className="pb-3.5 pt-0.5 pl-[60px] sm:pl-[68px] pr-2 flex flex-col gap-1.5 slide-down">
            {hasBreakdown && (
              <div className="flex items-center gap-1.5 flex-wrap">
                {TASTE_DIMENSIONS.map((dim) => {
                  const val = ratedEntry.taste_breakdown?.[dim.key];
                  if (val === undefined) return null;
                  return (
                    <span
                      key={dim.key}
                      className="text-[10px] text-[var(--text-muted)] bg-[var(--bg-elevated)] border border-[var(--border)] px-2 py-[1px] rounded-[4px]"
                    >
                      {dim.shortLabel}{" "}
                      <strong className="text-[var(--user-rating)] font-semibold">
                        {val.toFixed(1)}
                      </strong>
                    </span>
                  );
                })}
              </div>
            )}

            {hasTags && (
              <div className="flex items-center gap-1 flex-wrap">
                <Sparkles size={10} className="text-[var(--user-rating)]" />
                {ratedEntry.taste_tags!.map((tag) => (
                  <span
                    key={tag}
                    className="text-[10px] text-[var(--user-rating)] bg-[var(--user-rating-bg)] border border-[var(--user-rating-border)] px-2 py-[1px] rounded-full"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}

            {hasNote && (
              <p className="text-[11px] text-[var(--text-dim)] italic m-0 pl-2 border-l-2 border-[var(--user-rating)]/50 leading-relaxed">
                &ldquo;{ratedEntry.review_note}&rdquo;
              </p>
            )}
          </div>
        )}
      </div>

      {popupOpen && (
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
      )}
    </>
  );
}

const VALID_SORT_OPTIONS = new Set<UserListSortOption>([
  "ADDED",
  "USER_RATING_DESC",
  "USER_RATING_ASC",
  "RATING",
  "YEAR",
  "TITLE",
]);

export default function UserListPage({ type }: { type: ListType }) {
  const cfg = CONFIG[type];
  useDocumentTitle(cfg.label);
  const router = useRouter();

  const [noKey, setNoKey] = useState(false);
  const [entries, setEntries] = useState<FilmListEntry[]>([]);
  const [userName, setUserName] = useState("");
  const [query, setQuery] = useState("");
  const [activeTagFilter, setActiveTagFilter] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<UserListSortOption>(() =>
    getListSortPreference(type),
  );
  const [viewMode] = useState<"LIST" | "GRID">("LIST");
  const [editingFilm, setEditingFilm] = useState<RateFilmTarget | null>(null);

  const { toast } = useToast();

  // Restore saved sort & search/tag filter on mount or type change
  useEffect(() => {
    const savedPrefSort = getListSortPreference(type);
    let initialSort = savedPrefSort;
    let initialQuery = "";
    let initialTag: string | null = null;

    if (typeof window !== "undefined") {
      try {
        const sp = new URLSearchParams(window.location.search);
        const urlSort = sp.get("sort") as UserListSortOption | null;
        if (urlSort && VALID_SORT_OPTIONS.has(urlSort)) {
          initialSort = urlSort;
        }
        const rawSession = sessionStorage.getItem(
          `cinemix_userlist_state_${type}`,
        );
        if (rawSession) {
          const parsed = JSON.parse(rawSession) as {
            sort?: UserListSortOption;
            query?: string;
            tag?: string | null;
          };
          if (!urlSort && parsed.sort && VALID_SORT_OPTIONS.has(parsed.sort)) {
            initialSort = parsed.sort;
          }
          if (typeof parsed.query === "string") initialQuery = parsed.query;
          if (typeof parsed.tag === "string") initialTag = parsed.tag;
        }
      } catch {
        // ignore
      }
    }

    if (
      type !== "ratings" &&
      (initialSort === "USER_RATING_DESC" || initialSort === "USER_RATING_ASC")
    ) {
      initialSort = "ADDED";
    }

    setSortBy(initialSort);
    setQuery(initialQuery);
    setActiveTagFilter(initialTag);
  }, [type]);

  // Persist sort & filter changes to session preferences + sessionStorage + URL
  const handleSortChange = (nextSort: UserListSortOption) => {
    setSortBy(nextSort);
    saveListSortPreference(type, nextSort);
    if (typeof window !== "undefined") {
      try {
        sessionStorage.setItem(
          `cinemix_userlist_state_${type}`,
          JSON.stringify({ sort: nextSort, query, tag: activeTagFilter }),
        );
        const url = new URL(window.location.href);
        if (nextSort === "ADDED") {
          url.searchParams.delete("sort");
        } else {
          url.searchParams.set("sort", nextSort);
        }
        window.history.replaceState(window.history.state, "", url.toString());
      } catch {
        // ignore
      }
    }
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      sessionStorage.setItem(
        `cinemix_userlist_state_${type}`,
        JSON.stringify({ sort: sortBy, query, tag: activeTagFilter }),
      );
    } catch {
      // ignore
    }
  }, [type, sortBy, query, activeTagFilter]);

  useEffect(() => {
    let mounted = true;
    const sync = () => {
      if (!hasApiKeys()) {
        setNoKey(true);
        setEntries([]);
        return;
      }
      if (hasVerifiedApiKey()) {
        setNoKey(false);
        setEntries([...getList(type)]);
        setUserName(getSessionName());
        return;
      }
      setEntries([]);
      verifyApiKeys().then((valid) => {
        if (!mounted) return;
        if (!valid || !hasApiKeys()) {
          setNoKey(true);
          setEntries([]);
        } else {
          setNoKey(false);
          setEntries([...getList(type)]);
          setUserName(getSessionName());
        }
      });
    };
    sync();
    window.addEventListener("cinemix-session-change", sync);
    window.addEventListener("storage", sync);
    return () => {
      mounted = false;
      window.removeEventListener("cinemix-session-change", sync);
      window.removeEventListener("storage", sync);
    };
  }, [type]);

  const tasteStats = useMemo(() => {
    if (type !== "ratings") return null;
    return getTasteStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, entries]);

  const filteredEntries = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = entries.filter((e) => {
      if (activeTagFilter && isRatedEntry(e)) {
        if (!e.taste_tags?.includes(activeTagFilter)) return false;
      }
      if (!q) return true;
      const inTitle = e.film_name.toLowerCase().includes(q);
      const inYear = e.year ? String(e.year).includes(q) : false;
      const inTags =
        isRatedEntry(e) &&
        e.taste_tags?.some((t) => t.toLowerCase().includes(q));
      const inNote =
        isRatedEntry(e) && e.review_note?.toLowerCase().includes(q);
      return Boolean(inTitle || inYear || inTags || inNote);
    });

    return [...list].sort((a, b) => {
      if (sortBy === "USER_RATING_DESC") {
        const ra = isRatedEntry(a) ? a.user_rating : (a.rating ?? 0);
        const rb = isRatedEntry(b) ? b.user_rating : (b.rating ?? 0);
        return rb - ra;
      }
      if (sortBy === "USER_RATING_ASC") {
        const ra = isRatedEntry(a) ? a.user_rating : (a.rating ?? 0);
        const rb = isRatedEntry(b) ? b.user_rating : (b.rating ?? 0);
        return ra - rb;
      }
      if (sortBy === "RATING") {
        return (b.rating ?? 0) - (a.rating ?? 0);
      }
      if (sortBy === "YEAR") {
        return (b.year ?? 0) - (a.year ?? 0);
      }
      if (sortBy === "TITLE") {
        return a.film_name.localeCompare(b.film_name);
      }
      const dateA = isRatedEntry(a) && a.updated_at ? a.updated_at : a.added_at;
      const dateB = isRatedEntry(b) && b.updated_at ? b.updated_at : b.added_at;
      return (
        (new Date(dateB).getTime() || 0) - (new Date(dateA).getTime() || 0)
      );
    });
  }, [entries, query, sortBy, activeTagFilter]);

  const handleRemove = (removedEntry: FilmListEntry) => {
    const filmId = removedEntry.film_id;
    const payload = {
      film_id: removedEntry.film_id,
      film_name: removedEntry.film_name,
      poster_url: removedEntry.poster_url,
      year: removedEntry.year,
      rating: removedEntry.rating,
    };

    if (type === "history") {
      removeFromHistory(filmId);
    } else if (type === "favorites") {
      toggleFavorite(payload);
    } else if (type === "watchlater") {
      toggleWatchLater(payload);
    } else if (type === "ratings") {
      removeUserRating(filmId);
    }
    setEntries([...getList(type)]);

    toast.show(`Removed from ${cfg.label}`, {
      type: "info",
      icon: "trash",
      description: removedEntry.film_name,
      posterUrl: removedEntry.poster_url,
      dedupeKey: `remove-${type}-${filmId}`,
      action: {
        label: "Undo",
        onClick: () => {
          if (type === "history") {
            addToHistory(payload);
          } else if (type === "favorites") {
            toggleFavorite(payload);
          } else if (type === "watchlater") {
            toggleWatchLater(payload);
          } else if (type === "ratings" && isRatedEntry(removedEntry)) {
            setUserRating(removedEntry);
          }
          setEntries([...getList(type)]);
        },
      },
    });
  };

  const handlePickRandom = () => {
    if (filteredEntries.length === 0) return;
    const pick =
      filteredEntries[Math.floor(Math.random() * filteredEntries.length)];
    router.push(`/film/${pick.film_id}`);
  };

  if (noKey) return <NoKeyBanner />;

  const listTitle = userName ? `${userName}'s ${cfg.label}` : cfg.label;

  return (
    <PageContainer variant="narrow" className="sm:pb-28">
      <BackButton fallbackHref="/profile" />

      <div className="mb-4 pb-3.5 border-b border-[var(--border)] flex justify-between items-center gap-3 flex-wrap">
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

      {/* Minimal Single-Line Taste Summary & Tag Filter Bar on My Ratings */}
      {type === "ratings" && tasteStats && tasteStats.topTags.length > 0 && (
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-[10px] px-3.5 py-2 mb-4 flex items-center gap-1.5 overflow-x-auto scrollbar-none">
          <Sparkles size={11} className="text-[var(--user-rating)] shrink-0" />
          {tasteStats.topTags.map((t) => {
            const active = activeTagFilter === t.tag;
            return (
              <button
                key={t.tag}
                type="button"
                onClick={() => setActiveTagFilter(active ? null : t.tag)}
                className={`text-[10px] sm:text-[11px] font-medium px-2.5 py-0.5 rounded-full border cursor-pointer transition-colors whitespace-nowrap ${
                  active
                    ? "bg-[var(--user-rating)] text-[#080808] border-[var(--user-rating)] font-bold"
                    : "bg-[var(--user-rating-bg)] border-[var(--user-rating-border)] text-[var(--user-rating)]"
                }`}
              >
                {t.tag} ({t.count})
              </button>
            );
          })}
        </div>
      )}

      {/* Toolbar: Search + Persistent Sort */}
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
              placeholder={
                type === "ratings"
                  ? "Search by title, year, taste tag, or note…"
                  : `Search in ${cfg.label}…`
              }
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
            <select
              value={sortBy}
              onChange={(e) =>
                handleSortChange(e.target.value as UserListSortOption)
              }
              className="select text-[12px] py-2 px-3 rounded-[8px] flex-1 sm:flex-initial"
              aria-label={`Sort ${cfg.label}`}
            >
              <option value="ADDED">
                {type === "ratings" ? "Recently Rated" : "Recently Added"}
              </option>
              {type === "ratings" && (
                <>
                  <option value="USER_RATING_DESC">
                    Your Rating (High → Low)
                  </option>
                  <option value="USER_RATING_ASC">
                    Your Rating (Low → High)
                  </option>
                </>
              )}
              <option value="RATING">
                {type === "ratings" ? "Global Rating" : "Highest Rated"}
              </option>
              <option value="YEAR">Release Year</option>
              <option value="TITLE">Title (A–Z)</option>
            </select>
          </div>
        </div>
      )}

      {entries.length === 0 ? (
        <EmptyState
          icon={cfg.icon}
          title={`No ${cfg.label} Yet`}
          description={cfg.emptyMsg}
          actionLabel="Browse Films"
          actionHref="/explore"
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
                  handleRemove(e);
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
              onEditRating={(rated) =>
                setEditingFilm({
                  film_id: rated.film_id,
                  film_name: rated.film_name,
                  poster_url: rated.poster_url,
                  year: rated.year,
                  rating: rated.rating,
                })
              }
            />
          ))}
        </div>
      )}

      <RateFilmModal
        open={editingFilm !== null}
        onClose={() => setEditingFilm(null)}
        film={editingFilm}
        onSaved={() => setEntries([...getList(type)])}
      />
    </PageContainer>
  );
}
