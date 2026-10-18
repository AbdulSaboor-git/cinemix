"use client";
import React from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

interface SectionHeaderProps {
  title: string;
  count?: number;
  badges?: React.ReactNode;
  href?: string;
  linkLabel?: string;
  rightSlot?: React.ReactNode;
  className?: string;
}

export default function SectionHeader({
  title,
  count,
  badges,
  href,
  linkLabel = "See all",
  rightSlot,
  className = "mb-4 sm:mb-5",
}: SectionHeaderProps) {
  return (
    <div
      className={`flex items-center justify-between flex-wrap gap-3 ${className}`.trim()}
    >
      <div className="flex items-center gap-3 flex-wrap">
        <h2 className="font-display font-bold uppercase text-[clamp(18px,2.5vw,26px)] tracking-[1.5px] text-white leading-none m-0">
          {title}
        </h2>
        {count !== undefined && (
          <span className="text-[11px] sm:text-[12px] text-[var(--text-muted)] font-medium">
            ({count.toLocaleString()})
          </span>
        )}
        {badges}
      </div>
      <div className="flex items-center gap-3">
        {rightSlot}
        {href && (
          <Link
            href={href}
            className="text-[11px] font-bold text-[var(--accent)] no-underline flex items-center gap-1 tracking-[1px] uppercase flex-shrink-0 opacity-85 hover:opacity-100 transition-opacity"
          >
            {linkLabel}
            <ArrowRight size={11} strokeWidth={3} />
          </Link>
        )}
      </div>
    </div>
  );
}
