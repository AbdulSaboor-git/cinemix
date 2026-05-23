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
import Image from "next/image";

function StatCard({
  label,
  value,
  href,
  color = "var(--accent)",
}: {
  label: string;
  value: number;
  href: string;
  color?: string;
}) {
  return (
    <Link href={href} className="no-underline group">
      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-lg)] p-4 sm:p-5 flex flex-col gap-1 transition-all duration-150 hover:border-[rgba(229,9,20,0.35)] hover:shadow-[0_8px_32px_rgba(0,0,0,0.4)] cursor-pointer">
        <span
          className="font-display text-[clamp(28px,6vw,40px)] leading-none"
          style={{ color }}
        >
          {value}
        </span>
        <span className="text-[12px] text-[var(--text-muted)] group-hover:text-[var(--text-dim)] transition-colors">
          {label}
        </span>
      </div>
    </Link>
  );
}

function RecentFilmRow({ film_id, film_name, poster_url, year }: {
  film_id: number; film_name: string; poster_url: string | null; year: number | null;
}) {
  const [imgErr, setImgErr] = useState(false);
  return (
    <Link href={`/film/${film_id}`} className="no-underline group flex items-center gap-3 py-[10px] border-b border-[var(--border)] last:border-b-0">
      <div className="w-8 h-12 rounded-[6px] overflow-hidden bg-[var(--bg-elevated)] flex-shrink-0">
        {poster_url && !imgErr ? (
          <img src={poster_url} alt={film_name} className="w-full h-full object-cover" onError={() => setImgErr(true)} />
        ) : (
          <div className="w-full h-full bg-[var(--surface)] flex items-center justify-center">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2"><rect x="2" y="2" width="20" height="20" rx="2" /><path d="M7 2v20M17 2v20M2 12h20" /></svg>
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-medium text-[var(--text)] group-hover:text-white truncate transition-colors">{film_name}</p>
        {year && <p className="text-[11px] text-[var(--text-muted)]">{year}</p>}
      </div>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" className="flex-shrink-0"><polyline points="9 18 15 12 9 6" /></svg>
    </Link>
  );
}

export default function ProfileClient() {
  const [name, setName] = useState("");
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [meta, setMeta] = useState<SessionMeta | null>(null);
  const [counts, setCounts] = useState({ favorites: 0, watchlater: 0, history: 0 });
  const [recentHistory, setRecentHistory] = useState<ReturnType<typeof getList>>([]);
  const [recentFavs, setRecentFavs] = useState<ReturnType<typeof getList>>([]);
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
  };

  useEffect(() => { refresh(); }, []);

  const handleSaveName = () => {
    saveSessionName(nameInput);
    setName(nameInput.trim());
    setEditingName(false);
    toast.success("Name saved!");
  };

  const displayName = name || "Guest";
  const initial = displayName[0].toUpperCase();

  const handleClearHistory = () => {
    if (!confirm("Clear all watch history? This can't be undone.")) return;
    clearHistory();
    refresh();
    toast.info("Watch history cleared.");
  };

  const handleClearFavs = () => {
    if (!confirm("Clear all favorites?")) return;
    clearFavorites();
    refresh();
    toast.info("Favorites cleared.");
  };

  const handleClearWL = () => {
    if (!confirm("Clear watch later list?")) return;
    clearWatchLater();
    refresh();
    toast.info("Watch Later cleared.");
  };

  return (
    <div className="min-h-screen px-4 sm:px-[clamp(16px,5vw,48px)] py-8 sm:py-12 pb-24">
      <div className="max-w-[760px] mx-auto">

        {/* ── Header ── */}
        <div className="mb-8 pb-6 border-b border-[var(--border)]">
          <div className="flex items-center gap-3 mb-1">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
            </svg>
            <h1 className="font-display tracking-[2px] text-[var(--text)] m-0 text-[clamp(20px,4vw,34px)]">PROFILE</h1>
          </div>
          <p className="text-[12px] sm:text-[13px] text-[var(--text-muted)] ml-7 sm:ml-8">Your lists and identity — all stored locally.</p>
        </div>

        {/* ── Avatar + Name ── */}
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-lg)] p-5 sm:p-6 mb-5 flex items-center gap-4 sm:gap-5">
          <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-[var(--accent)] flex items-center justify-center flex-shrink-0 shadow-[0_0_24px_var(--accent-glow)]">
            <span className="font-display text-[clamp(22px,4vw,28px)] text-white">{initial}</span>
          </div>
          <div className="flex-1 min-w-0">
            {editingName ? (
              <div className="flex items-center gap-2 flex-wrap">
                <input
                  autoFocus
                  type="text"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleSaveName(); if (e.key === "Escape") setEditingName(false); }}
                  placeholder="Your name"
                  maxLength={40}
                  className="flex-1 min-w-0 bg-[var(--bg-elevated)] border border-[rgba(229,9,20,0.4)] rounded-[var(--radius)] px-3 py-[7px] text-[14px] text-[var(--text)] outline-none"
                />
                <button onClick={handleSaveName} className="bg-[var(--accent)] text-white border-none rounded-[var(--radius)] px-4 py-[7px] text-[12px] font-bold cursor-pointer hover:opacity-90 whitespace-nowrap">Save</button>
                <button onClick={() => setEditingName(false)} className="bg-[var(--bg-elevated)] border border-[var(--border)] text-[var(--text-dim)] rounded-[var(--radius)] px-3 py-[7px] text-[12px] cursor-pointer hover:border-[var(--border-hover)] whitespace-nowrap">Cancel</button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-[16px] sm:text-[18px] font-semibold text-[var(--text)] truncate">{displayName}</span>
                <button onClick={() => setEditingName(true)} className="flex-shrink-0 bg-transparent border border-[var(--border)] rounded-[6px] p-[5px] cursor-pointer text-[var(--text-muted)] hover:text-[var(--accent)] hover:border-[rgba(229,9,20,0.4)] transition-colors">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                </button>
              </div>
            )}
            {!editingName && (
              <p className="text-[11px] text-[var(--text-muted)] mt-[3px]">
                {name ? "Tap the pencil to change your name" : "Add your name to personalize your lists"}
              </p>
            )}
          </div>
        </div>

        {/* ── Stats ── */}
        <div className="grid grid-cols-3 gap-3 mb-5">
          <StatCard label="Favorites" value={counts.favorites} href="/profile/favorites" color="var(--accent)" />
          <StatCard label="Watch Later" value={counts.watchlater} href="/profile/watchlater" color="#60a5fa" />
          <StatCard label="Watched" value={counts.history} href="/profile/history" color="#22c55e" />
        </div>

        {/* ── Recent History ── */}
        {recentHistory.length > 0 && (
          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-lg)] overflow-hidden mb-5">
            <div className="flex items-center justify-between px-4 sm:px-5 py-[14px] border-b border-[var(--border)]">
              <div className="flex items-center gap-2">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                <span className="text-[12px] font-semibold uppercase tracking-[0.8px] text-[var(--text-dim)]">Recently Watched</span>
              </div>
              <Link href="/profile/history" className="text-[11px] text-[var(--accent)] no-underline hover:underline font-medium">See all →</Link>
            </div>
            <div className="px-4 sm:px-5">
              {recentHistory.map((f) => <RecentFilmRow key={f.film_id} {...f} />)}
            </div>
          </div>
        )}

        {/* ── Recent Favorites ── */}
        {recentFavs.length > 0 && (
          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-lg)] overflow-hidden mb-5">
            <div className="flex items-center justify-between px-4 sm:px-5 py-[14px] border-b border-[var(--border)]">
              <div className="flex items-center gap-2">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="var(--accent)" stroke="var(--accent)" strokeWidth="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" /></svg>
                <span className="text-[12px] font-semibold uppercase tracking-[0.8px] text-[var(--text-dim)]">Favorites</span>
              </div>
              <Link href="/profile/favorites" className="text-[11px] text-[var(--accent)] no-underline hover:underline font-medium">See all →</Link>
            </div>
            <div className="px-4 sm:px-5">
              {recentFavs.map((f) => <RecentFilmRow key={f.film_id} {...f} />)}
            </div>
          </div>
        )}

        {/* ── Session Info ── */}
        {meta && (
          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-lg)] overflow-hidden mb-5">
            <div className="flex items-center gap-2 px-4 sm:px-5 py-[14px] border-b border-[var(--border)]">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" /></svg>
              <span className="text-[12px] font-semibold uppercase tracking-[0.8px] text-[var(--text-dim)]">Session Info</span>
            </div>
            <div className="px-4 sm:px-5 py-3 grid grid-cols-2 gap-x-4 gap-y-[10px]">
              {[
                ["Session ID", meta.id],
                ["Device", meta.device],
                ["Browser", meta.browser],
                ...(meta.country ? [["Location", `${meta.city ? meta.city + ", " : ""}${meta.country}`]] : []),
                ["Member since", new Date(meta.created_at).toLocaleDateString()],
              ].map(([k, v]) => (
                <div key={k}>
                  <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-[0.5px] mb-[2px]">{k}</p>
                  <p className="text-[12px] text-[var(--text)] font-mono truncate">{v}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Danger zone ── */}
        <div className="bg-[var(--bg-card)] border border-[rgba(229,9,20,0.2)] rounded-[var(--radius-lg)] overflow-hidden">
          <div className="flex items-center gap-2 px-4 sm:px-5 py-[14px] border-b border-[var(--border)]">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
            <span className="text-[12px] font-semibold uppercase tracking-[0.8px] text-[var(--text-dim)]">Data Management</span>
          </div>
          <div className="p-4 sm:p-5 flex flex-col sm:flex-row gap-3">
            <button onClick={handleClearHistory} className="flex-1 bg-transparent border border-[var(--border)] text-[var(--text-muted)] rounded-[var(--radius)] px-4 py-[9px] text-[12px] font-medium cursor-pointer hover:border-[rgba(229,9,20,0.4)] hover:text-[var(--accent)] transition-all">
              Clear History
            </button>
            <button onClick={handleClearFavs} className="flex-1 bg-transparent border border-[var(--border)] text-[var(--text-muted)] rounded-[var(--radius)] px-4 py-[9px] text-[12px] font-medium cursor-pointer hover:border-[rgba(229,9,20,0.4)] hover:text-[var(--accent)] transition-all">
              Clear Favorites
            </button>
            <button onClick={handleClearWL} className="flex-1 bg-transparent border border-[var(--border)] text-[var(--text-muted)] rounded-[var(--radius)] px-4 py-[9px] text-[12px] font-medium cursor-pointer hover:border-[rgba(229,9,20,0.4)] hover:text-[var(--accent)] transition-all">
              Clear Watch Later
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
