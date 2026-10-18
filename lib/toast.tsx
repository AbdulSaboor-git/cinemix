"use client";
/**
 * CineMix Toast System
 * --------------------
 * Lightweight, zero-dependency toast using lucide-react icons.
 */
import {
  createContext,
  useContext,
  useState,
  useCallback,
  ReactNode,
  ReactElement,
} from "react";
import { Check, CircleAlert, Info } from "lucide-react";

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
let _toastSeq = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const push = useCallback((message: string, type: ToastType) => {
    const id = _toastSeq++;
    setToasts((t) => [...t, { id, message, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500);
  }, []);

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
  success: <Check size={14} stroke="#22c55e" strokeWidth={2.5} />,
  error: <CircleAlert size={14} stroke="var(--accent)" strokeWidth={2.5} />,
  info: <Info size={14} stroke="#60a5fa" strokeWidth={2.5} />,
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
