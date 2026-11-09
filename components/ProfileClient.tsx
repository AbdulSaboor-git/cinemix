"use client";
import { useState, useEffect } from "react";
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
} from "lucide-react";
import {
  getSession,
  getSessionName,
  saveSessionName,
  SessionMeta,
  RatedFilmEntry,
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
import { hasApiKeys, hasVerifiedApiKey } from "@/lib/preferences";
import { verifyApiKeys } from "@/lib/kinopoisk";
import PageContainer from "@/components/ui/PageContainer";
import PosterImage from "@/components/ui/PosterImage";
import NoKeyBanner from "@/components/ui/NoKeyBanner";
import RateFilmModal, { RateFilmTarget } from "@/components/RateFilmModal";

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
      <div className="h-full bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-lg)] p-4 sm:p-5 flex flex-col gap-2 transition-all duration-200 hover:border-[rgba(229,9,20,0.35)] hover:shadow-[0_8px_32px_rgba(0,0,0,0.4)] active:scale-[0.97] cursor-pointer">
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
}: {
  film_id: number;
  film_name: string;
  poster_url: string | null;
  year: number | null;
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
        <p className="text-[13px] font-semibold text-[var(--text)] group-hover:text-white truncate transition-colors leading-[1.3]">
          {displayName}
        </p>
        {year && (
          <p className="text-[11px] text-[var(--text-muted)] mt-[2px]">
            {year}
          </p>
        )}
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

function SectionCard({
  title,
  icon,
  href,
  items,
}: {
  title: string;
  icon: React.ReactNode;
  href: string;
  items: ReturnType<typeof getList>;
}) {
  if (items.length === 0) return null;
  return (
    <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-lg)] overflow-hidden mb-4">
      <Link
        href={href}
        className="flex items-center justify-between px-4 sm:px-5 py-[13px] border-b border-[var(--border)] no-underline"
      >
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-[11px] font-semibold uppercase tracking-[0.8px] text-[var(--text-dim)]">
            {title}
          </span>
        </div>
        <div className="text-[11px] text-[var(--accent)] hover:underline font-medium">
          See all
        </div>
      </Link>
      <div className="px-4 sm:px-5">
        {items.map((f) => (
          <RecentFilmRow key={f.film_id} {...f} />
        ))}
      </div>
    </div>
  );
}

export default function ProfileClient() {
  useDocumentTitle("Profile");

  const [noKey, setNoKey] = useState(false);
  const [name, setName] = useState("");
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [, setMeta] = useState<SessionMeta | null>(null);
  const [counts, setCounts] = useState({
    favorites: 0,
    watchlater: 0,
    history: 0,
    ratings: 0,
  });
  const [recentHistory, setRecentHistory] = useState<
    ReturnType<typeof getList>
  >([]);
  const [recentFavs, setRecentFavs] = useState<ReturnType<typeof getList>>([]);
  const [recentWL, setRecentWL] = useState<ReturnType<typeof getList>>([]);
  const [recentRatings, setRecentRatings] = useState<RatedFilmEntry[]>([]);
  const [tasteStats, setTasteStats] = useState<TasteStats>({
    count: 0,
    avgRating: 0,
    topTags: [],
    highestRated: null,
  });
  const [editingFilm, setEditingFilm] = useState<RateFilmTarget | null>(null);
  const { toast } = useToast();

  const clearDisplayedLists = () => {
    setCounts({ favorites: 0, watchlater: 0, history: 0, ratings: 0 });
    setRecentHistory([]);
    setRecentFavs([]);
    setRecentWL([]);
    setRecentRatings([]);
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
    setName(n);
    setNameInput(n);
    setMeta(s.meta);
    setCounts({
      favorites: getList("favorites").length,
      watchlater: getList("watchlater").length,
      history: getList("history").length,
      ratings: rated.length,
    });
    setRecentHistory(getList("history").slice(0, 5));
    setRecentFavs(getList("favorites").slice(0, 5));
    setRecentWL(getList("watchlater").slice(0, 5));
    setRecentRatings(rated.slice(0, 5));
    setTasteStats(getTasteStats());
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

  if (noKey) return <NoKeyBanner />;

  const displayName = name || "Guest";
  const initial = displayName[0].toUpperCase();

  return (
    <PageContainer variant="narrow" className="sm:pb-28">
      {/* ── Avatar + Name ── */}
      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-lg)] p-5 sm:p-6 mb-4 flex items-center gap-4 sm:gap-5">
        <div className="relative flex-shrink-0">
          <div className="w-[60px] h-[60px] sm:w-[68px] sm:h-[68px] rounded-full bg-[var(--accent)] flex items-center justify-center shadow-[0_0_28px_var(--accent-glow)]">
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

      {/* ── Stats ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4 items-stretch">
        <StatCard
          label="My Ratings"
          value={counts.ratings}
          // sublabel={
          //   tasteStats.count > 0
          //     ? `★ ${tasteStats.avgRating.toFixed(1)}`
          //     : undefined
          // }
          href="/profile/ratings"
          color="var(--user-rating)"
          icon={
            <Star
              size={20}
              fill="var(--user-rating)"
              stroke="var(--user-rating)"
              strokeWidth={1.5}
            />
          }
        />
        <StatCard
          label="Favorites"
          value={counts.favorites}
          href="/profile/favorites"
          color="var(--accent)"
          icon={
            <Heart
              size={20}
              fill="var(--accent)"
              stroke="var(--accent)"
              strokeWidth={1.5}
            />
          }
        />
        <StatCard
          label="Watch Later"
          value={counts.watchlater}
          href="/profile/watchlater"
          color="#60a5fa"
          icon={<Clock size={20} stroke="#60a5fa" strokeWidth={1.5} />}
        />
        <StatCard
          label="Watched"
          value={counts.history}
          href="/profile/history"
          color="#22c55e"
          icon={<History size={20} stroke="#22c55e" strokeWidth={1.5} />}
        />
      </div>

      {/* ── My Taste & Rated Movies Section (Minimal & Expandable) ── */}
      {recentRatings.length > 0 && (
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-lg)] overflow-hidden mb-4">
          <Link
            href="/profile/ratings"
            className="flex items-center justify-between px-4 sm:px-5 py-[13px] border-b border-[var(--border)] no-underline"
          >
            <div className="flex items-center gap-2">
              <Star
                size={14}
                fill="var(--user-rating)"
                stroke="var(--user-rating)"
                strokeWidth={2}
              />
              <span className="text-[11px] font-semibold uppercase tracking-[0.8px] text-[var(--text-dim)]">
                My Ratings
              </span>
              {/* {tasteStats.count > 0 && (
                <span className="text-[10px] font-semibold text-[var(--user-rating)] bg-[var(--user-rating-bg)] px-2 py-[1px] rounded-full">
                  ★ {tasteStats.avgRating.toFixed(1)} avg
                </span>
              )} */}
            </div>
            <div className="text-[11px] text-[var(--accent)] hover:underline font-medium">
              See all
            </div>
          </Link>

          <div className="px-4 sm:px-5">
            {recentRatings.map((entry) => (
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
      )}

      {/* ── Recent sections ── */}
      <SectionCard
        title="Recently Watched"
        icon={<History size={14} stroke="#22c55e" strokeWidth={2} />}
        href="/profile/history"
        items={recentHistory}
      />
      <SectionCard
        title="Favorites"
        icon={
          <Heart
            size={14}
            fill="var(--accent)"
            stroke="var(--accent)"
            strokeWidth={2}
          />
        }
        href="/profile/favorites"
        items={recentFavs}
      />
      <SectionCard
        title="Watch Later"
        icon={<Clock size={14} stroke="#60a5fa" strokeWidth={2} />}
        href="/profile/watchlater"
        items={recentWL}
      />

      <RateFilmModal
        open={editingFilm !== null}
        onClose={() => setEditingFilm(null)}
        film={editingFilm}
        onSaved={() => refresh()}
      />
    </PageContainer>
  );
}
