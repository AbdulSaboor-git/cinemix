"use client";
import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  Pencil,
  Heart,
  Clock,
  History,
  Monitor,
  CircleAlert,
  ChevronRight,
  Download,
  Upload,
} from "lucide-react";
import {
  getSession,
  getSessionName,
  saveSessionName,
  exportSessionBackup,
  importSessionBackup,
  SessionMeta,
} from "@/lib/session";
import {
  getList,
  clearFavorites,
  clearWatchLater,
  clearHistory,
} from "@/lib/userLists";
import { useTranslate } from "@/hooks/useTranslate";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { useToast } from "@/lib/toast";
import PageContainer from "@/components/ui/PageContainer";
import PosterImage from "@/components/ui/PosterImage";
import ConfirmButton from "@/components/ui/ConfirmButton";

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
    <Link href={href} className="no-underline group h-full">
      <div className="h-full bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-lg)] p-4 sm:p-5 flex flex-col gap-2 transition-all duration-200 hover:border-[rgba(229,9,20,0.35)] hover:shadow-[0_8px_32px_rgba(0,0,0,0.4)] active:scale-[0.97] cursor-pointer">
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
        <span className="text-[10px] sm:text-[12px] text-[var(--text-muted)] group-hover:text-[var(--text-dim)] transition-colors font-medium uppercase tracking-[0.6px]">
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
  const fileInputRef = useRef<HTMLInputElement>(null);
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

  const handleExportBackup = () => {
    try {
      const json = exportSessionBackup();
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const dateStr = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `cinemix-backup-${dateStr}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("Backup exported (.json)");
    } catch {
      toast.error("Failed to export session backup.");
    }
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const raw = String(reader.result || "");
      const res = importSessionBackup(raw);
      if (res.ok) {
        refresh();
        toast.success("Session backup restored!");
      } else {
        toast.error(res.error || "Invalid backup file.");
      }
      if (fileInputRef.current) fileInputRef.current.value = "";
    };
    reader.readAsText(file);
  };

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
      <div className="grid grid-cols-3 gap-3 mb-4 items-stretch">
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

      {/* ── Session Info ── */}
      {meta && (
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-lg)] overflow-hidden mb-4">
          <div className="flex items-center gap-2 px-4 sm:px-5 py-[13px] border-b border-[var(--border)]">
            <Monitor size={14} stroke="var(--text-muted)" strokeWidth={2} />
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
          <CircleAlert size={14} stroke="var(--accent)" strokeWidth={2} />
          <span className="text-[11px] font-semibold uppercase tracking-[0.8px] text-[var(--text-dim)]">
            Data Management
          </span>
        </div>

        {/* Backup Export & Import */}
        <div className="p-4 sm:p-5 border-b border-[var(--border)] flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            onClick={handleExportBackup}
            className="flex-1 btn btn-ghost justify-center text-[12px] py-2.5"
          >
            <Download size={13} />
            Export Backup (.json)
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex-1 btn btn-ghost justify-center text-[12px] py-2.5"
          >
            <Upload size={13} />
            Import Backup (.json)
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            onChange={handleImportFile}
            className="hidden"
          />
        </div>

        {/* Clear Lists */}
        <div className="p-4 sm:p-5 flex flex-col sm:flex-row gap-3">
          <ConfirmButton
            label="Clear History"
            onConfirm={() => {
              clearHistory();
              refresh();
              toast.info("Watch history cleared.");
            }}
          />
          <ConfirmButton
            label="Clear Favorites"
            onConfirm={() => {
              clearFavorites();
              refresh();
              toast.info("Favorites cleared.");
            }}
          />
          <ConfirmButton
            label="Clear Watch Later"
            onConfirm={() => {
              clearWatchLater();
              refresh();
              toast.info("Watch Later cleared.");
            }}
          />
        </div>
      </div>
    </PageContainer>
  );
}
