"use client";
import React from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";

export const NAV_DEPTH_KEY = "cinemix_internal_nav_depth";

interface BackButtonProps {
  desktopOnly?: boolean;
  fallbackHref?: string;
  label?: string;
  className?: string;
  iconOnlyOnPhone?: boolean;
}

export default function BackButton({
  desktopOnly = false,
  fallbackHref = "/",
  label = "Back",
  className = "mb-5",
  iconOnlyOnPhone = false,
}: BackButtonProps) {
  const router = useRouter();

  const handleBack = () => {
    if (typeof window !== "undefined") {
      const depth = parseInt(sessionStorage.getItem(NAV_DEPTH_KEY) || "0", 10);
      if (depth > 1 && window.history.length > 1) {
        sessionStorage.setItem(NAV_DEPTH_KEY, String(Math.max(1, depth - 1)));
        router.back();
        return;
      }
    }
    router.push(fallbackHref);
  };

  return (
    <button
      type="button"
      onClick={handleBack}
      className={`items-center gap-1.5 text-(--text-muted) bg-transparent border-none cursor-pointer text-[13px] py-[6px] px-0 font-[var(--font-body)] hover:text-[var(--text)] transition-colors ${
        desktopOnly ? "hidden md:inline-flex" : "inline-flex"
      } ${className}`.trim()}
    >
      <ChevronLeft size={14} strokeWidth={2.5} />
      <div className={iconOnlyOnPhone ? "hidden sm:inline" : "inline"}>
        {label}
      </div>
    </button>
  );
}
