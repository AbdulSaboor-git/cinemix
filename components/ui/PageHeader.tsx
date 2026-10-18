"use client";
import React from "react";

interface PageHeaderProps {
  eyebrow?: string;
  eyebrowIcon?: React.ReactNode;
  eyebrowColor?: string;
  title: string;
  subtitle?: React.ReactNode;
  rightSlot?: React.ReactNode;
  className?: string;
}

export default function PageHeader({
  eyebrow,
  eyebrowIcon,
  eyebrowColor,
  title,
  subtitle,
  rightSlot,
  className = "mb-6 sm:mb-8",
}: PageHeaderProps) {
  return (
    <div className={className}>
      {(eyebrow || eyebrowIcon) && (
        <div
          className="text-[11px] uppercase tracking-[2px] font-semibold flex items-center gap-1.5 mb-1.5"
          style={{ color: eyebrowColor || "var(--text-muted)" }}
        >
          {eyebrowIcon}
          {eyebrow && <span>{eyebrow}</span>}
        </div>
      )}
      <div className="flex items-end justify-between flex-wrap gap-2 sm:gap-3">
        <h1
          suppressHydrationWarning
          className="font-display uppercase leading-none tracking-[1.5px] sm:tracking-[2px] text-[var(--text)] text-[clamp(28px,5vw,56px)] m-0"
        >
          {title}
        </h1>
        {rightSlot && <div className="pb-1">{rightSlot}</div>}
      </div>
      {subtitle && (
        <div className="text-[var(--text-dim)] mt-2 text-[13px] sm:text-[14px]">
          {subtitle}
        </div>
      )}
    </div>
  );
}
