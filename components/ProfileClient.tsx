"use client";
import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  Pencil,
  Heart,
  Clock,
  History,
  Star,
  Sparkles,
  ChevronRight,
  ChevronDown,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  RotateCcw,
} from "lucide-react";
import {
  getSession,
  getSessionName,
  saveSessionName,
  SessionMeta,
  RatedFilmEntry,
  FilmListEntry,
  ProfileSectionKey,
  DEFAULT_PROFILE_SECTION_ORDER,
} from "@/lib/session";
import {
  getList,
  getRatedFilms,
  getTasteStats,
  getRatingVerdict,
  TASTE_DIMENSIONS,
  TasteStats,
} from "@/lib/userLists";
import { useTranslate } from "@/hooks/useTranslate";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { useToast } from "@/lib/toast";
import {
  hasApiKeys,
  hasVerifiedApiKey,
  getProfileSectionOrder,
  saveProfileSectionOrder,
  getProfileSectionSort,
  saveProfileSectionSort,
} from "@/lib/preferences";
import { verifyApiKeys } from "@/lib/kinopoisk";
import PageContainer from "@/components/ui/PageContainer";
import PosterImage from "@/components/ui/PosterImage";
import NoKeyBanner from "@/components/ui/NoKeyBanner";
import RateFilmModal, { RateFilmTarget } from "@/components/RateFilmModal";

type SectionPreviewSort = "RECENT" | "RATING" | "YEAR" | "TITLE";

function StatCard({
  label,
  value,
  sublabel,
  href,
  color = "var(--accent)",
  icon,
}: {
  label: string;
  value: number | string;
  sublabel?: string;
  href: string;
  color?: string;
  icon: React.ReactNode;
}) {
  return (
    <Link href={href} className="no-underline group h-full">
      <div className="h-full bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-lg)] p-4 sm:p-5 flex flex-col gap-2 transition-all duration-200 hover:border-[rgba(229,9,20,0.35)] active:scale-[0.97] cursor-pointer">
        <div className="flex items-center justify-between">
          <span
            className="font-display text-[clamp(28px,5.5vw,40px)] leading-none"
            style={{ color }}
          >
            {value}
          </span>
          <div className="opacity-40 group-hover:opacity-70 transition-opacity">
            {icon}
          </div>
        </div>
        <div className="flex items-center justify-between gap-1.5">
          <span className="text-[10px] sm:text-[11px] text-[var(--text-muted)] group-hover:text-[var(--text-dim)] transition-colors font-medium uppercase tracking-[0.6px]">
            {label}
          </span>
          {sublabel && (
            <span className="text-[10px] font-semibold text-[var(--user-rating)]">
              {sublabel}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

function RecentFilmRow({
  film_id,
  film_name,
  poster_url,
  year,
  rating,
}: {
  film_id: number;
  film_name: string;
  poster_url: string | null;
  year: number | null;
  rating?: number | null;
}) {
  const translatedName = useTranslate(film_name);
  const displayName = translatedName || film_name;

  return (
    <Link
      href={`/film/${film_id}`}
      className="no-underline group flex items-center gap-3 py-3 border-b border-[var(--border)] last:border-b-0 active:bg-[var(--bg-elevated)] transition-colors rounded-[4px]"
    >
      <PosterImage
        src={poster_url}
        alt={displayName}
        title={displayName}
        filmId={film_id}
        year={year}
        fallbackType="mini"
        className="w-9 h-[52px] sm:w-10 sm:h-[60px] rounded-[6px] overflow-hidden bg-[var(--bg-elevated)] flex-shrink-0 relative"
      />
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-semibold text-[var(--text)] group-hover:text-white truncate transition-colors leading-[1.3] m-0">
          {displayName}
        </p>
        <div className="flex items-center gap-2 mt-[2px]">
          {year && (
            <span className="text-[11px] text-[var(--text-muted)]">{year}</span>
          )}
          {typeof rating === "number" && rating > 0 && (
            <span className="inline-flex items-center gap-0.5 text-[11px] text-[#f5c518] font-medium">
              <Star size={9} fill="#f5c518" stroke="#f5c518" />
              {rating.toFixed(1)}
            </span>
          )}
        </div>
      </div>
      <ChevronRight
        size={13}
        stroke="var(--text-muted)"
        strokeWidth={2}
        className="flex-shrink-0 opacity-40 group-hover:opacity-70 transition-opacity"
      />
    </Link>
  );
}

function RatedFilmRow({
  entry,
  onEdit,
}: {
  entry: RatedFilmEntry;
  onEdit: (entry: RatedFilmEntry) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const translatedName = useTranslate(entry.film_name);
  const displayName = translatedName || entry.film_name;
  const verdict = getRatingVerdict(entry.user_rating);
  const hasBreakdown =
    entry.taste_breakdown && Object.keys(entry.taste_breakdown).length > 0;
  const hasTags = entry.taste_tags && entry.taste_tags.length > 0;
  const hasNote = Boolean(entry.review_note);
  const hasDetails = Boolean(hasBreakdown || hasTags || hasNote);

  return (
    <div className="border-b border-[var(--border)] last:border-b-0">
      <div className="flex items-center gap-3 py-2.5 sm:py-3">
        <Link
          href={`/film/${entry.film_id}`}
          className="no-underline group flex items-center gap-3 flex-1 min-w-0 active:opacity-80 transition-opacity"
        >
          <PosterImage
            src={entry.poster_url}
            alt={displayName}
            title={displayName}
            filmId={entry.film_id}
            year={entry.year}
            fallbackType="mini"
            className="w-9 h-[52px] sm:w-10 sm:h-[60px] rounded-[6px] overflow-hidden bg-[var(--bg-elevated)] flex-shrink-0 relative"
          />
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-semibold text-[var(--text)] group-hover:text-white truncate transition-colors leading-[1.3] m-0">
              {displayName}
            </p>
            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
              {entry.year && (
                <span className="text-[11px] text-[var(--text-muted)]">
                  {entry.year}
                </span>
              )}
              <span
                className="inline-flex items-center gap-1 px-1.5 py-[1px] rounded-[5px] text-[10px] font-bold"
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
                {entry.user_rating.toFixed(1)}
              </span>
              <span className="text-[10px] text-[var(--text-muted)] hidden sm:inline">
                {verdict.label}
              </span>
            </div>
          </div>
        </Link>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          {hasDetails && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              aria-expanded={expanded}
              title={expanded ? "Hide rating details" : "Show rating details"}
              className="h-7 px-2 rounded-[6px] bg-transparent border border-[var(--border)] hover:border-[var(--border-hover)] text-[10px] font-medium text-[var(--text-muted)] hover:text-[var(--text)] inline-flex items-center gap-1 cursor-pointer transition-colors"
            >
              <span className="hidden sm:inline">
                {expanded ? "Hide" : "Details"}
              </span>
              <ChevronDown
                size={12}
                className={`transition-transform duration-200 ${
                  expanded ? "rotate-180" : ""
                }`}
              />
            </button>
          )}
          <button
            type="button"
            onClick={() => onEdit(entry)}
            title="Edit your rating"
            aria-label={`Edit rating for ${displayName}`}
            className="w-7 h-7 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-[6px] cursor-pointer text-[var(--text-dim)] hover:text-[var(--user-rating)] hover:border-[var(--user-rating-border)] transition-colors flex items-center justify-center"
          >
            <Pencil size={11} strokeWidth={2.2} />
          </button>
        </div>
      </div>

      {expanded && hasDetails && (
        <div className="pb-3 pt-0.5 pl-12 pr-1 flex flex-col gap-1.5 slide-down">
          {hasBreakdown && (
            <div className="flex items-center gap-1.5 flex-wrap">
              {TASTE_DIMENSIONS.map((dim) => {
                const val = entry.taste_breakdown?.[dim.key];
                if (val === undefined) return null;
                return (
                  <span
                    key={dim.key}
                    className="text-[10px] text-[var(--text-muted)] bg-[var(--bg-elevated)] border border-[var(--border)] px-1.5 py-[1px] rounded-[4px]"
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
              {entry.taste_tags!.map((tag) => (
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
              &ldquo;{entry.review_note}&rdquo;
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function sortSectionItems<T extends FilmListEntry>(
  list: T[],
  sortMode: SectionPreviewSort,
): T[] {
  const copy = [...list];
  if (sortMode === "RATING") {
    return copy.sort((a, b) => {
      const rA =
        "user_rating" in a && typeof a.user_rating === "number"
          ? a.user_rating
          : (a.rating ?? 0);
      const rB =
        "user_rating" in b && typeof b.user_rating === "number"
          ? b.user_rating
          : (b.rating ?? 0);
      return rB - rA;
    });
  }
  if (sortMode === "YEAR") {
    return copy.sort((a, b) => (b.year ?? 0) - (a.year ?? 0));
  }
  if (sortMode === "TITLE") {
    return copy.sort((a, b) => a.film_name.localeCompare(b.film_name));
  }
  return copy.sort((a, b) => {
    const dA =
      "updated_at" in a && typeof a.updated_at === "string"
        ? a.updated_at
        : a.added_at;
    const dB =
      "updated_at" in b && typeof b.updated_at === "string"
        ? b.updated_at
        : b.added_at;
    return (new Date(dB).getTime() || 0) - (new Date(dA).getTime() || 0);
  });
}

const SECTION_META: Record<
  ProfileSectionKey,
  {
    title: string;
    statLabel: string;
    href: string;
    color: string;
    icon: React.ReactNode;
    statIcon: React.ReactNode;
  }
> = {
  ratings: {
    title: "My Ratings",
    statLabel: "My Ratings",
    href: "/profile/ratings",
    color: "var(--user-rating)",
    icon: (
      <Star
        size={14}
        fill="var(--user-rating)"
        stroke="var(--user-rating)"
        strokeWidth={2}
      />
    ),
    statIcon: (
      <Star
        size={20}
        fill="var(--user-rating)"
        stroke="var(--user-rating)"
        strokeWidth={1.5}
      />
    ),
  },
  history: {
    title: "Recently Watched",
    statLabel: "Watched",
    href: "/profile/history",
    color: "#22c55e",
    icon: <History size={14} stroke="#22c55e" strokeWidth={2} />,
    statIcon: <History size={20} stroke="#22c55e" strokeWidth={1.5} />,
  },
  favorites: {
    title: "Favorites",
    statLabel: "Favorites",
    href: "/profile/favorites",
    color: "var(--accent)",
    icon: (
      <Heart
        size={14}
        fill="var(--accent)"
        stroke="var(--accent)"
        strokeWidth={2}
      />
    ),
    statIcon: (
      <Heart
        size={20}
        fill="var(--accent)"
        stroke="var(--accent)"
        strokeWidth={1.5}
      />
    ),
  },
  watchlater: {
    title: "Watch Later",
    statLabel: "Watch Later",
    href: "/profile/watchlater",
    color: "#60a5fa",
    icon: <Clock size={14} stroke="#60a5fa" strokeWidth={2} />,
    statIcon: <Clock size={20} stroke="#60a5fa" strokeWidth={1.5} />,
  },
};

export default function ProfileClient() {
  useDocumentTitle("Profile");

  const [noKey, setNoKey] = useState(false);
  const [name, setName] = useState("");
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [, setMeta] = useState<SessionMeta | null>(null);
  const [counts, setCounts] = useState<Record<ProfileSectionKey, number>>({
    favorites: 0,
    watchlater: 0,
    history: 0,
    ratings: 0,
  });
  const [allHistory, setAllHistory] = useState<FilmListEntry[]>([]);
  const [allFavs, setAllFavs] = useState<FilmListEntry[]>([]);
  const [allWL, setAllWL] = useState<FilmListEntry[]>([]);
  const [allRatings, setAllRatings] = useState<RatedFilmEntry[]>([]);
  const [, setTasteStats] = useState<TasteStats>({
    count: 0,
    avgRating: 0,
    topTags: [],
    highestRated: null,
  });

  const [sectionOrder, setSectionOrder] = useState<ProfileSectionKey[]>(() =>
    getProfileSectionOrder(),
  );
  const [sectionSorts, setSectionSorts] = useState<
    Record<ProfileSectionKey, SectionPreviewSort>
  >(() => ({
    ratings: getProfileSectionSort("ratings"),
    history: getProfileSectionSort("history"),
    favorites: getProfileSectionSort("favorites"),
    watchlater: getProfileSectionSort("watchlater"),
  }));
  const [reorderDrawerOpen, setReorderDrawerOpen] = useState(false);

  const [editingFilm, setEditingFilm] = useState<RateFilmTarget | null>(null);
  const { toast } = useToast();

  const clearDisplayedLists = () => {
    setCounts({ favorites: 0, watchlater: 0, history: 0, ratings: 0 });
    setAllHistory([]);
    setAllFavs([]);
    setAllWL([]);
    setAllRatings([]);
    setTasteStats({ count: 0, avgRating: 0, topTags: [], highestRated: null });
  };

  const refresh = () => {
    if (!hasApiKeys()) {
      setNoKey(true);
      clearDisplayedLists();
      return;
    }
    const n = getSessionName();
    const s = getSession();
    const rated = getRatedFilms();
    const hist = getList("history");
    const favs = getList("favorites");
    const wl = getList("watchlater");
    setName(n);
    setNameInput(n);
    setMeta(s.meta);
    setCounts({
      favorites: favs.length,
      watchlater: wl.length,
      history: hist.length,
      ratings: rated.length,
    });
    setAllHistory(hist);
    setAllFavs(favs);
    setAllWL(wl);
    setAllRatings(rated);
    setTasteStats(getTasteStats());
    setSectionOrder(getProfileSectionOrder());
    setSectionSorts({
      ratings: getProfileSectionSort("ratings"),
      history: getProfileSectionSort("history"),
      favorites: getProfileSectionSort("favorites"),
      watchlater: getProfileSectionSort("watchlater"),
    });
  };

  useEffect(() => {
    let mounted = true;
    const syncProfile = () => {
      if (!hasApiKeys()) {
        setNoKey(true);
        clearDisplayedLists();
        return;
      }
      if (hasVerifiedApiKey()) {
        setNoKey(false);
        refresh();
        return;
      }
      clearDisplayedLists();
      verifyApiKeys().then((valid) => {
        if (!mounted) return;
        if (!valid || !hasApiKeys()) {
          setNoKey(true);
          clearDisplayedLists();
        } else {
          setNoKey(false);
          refresh();
        }
      });
    };

    syncProfile();
    window.addEventListener("cinemix-session-change", syncProfile);
    window.addEventListener("storage", syncProfile);
    return () => {
      mounted = false;
      window.removeEventListener("cinemix-session-change", syncProfile);
      window.removeEventListener("storage", syncProfile);
    };
  }, []);

  const handleSaveName = () => {
    saveSessionName(nameInput);
    setName(nameInput.trim());
    setEditingName(false);
    toast.success("Name saved!");
  };

  const handleMoveSection = (key: ProfileSectionKey, dir: -1 | 1) => {
    const idx = sectionOrder.indexOf(key);
    if (idx === -1) return;
    const targetIdx = idx + dir;
    if (targetIdx < 0 || targetIdx >= sectionOrder.length) return;
    const next = [...sectionOrder];
    [next[idx], next[targetIdx]] = [next[targetIdx], next[idx]];
    setSectionOrder(next);
    saveProfileSectionOrder(next);
  };

  const handleMoveVisibleSection = (key: ProfileSectionKey, dir: -1 | 1) => {
    const visibleKeys = sectionOrder.filter((k) => counts[k] > 0);
    const visIdx = visibleKeys.indexOf(key);
    if (visIdx === -1) return;
    const swapTargetKey = visibleKeys[visIdx + dir];
    if (!swapTargetKey) return;

    const idxA = sectionOrder.indexOf(key);
    const idxB = sectionOrder.indexOf(swapTargetKey);
    if (idxA === -1 || idxB === -1) return;

    const next = [...sectionOrder];
    [next[idxA], next[idxB]] = [next[idxB], next[idxA]];
    setSectionOrder(next);
    saveProfileSectionOrder(next);
  };

  const handleResetSectionOrder = () => {
    const def = [...DEFAULT_PROFILE_SECTION_ORDER];
    setSectionOrder(def);
    saveProfileSectionOrder(def);
    toast.info("Section order reset to default.");
  };

  const handleChangeSectionSort = (
    key: ProfileSectionKey,
    sort: SectionPreviewSort,
  ) => {
    setSectionSorts((prev) => ({ ...prev, [key]: sort }));
    saveProfileSectionSort(key, sort);
  };

  const visibleSections = useMemo(
    () => sectionOrder.filter((k) => counts[k] > 0),
    [sectionOrder, counts],
  );

  if (noKey) return <NoKeyBanner />;

  const displayName = name || "Guest";
  const initial = displayName[0].toUpperCase();

  return (
    <PageContainer variant="narrow" className="sm:pb-28">
      {/* ── Avatar + Name ── */}
      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-lg)] p-5 sm:p-6 mb-4 flex items-center gap-4 sm:gap-5">
        <div className="relative flex-shrink-0">
          <div className="w-[60px] h-[60px] sm:w-[68px] sm:h-[68px] rounded-full bg-[var(--accent)] flex items-center justify-center">
            <span className="font-display text-[28px] sm:text-[32px] text-white leading-none">
              {initial}
            </span>
          </div>
          <span className="absolute bottom-0.5 right-0.5 w-3 h-3 rounded-full bg-[#22c55e] border-2 border-[var(--bg-card)]" />
        </div>

        <div className="flex-1 min-w-0">
          {editingName ? (
            <div className="flex items-center gap-2 flex-wrap">
              <input
                autoFocus
                type="text"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSaveName();
                  if (e.key === "Escape") setEditingName(false);
                }}
                placeholder="Your name"
                maxLength={40}
                className="flex-1 min-w-0 bg-[var(--bg-elevated)] border border-[rgba(229,9,20,0.4)] rounded-[var(--radius)] px-3 py-2 text-[14px] text-[var(--text)] outline-none"
              />
              <button
                type="button"
                onClick={handleSaveName}
                className="bg-[var(--accent)] text-white border-none rounded-[var(--radius)] px-4 py-2 text-[12px] font-bold cursor-pointer hover:opacity-90 whitespace-nowrap min-h-[38px]"
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => setEditingName(false)}
                className="bg-[var(--bg-elevated)] border border-[var(--border)] text-[var(--text-dim)] rounded-[var(--radius)] px-3 py-2 text-[12px] cursor-pointer hover:border-[var(--border-hover)] whitespace-nowrap min-h-[38px]"
              >
                Cancel
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-[17px] sm:text-[19px] font-semibold text-[var(--text)] truncate">
                {displayName}
              </span>
              <button
                type="button"
                onClick={() => setEditingName(true)}
                className="flex-shrink-0 bg-transparent border border-[var(--border)] rounded-[6px] p-[6px] cursor-pointer text-[var(--text-muted)] hover:text-[var(--accent)] hover:border-[rgba(229,9,20,0.4)] transition-colors min-w-[32px] min-h-[32px] flex items-center justify-center"
                aria-label="Edit name"
              >
                <Pencil size={12} strokeWidth={2.5} />
              </button>
            </div>
          )}
          {!editingName && (
            <p className="text-[11px] text-[var(--text-muted)] mt-1">
              {name
                ? "Local profile · data stored on this device"
                : "Tap the pencil to set your name"}
            </p>
          )}
        </div>
      </div>

      {/* ── Stats (Ordered according to user's section priority) ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4 items-stretch">
        {sectionOrder.map((key) => {
          const meta = SECTION_META[key];
          return (
            <StatCard
              key={key}
              label={meta.statLabel}
              value={counts[key]}
              href={meta.href}
              color={meta.color}
              icon={meta.statIcon}
            />
          );
        })}
      </div>

      {/* ── Section Order Customizer Bar ── */}
      <div className="flex items-center justify-between gap-2 mb-3 px-1">
        <span className="text-[11px] font-semibold uppercase tracking-[0.8px] text-[var(--text-muted)]">
          Library Sections
        </span>
        <button
          type="button"
          onClick={() => setReorderDrawerOpen((v) => !v)}
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[7px] text-[11px] font-semibold border cursor-pointer transition-colors ${
            reorderDrawerOpen
              ? "bg-[var(--accent-dim)] border-[var(--accent)] text-white"
              : "bg-[var(--bg-card)] border-[var(--border)] text-[var(--text-dim)] hover:text-white"
          }`}
        >
          <ArrowUpDown size={11} />
          <span>
            {reorderDrawerOpen ? "Done Ordering" : "Reorder Sections"}
          </span>
        </button>
      </div>

      {reorderDrawerOpen && (
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-lg)] p-3.5 sm:p-4 mb-4 slide-down">
          <div className="flex items-center justify-between gap-2 mb-2.5">
            <p className="text-[12px] text-[var(--text-dim)] m-0">
              Arrange the order of your sections &amp; stat cards on Profile:
            </p>
            <button
              type="button"
              onClick={handleResetSectionOrder}
              className="text-[11px] text-[var(--text-muted)] hover:text-white inline-flex items-center gap-1 bg-transparent border-none cursor-pointer"
            >
              <RotateCcw size={11} />
              Reset
            </button>
          </div>
          <div className="flex flex-col gap-1.5">
            {sectionOrder.map((key, idx) => {
              const meta = SECTION_META[key];
              return (
                <div
                  key={key}
                  className="flex items-center justify-between gap-3 px-3 py-2 rounded-[8px] bg-[var(--bg-elevated)] border border-[var(--border)]"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="text-[11px] font-mono text-[var(--text-muted)] w-4">
                      {idx + 1}.
                    </span>
                    {meta.icon}
                    <span className="text-[12.5px] font-semibold text-[var(--text)] truncate">
                      {meta.title}
                    </span>
                    <span className="text-[11px] text-[var(--text-muted)]">
                      ({counts[key]})
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => handleMoveSection(key, -1)}
                      aria-label={`Move ${meta.title} up`}
                      className="w-7 h-7 rounded-[6px] border border-[var(--border)] bg-[var(--bg-card)] text-[var(--text-dim)] hover:text-white disabled:opacity-30 disabled:pointer-events-none flex items-center justify-center cursor-pointer"
                    >
                      <ArrowUp size={13} />
                    </button>
                    <button
                      type="button"
                      disabled={idx === sectionOrder.length - 1}
                      onClick={() => handleMoveSection(key, 1)}
                      aria-label={`Move ${meta.title} down`}
                      className="w-7 h-7 rounded-[6px] border border-[var(--border)] bg-[var(--bg-card)] text-[var(--text-dim)] hover:text-white disabled:opacity-30 disabled:pointer-events-none flex items-center justify-center cursor-pointer"
                    >
                      <ArrowDown size={13} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Ordered Profile Sections ── */}
      {visibleSections.map((key, visIdx) => {
        const meta = SECTION_META[key];
        const sortMode = sectionSorts[key] || "RECENT";
        const isFirst = visIdx === 0;
        const isLast = visIdx === visibleSections.length - 1;

        if (key === "ratings") {
          const sortedRatings = sortSectionItems(allRatings, sortMode).slice(
            0,
            5,
          );
          if (sortedRatings.length === 0) return null;
          return (
            <div
              key={key}
              className="bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-lg)] overflow-hidden mb-4"
            >
              <div className="flex items-center justify-between gap-2 px-4 sm:px-5 py-[11px] border-b border-[var(--border)]">
                <Link
                  href={meta.href}
                  className="flex items-center gap-2 no-underline min-w-0"
                >
                  {meta.icon}
                  <span className="text-[11px] font-semibold uppercase tracking-[0.8px] text-[var(--text-dim)] truncate">
                    {meta.title}
                  </span>
                </Link>

                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <select
                    value={sortMode}
                    onChange={(e) =>
                      handleChangeSectionSort(
                        key,
                        e.target.value as SectionPreviewSort,
                      )
                    }
                    aria-label={`Sort ${meta.title}`}
                    className="bg-[var(--bg-elevated)] border border-[var(--border)] rounded-[6px] text-[10.5px] text-[var(--text-dim)] px-2 py-1 outline-none cursor-pointer"
                  >
                    <option value="RECENT">Recent</option>
                    <option value="RATING">Top Rated</option>
                    <option value="YEAR">Year</option>
                    <option value="TITLE">Title A–Z</option>
                  </select>

                  {visibleSections.length > 1 && (
                    <div className="inline-flex items-center gap-0.5">
                      <button
                        type="button"
                        disabled={isFirst}
                        onClick={() => handleMoveVisibleSection(key, -1)}
                        title="Move section up"
                        aria-label={`Move ${meta.title} up`}
                        className="w-6 h-6 rounded-[5px] bg-[var(--bg-elevated)] border border-[var(--border)] text-[var(--text-muted)] hover:text-white disabled:opacity-30 disabled:pointer-events-none flex items-center justify-center cursor-pointer"
                      >
                        <ArrowUp size={11} />
                      </button>
                      <button
                        type="button"
                        disabled={isLast}
                        onClick={() => handleMoveVisibleSection(key, 1)}
                        title="Move section down"
                        aria-label={`Move ${meta.title} down`}
                        className="w-6 h-6 rounded-[5px] bg-[var(--bg-elevated)] border border-[var(--border)] text-[var(--text-muted)] hover:text-white disabled:opacity-30 disabled:pointer-events-none flex items-center justify-center cursor-pointer"
                      >
                        <ArrowDown size={11} />
                      </button>
                    </div>
                  )}

                  <Link
                    href={meta.href}
                    className="text-[11px] text-[var(--accent)] hover:underline font-medium no-underline ml-1"
                  >
                    See all
                  </Link>
                </div>
              </div>

              <div className="px-4 sm:px-5">
                {sortedRatings.map((entry) => (
                  <RatedFilmRow
                    key={entry.film_id}
                    entry={entry}
                    onEdit={(e) =>
                      setEditingFilm({
                        film_id: e.film_id,
                        film_name: e.film_name,
                        poster_url: e.poster_url,
                        year: e.year,
                        rating: e.rating,
                      })
                    }
                  />
                ))}
              </div>
            </div>
          );
        }

        const rawItems =
          key === "history"
            ? allHistory
            : key === "favorites"
              ? allFavs
              : allWL;
        const sortedItems = sortSectionItems(rawItems, sortMode).slice(0, 5);
        if (sortedItems.length === 0) return null;

        return (
          <div
            key={key}
            className="bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-lg)] overflow-hidden mb-4"
          >
            <div className="flex items-center justify-between gap-2 px-4 sm:px-5 py-[11px] border-b border-[var(--border)]">
              <Link
                href={meta.href}
                className="flex items-center gap-2 no-underline min-w-0"
              >
                {meta.icon}
                <span className="text-[11px] font-semibold uppercase tracking-[0.8px] text-[var(--text-dim)] truncate">
                  {meta.title}
                </span>
              </Link>

              <div className="flex items-center gap-1.5 flex-shrink-0">
                <select
                  value={sortMode}
                  onChange={(e) =>
                    handleChangeSectionSort(
                      key,
                      e.target.value as SectionPreviewSort,
                    )
                  }
                  aria-label={`Sort ${meta.title}`}
                  className="bg-[var(--bg-elevated)] border border-[var(--border)] rounded-[6px] text-[10.5px] text-[var(--text-dim)] px-2 py-1 outline-none cursor-pointer"
                >
                  <option value="RECENT">Recent</option>
                  <option value="RATING">Top Rated</option>
                  <option value="YEAR">Year</option>
                  <option value="TITLE">Title A–Z</option>
                </select>

                {visibleSections.length > 1 && (
                  <div className="inline-flex items-center gap-0.5">
                    <button
                      type="button"
                      disabled={isFirst}
                      onClick={() => handleMoveVisibleSection(key, -1)}
                      title="Move section up"
                      aria-label={`Move ${meta.title} up`}
                      className="w-6 h-6 rounded-[5px] bg-[var(--bg-elevated)] border border-[var(--border)] text-[var(--text-muted)] hover:text-white disabled:opacity-30 disabled:pointer-events-none flex items-center justify-center cursor-pointer"
                    >
                      <ArrowUp size={11} />
                    </button>
                    <button
                      type="button"
                      disabled={isLast}
                      onClick={() => handleMoveVisibleSection(key, 1)}
                      title="Move section down"
                      aria-label={`Move ${meta.title} down`}
                      className="w-6 h-6 rounded-[5px] bg-[var(--bg-elevated)] border border-[var(--border)] text-[var(--text-muted)] hover:text-white disabled:opacity-30 disabled:pointer-events-none flex items-center justify-center cursor-pointer"
                    >
                      <ArrowDown size={11} />
                    </button>
                  </div>
                )}

                <Link
                  href={meta.href}
                  className="text-[11px] text-[var(--accent)] hover:underline font-medium no-underline ml-1"
                >
                  See all
                </Link>
              </div>
            </div>

            <div className="px-4 sm:px-5">
              {sortedItems.map((f) => (
                <RecentFilmRow key={f.film_id} {...f} />
              ))}
            </div>
          </div>
        );
      })}

      <RateFilmModal
        open={editingFilm !== null}
        onClose={() => setEditingFilm(null)}
        film={editingFilm}
        onSaved={() => refresh()}
      />
    </PageContainer>
  );
}
