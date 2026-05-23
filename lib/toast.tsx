"use client";
/**
 * CineMix Toast System
 * --------------------
 * Lightweight, zero-dependency toast.
 * Usage:
 *   const { toast } = useToast();
 *   toast.success("Added to favorites!");
 *   toast.error("Something went wrong.");
 *   toast.info("History cleared.");
 */
import {
  createContext,
  useContext,
  useState,
  useCallback,
  ReactNode,
  ReactElement,
} from "react";

export type ToastType = "success" | "error" | "info";

export interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  toasts: ToastItem[];
  push: (message: string, type: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue>({
  toasts: [],
  push: () => {},
});

let _globalPush: ((message: string, type: ToastType) => void) | null = null;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const push = useCallback((message: string, type: ToastType) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, message, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500);
  }, []);

  // Expose globally for non-component usage
  _globalPush = push;

  return (
    <ToastContext.Provider value={{ toasts, push }}>
      {children}
      <ToastStack toasts={toasts} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  return {
    toast: {
      success: (msg: string) => ctx.push(msg, "success"),
      error: (msg: string) => ctx.push(msg, "error"),
      info: (msg: string) => ctx.push(msg, "info"),
    },
  };
}

/** Call from anywhere outside React tree */
export function toast(message: string, type: ToastType = "info") {
  _globalPush?.(message, type);
}

// ─── Toast Stack UI ──────────────────────────────────────────────────────────

const ICONS: Record<ToastType, ReactElement> = {
  success: (
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
  ),
  error: (
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
  ),
  info: (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#60a5fa"
      strokeWidth="2.5"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  ),
};

const BG: Record<ToastType, string> = {
  success: "bg-[rgba(34,197,94,0.1)] border border-[rgba(34,197,94,0.3)]",
  error: "bg-[rgba(229,9,20,0.12)] border border-[rgba(229,9,20,0.35)]",
  info: "bg-[rgba(96,165,250,0.1)] border border-[rgba(96,165,250,0.3)]",
};

function ToastStack({ toasts }: { toasts: ToastItem[] }) {
  if (toasts.length === 0) return null;
  return (
    <div className="fixed bottom-5 sm:bottom-7 right-4 sm:right-6 flex flex-col gap-[10px] z-[9999] pointer-events-none max-w-[calc(100vw-32px)]">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`flex items-center gap-[10px] rounded-[var(--radius)] px-4 py-[10px] text-[12px] sm:text-[13px] text-[var(--text)] backdrop-blur-[8px] shadow-[0_4px_24px_rgba(0,0,0,0.4)] pointer-events-auto slide-down ${BG[t.type]}`}
        >
          <span className="flex-shrink-0">{ICONS[t.type]}</span>
          <span>{t.message}</span>
        </div>
      ))}
    </div>
  );
}
