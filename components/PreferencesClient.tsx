"use client";
import { useState, useEffect, useCallback } from "react";
import {
  Settings,
  Check,
  CircleAlert,
  X,
  KeyRound,
  Clock,
  Plus,
  History,
  Search,
  Monitor,
  Home,
  Film,
  ShieldCheck,
} from "lucide-react";
import {
  Preferences,
  DEFAULT_PREFERENCES,
  getPreferences,
  savePreferences,
} from "@/lib/preferences";
import { saveApiKeys } from "@/lib/session";
import { getApiKeyInfo, clearApiCache } from "@/lib/kinopoisk";
import { clearHistory } from "@/lib/userLists";
import { useToast } from "@/lib/toast";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import ApiKeyQuotaModal from "@/components/ApiKeyQuotaModal";
import PageContainer from "@/components/ui/PageContainer";
import ConfirmButton from "@/components/ui/ConfirmButton";

function Toggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative flex-shrink-0 cursor-pointer rounded-full border-none outline-none transition-[background] duration-200 ${
        checked
          ? "bg-[var(--accent)] shadow-[0_0_10px_var(--accent-glow)]"
          : "bg-[var(--surface)]"
      }`}
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
    const trimmed = value.trim();
    if (!trimmed) return;
    setStatus("testing");
    try {
      const info = await getApiKeyInfo(trimmed);
      if (
        info.dailyQuota &&
        info.dailyQuota.value > 0 &&
        info.dailyQuota.used >= info.dailyQuota.value
      ) {
        setStatus("exhausted");
      } else {
        setStatus("ok");
      }
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
      <div className="flex items-center gap-[4px] flex-shrink-0">
        <div className="w-[18px] h-[18px] flex items-center justify-center">
          {status === "testing" && (
            <div className="w-[13px] h-[13px] rounded-full border-2 border-[var(--surface)] border-t-[var(--accent)] animate-spin-fast" />
          )}
          {status === "ok" && (
            <Check size={15} stroke="#22c55e" strokeWidth={2.5} />
          )}
          {status === "exhausted" && (
            <CircleAlert size={15} stroke="#eab308" strokeWidth={2.5} />
          )}
          {status === "invalid" && (
            <X size={15} stroke="var(--accent)" strokeWidth={2.5} />
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
        type="button"
        onClick={testKey}
        disabled={!value.trim() || status === "testing"}
        className="bg-[var(--bg-elevated)] border border-[var(--border)] rounded-[var(--radius)] px-[8px] sm:px-[10px] py-[6px] text-[11px] font-semibold text-[var(--text-dim)] whitespace-nowrap transition-all duration-[180ms] hover:border-[rgba(255,255,255,0.2)] tracking-[0.3px] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
      >
        Test
      </button>
      <button
        type="button"
        onClick={onRemove}
        className="bg-transparent border-none cursor-pointer p-1 rounded-[4px] flex items-center justify-center flex-shrink-0 text-[var(--text-muted)] hover:text-[var(--accent)] transition-colors min-w-[32px] min-h-[32px]"
        aria-label="Remove key"
      >
        <X size={15} strokeWidth={2} />
      </button>
    </div>
  );
}

const HOME_SECTION_LABELS: Record<string, string> = {
  // popular: "Popular Films",
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

export default function PreferencesClient() {
  useDocumentTitle("Preferences");

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
      const cleaned: Preferences = {
        ...prefs,
        apiKeys: prefs.apiKeys.map((k) => k.trim()).filter(Boolean),
      };
      savePreferences(cleaned);
      clearApiCache();
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
      clearApiCache();
      setPrefs((p) => ({ ...p, apiKeys: keys }));
      toast.success("API keys saved.");
    } catch {
      toast.error("Failed to save keys.");
    } finally {
      setSavingKeys(false);
    }
  };

  const handleReset = () => {
    setPrefs({ ...DEFAULT_PREFERENCES, apiKeys: prefs.apiKeys });
    setUnsaved(true);
    toast.info("Reset to defaults — click Save to apply.");
  };

  const setKey = (i: number, val: string) => {
    const u = [...prefs.apiKeys];
    u[i] = val;
    setPrefs((p) => ({ ...p, apiKeys: u }));
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

  const updatePref = (updater: (p: Preferences) => Preferences) => {
    setPrefs(updater);
    setUnsaved(true);
  };

  if (!loaded) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-6 h-6 rounded-full border-2 border-[var(--surface)] border-t-[var(--accent)] animate-spin-fast" />
      </div>
    );
  }

  const card =
    "bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-lg)] overflow-hidden mb-4 sm:mb-5";
  const cardHdr =
    "flex items-center gap-3 px-4 sm:px-6 py-[15px] sm:py-[18px] border-b border-[var(--border)]";
  const row =
    "flex items-center justify-between px-4 sm:px-6 py-[12px] sm:py-[14px] gap-3 sm:gap-4 border-b border-[var(--border)]";
  const rowLast =
    "flex items-center justify-between px-4 sm:px-6 py-[12px] sm:py-[14px] gap-3 sm:gap-4";
  const lbl = "text-[13px] sm:text-[14px] font-medium text-[var(--text)] m-0";
  const hint =
    "text-[11px] sm:text-[12px] text-[var(--text-muted)] mt-[2px] leading-[1.5] m-0";
  const optBtn = (active: boolean) =>
    `px-[10px] sm:px-[14px] py-[6px] rounded-[var(--radius)] text-[11px] sm:text-[12px] font-semibold cursor-pointer transition-all duration-150 ${
      active
        ? "bg-[var(--accent-dim)] text-[var(--accent)] border border-[rgba(229,9,20,0.5)]"
        : "bg-[var(--bg-elevated)] text-[var(--text-dim)] border border-[var(--border)] hover:border-[var(--border-hover)]"
    }`;

  return (
    <PageContainer variant="narrow" className="pb-24">
      {/* ── Sticky Save Bar ── */}
      <div className="sticky top-[var(--nav-height)] z-[100] -mx-4 sm:-mx-[var(--page-x)] px-4 sm:px-[var(--page-x)] py-[10px] mb-5 sm:mb-6 bg-[#080808e6] backdrop-blur-[20px] border-b border-[var(--border)] transition-all duration-300">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-[10px] min-w-0">
            <Settings width={19} />
            <h1 className="font-display tracking-[2px] text-[var(--text)] m-0 text-[clamp(16px,3vw,22px)]">
              PREFERENCES
            </h1>
            {unsaved && (
              <span className="hidden sm:inline-flex items-center gap-[5px] bg-[rgba(229,9,20,0.1)] border border-[rgba(229,9,20,0.25)] rounded-full px-[10px] py-[3px] text-[11px] text-[var(--accent)] font-medium">
                <span className="w-[5px] h-[5px] rounded-full bg-[var(--accent)] shadow-[0_0_6px_var(--accent-glow)]" />
                Unsaved
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {unsaved && (
              <button
                type="button"
                onClick={handleReset}
                className="bg-transparent border border-[var(--border)] rounded-[var(--radius)] px-3 sm:px-4 py-[7px] text-[12px] font-medium text-[var(--text-muted)] cursor-pointer transition-all duration-150 hover:border-[var(--border-hover)] hover:text-[var(--text-dim)]"
              >
                Reset
              </button>
            )}
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className={`bg-[var(--accent)] border-none rounded-[var(--radius)] px-4 sm:px-5 py-[7px] text-[12px] sm:text-[13px] font-bold text-white flex items-center gap-[6px] transition-all duration-150 shadow-[0_0_20px_var(--accent-glow)] ${
                saving
                  ? "opacity-70 cursor-not-allowed"
                  : "cursor-pointer hover:opacity-90 hover:shadow-[0_0_32px_var(--accent-glow)]"
              }`}
            >
              {saving ? (
                <>
                  <div className="w-3 h-3 rounded-full border-2 border-[rgba(255,255,255,0.3)] border-t-white animate-spin-fast" />
                  <span className="hidden sm:inline">Saving…</span>
                </>
              ) : (
                <>
                  <Check size={12} strokeWidth={2.5} />
                  Save
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* API Keys */}
      <div className={card}>
        <div className={cardHdr}>
          <SectionIcon>
            <KeyRound size={15} strokeWidth={2} />
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
              type="button"
              onClick={() => setQuotaOpen(true)}
              className="flex-shrink-0 flex items-center gap-[6px] bg-[var(--bg-elevated)] border border-[var(--border)] rounded-[var(--radius)] px-[10px] py-[7px] text-[11px] font-semibold text-[var(--text-dim)] cursor-pointer hover:border-[rgba(229,9,20,0.4)] hover:text-[var(--accent)] transition-all duration-150"
            >
              <Clock size={12} strokeWidth={2} />
              <span className="hidden sm:inline">Quota</span>
            </button>
          )}
        </div>
        <div className="py-2">
          {prefs.apiKeys.length === 0 ? (
            <div className="p-3 sm:p-5">
              <div className="bg-[rgba(229,9,20,0.06)] border border-dashed border-[rgba(229,9,20,0.3)] rounded-[var(--radius)] p-[14px_16px] sm:p-[16px_20px] flex items-start gap-3">
                <CircleAlert
                  size={18}
                  stroke="var(--accent)"
                  strokeWidth={2}
                  className="flex-shrink-0 mt-[2px]"
                />
                <p className="text-[12px] sm:text-[13px] text-[var(--text-dim)] leading-[1.5] m-0">
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
          <div className="px-3 sm:px-6 pt-[10px] pb-2 flex items-center gap-3 flex-wrap">
            <button
              type="button"
              onClick={addKey}
              className="inline-flex items-center gap-[7px] bg-transparent border border-dashed border-[var(--border-hover)] rounded-[var(--radius)] px-[12px] sm:px-[14px] py-[7px] text-[12px] font-semibold text-[var(--text-dim)] cursor-pointer transition-all duration-[180ms] hover:border-[rgba(229,9,20,0.4)] hover:text-[var(--accent)] tracking-[0.3px]"
            >
              <Plus size={12} strokeWidth={2.5} />
              Add another key
            </button>
            {prefs.apiKeys.filter((k) => k.trim()).length > 0 && (
              <button
                type="button"
                onClick={handleSaveKeys}
                disabled={savingKeys}
                className="inline-flex items-center gap-[7px] bg-[var(--accent-dim)] border border-[rgba(229,9,20,0.4)] rounded-[var(--radius)] px-[12px] sm:px-[14px] py-[7px] text-[12px] font-semibold text-[var(--accent)] cursor-pointer transition-all duration-[180ms] hover:border-[rgba(229,9,20,0.7)] tracking-[0.3px] disabled:opacity-50"
              >
                <Check size={12} strokeWidth={2.5} />
                {savingKeys ? "Saving…" : "Save Keys"}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Safe Mode (Requirement 9: Minimal "Safe Mode" with toggle only, no RU/USSR text) */}
      <div className={card}>
        <div className="flex items-center justify-between px-4 sm:px-6 py-[14px] sm:py-[16px] gap-3">
          <div className="flex items-center gap-3">
            <SectionIcon>
              <ShieldCheck size={15} strokeWidth={2} />
            </SectionIcon>
            <span className={lbl}>Safe Mode</span>
          </div>
          <Toggle
            checked={prefs.safeModeEnabled ?? true}
            onChange={(v) => updatePref((p) => ({ ...p, safeModeEnabled: v }))}
          />
        </div>
      </div>

      {/* Watch History */}
      <div className={card}>
        <div className={cardHdr}>
          <SectionIcon>
            <History size={15} strokeWidth={2} />
          </SectionIcon>
          <SectionTitle>Watch History</SectionTitle>
        </div>
        <div className="py-2">
          <div className={row}>
            <div className="min-w-0 flex-1">
              <p className={lbl}>Enable watch history</p>
            </div>
            <Toggle
              checked={prefs.historyEnabled ?? true}
              onChange={(v) => updatePref((p) => ({ ...p, historyEnabled: v }))}
            />
          </div>
          <div className={rowLast}>
            <div className="min-w-0 flex-1">
              <p className={lbl}>Clear history</p>
            </div>
            <div className="flex-shrink-0">
              <ConfirmButton
                label="Clear"
                className="flex-initial"
                onConfirm={() => {
                  clearHistory();
                  toast.info("Watch history cleared.");
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className={card}>
        <div className={cardHdr}>
          <SectionIcon>
            <Search size={15} strokeWidth={2} />
          </SectionIcon>
          <SectionTitle>Search</SectionTitle>
        </div>
        <div className="py-2">
          <div className={row}>
            <div>
              <p className={lbl}>Search suggestions</p>
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
                  <p className={lbl}>Suggestions shown</p>
                </div>
                <div className="flex gap-[5px] sm:gap-[6px] flex-shrink-0">
                  {[3, 4, 6, 8].map((n) => (
                    <button
                      key={n}
                      type="button"
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
            <Monitor size={15} strokeWidth={2} />
          </SectionIcon>
          <SectionTitle>Content & Display</SectionTitle>
        </div>
        <div className="py-2">
          <div className={row}>
            <div className="min-w-0 flex-1">
              <p className={lbl}>Auto-translate content to English</p>
            </div>
            <Toggle
              checked={prefs.autoTranslateEnabled}
              onChange={(v) =>
                updatePref((p) => ({ ...p, autoTranslateEnabled: v }))
              }
            />
          </div>

          {/* <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-[var(--border)]">
            <p className={`${lbl} mb-2`}>Catalog Priority</p>
            <div className="flex gap-[5px] sm:gap-[6px] flex-wrap">
              {(
                [
                  { id: "GLOBAL_FIRST", label: "Global & Hollywood" },
                  { id: "BALANCED", label: "Balanced Mix" },
                  { id: "ALL", label: "All Regions" },
                ] as const
              ).map((mode) => (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() =>
                    updatePref((p) => ({ ...p, contentRegionMode: mode.id }))
                  }
                  className={optBtn(
                    (prefs.contentRegionMode ?? "GLOBAL_FIRST") === mode.id,
                  )}
                >
                  {mode.label}
                </button>
              ))}
            </div>
          </div> */}

          <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-[var(--border)]">
            <p className={`${lbl} mb-1`}>Default Explore sort</p>
            <div className="flex gap-[5px] sm:gap-[6px] flex-wrap">
              {(["NUM_VOTE", "RATING", "YEAR"] as const).map((o) => {
                const label =
                  o === "RATING"
                    ? "Top Rated"
                    : o === "NUM_VOTE"
                      ? "Most Popular (Votes)"
                      : "Newest";
                return (
                  <button
                    key={o}
                    type="button"
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
            <div className="flex gap-[5px] sm:gap-[6px] flex-wrap">
              {(
                ["ALL", "FILM", "TV_SERIES", "TV_SHOW", "MINI_SERIES"] as const
              ).map((t) => {
                const label =
                  t === "ALL"
                    ? "All"
                    : t === "FILM"
                      ? "Movies"
                      : t === "TV_SERIES"
                        ? "Series"
                        : t === "TV_SHOW"
                          ? "TV Shows"
                          : "Mini Series";
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() =>
                      updatePref((p) => ({ ...p, defaultExploreType: t }))
                    }
                    className={optBtn(prefs.defaultExploreType === t)}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Home Sections */}
      <div className={card}>
        <div className={cardHdr}>
          <SectionIcon>
            <Home size={15} strokeWidth={2} />
          </SectionIcon>
          <div>
            <SectionTitle>Home Page Sections</SectionTitle>
            <p className={`${hint} !mt-0`}>
              Disable Home Page rows you don&apos;t need.
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
            <Film size={15} strokeWidth={2} />
          </SectionIcon>
          <div>
            <SectionTitle>Film Page Sections</SectionTitle>
            <p className={`${hint} !mt-0`}>
              Disable sections you don&apos;t need.
            </p>
          </div>
        </div>
        <div className="py-2">
          {(
            [
              ["cast", "Cast & Crew", "Actors, directors, writers"],
              ["awards", "Awards", "Oscar wins, nominations"],
              ["gallery", "Gallery", "Film stills and images"],
              ["facts", "Trivia & Spoilers", "Facts and bloopers"],
              ["boxOffice", "Box Office", "Budget and revenue"],
              ["similars", "You May Also Like", "Similar film recommendations"],
              ["sequels", "Sequels & Prequels", "Related films in the series"],
              ["reviews", "Audience Reviews", "User-written reviews"],
              [
                "distributions",
                "Release Dates",
                "Country-by-country release info",
              ],
              [
                "parentalGuide",
                "Parental Guide",
                "IMDb content advisories & age certifications",
              ],
            ] as [keyof Preferences["filmSections"], string, string][]
          ).map(([key, label, hint_], i, arr) => (
            <div key={key} className={i === arr.length - 1 ? rowLast : row}>
              <div>
                <p className={lbl}>{label}</p>
                {/* <p className={hint}>{hint_}</p> */}
              </div>
              <Toggle
                checked={prefs.filmSections[key] ?? true}
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

      {quotaOpen && (
        <ApiKeyQuotaModal
          apiKeys={prefs.apiKeys}
          onClose={() => setQuotaOpen(false)}
        />
      )}
    </PageContainer>
  );
}
