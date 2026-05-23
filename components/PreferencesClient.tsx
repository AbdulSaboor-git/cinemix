"use client";
import { useState, useEffect, useCallback } from "react";
import {
  Preferences,
  DEFAULT_PREFERENCES,
  getPreferences,
  savePreferences,
} from "@/lib/preferences";
import { saveApiKeys, getSession } from "@/lib/session";
import { clearHistory } from "@/lib/userLists";
import { useToast } from "@/lib/toast";
import ApiKeyQuotaModal from "@/components/ApiKeyQuotaModal";

function Toggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative flex-shrink-0 cursor-pointer rounded-full border-none outline-none transition-[background] duration-200
        ${checked ? "bg-[var(--accent)] shadow-[0_0_10px_var(--accent-glow)]" : "bg-[var(--surface)]"}`}
      style={{ width: 44, height: 24 }}
    >
      <span
        className="absolute top-[3px] rounded-full bg-white transition-[left] duration-200 shadow-[0_1px_4px_rgba(0,0,0,0.4)]"
        style={{ width: 18, height: 18, left: checked ? 23 : 3 }}
      />
    </button>
  );
}

function SectionIcon({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-8 h-8 rounded-[8px] bg-[var(--accent-dim)] border border-[rgba(229,9,20,0.2)] flex items-center justify-center flex-shrink-0 text-[var(--accent)]">
      {children}
    </div>
  );
}
function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[13px] font-semibold tracking-[0.5px] uppercase text-[var(--text-dim)]">
      {children}
    </span>
  );
}

type KeyStatus = "idle" | "testing" | "ok" | "exhausted" | "invalid";
const STATUS_META: Record<
  KeyStatus,
  { borderColor: string; label: string; labelCls: string }
> = {
  idle: { borderColor: "var(--border)", label: "", labelCls: "" },
  testing: { borderColor: "var(--border)", label: "", labelCls: "" },
  ok: {
    borderColor: "rgba(34,197,94,0.4)",
    label: "Valid",
    labelCls: "text-[#22c55e]",
  },
  exhausted: {
    borderColor: "rgba(234,179,8,0.4)",
    label: "Limit reached",
    labelCls: "text-[#eab308]",
  },
  invalid: {
    borderColor: "rgba(229,9,20,0.4)",
    label: "Invalid key",
    labelCls: "text-[var(--accent)]",
  },
};

function KeyField({
  value,
  index,
  onChange,
  onRemove,
}: {
  value: string;
  index: number;
  onChange: (v: string) => void;
  onRemove: () => void;
}) {
  const [status, setStatus] = useState<KeyStatus>("idle");
  const [focused, setFocused] = useState(false);
  const meta = STATUS_META[status];
  const borderColor = focused ? "rgba(229,9,20,0.5)" : meta.borderColor;

  const testKey = useCallback(async () => {
    if (!value.trim()) return;
    setStatus("testing");
    try {
      const r = await fetch(
        "https://kinopoiskapiunofficial.tech/api/v2.1/films/search-by-keyword?keyword=test&page=1",
        {
          headers: {
            "X-API-KEY": value.trim(),
            "Content-Type": "application/json",
          },
        },
      );
      if (r.status === 200) setStatus("ok");
      else if (r.status === 402) setStatus("exhausted");
      else setStatus("invalid");
    } catch {
      setStatus("invalid");
    }
  }, [value]);

  return (
    <div className="flex items-center gap-2 sm:gap-[10px] px-3 sm:px-6 py-3 border-b border-[var(--border)]">
      <div className="w-[22px] h-[22px] rounded-full bg-[var(--surface)] flex items-center justify-center text-[10px] font-semibold text-[var(--text-muted)] flex-shrink-0">
        {index + 1}
      </div>
      <input
        type="text"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setStatus("idle");
        }}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
        spellCheck={false}
        className="flex-1 bg-[var(--bg-elevated)] rounded-[var(--radius)] px-2 sm:px-3 py-2 text-[11px] sm:text-[13px] text-[var(--text)] outline-none transition-[border-color] duration-[180ms] font-mono tracking-[0.3px] min-w-0"
        style={{ border: `1px solid ${borderColor}` }}
      />
      {/* Status indicator — icon only on mobile, icon+label on sm+ */}
      <div className="flex items-center gap-[4px] flex-shrink-0">
        <div className="w-[18px] h-[18px] flex items-center justify-center">
          {status === "testing" && (
            <div className="w-[13px] h-[13px] rounded-full border-2 border-[var(--surface)] border-t-[var(--accent)] animate-spin-fast" />
          )}
          {status === "ok" && (
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#22c55e"
              strokeWidth="2.5"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          )}
          {status === "exhausted" && (
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#eab308"
              strokeWidth="2.5"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          )}
          {status === "invalid" && (
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--accent)"
              strokeWidth="2.5"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          )}
        </div>
        {meta.label && (
          <span
            className={`hidden sm:inline text-[11px] font-semibold whitespace-nowrap ${meta.labelCls}`}
          >
            {meta.label}
          </span>
        )}
      </div>
      <button
        onClick={testKey}
        disabled={!value.trim() || status === "testing"}
        className="bg-[var(--bg-elevated)] border border-[var(--border)] rounded-[var(--radius)] px-[8px] sm:px-[10px] py-[6px] text-[11px] font-semibold text-[var(--text-dim)] whitespace-nowrap transition-all duration-[180ms] hover:border-[rgba(255,255,255,0.2)] tracking-[0.3px] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
      >
        Test
      </button>
      <button
        onClick={onRemove}
        className="bg-transparent border-none cursor-pointer p-1 rounded-[4px] flex items-center justify-center flex-shrink-0 text-[var(--text-muted)] hover:text-[var(--accent)] transition-colors min-w-[32px] min-h-[32px]"
      >
        <svg
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  );
}

const HOME_SECTION_LABELS: Record<string, string> = {
  popular: "Popular Films",
  top250: "Top 250",
  series: "Top Series",
  action: "Action",
  drama: "Drama",
  scifi: "Sci-Fi",
  upcoming: "Most Anticipated",
  comedy: "Comedy",
  horror: "Horror",
  premieres: "New Premieres",
};

type Toast = { id: number; message: string; type: "success" | "error" };

export default function PreferencesClient() {
  const [prefs, setPrefs] = useState<Preferences>(DEFAULT_PREFERENCES);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingKeys, setSavingKeys] = useState(false);
  const [unsaved, setUnsaved] = useState(false);
  const [quotaOpen, setQuotaOpen] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    setPrefs(getPreferences());
    setLoaded(true);
  }, []);

  const handleSave = () => {
    setSaving(true);
    try {
      const cleaned = {
        ...prefs,
        apiKeys: prefs.apiKeys.map((k) => k.trim()).filter(Boolean),
      };
      savePreferences(cleaned);
      setPrefs(cleaned);
      setUnsaved(false);
      toast.success("Preferences saved.");
    } catch {
      toast.error("Failed to save preferences.");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveKeys = () => {
    setSavingKeys(true);
    try {
      const keys = prefs.apiKeys.map((k) => k.trim()).filter(Boolean);
      saveApiKeys(keys);
      savePreferences({ ...prefs, apiKeys: keys });
      setPrefs((p) => ({ ...p, apiKeys: keys }));
      toast.success("API keys saved.");
    } catch {
      toast.error("Failed to save keys.");
    } finally {
      setSavingKeys(false);
    }
  };

  const handleReset = () => {
    setPrefs(DEFAULT_PREFERENCES);
    setUnsaved(true);
    toast.info("Reset to defaults — click Save to apply.");
  };

  const handleClearHistory = () => {
    if (!confirm("Clear all watch history? This can't be undone.")) return;
    clearHistory();
    toast.info("Watch history cleared.");
  };

  const setKey = (i: number, val: string) => {
    const u = [...prefs.apiKeys];
    u[i] = val;
    setPrefs((p) => ({ ...p, apiKeys: u }));
    // Keys have their own Save Keys button — don't mark global unsaved
  };
  const removeKey = (i: number) => {
    setPrefs((p) => ({
      ...p,
      apiKeys: p.apiKeys.filter((_, idx) => idx !== i),
    }));
  };
  const addKey = () => setPrefs((p) => ({ ...p, apiKeys: [...p.apiKeys, ""] }));
  const setSection = (key: keyof Preferences["homeSections"], val: boolean) => {
    setPrefs((p) => ({
      ...p,
      homeSections: { ...p.homeSections, [key]: val },
    }));
    setUnsaved(true);
  };

  // Generic pref updater that also marks unsaved
  const updatePref = (updater: (p: Preferences) => Preferences) => {
    setPrefs(updater);
    setUnsaved(true);
  };

  if (!loaded)
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-6 h-6 rounded-full border-2 border-[var(--surface)] border-t-[var(--accent)] animate-spin-fast" />
      </div>
    );

  const card =
    "bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-lg)] overflow-hidden mb-4 sm:mb-5";
  const cardHdr =
    "flex items-center gap-3 px-4 sm:px-6 py-[16px] sm:py-[18px] border-b border-[var(--border)]";
  const row =
    "flex items-center justify-between px-4 sm:px-6 py-[12px] sm:py-[14px] gap-3 sm:gap-4 border-b border-[var(--border)]";
  const rowLast =
    "flex items-center justify-between px-4 sm:px-6 py-[12px] sm:py-[14px] gap-3 sm:gap-4";
  const lbl = "text-[13px] sm:text-[14px] font-medium text-[var(--text)]";
  const hint =
    "text-[11px] sm:text-[12px] text-[var(--text-muted)] mt-[2px] leading-[1.5]";
  const optBtn = (active: boolean) =>
    `px-[10px] sm:px-[14px] py-[6px] rounded-[var(--radius)] text-[11px] sm:text-[12px] font-semibold cursor-pointer transition-all duration-150
     ${active ? "bg-[var(--accent-dim)] text-[var(--accent)] border border-[rgba(229,9,20,0.5)]" : "bg-[var(--bg-elevated)] text-[var(--text-dim)] border border-[var(--border)] hover:border-[var(--border-hover)]"}`;

  return (
    <div className="min-h-screen px-4 sm:px-[clamp(16px,5vw,48px)] py-8 sm:py-12 pb-24">
      <div className="max-w-[760px] mx-auto">
        {/* ── Sticky Save Bar ── */}
        <div
          className={`sticky top-[var(--nav-height)] z-[100] -mx-4 sm:-mx-[clamp(16px,5vw,48px)] px-4 sm:px-[clamp(16px,5vw,48px)] py-[10px] mb-6
            bg-[#08080815] backdrop-blur-[20px] 
            transition-all duration-300
            `}
        >
          <div className="flex items-center justify-between gap-3">
            {/* Left — title or unsaved indicator */}
            <div className="flex items-center gap-[10px] min-w-0">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--accent)"
                strokeWidth="2"
                className="flex-shrink-0"
              >
                <circle cx="12" cy="12" r="3" />
                <path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14" />
                <path d="M15.54 8.46a5 5 0 0 1 0 7.07M8.46 8.46a5 5 0 0 0 0 7.07" />
              </svg>
              <h1 className="font-display tracking-[2px] text-[var(--text)] m-0 text-[clamp(15px,3vw,22px)]">
                PREFERENCES
              </h1>
              {unsaved && (
                <span className="hidden sm:inline-flex items-center gap-[5px] bg-[rgba(229,9,20,0.1)] border border-[rgba(229,9,20,0.25)] rounded-full px-[10px] py-[3px] text-[11px] text-[var(--accent)] font-medium">
                  <span className="w-[5px] h-[5px] rounded-full bg-[var(--accent)] shadow-[0_0_6px_var(--accent-glow)]" />
                  Unsaved
                </span>
              )}
            </div>

            {/* Right — buttons */}
            <div className="flex items-center gap-2 flex-shrink-0">
              {unsaved && (
                <button
                  onClick={handleReset}
                  className="bg-transparent border border-[var(--border)] rounded-[var(--radius)] px-3 sm:px-4 py-[7px] text-[12px] font-medium text-[var(--text-muted)] cursor-pointer transition-all duration-150 hover:border-[var(--border-hover)] hover:text-[var(--text-dim)]"
                >
                  Reset
                </button>
              )}
              <button
                onClick={handleSave}
                disabled={saving}
                className={`bg-[var(--accent)] border-none rounded-[var(--radius)] px-4 sm:px-5 py-[7px] text-[12px] sm:text-[13px] font-bold text-white flex items-center gap-[6px] transition-all duration-150
                  shadow-[0_0_20px_var(--accent-glow)]
                  ${saving ? "opacity-70 cursor-not-allowed" : "cursor-pointer hover:opacity-90 hover:shadow-[0_0_32px_var(--accent-glow)]"}`}
              >
                {saving ? (
                  <>
                    <div className="w-3 h-3 rounded-full border-2 border-[rgba(255,255,255,0.3)] border-t-white animate-spin-fast" />
                    <span className="hidden sm:inline">Saving…</span>
                  </>
                ) : (
                  <>
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    Save
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Header — shown below the sticky bar, no title duplication */}
        {/* <div className="mb-7 sm:mb-10 pb-5 sm:pb-6 border-b border-[var(--border)]">
          <p className="text-[12px] sm:text-[13px] text-[var(--text-muted)]">
            Stored locally in your browser. Never sent to any server.
          </p>
        </div> */}

        {/* API Keys */}
        <div className={card}>
          <div className={cardHdr}>
            <SectionIcon>
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
              </svg>
            </SectionIcon>
            <div className="flex-1 min-w-0">
              <SectionTitle>API Keys</SectionTitle>
              <p className={`${hint} !mt-0`}>
                Get free keys at{" "}
                <a
                  href="https://kinopoiskapiunofficial.tech"
                  target="_blank"
                  rel="noreferrer"
                  className="text-[var(--accent)] no-underline hover:underline"
                >
                  kinopoiskapiunofficial.tech
                </a>{" "}
                — keys rotate automatically when the daily limit is hit.
              </p>
            </div>
            {prefs.apiKeys.filter((k) => k.trim()).length > 0 && (
              <button
                onClick={() => setQuotaOpen(true)}
                className="flex-shrink-0 flex items-center gap-[6px] bg-[var(--bg-elevated)] border border-[var(--border)] rounded-[var(--radius)] px-[10px] py-[7px] text-[11px] font-semibold text-[var(--text-dim)] cursor-pointer hover:border-[rgba(229,9,20,0.4)] hover:text-[var(--accent)] transition-all duration-150"
              >
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 6v6l4 2" />
                </svg>
                <span className="hidden sm:inline">Quota</span>
              </button>
            )}
          </div>
          <div className="py-2">
            {prefs.apiKeys.length === 0 ? (
              <div className="p-3 sm:p-5">
                <div className="bg-[rgba(229,9,20,0.06)] border border-dashed border-[rgba(229,9,20,0.3)] rounded-[var(--radius)] p-[14px_16px] sm:p-[16px_20px] flex items-start gap-3">
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="var(--accent)"
                    strokeWidth="2"
                    className="flex-shrink-0 mt-[2px]"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  <p className="text-[12px] sm:text-[13px] text-[var(--text-dim)] leading-[1.5]">
                    No API key configured. The app won&apos;t load content until
                    you add one.
                  </p>
                </div>
              </div>
            ) : (
              prefs.apiKeys.map((key, i) => (
                <KeyField
                  key={i}
                  value={key}
                  index={i}
                  onChange={(v) => setKey(i, v)}
                  onRemove={() => removeKey(i)}
                />
              ))
            )}
            <div className="px-3 sm:px-6 pt-[10px] pb-1 flex items-center gap-3 flex-wrap">
              <button
                onClick={addKey}
                className="inline-flex items-center gap-[7px] bg-transparent border border-dashed border-[var(--border-hover)] rounded-[var(--radius)] px-[12px] sm:px-[14px] py-[7px] text-[12px] font-semibold text-[var(--text-dim)] cursor-pointer transition-all duration-[180ms] hover:border-[rgba(229,9,20,0.4)] hover:text-[var(--accent)] tracking-[0.3px]"
              >
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                >
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                Add another key
              </button>
              {prefs.apiKeys.filter((k) => k.trim()).length > 0 && (
                <button
                  onClick={handleSaveKeys}
                  disabled={savingKeys}
                  className="inline-flex items-center gap-[7px] bg-[var(--accent-dim)] border border-[rgba(229,9,20,0.4)] rounded-[var(--radius)] px-[12px] sm:px-[14px] py-[7px] text-[12px] font-semibold text-[var(--accent)] cursor-pointer transition-all duration-[180ms] hover:border-[rgba(229,9,20,0.7)] tracking-[0.3px] disabled:opacity-50"
                >
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  {savingKeys ? "Saving…" : "Save Keys"}
                </button>
              )}
            </div>
            {/* <div className="px-4 sm:px-6 pb-3">
              <p className="text-[10px] text-[var(--text-muted)] leading-[1.5]">
                💡 In a future update, saving keys will generate an 8-character
                code you can use to restore them on a new device.
              </p>
            </div> */}
          </div>
        </div>

        {/* History */}
        <div className={card}>
          <div className={cardHdr}>
            <SectionIcon>
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M3 3v5h5" />
                <path d="M3.05 13A9 9 0 1 0 6 5.3L3 8" />
              </svg>
            </SectionIcon>
            <SectionTitle>Watch History</SectionTitle>
          </div>
          <div className="py-2">
            <div className={row}>
              <div className="min-w-0 flex-1">
                <p className={lbl}>Enable watch history</p>
                <p className={hint}>
                  Films are added after 10+ seconds of playback.
                </p>
              </div>
              <Toggle
                checked={prefs.historyEnabled ?? true}
                onChange={(v) =>
                  updatePref((p) => ({ ...p, historyEnabled: v }))
                }
              />
            </div>
            <div className={rowLast}>
              <div className="min-w-0 flex-1">
                <p className={lbl}>Clear history</p>
                <p className={hint}>
                  Remove all entries from your watch history.
                </p>
              </div>
              <button
                onClick={handleClearHistory}
                className="flex-shrink-0 bg-transparent border border-[var(--border)] rounded-[var(--radius)] px-[12px] py-[7px] text-[12px] font-semibold text-[var(--text-muted)] cursor-pointer hover:border-[rgba(229,9,20,0.4)] hover:text-[var(--accent)] transition-all"
              >
                Clear
              </button>
            </div>
          </div>
        </div>

        {/* Search */}
        <div className={card}>
          <div className={cardHdr}>
            <SectionIcon>
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.35-4.35" />
              </svg>
            </SectionIcon>
            <SectionTitle>Search</SectionTitle>
          </div>
          <div className="py-2">
            <div className={row}>
              <div>
                <p className={lbl}>Search suggestions</p>
                <p className={hint}>
                  Show instant film suggestions as you type. Disabling saves API
                  calls.
                </p>
              </div>
              <Toggle
                checked={prefs.searchSuggestionsEnabled}
                onChange={(v) =>
                  updatePref((p) => ({ ...p, searchSuggestionsEnabled: v }))
                }
              />
            </div>
            {prefs.searchSuggestionsEnabled && (
              <>
                <div className={row}>
                  <div className="min-w-0 flex-1">
                    <p className={lbl}>Suggestion delay</p>
                    <p className={hint}>
                      Wait before firing a request after you stop typing.
                    </p>
                  </div>
                  <div className="flex items-center gap-[8px] sm:gap-[10px] flex-shrink-0">
                    <input
                      type="range"
                      min={100}
                      max={1000}
                      step={50}
                      value={prefs.suggestionDebounceMs}
                      onChange={(e) =>
                        updatePref((p) => ({
                          ...p,
                          suggestionDebounceMs: +e.target.value,
                        }))
                      }
                      className="w-[72px] sm:w-[100px] cursor-pointer accent-[var(--accent)]"
                    />
                    <span className="text-[11px] sm:text-[12px] text-[var(--text-dim)] min-w-[46px] text-right">
                      {prefs.suggestionDebounceMs}ms
                    </span>
                  </div>
                </div>
                <div className={rowLast}>
                  <div>
                    <p className={lbl}>Results shown</p>
                    <p className={hint}>
                      How many suggestions appear in the dropdown.
                    </p>
                  </div>
                  <div className="flex gap-[5px] sm:gap-[6px] flex-shrink-0">
                    {[3, 4, 6, 8].map((n) => (
                      <button
                        key={n}
                        onClick={() =>
                          updatePref((p) => ({ ...p, suggestionLimit: n }))
                        }
                        className={`${optBtn(prefs.suggestionLimit === n)} w-8 sm:w-9 h-8`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Content & Display */}
        <div className={card}>
          <div className={cardHdr}>
            <SectionIcon>
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                <line x1="8" y1="21" x2="16" y2="21" />
                <line x1="12" y1="17" x2="12" y2="21" />
              </svg>
            </SectionIcon>
            <SectionTitle>Content & Display</SectionTitle>
          </div>
          <div className="py-2">
            <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-[var(--border)]">
              <p className={`${lbl} mb-1`}>Default Explore sort</p>
              <p className={`${hint} mb-3`}>
                Which order the Explore page loads with by default.
              </p>
              <div className="flex gap-[5px] sm:gap-[6px] flex-wrap">
                {(["RATING", "NUM_VOTE", "YEAR"] as const).map((o) => {
                  const label =
                    o === "RATING"
                      ? "Top Rated"
                      : o === "NUM_VOTE"
                        ? "Most Voted"
                        : "Newest";
                  return (
                    <button
                      key={o}
                      onClick={() =>
                        updatePref((p) => ({ ...p, defaultExploreOrder: o }))
                      }
                      className={optBtn(prefs.defaultExploreOrder === o)}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="px-4 sm:px-6 py-3 sm:py-4">
              <p className={`${lbl} mb-1`}>Default Explore type</p>
              <p className={`${hint} mb-3`}>
                Which content type the Explore page shows by default.
              </p>
              <div className="flex gap-[5px] sm:gap-[6px] flex-wrap">
                {(["FILM", "TV_SERIES", "TV_SHOW", "MINI_SERIES"] as const).map(
                  (t) => {
                    const label =
                      t === "FILM"
                        ? "Movies"
                        : t === "TV_SERIES"
                          ? "Series"
                          : t === "TV_SHOW"
                            ? "TV Shows"
                            : "Mini Series";
                    return (
                      <button
                        key={t}
                        onClick={() =>
                          updatePref((p) => ({ ...p, defaultExploreType: t }))
                        }
                        className={optBtn(prefs.defaultExploreType === t)}
                      >
                        {label}
                      </button>
                    );
                  },
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Home Sections */}
        <div className={card}>
          <div className={cardHdr}>
            <SectionIcon>
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
            </SectionIcon>
            <div>
              <SectionTitle>Home Page Sections</SectionTitle>
              <p className={`${hint} !mt-0`}>
                Each section is a separate API call. Disable rows you don&apos;t
                need.
              </p>
            </div>
          </div>
          <div className="py-2">
            {(
              Object.entries(HOME_SECTION_LABELS) as [
                keyof Preferences["homeSections"],
                string,
              ][]
            ).map(([key, label], i, arr) => (
              <div key={key} className={i === arr.length - 1 ? rowLast : row}>
                <p className={lbl}>{label}</p>
                <Toggle
                  checked={prefs.homeSections[key]}
                  onChange={(v) => setSection(key, v)}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Film Page Sections */}
        <div className={card}>
          <div className={cardHdr}>
            <SectionIcon>
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <rect x="2" y="2" width="20" height="20" rx="2" />
                <path d="M7 2v20M17 2v20M2 12h20M2 7h5M2 17h5M17 7h5M17 17h5" />
              </svg>
            </SectionIcon>
            <div>
              <SectionTitle>Film Page Sections</SectionTitle>
              <p className={`${hint} !mt-0`}>
                Each toggle below is a separate API call. Disable sections you
                don&apos;t need to save your daily quota.
              </p>
            </div>
          </div>
          <div className="py-2">
            {(
              [
                ["cast", "Cast & Crew", "Actors, directors, writers — 1 call"],
                ["awards", "Awards", "Oscar wins, nominations — 1 call"],
                ["gallery", "Gallery", "Film stills and images — 1 call"],
                ["facts", "Trivia & Spoilers", "Facts and bloopers — 1 call"],
                ["boxOffice", "Box Office", "Budget and revenue — 1 call"],
                [
                  "similars",
                  "You May Also Like",
                  "Similar film recommendations — 1 call",
                ],
                [
                  "sequels",
                  "Sequels & Prequels",
                  "Related films in the series — 1 call",
                ],
                [
                  "reviews",
                  "Audience Reviews",
                  "User-written reviews — 1 call",
                ],
                [
                  "distributions",
                  "Release Dates",
                  "Country-by-country release info — 1 call",
                ],
              ] as [keyof Preferences["filmSections"], string, string][]
            ).map(([key, label, hint_], i, arr) => (
              <div key={key} className={i === arr.length - 1 ? rowLast : row}>
                <div>
                  <p className={lbl}>{label}</p>
                  <p className={hint}>{hint_}</p>
                </div>
                <Toggle
                  checked={prefs.filmSections[key]}
                  onChange={(v) =>
                    updatePref((p) => ({
                      ...p,
                      filmSections: { ...p.filmSections, [key]: v },
                    }))
                  }
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      {quotaOpen && (
        <ApiKeyQuotaModal
          apiKeys={prefs.apiKeys}
          onClose={() => setQuotaOpen(false)}
        />
      )}
    </div>
  );
}
