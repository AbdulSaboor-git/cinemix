"use client";
import { useState, useEffect, useCallback } from "react";
import {
  Preferences,
  DEFAULT_PREFERENCES,
  getPreferences,
  savePreferences,
} from "@/lib/preferences";

// ─── Small design tokens reused throughout ────────────────────────────────────

const S = {
  page: {
    minHeight: "100vh",
    background: "var(--bg)",
    padding: "48px clamp(16px, 5vw, 48px) 80px",
  } as React.CSSProperties,

  shell: {
    maxWidth: 760,
    margin: "0 auto",
  } as React.CSSProperties,

  header: {
    marginBottom: 40,
    paddingBottom: 24,
    borderBottom: "1px solid var(--border)",
  } as React.CSSProperties,

  card: {
    background: "var(--bg-card)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-lg)",
    overflow: "hidden",
    marginBottom: 20,
  } as React.CSSProperties,

  cardHeader: {
    padding: "18px 24px",
    borderBottom: "1px solid var(--border)",
    display: "flex",
    alignItems: "center",
    gap: 12,
  } as React.CSSProperties,

  cardBody: {
    padding: "8px 0",
  } as React.CSSProperties,

  row: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "14px 24px",
    gap: 16,
    borderBottom: "1px solid var(--border)",
  } as React.CSSProperties,

  rowLast: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "14px 24px",
    gap: 16,
  } as React.CSSProperties,

  label: {
    fontSize: "14px",
    fontWeight: 500,
    color: "var(--text)",
    fontFamily: "var(--font-body)",
  } as React.CSSProperties,

  hint: {
    fontSize: "12px",
    color: "var(--text-muted)",
    marginTop: 2,
    lineHeight: 1.5,
    fontFamily: "var(--font-body)",
  } as React.CSSProperties,
} as const;

// ─── Toggle switch ────────────────────────────────────────────────────────────

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
      style={{
        position: "relative",
        width: 44,
        height: 24,
        borderRadius: 99,
        border: "none",
        background: checked ? "var(--accent)" : "var(--surface)",
        cursor: "pointer",
        flexShrink: 0,
        transition: "background 0.2s",
        outline: "none",
        boxShadow: checked ? "0 0 10px var(--accent-glow)" : "none",
      }}
    >
      <span
        style={{
          position: "absolute",
          top: 3,
          left: checked ? 23 : 3,
          width: 18,
          height: 18,
          borderRadius: "50%",
          background: "white",
          transition: "left 0.2s cubic-bezier(0.4,0,0.2,1)",
          boxShadow: "0 1px 4px rgba(0,0,0,0.4)",
        }}
      />
    </button>
  );
}

// ─── Section heading ──────────────────────────────────────────────────────────

function SectionIcon({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        width: 32,
        height: 32,
        borderRadius: 8,
        background: "var(--accent-dim)",
        border: "1px solid rgba(229,9,20,0.2)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        color: "var(--accent)",
      }}
    >
      {children}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        fontSize: "13px",
        fontWeight: 600,
        letterSpacing: "0.5px",
        textTransform: "uppercase",
        color: "var(--text-dim)",
        fontFamily: "var(--font-body)",
      }}
    >
      {children}
    </span>
  );
}

// ─── Key field row ────────────────────────────────────────────────────────────

type KeyStatus = "idle" | "testing" | "ok" | "exhausted" | "invalid";

const STATUS_META: Record<
  KeyStatus,
  { border: string; iconColor: string; label: string }
> = {
  idle: { border: "var(--border)", iconColor: "", label: "" },
  testing: { border: "var(--border)", iconColor: "", label: "" },
  ok: { border: "rgba(34,197,94,0.4)", iconColor: "#22c55e", label: "Valid" },
  exhausted: {
    border: "rgba(234,179,8,0.4)",
    iconColor: "#eab308",
    label: "Limit reached",
  },
  invalid: {
    border: "rgba(229,9,20,0.4)",
    iconColor: "var(--accent)",
    label: "Invalid key",
  },
};

function KeyField({
  value,
  index,
  total,
  onChange,
  onRemove,
}: {
  value: string;
  index: number;
  total: number;
  onChange: (v: string) => void;
  onRemove: () => void;
}) {
  const [status, setStatus] = useState<KeyStatus>("idle");
  const [focused, setFocused] = useState(false);

  const testKey = useCallback(async () => {
    const trimmed = value.trim();
    if (!trimmed) return;
    setStatus("testing");
    try {
      const base =
        process.env.NEXT_PUBLIC_API_BASE_URL ||
        "https://kinopoiskapiunofficial.tech/api";
      const res = await fetch(`${base}/v2.2/films/filters`, {
        headers: { "X-API-KEY": trimmed, "Content-Type": "application/json" },
      });
      if (res.ok) setStatus("ok");
      else if (res.status === 402 || res.status === 429) setStatus("exhausted");
      else setStatus("invalid");
    } catch {
      setStatus("invalid");
    }
  }, [value]);

  const meta = STATUS_META[status];
  const borderColor = focused ? "rgba(255,255,255,0.2)" : meta.border;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "10px 24px",
        borderBottom: index < total - 1 ? "1px solid var(--border)" : undefined,
      }}
    >
      {/* Index pill */}
      <div
        style={{
          width: 20,
          height: 20,
          borderRadius: "50%",
          background: "var(--surface)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "10px",
          fontWeight: 600,
          color: "var(--text-muted)",
          flexShrink: 0,
          fontFamily: "var(--font-body)",
        }}
      >
        {index + 1}
      </div>

      {/* Input */}
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
        style={{
          flex: 1,
          background: "var(--bg-elevated)",
          border: `1px solid ${borderColor}`,
          borderRadius: "var(--radius)",
          padding: "8px 12px",
          fontSize: "13px",
          fontFamily: "monospace",
          color: "var(--text)",
          outline: "none",
          transition: "border-color 0.18s",
          letterSpacing: "0.3px",
        }}
      />

      {/* Status indicator + label */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 5,
          flexShrink: 0,
          minWidth: 90,
        }}
      >
        <div
          style={{
            width: 18,
            height: 18,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {status === "testing" && (
            <div
              style={{
                width: 13,
                height: 13,
                borderRadius: "50%",
                border: "2px solid var(--surface)",
                borderTopColor: "var(--accent)",
                animation: "spin 0.7s linear infinite",
              }}
            />
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
            style={{
              fontSize: "11px",
              fontWeight: 600,
              color: meta.iconColor,
              fontFamily: "var(--font-body)",
              whiteSpace: "nowrap",
            }}
          >
            {meta.label}
          </span>
        )}
      </div>

      {/* Test button */}
      <button
        onClick={testKey}
        disabled={!value.trim() || status === "testing"}
        title="Test key"
        style={{
          background: "var(--bg-elevated)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius)",
          padding: "6px 10px",
          fontSize: "11px",
          fontWeight: 600,
          color: "var(--text-dim)",
          cursor: value.trim() ? "pointer" : "not-allowed",
          opacity: value.trim() ? 1 : 0.4,
          transition: "all 0.18s",
          fontFamily: "var(--font-body)",
          letterSpacing: "0.3px",
          whiteSpace: "nowrap",
        }}
        onMouseEnter={(e) => {
          if (value.trim())
            (e.currentTarget as HTMLElement).style.borderColor =
              "rgba(255,255,255,0.2)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.borderColor = "var(--border)";
        }}
      >
        Test
      </button>

      {/* Remove button */}
      <button
        onClick={onRemove}
        title="Remove key"
        style={{
          background: "none",
          border: "none",
          cursor: "pointer",
          color: "var(--text-muted)",
          padding: 4,
          borderRadius: 4,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transition: "color 0.15s",
          flexShrink: 0,
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLElement).style.color = "var(--accent)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.color = "var(--text-muted)";
        }}
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

// ─── Home section row ─────────────────────────────────────────────────────────

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

// ─── Main component ───────────────────────────────────────────────────────────

type Toast = { id: number; message: string; type: "success" | "error" };

export default function PreferencesClient() {
  const [prefs, setPrefs] = useState<Preferences>(DEFAULT_PREFERENCES);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);

  // Load from localStorage on mount
  useEffect(() => {
    setPrefs(getPreferences());
    setLoaded(true);
  }, []);

  const pushToast = (message: string, type: Toast["type"]) => {
    const id = Date.now();
    setToasts((t) => [...t, { id, message, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500);
  };

  const handleSave = () => {
    const hasKey = prefs.apiKeys.some((k) => k.trim().length > 0);
    if (!hasKey) {
      pushToast("Add at least one API key before saving.", "error");
      return;
    }
    setSaving(true);
    try {
      const cleaned: Preferences = {
        ...prefs,
        apiKeys: prefs.apiKeys.map((k) => k.trim()).filter(Boolean),
      };
      savePreferences(cleaned);
      setPrefs(cleaned);
      pushToast("Preferences saved.", "success");
    } catch {
      pushToast("Failed to save preferences.", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setPrefs(DEFAULT_PREFERENCES);
    pushToast("Reset to defaults — click Save to apply.", "success");
  };

  const setKey = (i: number, val: string) => {
    const updated = [...prefs.apiKeys];
    updated[i] = val;
    setPrefs((p) => ({ ...p, apiKeys: updated }));
  };

  const removeKey = (i: number) => {
    const updated = prefs.apiKeys.filter((_, idx) => idx !== i);
    setPrefs((p) => ({ ...p, apiKeys: updated }));
  };

  const addKey = () => {
    setPrefs((p) => ({ ...p, apiKeys: [...p.apiKeys, ""] }));
  };

  const setSection = (key: keyof Preferences["homeSections"], val: boolean) => {
    setPrefs((p) => ({
      ...p,
      homeSections: { ...p.homeSections, [key]: val },
    }));
  };

  if (!loaded) {
    return (
      <div
        style={{
          ...S.page,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            width: 24,
            height: 24,
            borderRadius: "50%",
            border: "2px solid var(--surface)",
            borderTopColor: "var(--accent)",
            animation: "spin 0.7s linear infinite",
          }}
        />
      </div>
    );
  }

  return (
    <div style={S.page}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes slideUp { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
        @keyframes fadeOut { from { opacity:1; } to { opacity:0; } }
      `}</style>

      <div style={S.shell}>
        {/* ── Page header ── */}
        <div style={S.header}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              marginBottom: 6,
            }}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--accent)"
              strokeWidth="2"
            >
              <circle cx="12" cy="12" r="3" />
              <path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14" />
              <path d="M15.54 8.46a5 5 0 0 1 0 7.07M8.46 8.46a5 5 0 0 0 0 7.07" />
            </svg>
            <h1
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "clamp(26px,3vw,34px)",
                letterSpacing: "2px",
                color: "var(--text)",
                margin: 0,
              }}
            >
              PREFERENCES
            </h1>
          </div>
          <p
            style={{
              fontSize: "13px",
              color: "var(--text-muted)",
              fontFamily: "var(--font-body)",
              marginLeft: 32,
            }}
          >
            Stored locally in your browser. Never sent to any server.
          </p>
        </div>

        {/* ── API Keys ── */}
        <div style={S.card}>
          <div style={S.cardHeader}>
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
            <div>
              <SectionTitle>API Keys</SectionTitle>
              <p style={{ ...S.hint, marginTop: 0 }}>
                Get free keys at{" "}
                <a
                  href="https://kinopoiskapiunofficial.tech"
                  target="_blank"
                  rel="noreferrer"
                  style={{ color: "var(--accent)", textDecoration: "none" }}
                >
                  kinopoiskapiunofficial.tech
                </a>{" "}
                — keys rotate automatically when the daily limit is hit.
              </p>
            </div>
          </div>

          <div style={S.cardBody}>
            {prefs.apiKeys.length === 0 ? (
              <div style={{ padding: "20px 24px" }}>
                <div
                  style={{
                    background: "rgba(229,9,20,0.06)",
                    border: "1px dashed rgba(229,9,20,0.3)",
                    borderRadius: "var(--radius)",
                    padding: "16px 20px",
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                  }}
                >
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="var(--accent)"
                    strokeWidth="2"
                    style={{ flexShrink: 0 }}
                  >
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  <p
                    style={{
                      fontSize: "13px",
                      color: "var(--text-dim)",
                      fontFamily: "var(--font-body)",
                      lineHeight: 1.5,
                    }}
                  >
                    No API key configured. The app won't be able to load any
                    content until you add one.
                  </p>
                </div>
              </div>
            ) : (
              prefs.apiKeys.map((key, i) => (
                <KeyField
                  key={i}
                  value={key}
                  index={i}
                  total={prefs.apiKeys.length}
                  onChange={(v) => setKey(i, v)}
                  onRemove={() => removeKey(i)}
                />
              ))
            )}

            {/* Add key button */}
            <div style={{ padding: "10px 24px 4px" }}>
              <button
                onClick={addKey}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 7,
                  background: "none",
                  border: "1px dashed var(--border-hover)",
                  borderRadius: "var(--radius)",
                  padding: "7px 14px",
                  fontSize: "12px",
                  fontWeight: 600,
                  color: "var(--text-dim)",
                  cursor: "pointer",
                  fontFamily: "var(--font-body)",
                  transition: "all 0.18s",
                  letterSpacing: "0.3px",
                }}
                onMouseEnter={(e) => {
                  const el = e.currentTarget as HTMLElement;
                  el.style.borderColor = "rgba(229,9,20,0.4)";
                  el.style.color = "var(--accent)";
                }}
                onMouseLeave={(e) => {
                  const el = e.currentTarget as HTMLElement;
                  el.style.borderColor = "var(--border-hover)";
                  el.style.color = "var(--text-dim)";
                }}
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
            </div>
          </div>
        </div>

        {/* ── Search & Suggestions ── */}
        <div style={S.card}>
          <div style={S.cardHeader}>
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
          <div style={S.cardBody}>
            <div style={S.row}>
              <div>
                <p style={S.label}>Search suggestions</p>
                <p style={S.hint}>
                  Show instant film suggestions as you type in the search bar.
                  Disabling saves API calls.
                </p>
              </div>
              <Toggle
                checked={prefs.searchSuggestionsEnabled}
                onChange={(v) =>
                  setPrefs((p) => ({ ...p, searchSuggestionsEnabled: v }))
                }
              />
            </div>

            {prefs.searchSuggestionsEnabled && (
              <>
                <div style={S.row}>
                  <div>
                    <p style={S.label}>Suggestion delay</p>
                    <p style={S.hint}>
                      Wait before firing a request after you stop typing. Higher
                      = fewer API calls.
                    </p>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      flexShrink: 0,
                    }}
                  >
                    <input
                      type="range"
                      min={100}
                      max={1000}
                      step={50}
                      value={prefs.suggestionDebounceMs}
                      onChange={(e) =>
                        setPrefs((p) => ({
                          ...p,
                          suggestionDebounceMs: +e.target.value,
                        }))
                      }
                      style={{
                        width: 100,
                        accentColor: "var(--accent)",
                        cursor: "pointer",
                      }}
                    />
                    <span
                      style={{
                        fontSize: "12px",
                        color: "var(--text-dim)",
                        minWidth: 50,
                        textAlign: "right",
                        fontFamily: "var(--font-body)",
                      }}
                    >
                      {prefs.suggestionDebounceMs}ms
                    </span>
                  </div>
                </div>

                <div style={S.rowLast}>
                  <div>
                    <p style={S.label}>Results shown</p>
                    <p style={S.hint}>
                      How many suggestions appear in the dropdown.
                    </p>
                  </div>
                  <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                    {[3, 4, 6, 8].map((n) => (
                      <button
                        key={n}
                        onClick={() =>
                          setPrefs((p) => ({ ...p, suggestionLimit: n }))
                        }
                        style={{
                          width: 36,
                          height: 32,
                          borderRadius: "var(--radius)",
                          border:
                            prefs.suggestionLimit === n
                              ? "1px solid rgba(229,9,20,0.5)"
                              : "1px solid var(--border)",
                          background:
                            prefs.suggestionLimit === n
                              ? "var(--accent-dim)"
                              : "var(--bg-elevated)",
                          color:
                            prefs.suggestionLimit === n
                              ? "var(--accent)"
                              : "var(--text-dim)",
                          fontSize: "13px",
                          fontWeight: 600,
                          cursor: "pointer",
                          transition: "all 0.15s",
                          fontFamily: "var(--font-body)",
                        }}
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

        {/* ── Content & Display ── */}
        <div style={S.card}>
          <div style={S.cardHeader}>
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
          <div style={S.cardBody}>
            <div style={S.row}>
              <div>
                <p style={S.label}>Auto-translate Russian text</p>
                <p style={S.hint}>
                  Translate descriptions and titles via Google Translate.
                  Disable to reduce external requests.
                </p>
              </div>
              <Toggle
                checked={prefs.autoTranslateEnabled}
                onChange={(v) =>
                  setPrefs((p) => ({ ...p, autoTranslateEnabled: v }))
                }
              />
            </div>

            <div
              style={{
                padding: "16px 24px",
                borderBottom: "1px solid var(--border)",
              }}
            >
              <p style={{ ...S.label, marginBottom: 4 }}>
                Default Explore sort
              </p>
              <p style={{ ...S.hint, marginBottom: 12 }}>
                Which order the Explore page loads with by default.
              </p>
              <div style={{ display: "flex", gap: 6 }}>
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
                        setPrefs((p) => ({ ...p, defaultExploreOrder: o }))
                      }
                      style={{
                        padding: "6px 14px",
                        borderRadius: "var(--radius)",
                        border:
                          prefs.defaultExploreOrder === o
                            ? "1px solid rgba(229,9,20,0.5)"
                            : "1px solid var(--border)",
                        background:
                          prefs.defaultExploreOrder === o
                            ? "var(--accent-dim)"
                            : "var(--bg-elevated)",
                        color:
                          prefs.defaultExploreOrder === o
                            ? "var(--accent)"
                            : "var(--text-dim)",
                        fontSize: "12px",
                        fontWeight: 600,
                        cursor: "pointer",
                        transition: "all 0.15s",
                        fontFamily: "var(--font-body)",
                      }}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div style={{ padding: "16px 24px" }}>
              <p style={{ ...S.label, marginBottom: 4 }}>
                Default Explore type
              </p>
              <p style={{ ...S.hint, marginBottom: 12 }}>
                Which content type the Explore page shows by default.
              </p>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {(
                  [
                    "ALL",
                    "FILM",
                    "TV_SERIES",
                    "TV_SHOW",
                    "MINI_SERIES",
                  ] as const
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
                      onClick={() =>
                        setPrefs((p) => ({ ...p, defaultExploreType: t }))
                      }
                      style={{
                        padding: "6px 14px",
                        borderRadius: "var(--radius)",
                        border:
                          prefs.defaultExploreType === t
                            ? "1px solid rgba(229,9,20,0.5)"
                            : "1px solid var(--border)",
                        background:
                          prefs.defaultExploreType === t
                            ? "var(--accent-dim)"
                            : "var(--bg-elevated)",
                        color:
                          prefs.defaultExploreType === t
                            ? "var(--accent)"
                            : "var(--text-dim)",
                        fontSize: "12px",
                        fontWeight: 600,
                        cursor: "pointer",
                        transition: "all 0.15s",
                        fontFamily: "var(--font-body)",
                      }}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* ── Home Page Sections ── */}
        <div style={S.card}>
          <div style={S.cardHeader}>
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
              <p style={{ ...S.hint, marginTop: 0 }}>
                Each section is a separate API call. Disable rows you don't
                need.
              </p>
            </div>
          </div>
          <div style={S.cardBody}>
            {(
              Object.entries(HOME_SECTION_LABELS) as [
                keyof Preferences["homeSections"],
                string,
              ][]
            ).map(([key, label], i, arr) => (
              <div key={key} style={i === arr.length - 1 ? S.rowLast : S.row}>
                <p style={S.label}>{label}</p>
                <Toggle
                  checked={prefs.homeSections[key]}
                  onChange={(v) => setSection(key, v)}
                />
              </div>
            ))}
          </div>
        </div>

        {/* ── Action bar ── */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            paddingTop: 8,
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <button
            onClick={handleReset}
            style={{
              background: "none",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius)",
              padding: "10px 20px",
              fontSize: "13px",
              fontWeight: 500,
              color: "var(--text-muted)",
              cursor: "pointer",
              fontFamily: "var(--font-body)",
              transition: "all 0.18s",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.borderColor =
                "var(--border-hover)";
              (e.currentTarget as HTMLElement).style.color = "var(--text-dim)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.borderColor =
                "var(--border)";
              (e.currentTarget as HTMLElement).style.color =
                "var(--text-muted)";
            }}
          >
            Reset to defaults
          </button>

          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              background: "var(--accent)",
              border: "none",
              borderRadius: "var(--radius)",
              padding: "10px 28px",
              fontSize: "13px",
              fontWeight: 700,
              color: "white",
              cursor: saving ? "not-allowed" : "pointer",
              fontFamily: "var(--font-body)",
              letterSpacing: "0.5px",
              boxShadow: "0 0 20px var(--accent-glow)",
              opacity: saving ? 0.7 : 1,
              transition: "opacity 0.15s, box-shadow 0.15s",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
            onMouseEnter={(e) => {
              if (!saving)
                (e.currentTarget as HTMLElement).style.boxShadow =
                  "0 0 32px var(--accent-glow)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.boxShadow =
                "0 0 20px var(--accent-glow)";
            }}
          >
            {saving ? (
              <>
                <div
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: "50%",
                    border: "2px solid rgba(255,255,255,0.3)",
                    borderTopColor: "white",
                    animation: "spin 0.7s linear infinite",
                  }}
                />
                Saving…
              </>
            ) : (
              <>
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                Save preferences
              </>
            )}
          </button>
        </div>
      </div>

      {/* ── Toast stack ── */}
      <div
        style={{
          position: "fixed",
          bottom: 28,
          right: 24,
          display: "flex",
          flexDirection: "column",
          gap: 10,
          zIndex: 9999,
          pointerEvents: "none",
        }}
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              background:
                t.type === "success"
                  ? "var(--bg-elevated)"
                  : "rgba(229,9,20,0.15)",
              border: `1px solid ${t.type === "success" ? "var(--border-hover)" : "rgba(229,9,20,0.35)"}`,
              borderRadius: "var(--radius)",
              padding: "10px 16px",
              fontSize: "13px",
              fontFamily: "var(--font-body)",
              color: "var(--text)",
              backdropFilter: "blur(8px)",
              animation: "slideUp 0.25s ease",
              boxShadow: "0 4px 24px rgba(0,0,0,0.4)",
              maxWidth: 320,
              pointerEvents: "auto",
            }}
          >
            {t.type === "success" ? (
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#22c55e"
                strokeWidth="2.5"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
            ) : (
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--accent)"
                strokeWidth="2.5"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            )}
            {t.message}
          </div>
        ))}
      </div>
    </div>
  );
}
