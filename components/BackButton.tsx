"use client";
import React from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";

export const NAV_DEPTH_KEY = "cinemix_internal_nav_depth";
export const NAV_STACK_KEY = "cinemix_nav_stack_v1";

export function readNavStack(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = sessionStorage.getItem(NAV_STACK_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

export function writeNavStack(stack: string[]): void {
  if (typeof window === "undefined") return;
  try {
    const trimmed = stack.slice(-40);
    sessionStorage.setItem(NAV_STACK_KEY, JSON.stringify(trimmed));
    sessionStorage.setItem(NAV_DEPTH_KEY, String(trimmed.length));
  } catch {
    // ignore storage errors
  }
}

/**
 * Synchronously updates or pushes the current route (including query params like ?lens=...)
 * onto the internal navigation stack so custom BackButton always restores exact presets/filters.
 */
export function syncRouteInNavStack(fullUrl: string): void {
  if (typeof window === "undefined" || !fullUrl) return;
  try {
    const pathname = fullUrl.split("?")[0].split("#")[0];
    const stack = readNavStack();
    const last = stack[stack.length - 1];
    const lastPathname = last ? last.split("?")[0].split("#")[0] : null;

    if (lastPathname === pathname) {
      stack[stack.length - 1] = fullUrl;
    } else {
      stack.push(fullUrl);
    }
    writeNavStack(stack);
  } catch {
    // ignore
  }
}

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

  const handleBack = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();

    try {
      if (typeof window !== "undefined") {
        const currentPathname = window.location.pathname;
        const stack = readNavStack();

        // Remove any trailing entries that match the current pathname
        // so same-page filter changes, modal pushStates, or iframe navigations
        // never trap the user on the same route or trigger a phantom scroll.
        while (stack.length > 0) {
          const top = stack[stack.length - 1];
          const topPathname = top.split("?")[0].split("#")[0];
          if (topPathname === currentPathname) {
            stack.pop();
          } else {
            break;
          }
        }

        const targetRoute = stack.pop();
        writeNavStack(stack);

        if (targetRoute) {
          router.push(targetRoute);
          return;
        }
      }
    } catch {
      // Fallback to router.push(fallbackHref) below
    }

    router.push(fallbackHref);
  };

  return (
    <button
      type="button"
      onClick={handleBack}
      className={`items-center gap-1.5 text-[var(--text-muted)] bg-transparent border-none cursor-pointer text-[13px] py-[6px] px-0 font-[var(--font-body)] hover:text-[var(--text)] transition-colors ${
        desktopOnly ? "hidden md:inline-flex" : "inline-flex"
      } ${className}`.trim()}
    >
      <ChevronLeft
        size={14}
        strokeWidth={2.5}
        className={`${iconOnlyOnPhone ? " -mt-2 sm:mt-0" : ""}`}
      />
      <div className={iconOnlyOnPhone ? "hidden sm:inline" : "inline"}>
        {label}
      </div>
    </button>
  );
}
