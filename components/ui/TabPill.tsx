"use client";
import React from "react";
import Link from "next/link";

interface TabPillProps {
  active: boolean;
  onClick?: () => void;
  href?: string;
  children: React.ReactNode;
  className?: string;
}

export default function TabPill({
  active,
  onClick,
  href,
  children,
  className = "",
}: TabPillProps) {
  const cls = `flex-shrink-0 px-3 sm:px-4 py-[7px] sm:py-[8px] rounded-[8px] text-[12px] sm:text-[13px] font-semibold cursor-pointer transition-all duration-[180ms] whitespace-nowrap inline-flex items-center gap-1.5 border ${
    active
      ? "bg-[var(--accent)] text-white border-[var(--accent)] shadow-[0_0_16px_rgba(229,9,20,0.3)]"
      : "bg-[var(--bg-elevated)] text-[var(--text-dim)] border-[var(--border)] hover:border-[var(--border-hover)] hover:text-[var(--text)]"
  } ${className}`.trim();

  if (href) {
    return (
      <Link href={href} className="no-underline shrink-0">
        <span className={cls}>{children}</span>
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} className={cls}>
      {children}
    </button>
  );
}
