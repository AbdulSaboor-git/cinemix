"use client";
import { useState, useEffect, useCallback } from "react";
import { getApiKeyInfo } from "@/lib/kinopoisk";
import { ApiKeyResponse } from "@/types/kinopoisk";

interface KeyQuotaState {
  status: "idle" | "loading" | "loaded" | "error";
  data?: ApiKeyResponse;
  error?: string;
}

const ACCOUNT_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  FREE:     { bg: "rgba(240,240,240,0.08)",  text: "#a0a0a0", label: "Free" },
  BASIC:    { bg: "rgba(59,130,246,0.15)",   text: "#60a5fa", label: "Basic" },
  EXTENDED: { bg: "rgba(34,197,94,0.15)",    text: "#4ade80", label: "Extended" },
};

function QuotaBar({ used, total, color }: { used: number; total: number; color: string }) {
  const pct = total > 0 ? Math.min(100, (used / total) * 100) : 0;
  const danger = pct >= 90;
  const warn = pct >= 70;
  const barColor = danger ? "#e50914" : warn ? "#eab308" : color;
  return (
    <div>
      <div className="flex justify-between text-[11px] mb-1">
        <span className="text-[var(--text-muted)]">{used.toLocaleString()} used</span>
        <span className="text-[var(--text-muted)]">{total.toLocaleString()} total</span>
      </div>
      <div className="h-[6px] bg-[var(--surface)] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-[width] duration-700"
          style={{ width: `${pct}%`, background: barColor }}
        />
      </div>
      <p className="text-right text-[10px] mt-[3px]" style={{ color: barColor }}>
        {pct.toFixed(1)}% used · {(total - used).toLocaleString()} remaining
      </p>
    </div>
  );
}

function SingleKeyQuota({ apiKey, index }: { apiKey: string; index: number }) {
  const [state, setState] = useState<KeyQuotaState>({ status: "idle" });

  const load = useCallback(async () => {
    if (!apiKey.trim()) return;
    setState({ status: "loading" });
    try {
      const data = await getApiKeyInfo(apiKey.trim());
      setState({ status: "loaded", data });
    } catch (e) {
      setState({ status: "error", error: e instanceof Error ? e.message : "Failed to load" });
    }
  }, [apiKey]);

  useEffect(() => { load(); }, [load]);

  const truncated = apiKey.length > 16
    ? `${apiKey.slice(0, 8)}…${apiKey.slice(-4)}`
    : apiKey;

  const acct = state.data ? (ACCOUNT_COLORS[state.data.accountType] ?? ACCOUNT_COLORS.FREE) : null;

  return (
    <div className="bg-[var(--bg-elevated)] border border-[var(--border)] rounded-[var(--radius-lg)] p-4 flex flex-col gap-3">
      {/* Key header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-[var(--surface)] flex items-center justify-center text-[10px] font-semibold text-[var(--text-muted)] flex-shrink-0">
            {index + 1}
          </div>
          <span className="font-mono text-[11px] sm:text-[12px] text-[var(--text-dim)]">{truncated}</span>
        </div>
        {acct && state.data && (
          <span
            className="text-[10px] font-bold px-2 py-[3px] rounded-[4px] flex-shrink-0"
            style={{ background: acct.bg, color: acct.text }}
          >
            {acct.label}
          </span>
        )}
      </div>

      {/* Status */}
      {state.status === "loading" && (
        <div className="flex items-center gap-2 text-[12px] text-[var(--text-muted)]">
          <div className="w-3 h-3 rounded-full border-2 border-[var(--surface)] border-t-[var(--accent)] animate-spin" />
          Loading quota…
        </div>
      )}

      {state.status === "error" && (
        <div className="flex items-center gap-2 text-[12px] text-[var(--accent)]">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          {state.error ?? "Could not load quota"}
        </div>
      )}

      {state.status === "loaded" && state.data && (
        <div className="flex flex-col gap-3">
          {/* Total quota */}
          <div>
            <p className="text-[11px] text-[var(--text-muted)] uppercase tracking-[0.8px] mb-[6px]">
              Total Quota
            </p>
            <QuotaBar
              used={state.data.totalQuota.used}
              total={state.data.totalQuota.value}
              color="#60a5fa"
            />
          </div>
          {/* Daily quota */}
          <div>
            <p className="text-[11px] text-[var(--text-muted)] uppercase tracking-[0.8px] mb-[6px]">
              Daily Quota
            </p>
            <QuotaBar
              used={state.data.dailyQuota.used}
              total={state.data.dailyQuota.value}
              color="#4ade80"
            />
          </div>
        </div>
      )}

      {state.status !== "loading" && (
        <button
          onClick={load}
          className="self-start text-[11px] text-[var(--text-muted)] hover:text-[var(--text)] flex items-center gap-1 bg-transparent border-none cursor-pointer p-0 mt-1 transition-colors"
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M23 4v6h-6M1 20v-6h6"/>
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
          </svg>
          Refresh
        </button>
      )}
    </div>
  );
}

interface Props {
  apiKeys: string[];
  onClose: () => void;
}

export default function ApiKeyQuotaModal({ apiKeys, onClose }: Props) {
  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Lock body scroll
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  const validKeys = apiKeys.filter((k) => k.trim());

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(4px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="bg-[var(--bg-card)] border border-[var(--border)] w-full sm:max-w-[520px] rounded-t-[20px] sm:rounded-[var(--radius-lg)] overflow-hidden shadow-[0_24px_80px_rgba(0,0,0,0.8)] flex flex-col max-h-[92vh] sm:max-h-[80vh]"
        style={{ animation: "scaleIn 0.18s ease" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-5 py-4 border-b border-[var(--border)] flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-[8px] bg-[var(--accent-dim)] border border-[rgba(229,9,20,0.2)] flex items-center justify-center text-[var(--accent)]">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/>
              </svg>
            </div>
            <div>
              <h2 className="font-display tracking-[1px] text-[var(--text)] text-[16px] sm:text-[18px]">
                API KEY QUOTA
              </h2>
              <p className="text-[11px] text-[var(--text-muted)]">{validKeys.length} key{validKeys.length !== 1 ? "s" : ""} configured</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full border border-[var(--border)] flex items-center justify-center cursor-pointer hover:border-[var(--border-hover)] hover:bg-[var(--bg-elevated)] transition-all text-[var(--text-muted)] hover:text-[var(--text)] bg-transparent"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 p-4 sm:p-5 flex flex-col gap-3">
          {validKeys.length === 0 ? (
            <p className="text-[13px] text-[var(--text-muted)] text-center py-8">
              No API keys configured.
            </p>
          ) : (
            validKeys.map((key, i) => (
              <SingleKeyQuota key={key} apiKey={key} index={i} />
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-4 sm:px-5 py-3 border-t border-[var(--border)] flex-shrink-0">
          <p className="text-[10px] sm:text-[11px] text-[var(--text-muted)] text-center">
            Quota resets daily. Keys rotate automatically when the daily limit is reached.
          </p>
        </div>
      </div>
    </div>
  );
}
