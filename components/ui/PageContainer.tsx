"use client";
import React from "react";

interface PageContainerProps {
  variant?: "default" | "narrow" | "bleed";
  className?: string;
  children: React.ReactNode;
}

export default function PageContainer({
  variant = "default",
  className = "",
  children,
}: PageContainerProps) {
  const base =
    variant === "narrow"
      ? "max-w-[780px] mx-auto px-4 sm:px-[var(--page-x)] pt-7 sm:pt-10 pb-20 min-h-screen"
      : variant === "bleed"
        ? "w-full pb-20 min-h-screen"
        : "max-w-[1440px] mx-auto px-4 sm:px-[var(--page-x)] pt-7 sm:pt-10 pb-20 min-h-screen";

  return <div className={`${base} ${className}`.trim()}>{children}</div>;
}
