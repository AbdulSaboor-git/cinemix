"use client";
/**
 * CineMix Notification System (v2)
 * --------------------------------
 * Cinema-grade glassmorphic toast notifications with:
 * - Smart deduplication & in-place coalescing (prevents duplicate toast spam)
 * - Hover / touch pause & resume with accurate millisecond progress tracking
 * - Horizontal touch swipe-to-dismiss & manual close button
 * - Contextual icons (Heart for Favorites, Clock for Watch Later, Trash for removals, etc.)
 * - Optional mini poster thumbnail, subtitle/description, and interactive Action / Undo button
 * - Smooth two-phase enter & exit animations
 */
import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  type ReactNode,
  type TouchEvent,
} from "react";
import {
  CheckCircle2,
  CircleAlert,
  Info,
  TriangleAlert,
  Heart,
  Clock,
  Trash2,
  Sparkles,
  X,
} from "lucide-react";

export type ToastType = "success" | "error" | "info" | "warning";

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface ToastOptions {
  type?: ToastType;
  description?: string;
  posterUrl?: string | null;
  action?: ToastAction;
  duration?: number;
  icon?: "heart" | "clock" | "trash" | "sparkles" | "default";
  dedupeKey?: string;
}

export interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
  description?: string;
  posterUrl?: string | null;
  action?: ToastAction;
  duration: number;
  icon?: ToastOptions["icon"];
  dedupeKey: string;
  createdAt: number;
  pulseCount: number;
  exiting?: boolean;
}

interface ToastContextValue {
  toasts: ToastItem[];
  push: (message: string, type: ToastType, options?: ToastOptions) => number;
  dismiss: (id: number) => void;
  clearAll: () => void;
}

const ToastContext = createContext<ToastContextValue>({
  toasts: [],
  push: () => 0,
  dismiss: () => {},
  clearAll: () => {},
});

let _globalPush:
  | ((message: string, type: ToastType, options?: ToastOptions) => number)
  | null = null;
let _toastSeq = 1;

const DEFAULT_DURATION_MS: Record<ToastType, number> = {
  success: 3600,
  info: 3600,
  warning: 4200,
  error: 4800,
};

const EXIT_ANIMATION_MS = 220;
const MAX_VISIBLE_TOASTS = 4;

function inferContextualIcon(
  message: string,
  explicit?: ToastOptions["icon"],
): ToastOptions["icon"] {
  if (explicit) return explicit;
  const lower = message.toLowerCase();
  if (lower.includes("favorite")) return "heart";
  if (lower.includes("watch later") || lower.includes("watchlist")) {
    return "clock";
  }
  if (
    lower.includes("removed") ||
    lower.includes("cleared") ||
    lower.includes("deleted")
  ) {
    return "trash";
  }
  if (lower.includes("preset") || lower.includes("restored")) {
    return "sparkles";
  }
  return "default";
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const exitTimersRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(
    new Map(),
  );

  useEffect(() => {
    const timers = exitTimersRef.current;
    return () => {
      timers.forEach((t) => clearTimeout(t));
      timers.clear();
    };
  }, []);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) =>
      prev.map((item) =>
        item.id === id && !item.exiting ? { ...item, exiting: true } : item,
      ),
    );

    if (exitTimersRef.current.has(id)) return;
    const timer = setTimeout(() => {
      exitTimersRef.current.delete(id);
      setToasts((prev) => prev.filter((item) => item.id !== id));
    }, EXIT_ANIMATION_MS);
    exitTimersRef.current.set(id, timer);
  }, []);

  const clearAll = useCallback(() => {
    setToasts((prev) => prev.map((t) => ({ ...t, exiting: true })));
    setTimeout(() => {
      setToasts([]);
    }, EXIT_ANIMATION_MS);
  }, []);

  const push = useCallback(
    (message: string, type: ToastType, options?: ToastOptions): number => {
      const cleanMsg = message.trim();
      const resolvedType: ToastType = options?.type ?? type;
      const dedupeKey =
        options?.dedupeKey ||
        `${resolvedType}:${cleanMsg.toLowerCase()}:${(options?.description || "").toLowerCase()}`;
      const duration =
        options?.duration ??
        (options?.action ? 4600 : DEFAULT_DURATION_MS[resolvedType]);
      const icon = inferContextualIcon(cleanMsg, options?.icon);

      let targetId = 0;

      setToasts((prev) => {
        // Coalesce in-place if an active toast with the same dedupeKey or same film description exists
        const existingIdx = prev.findIndex(
          (t) =>
            !t.exiting &&
            (t.dedupeKey === dedupeKey ||
              (options?.description &&
                t.description === options.description &&
                t.icon === icon)),
        );

        if (existingIdx !== -1) {
          const existing = prev[existingIdx];
          targetId = existing.id;
          const updated: ToastItem = {
            ...existing,
            message: cleanMsg,
            type: resolvedType,
            description: options?.description ?? existing.description,
            posterUrl:
              options?.posterUrl !== undefined
                ? options.posterUrl
                : existing.posterUrl,
            action: options?.action,
            duration,
            icon,
            dedupeKey,
            createdAt: Date.now(),
            pulseCount: existing.pulseCount + 1,
            exiting: false,
          };
          const clone = [...prev];
          clone[existingIdx] = updated;
          return clone;
        }

        targetId = _toastSeq++;
        const nextItem: ToastItem = {
          id: targetId,
          message: cleanMsg,
          type: resolvedType,
          description: options?.description,
          posterUrl: options?.posterUrl,
          action: options?.action,
          duration,
          icon,
          dedupeKey,
          createdAt: Date.now(),
          pulseCount: 0,
          exiting: false,
        };

        const activeList = prev.filter((t) => !t.exiting);
        const trimmed =
          activeList.length >= MAX_VISIBLE_TOASTS
            ? prev.slice(prev.length - (MAX_VISIBLE_TOASTS - 1))
            : prev;
        return [...trimmed, nextItem];
      });

      return targetId;
    },
    [],
  );

  useEffect(() => {
    _globalPush = push;
    return () => {
      if (_globalPush === push) {
        _globalPush = null;
      }
    };
  }, [push]);

  return (
    <ToastContext.Provider value={{ toasts, push, dismiss, clearAll }}>
      {children}
      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  return {
    toast: {
      show: (msg: string, options?: ToastOptions) =>
        ctx.push(msg, options?.type ?? "info", options),
      success: (msg: string, options?: ToastOptions) =>
        ctx.push(msg, "success", options),
      error: (msg: string, options?: ToastOptions) =>
        ctx.push(msg, "error", options),
      info: (msg: string, options?: ToastOptions) =>
        ctx.push(msg, "info", options),
      warning: (msg: string, options?: ToastOptions) =>
        ctx.push(msg, "warning", options),
      dismiss: ctx.dismiss,
      clearAll: ctx.clearAll,
    },
  };
}

/** Call from anywhere outside React tree */
export function toast(
  message: string,
  type: ToastType = "info",
  options?: ToastOptions,
) {
  return _globalPush?.(message, type, options) ?? 0;
}

// ─── Visual Theme & Card Component ──────────────────────────────────────────

interface ToastVisualTheme {
  borderCls: string;
  glowColor: string;
  barColor: string;
  badgeBg: string;
  badgeText: string;
}

function getToastTheme(item: ToastItem): ToastVisualTheme {
  const lower = item.message.toLowerCase();
  const isRemoval =
    lower.includes("removed") ||
    lower.includes("cleared") ||
    lower.includes("deleted");

  if (item.icon === "heart" && !isRemoval) {
    return {
      borderCls: "border-[rgba(229,9,20,0.45)]",
      glowColor: "rgba(229, 9, 20, 0.22)",
      barColor: "#e50914",
      badgeBg: "bg-[rgba(229,9,20,0.18)] border-[rgba(229,9,20,0.4)]",
      badgeText: "text-[#ff3b47]",
    };
  }

  if (item.icon === "clock" && !isRemoval) {
    return {
      borderCls: "border-[rgba(96,165,250,0.45)]",
      glowColor: "rgba(96, 165, 250, 0.22)",
      barColor: "#60a5fa",
      badgeBg: "bg-[rgba(96,165,250,0.18)] border-[rgba(96,165,250,0.4)]",
      badgeText: "text-[#60a5fa]",
    };
  }

  switch (item.type) {
    case "success":
      return {
        borderCls: "border-[rgba(34,197,94,0.42)]",
        glowColor: "rgba(34, 197, 94, 0.2)",
        barColor: "#22c55e",
        badgeBg: "bg-[rgba(34,197,94,0.16)] border-[rgba(34,197,94,0.38)]",
        badgeText: "text-[#4ade80]",
      };
    case "error":
      return {
        borderCls: "border-[rgba(229,9,20,0.5)]",
        glowColor: "rgba(229, 9, 20, 0.25)",
        barColor: "#e50914",
        badgeBg: "bg-[rgba(229,9,20,0.18)] border-[rgba(229,9,20,0.45)]",
        badgeText: "text-[#ff4d57]",
      };
    case "warning":
      return {
        borderCls: "border-[rgba(245,197,24,0.45)]",
        glowColor: "rgba(245, 197, 24, 0.2)",
        barColor: "#f5c518",
        badgeBg: "bg-[rgba(245,197,24,0.16)] border-[rgba(245,197,24,0.38)]",
        badgeText: "text-[#f5c518]",
      };
    case "info":
    default:
      return {
        borderCls: isRemoval
          ? "border-white/[0.16]"
          : "border-[rgba(96,165,250,0.4)]",
        glowColor: isRemoval
          ? "rgba(255, 255, 255, 0.08)"
          : "rgba(96, 165, 250, 0.18)",
        barColor: isRemoval ? "rgba(240,240,240,0.45)" : "#60a5fa",
        badgeBg: isRemoval
          ? "bg-white/[0.08] border-white/[0.16]"
          : "bg-[rgba(96,165,250,0.16)] border-[rgba(96,165,250,0.35)]",
        badgeText: isRemoval ? "text-[var(--text-dim)]" : "text-[#60a5fa]",
      };
  }
}

function renderToastIcon(item: ToastItem) {
  const lower = item.message.toLowerCase();
  const isRemoval =
    lower.includes("removed") ||
    lower.includes("cleared") ||
    lower.includes("deleted");

  if (item.icon === "heart") {
    return (
      <Heart
        size={15}
        fill={isRemoval ? "none" : "currentColor"}
        stroke="currentColor"
        strokeWidth={2.3}
      />
    );
  }
  if (item.icon === "clock") {
    return <Clock size={15} stroke="currentColor" strokeWidth={2.3} />;
  }
  if (item.icon === "trash") {
    return <Trash2 size={14} stroke="currentColor" strokeWidth={2.2} />;
  }
  if (item.icon === "sparkles") {
    return <Sparkles size={15} stroke="currentColor" strokeWidth={2.2} />;
  }

  switch (item.type) {
    case "success":
      return <CheckCircle2 size={16} stroke="currentColor" strokeWidth={2.3} />;
    case "error":
      return <CircleAlert size={16} stroke="currentColor" strokeWidth={2.3} />;
    case "warning":
      return (
        <TriangleAlert size={15} stroke="currentColor" strokeWidth={2.3} />
      );
    case "info":
    default:
      return <Info size={16} stroke="currentColor" strokeWidth={2.3} />;
  }
}

function ToastCard({
  item,
  onDismiss,
}: {
  item: ToastItem;
  onDismiss: (id: number) => void;
}) {
  const [paused, setPaused] = useState(false);
  const [dragX, setDragX] = useState(0);
  const [pulsing, setPulsing] = useState(false);

  const remainingRef = useRef(item.duration);
  const lastStartRef = useRef(Date.now());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchStartXRef = useRef<number | null>(null);

  const theme = getToastTheme(item);

  // Reset countdown when toast is coalesced/updated in-place
  useEffect(() => {
    remainingRef.current = item.duration;
    lastStartRef.current = Date.now();
    if (item.pulseCount > 0) {
      setPulsing(true);
      const t = setTimeout(() => setPulsing(false), 260);
      return () => clearTimeout(t);
    }
  }, [item.createdAt, item.duration, item.pulseCount]);

  // Accurate pause-aware countdown timer
  useEffect(() => {
    if (item.exiting) return;

    if (paused) {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      const elapsed = Date.now() - lastStartRef.current;
      remainingRef.current = Math.max(400, remainingRef.current - elapsed);
      return;
    }

    lastStartRef.current = Date.now();
    timerRef.current = setTimeout(() => {
      onDismiss(item.id);
    }, remainingRef.current);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [paused, item.id, item.createdAt, item.exiting, onDismiss]);

  const handleTouchStart = (e: TouchEvent<HTMLDivElement>) => {
    setPaused(true);
    touchStartXRef.current = e.touches[0]?.clientX ?? null;
  };

  const handleTouchMove = (e: TouchEvent<HTMLDivElement>) => {
    if (touchStartXRef.current === null) return;
    const dx = (e.touches[0]?.clientX ?? 0) - touchStartXRef.current;
    if (dx > -20) {
      setDragX(Math.max(0, dx));
    }
  };

  const handleTouchEnd = () => {
    setPaused(false);
    touchStartXRef.current = null;
    if (dragX > 75) {
      onDismiss(item.id);
    } else {
      setDragX(0);
    }
  };

  return (
    <div
      role="status"
      aria-live="polite"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{
        transform:
          dragX > 0 ? `translate3d(${dragX}px, 0, 0)` : undefined,
        opacity: dragX > 0 ? Math.max(0.2, 1 - dragX / 160) : undefined,
        backgroundImage: `radial-gradient(120px circle at 18px 50%, ${theme.glowColor}, transparent 100%)`,
      }}
      className={`group relative overflow-hidden flex items-center gap-3 rounded-[14px] px-3.5 py-2.5 text-[12.5px] sm:text-[13px] font-medium text-[var(--text)] bg-[#111116]/95 backdrop-blur-2xl [-webkit-backdrop-filter:blur(24px)] border ${theme.borderCls} shadow-[0_14px_40px_rgba(0,0,0,0.75),inset_0_1px_0_rgba(255,255,255,0.08)] pointer-events-auto select-none transition-all duration-200 ${
        item.exiting
          ? "toast-exit"
          : pulsing
            ? "scale-[1.03]"
            : "toast-enter"
      }`}
    >
      {/* Left Thumbnail or Contextual Icon Badge */}
      {item.posterUrl ? (
        <div className="relative w-8 h-11 rounded-[6px] overflow-hidden flex-shrink-0 bg-[var(--surface)] border border-white/10 shadow-sm">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={item.posterUrl}
            alt=""
            className="w-full h-full object-cover block"
          />
          <div
            className={`absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full flex items-center justify-center bg-[#111116] ${theme.badgeText}`}
          >
            <span className="scale-75">{renderToastIcon(item)}</span>
          </div>
        </div>
      ) : (
        <div
          className={`w-8 h-8 rounded-[9px] border flex items-center justify-center flex-shrink-0 ${theme.badgeBg} ${theme.badgeText}`}
        >
          {renderToastIcon(item)}
        </div>
      )}

      {/* Message & Optional Film Title / Description */}
      <div className="flex-1 min-w-0 pr-1">
        <p className="font-semibold text-white text-[12.5px] sm:text-[13px] leading-snug truncate m-0">
          {item.message}
        </p>
        {item.description && (
          <p className="text-[11px] sm:text-[11.5px] text-[var(--text-dim)] truncate m-0 mt-0.5 leading-tight">
            {item.description}
          </p>
        )}
      </div>

      {/* Optional Interactive Action Button (e.g. Undo / View) */}
      {item.action && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            item.action?.onClick();
            onDismiss(item.id);
          }}
          className="flex-shrink-0 px-2.5 py-1 rounded-[7px] text-[11px] font-bold uppercase tracking-[0.4px] bg-white/[0.09] hover:bg-white/[0.16] text-white border border-white/[0.14] cursor-pointer transition-colors active:scale-95"
        >
          {item.action.label}
        </button>
      )}

      {/* Manual Close Button */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onDismiss(item.id);
        }}
        aria-label="Dismiss notification"
        className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[var(--text-muted)] hover:text-white hover:bg-white/10 bg-transparent border-none cursor-pointer transition-colors -mr-1"
      >
        <X size={13} strokeWidth={2.3} />
      </button>

      {/* Bottom Live Countdown Progress Bar */}
      <div className="absolute bottom-0 left-0 right-0 h-[2.5px] bg-white/[0.05] overflow-hidden pointer-events-none">
        <div
          key={`${item.id}-${item.pulseCount}`}
          style={{
            backgroundColor: theme.barColor,
            animationDuration: `${item.duration}ms`,
            animationPlayState: paused ? "paused" : "running",
          }}
          className="h-full w-full origin-left toast-progress-bar"
        />
      </div>
    </div>
  );
}

function ToastStack({
  toasts,
  onDismiss,
}: {
  toasts: ToastItem[];
  onDismiss: (id: number) => void;
}) {
  if (toasts.length === 0) return null;
  return (
    <div
      aria-label="Notifications"
      className="fixed bottom-[82px] md:bottom-7 right-3.5 sm:right-6 flex flex-col gap-2 z-[10000] pointer-events-none w-[calc(100vw-28px)] sm:w-[360px] max-w-[380px]"
    >
      {toasts.map((t) => (
        <ToastCard key={t.id} item={t} onDismiss={onDismiss} />
      ))}
    </div>
  );
}
