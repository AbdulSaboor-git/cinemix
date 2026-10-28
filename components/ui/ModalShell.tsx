"use client";
import React, { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { lockScroll, unlockScroll } from "@/lib/scrollLock";
import { useModalBack } from "@/hooks/useModalBack";

interface ModalShellProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  headerRight?: React.ReactNode;
  footer?: React.ReactNode;
  maxWidthClass?: string;
  children: React.ReactNode;
}

export default function ModalShell({
  open,
  onClose,
  title,
  subtitle,
  icon,
  headerRight,
  footer,
  maxWidthClass = "sm:max-w-[520px]",
  children,
}: ModalShellProps) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useModalBack(open, onClose);

  useEffect(() => {
    if (!open) return;
    lockScroll();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCloseRef.current();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      unlockScroll();
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-300 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/78 backdrop-blur-sm fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCloseRef.current();
      }}
    >
      <div
        className={`bg-[var(--bg-card)] border border-[var(--border)] w-full ${maxWidthClass} rounded-t-[22px] sm:rounded-[var(--radius-lg)] overflow-hidden shadow-[0_24px_80px_rgba(0,0,0,0.88)] flex flex-col max-h-[90vh] sm:max-h-[85vh] scale-in`}
      >
        {/* Mobile bottom-sheet drag pill */}
        <div className="sm:hidden flex justify-center pt-2.5 pb-0.5">
          <div className="w-9 h-1 rounded-full bg-white/20" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-5 py-3.5 sm:py-4 border-b border-[var(--border)] flex-shrink-0 gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {icon && (
              <div className="w-9 h-9 rounded-[10px] bg-[var(--accent-dim)] border border-[rgba(229,9,20,0.25)] flex items-center justify-center text-[var(--accent)] flex-shrink-0">
                {icon}
              </div>
            )}
            <div className="min-w-0">
              <h2 className="font-display tracking-[1.2px] text-[var(--text)] text-[16px] sm:text-[18px] leading-none m-0">
                {title}
              </h2>
              {subtitle && (
                <p className="text-[11px] sm:text-[12px] text-[var(--text-muted)] truncate mt-1 m-0">
                  {subtitle}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {headerRight}
            <button
              type="button"
              onClick={() => onCloseRef.current()}
              className="w-8 h-8 rounded-full border border-[var(--border)] flex items-center justify-center cursor-pointer hover:border-[var(--border-hover)] hover:bg-[var(--bg-elevated)] active:scale-95 transition-all text-[var(--text-muted)] hover:text-[var(--text)] bg-transparent"
              aria-label="Close modal"
            >
              <X size={15} strokeWidth={2.5} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 p-4 sm:p-5">{children}</div>

        {/* Footer */}
        {footer && (
          <div
            className="px-4 sm:px-5 py-3 border-t border-[var(--border)] bg-[var(--bg)] flex-shrink-0"
            style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
