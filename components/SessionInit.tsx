"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { initSession } from "@/lib/session";
import { forceUnlockScroll } from "@/lib/scrollLock";
import { NAV_DEPTH_KEY } from "@/components/BackButton";

/** Fires session geo-init once after hydration and tracks internal route changes + scroll safety */
export default function SessionInit() {
  const pathname = usePathname();

  useEffect(() => {
    initSession().catch(() => {});
  }, []);

  useEffect(() => {
    // Safety reset so page scroll is never stuck after route transitions
    forceUnlockScroll();
    if (typeof window !== "undefined") {
      try {
        const prev = parseInt(sessionStorage.getItem(NAV_DEPTH_KEY) || "0", 10);
        sessionStorage.setItem(NAV_DEPTH_KEY, String(prev + 1));
      } catch {
        // ignore
      }
    }
  }, [pathname]);

  return null;
}
