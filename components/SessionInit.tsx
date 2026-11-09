"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { initSession } from "@/lib/session";
import { forceUnlockScroll } from "@/lib/scrollLock";
import { readNavStack, writeNavStack } from "@/components/BackButton";

/** Fires session geo-init once after hydration and tracks internal route changes + scroll safety */
export default function SessionInit() {
  const pathname = usePathname();

  useEffect(() => {
    initSession().catch(() => {});
  }, []);

  useEffect(() => {
    // Safety reset so page scroll is never stuck after route transitions
    forceUnlockScroll();
    if (typeof window !== "undefined" && pathname) {
      try {
        const fullUrl = `${pathname}${window.location.search || ""}`;
        const stack = readNavStack();
        const last = stack[stack.length - 1];
        const lastPathname = last ? last.split("?")[0].split("#")[0] : null;

        if (lastPathname === pathname) {
          // Update query string in-place for same-pathname transitions
          stack[stack.length - 1] = fullUrl;
        } else {
          stack.push(fullUrl);
        }
        writeNavStack(stack);
      } catch {
        // ignore
      }
    }
  }, [pathname]);

  return null;
}
