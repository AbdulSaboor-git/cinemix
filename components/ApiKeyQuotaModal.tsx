"use client";
import { useState, useEffect, useCallback } from "react";
import { CircleAlert, RefreshCw, KeyRound } from "lucide-react";
import { getApiKeyInfo } from "@/lib/kinopoisk";
import { ApiKeyResponse } from "@/types/kinopoisk";
import ModalShell from "@/components/ui/ModalShell";

interface KeyQuotaState {
  status: "idle" | "loading" | "loaded" | "error";
  data?: ApiKeyResponse;
  error?: string;
}

const ACCOUNT_COLORS: Record<
  string,
  { bg: string; text: string; label: string }
> = {
  FREE: { bg: "rgba(240,240,240,0.08)", text: "#a0a0a0", label: "Free" },
  BASIC: { bg: "rgba(59,130,246,0.15)", text: "#60a5fa", label: "Basic" },
  EXTENDED: { bg: "rgba(34,197,94,0.15)", text: "#4ade80", label: "Extended" },
};

export function getQuotaErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message.trim() : "";
  const statusMatch = message.match(/API error:\s*(\d{3})/i);
  const status = statusMatch ? Number(statusMatch[1]) : null;

  if (status !== null) {
    switch (status) {
      case 400:
        return "Malformed API key format.";
      case 401:
        return "Unauthorized API key.";
      case 402:
        return "Daily quota exhausted. This key has reached its limit for today; CineMix will rotate to your next available key.";
      case 403:
        return "Access forbidden.";
      case 404:
        return "API key not found.";
      case 429:
        return "Rate limit reached. Wait a couple of seconds and click Refresh.";
      case 500:
      case 502:
      case 503:
      case 504:
        return `The service is temporarily unavailable, please try again shortly.`;
      default:
        if (status >= 500) {
          return `Please try again in a few minutes.`;
        }
        return `Error! Please verify your key and try again.`;
    }
  }

  if (/invalid api key/i.test(message)) {
    return "This API key is invalid. Check the key format and try again.";
  }

  if (/quota exhausted/i.test(message)) {
    return "Daily quota exhausted for this key. It will reset automatically on the next daily cycle.";
  }

  if (/rate limit/i.test(message)) {
    return "Rate limit reached. Please wait a couple of seconds and click Refresh.";
  }

  if (
    /failed to fetch|networkerror|load failed|network request failed/i.test(
      message,
    )
  ) {
    return "Network connection failed. Check your internet connection try again.";
  }

  return "Could not load quota details. Check your connection and try again.";
}

function QuotaBar({
  used,
  total,
  color,
}: {
  used: number;
  total: number;
  color: string;
}) {
  const pct = total > 0 ? Math.min(100, (used / total) * 100) : 0;
  const danger = pct >= 90;
  const warn = pct >= 70;
  const barColor = danger ? "#e50914" : warn ? "#eab308" : color;
  return (
    <div>
      <div className="flex justify-between text-[11px] mb-1">
        <span className="text-[var(--text-muted)]">
          {used.toLocaleString()} used
        </span>
        <span className="text-[var(--text-muted)]">
          {total.toLocaleString()} total
        </span>
      </div>
      <div className="h-[6px] bg-[var(--surface)] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-[width] duration-700"
          style={{ width: `${pct}%`, background: barColor }}
        />
      </div>
      <p
        className="text-right text-[10px] mt-[3px]"
        style={{ color: barColor }}
      >
        {pct.toFixed(1)}% used · {Math.max(0, total - used).toLocaleString()}{" "}
        remaining
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
      setState({
        status: "error",
        error: getQuotaErrorMessage(e),
      });
    }
  }, [apiKey]);

  useEffect(() => {
    // Stagger requests by 550ms per key index to respect /v1/api_keys 2 req/sec rate limit
    const timer = setTimeout(() => {
      void load();
    }, index * 550);
    return () => clearTimeout(timer);
  }, [load, index]);

  const truncated =
    apiKey.length > 16 ? `${apiKey.slice(0, 8)}…${apiKey.slice(-4)}` : apiKey;

  const acct = state.data
    ? (ACCOUNT_COLORS[state.data.accountType] ?? ACCOUNT_COLORS.FREE)
    : null;

  return (
    <div className="bg-[var(--bg-elevated)] border border-[var(--border)] rounded-[var(--radius-lg)] p-4 flex flex-col gap-3">
      {/* Key header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-[var(--surface)] flex items-center justify-center text-[10px] font-semibold text-[var(--text-muted)] flex-shrink-0">
            {index + 1}
          </div>
          <span className="font-mono text-[11px] sm:text-[12px] text-[var(--text-dim)]">
            {truncated}
          </span>
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
        <div className="flex items-start gap-2 text-[12px] text-[var(--accent)] leading-relaxed">
          <CircleAlert
            size={14}
            strokeWidth={2}
            className="flex-shrink-0 mt-0.5"
          />
          <span>{state.error ?? "Could not load quota"}</span>
        </div>
      )}

      {state.status === "loaded" && state.data && (
        <div className="flex flex-col gap-3">
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
          type="button"
          onClick={load}
          className="self-start text-[11px] text-[var(--text-muted)] hover:text-[var(--text)] flex items-center gap-1 bg-transparent border-none cursor-pointer p-0 mt-1 transition-colors"
        >
          <RefreshCw size={11} strokeWidth={2.5} />
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
  const validKeys = apiKeys.filter((k) => k.trim());

  return (
    <ModalShell
      open={true}
      onClose={onClose}
      title="API KEY QUOTA"
      subtitle={`${validKeys.length} key${validKeys.length !== 1 ? "s" : ""} configured`}
      icon={<KeyRound size={15} strokeWidth={2} />}
      footer={
        <p className="text-[10px] sm:text-[11px] text-[var(--text-muted)] text-center m-0">
          Quota resets daily. Keys rotate automatically when the daily limit is
          reached.
        </p>
      }
    >
      <div className="flex flex-col gap-3">
        {validKeys.length === 0 ? (
          <p className="text-[13px] text-[var(--text-muted)] text-center py-8">
            No API keys configured.
          </p>
        ) : (
          validKeys.map((key, i) => (
            <SingleKeyQuota key={`${key}-${i}`} apiKey={key} index={i} />
          ))
        )}
      </div>
    </ModalShell>
  );
}
