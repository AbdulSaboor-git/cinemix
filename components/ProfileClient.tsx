// ProfileClient.tsx
"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import {
  getSession,
  getSessionName,
  saveSessionName,
  SessionMeta,
} from "@/lib/session";
import {
  getList,
  clearFavorites,
  clearWatchLater,
  clearHistory,
} from "@/lib/userLists";
import { useToast } from "@/lib/toast";

function StatCard({
  label,
  value,
  href,
  color = "var(--accent)",
  icon,
}: {
  label: string;
  value: number;
  href: string;
  color?: string;
  icon: React.ReactNode;
}) {
  return (
    <Link href={href} className="no-underline group">
      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-lg)] p-4 sm:p-5 flex flex-col gap-2 transition-all duration-200 hover:border-[rgba(229,9,20,0.35)] hover:shadow-[0_8px_32px_rgba(0,0,0,0.4)] active:scale-[0.97] cursor-pointer">
        <div className="flex items-center justify-between">
          <span
            className="font-display text-[clamp(30px,6vw,42px)] leading-none"
            style={{ color }}
          >
            {value}
          </span>
          <div className="opacity-40 group-hover:opacity-70 transition-opacity">
            {icon}
          </div>
        </div>
        <span className="text-[11px] sm:text-[12px] text-[var(--text-muted)] group-hover:text-[var(--text-dim)] transition-colors font-medium uppercase tracking-[0.6px]">
          {label}
        </span>
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
  const [imgErr, setImgErr] = useState(false);
  return (
    <Link
      href={`/film/${film_id}`}
      className="no-underline group flex items-center gap-3 py-3 border-b border-[var(--border)] last:border-b-0 active:bg-[var(--bg-elevated)] transition-colors rounded-[4px]"
    >
      <div className="w-9 h-[52px] sm:w-10 sm:h-[60px] rounded-[6px] overflow-hidden bg-[var(--bg-elevated)] flex-shrink-0">
        {poster_url && !imgErr ? (
          <img
            src={poster_url}
            alt={film_name}
            className="w-full h-full object-cover"
            onError={() => setImgErr(true)}
          />
        ) : (
          <div className="w-full h-full bg-[var(--surface)] flex items-center justify-center">
            <svg
              width="12"
              height="12"
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
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-semibold text-[var(--text)] group-hover:text-white truncate transition-colors leading-[1.3]">
          {film_name}
        </p>
        {year && (
          <p className="text-[11px] text-[var(--text-muted)] mt-[2px]">
            {year}
          </p>
        )}
      </div>
      <svg
        width="13"
        height="13"
        viewBox="0 0 24 24"
        fill="none"
        stroke="var(--text-muted)"
        strokeWidth="2"
        className="flex-shrink-0 opacity-40 group-hover:opacity-70 transition-opacity"
      >
        <polyline points="9 18 15 12 9 6" />
      </svg>
    </Link>
  );
}

// Inline confirmation component — replaces ugly browser confirm()
function DangerButton({
  label,
  onConfirm,
}: {
  label: string;
  onConfirm: () => void;
}) {
  const [confirming, setConfirming] = useState(false);

  if (confirming) {
    return (
      <div className="flex-1 flex items-center gap-2">
        <button
          onClick={() => {
            onConfirm();
            setConfirming(false);
          }}
          className="flex-1 bg-[rgba(229,9,20,0.15)] border border-[rgba(229,9,20,0.5)] text-[var(--accent)] rounded-[var(--radius)] px-3 py-[10px] text-[12px] font-semibold cursor-pointer transition-all active:scale-95"
        >
          Confirm
        </button>
        <button
          onClick={() => setConfirming(false)}
          className="flex-1 bg-[var(--bg-elevated)] border border-[var(--border)] text-[var(--text-muted)] rounded-[var(--radius)] px-3 py-[10px] text-[12px] font-medium cursor-pointer hover:border-[var(--border-hover)] transition-all active:scale-95"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="flex-1 bg-transparent border border-[var(--border)] text-[var(--text-muted)] rounded-[var(--radius)] px-4 py-[10px] text-[12px] font-medium cursor-pointer hover:border-[rgba(229,9,20,0.4)] hover:text-[var(--accent)] transition-all active:scale-95 min-h-[44px]"
    >
      {label}
    </button>
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
      <div className="flex items-center justify-between px-4 sm:px-5 py-[13px] border-b border-[var(--border)]">
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-[11px] font-semibold uppercase tracking-[0.8px] text-[var(--text-dim)]">
            {title}
          </span>
        </div>
        <Link
          href={href}
          className="text-[11px] text-[var(--accent)] no-underline hover:underline font-medium"
        >
          See all →
        </Link>
      </div>
      <div className="px-4 sm:px-5">
        {items.map((f) => (
          <RecentFilmRow key={f.film_id} {...f} />
        ))}
      </div>
    </div>
  );
}

export default function ProfileClient() {
  const [name, setName] = useState("");
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [meta, setMeta] = useState<SessionMeta | null>(null);
  const [counts, setCounts] = useState({
    favorites: 0,
    watchlater: 0,
    history: 0,
  });
  const [recentHistory, setRecentHistory] = useState<
    ReturnType<typeof getList>
  >([]);
  const [recentFavs, setRecentFavs] = useState<ReturnType<typeof getList>>([]);
  const [recentWL, setRecentWL] = useState<ReturnType<typeof getList>>([]);
  const { toast } = useToast();

  const refresh = () => {
    const n = getSessionName();
    const s = getSession();
    setName(n);
    setNameInput(n);
    setMeta(s.meta);
    setCounts({
      favorites: getList("favorites").length,
      watchlater: getList("watchlater").length,
      history: getList("history").length,
    });
    setRecentHistory(getList("history").slice(0, 5));
    setRecentFavs(getList("favorites").slice(0, 5));
    // BUG FIX: was using recentFavs data for watch later section
    setRecentWL(getList("watchlater").slice(0, 5));
  };

  useEffect(() => {
    refresh();
  }, []);

  const handleSaveName = () => {
    saveSessionName(nameInput);
    setName(nameInput.trim());
    setEditingName(false);
    toast.success("Name saved!");
  };

  const displayName = name || "Guest";
  const initial = displayName[0].toUpperCase();

  return (
    <div className="min-h-screen px-4 sm:px-[clamp(16px,5vw,48px)] py-8 sm:py-10 pb-28">
      <div className="max-w-[720px] mx-auto">
        {/* ── Avatar + Name ── */}
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-lg)] p-5 sm:p-6 mb-4 flex items-center gap-4 sm:gap-5">
          {/* Avatar */}
          <div className="relative flex-shrink-0">
            <div className="w-[60px] h-[60px] sm:w-[68px] sm:h-[68px] rounded-full bg-[var(--accent)] flex items-center justify-center shadow-[0_0_28px_var(--accent-glow)]">
              <span className="font-display text-[28px] sm:text-[32px] text-white leading-none">
                {initial}
              </span>
            </div>
            {/* Online dot */}
            <span className="absolute bottom-0.5 right-0.5 w-3 h-3 rounded-full bg-[#22c55e] border-2 border-[var(--bg-card)]" />
          </div>

          {/* Name */}
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
                  onClick={handleSaveName}
                  className="bg-[var(--accent)] text-white border-none rounded-[var(--radius)] px-4 py-2 text-[12px] font-bold cursor-pointer hover:opacity-90 whitespace-nowrap min-h-[38px]"
                >
                  Save
                </button>
                <button
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
                  onClick={() => setEditingName(true)}
                  className="flex-shrink-0 bg-transparent border border-[var(--border)] rounded-[6px] p-[6px] cursor-pointer text-[var(--text-muted)] hover:text-[var(--accent)] hover:border-[rgba(229,9,20,0.4)] transition-colors min-w-[32px] min-h-[32px] flex items-center justify-center"
                  aria-label="Edit name"
                >
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                  >
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
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
        <div className="grid grid-cols-3 gap-3 mb-4">
          <StatCard
            label="Favorites"
            value={counts.favorites}
            href="/profile/favorites"
            color="var(--accent)"
            icon={
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="var(--accent)"
                stroke="var(--accent)"
                strokeWidth="1.5"
              >
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
              </svg>
            }
          />
          <StatCard
            label="Watch Later"
            value={counts.watchlater}
            href="/profile/watchlater"
            color="#60a5fa"
            icon={
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#60a5fa"
                strokeWidth="1.5"
              >
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            }
          />
          <StatCard
            label="Watched"
            value={counts.history}
            href="/profile/history"
            color="#22c55e"
            icon={
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#22c55e"
                strokeWidth="1.5"
              >
                <path d="M3 3v5h5" />
                <path d="M3.05 13A9 9 0 1 0 6 5.3L3 8" />
              </svg>
            }
          />
        </div>

        {/* ── Recent sections ── */}
        <SectionCard
          title="Recently Watched"
          icon={
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#22c55e"
              strokeWidth="2"
            >
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          }
          href="/profile/history"
          items={recentHistory}
        />
        <SectionCard
          title="Favorites"
          icon={
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="var(--accent)"
              stroke="var(--accent)"
              strokeWidth="2"
            >
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
          }
          href="/profile/favorites"
          items={recentFavs}
        />
        <SectionCard
          title="Watch Later"
          // BUG FIX: was using a heart icon here — now correctly uses clock
          icon={
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#60a5fa"
              strokeWidth="2"
            >
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          }
          href="/profile/watchlater"
          items={recentWL}
        />

        {/* ── Session Info ── */}
        {meta && (
          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-lg)] overflow-hidden mb-4">
            <div className="flex items-center gap-2 px-4 sm:px-5 py-[13px] border-b border-[var(--border)]">
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--text-muted)"
                strokeWidth="2"
              >
                <rect x="2" y="3" width="20" height="14" rx="2" />
                <line x1="8" y1="21" x2="16" y2="21" />
                <line x1="12" y1="17" x2="12" y2="21" />
              </svg>
              <span className="text-[11px] font-semibold uppercase tracking-[0.8px] text-[var(--text-dim)]">
                Session Info
              </span>
            </div>
            <div className="px-4 sm:px-5 py-4 grid grid-cols-2 gap-x-4 gap-y-4">
              {(
                [
                  ["Session ID", meta.id],
                  ["Device", meta.device],
                  ["Browser", meta.browser],
                  ...(meta.country
                    ? [
                        [
                          "Location",
                          `${meta.city ? meta.city + ", " : ""}${meta.country}`,
                        ],
                      ]
                    : []),
                  [
                    "Member since",
                    new Date(meta.created_at).toLocaleDateString(),
                  ],
                ] as [string, string][]
              ).map(([k, v]) => (
                <div key={k} className="min-w-0">
                  <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-[0.5px] mb-[3px]">
                    {k}
                  </p>
                  <p className="text-[12px] text-[var(--text)] font-mono truncate leading-[1.4]">
                    {v}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Data Management ── */}
        <div className="bg-[var(--bg-card)] border border-[rgba(229,9,20,0.15)] rounded-[var(--radius-lg)] overflow-hidden">
          <div className="flex items-center gap-2 px-4 sm:px-5 py-[13px] border-b border-[var(--border)]">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--accent)"
              strokeWidth="2"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span className="text-[11px] font-semibold uppercase tracking-[0.8px] text-[var(--text-dim)]">
              Data Management
            </span>
          </div>
          <div className="p-4 sm:p-5 flex flex-col sm:flex-row gap-3">
            <DangerButton
              label="Clear History"
              onConfirm={() => {
                clearHistory();
                refresh();
                toast.info("Watch history cleared.");
              }}
            />
            <DangerButton
              label="Clear Favorites"
              onConfirm={() => {
                clearFavorites();
                refresh();
                toast.info("Favorites cleared.");
              }}
            />
            <DangerButton
              label="Clear Watch Later"
              onConfirm={() => {
                clearWatchLater();
                refresh();
                toast.info("Watch Later cleared.");
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
