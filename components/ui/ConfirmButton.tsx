"use client";
import React, { useState } from "react";

interface ConfirmButtonProps {
  label: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  className?: string;
}

export default function ConfirmButton({
  label,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  onConfirm,
  className = "flex-1",
}: ConfirmButtonProps) {
  const [confirming, setConfirming] = useState(false);

  if (confirming) {
    return (
      <div className={`flex items-center gap-2 ${className}`.trim()}>
        <button
          type="button"
          onClick={() => {
            onConfirm();
            setConfirming(false);
          }}
          className="flex-1 bg-[rgba(229,9,20,0.15)] border border-[rgba(229,9,20,0.5)] text-[var(--accent)] rounded-[var(--radius)] px-3 py-[9px] text-[12px] font-semibold cursor-pointer transition-all active:scale-95 whitespace-nowrap"
        >
          {confirmLabel}
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          className="flex-1 bg-[var(--bg-elevated)] border border-[var(--border)] text-[var(--text-muted)] rounded-[var(--radius)] px-3 py-[9px] text-[12px] font-medium cursor-pointer hover:border-[var(--border-hover)] transition-all active:scale-95 whitespace-nowrap"
        >
          {cancelLabel}
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setConfirming(true)}
      className={`bg-transparent border border-[var(--border)] text-[var(--text-muted)] rounded-[var(--radius)] px-4 py-[9px] text-[12px] font-medium cursor-pointer hover:border-[rgba(229,9,20,0.4)] hover:text-[var(--accent)] transition-all active:scale-95 whitespace-nowrap ${className}`.trim()}
    >
      {label}
    </button>
  );
}
