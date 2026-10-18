"use client";
import React from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";

interface BackButtonProps {
  desktopOnly?: boolean;
  fallbackHref?: string;
  label?: string;
  className?: string;
}

export default function BackButton({
  desktopOnly = false,
  fallbackHref = "/",
  label = "Back",
  className = "mb-5",
}: BackButtonProps) {
  const router = useRouter();

  const handleBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push(fallbackHref);
    }
  };

  return (
    <button
      type="button"
      onClick={handleBack}
      className={`items-center gap-[6px] text-[var(--text-muted)] bg-transparent border-none cursor-pointer text-[13px] py-[6px] px-0 font-[var(--font-body)] hover:text-[var(--text)] transition-colors ${
        desktopOnly ? "hidden md:inline-flex" : "inline-flex"
      } ${className}`.trim()}
    >
      <ChevronLeft size={14} strokeWidth={2.5} />
      {label}
    </button>
  );
}
