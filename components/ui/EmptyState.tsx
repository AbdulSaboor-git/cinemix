"use client";
import React from "react";
import Link from "next/link";

interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description?: string;
  actionLabel?: string;
  actionHref?: string;
  onAction?: () => void;
  className?: string;
}

export default function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  actionHref,
  onAction,
  className = "py-20 sm:py-28",
}: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center text-center gap-3 px-4 ${className}`.trim()}
    >
      <div className="w-16 h-16 rounded-full bg-[var(--bg-elevated)] border border-[var(--border)] flex items-center justify-center text-[var(--text-muted)] mb-1">
        {icon}
      </div>
      <p className="font-display tracking-[1.2px] text-[20px] sm:text-[24px] text-[var(--text)] leading-none m-0">
        {title}
      </p>
      {description && (
        <p className="text-[13px] sm:text-[14px] text-[var(--text-muted)] max-w-[360px] leading-[1.6]">
          {description}
        </p>
      )}
      {actionLabel && actionHref && (
        <Link href={actionHref} className="no-underline mt-2">
          <span className="btn btn-primary px-5 py-2.5 text-[13px]">
            {actionLabel}
          </span>
        </Link>
      )}
      {actionLabel && !actionHref && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="btn btn-primary px-5 py-2.5 text-[13px] mt-2"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
