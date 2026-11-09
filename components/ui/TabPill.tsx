"use client";
import React, { useEffect, useRef } from "react";
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
  const pillRef = useRef<HTMLElement | null>(null);

  // Smoothly center the active pill inside its horizontal TabBar container without scrolling the vertical page
  useEffect(() => {
    if (!active || !pillRef.current) return;
    const el = pillRef.current;
    const parent = el.parentElement;
    if (!parent || parent.scrollWidth <= parent.clientWidth) return;
    const targetLeft =
      el.offsetLeft - parent.clientWidth / 2 + el.clientWidth / 2;
    parent.scrollTo({
      left: Math.max(0, targetLeft),
      behavior: "smooth",
    });
  }, [active]);

  const cls =
    `flex-shrink-0 px-3 sm:px-4 py-[7px] sm:py-[8px] rounded-[8px] text-[12px] sm:text-[13px] font-semibold cursor-pointer transition-all duration-[180ms] whitespace-nowrap inline-flex items-center gap-1.5 border ${
      active
        ? "bg-[var(--accent)] text-white border-[var(--accent)]"
        : "bg-[var(--bg-elevated)] text-[var(--text-dim)] border-[var(--border)] hover:border-[var(--border-hover)] hover:text-[var(--text)]"
    } ${className}`.trim();

  if (href) {
    return (
      <Link
        href={href}
        ref={(node) => {
          pillRef.current = node;
        }}
        className="no-underline shrink-0"
      >
        <span className={cls}>{children}</span>
      </Link>
    );
  }

  return (
    <button
      ref={(node) => {
        pillRef.current = node;
      }}
      type="button"
      onClick={onClick}
      className={cls}
    >
      {children}
    </button>
  );
}
