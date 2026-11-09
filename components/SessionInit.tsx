"use client";
import { Suspense, useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { initSession } from "@/lib/session";
import { forceUnlockScroll } from "@/lib/scrollLock";
import { syncRouteInNavStack } from "@/components/BackButton";

function NavTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    forceUnlockScroll();
    if (typeof window !== "undefined" && pathname) {
      const qs = searchParams?.toString() || window.location.search.replace(/^\?/, "");
      const fullUrl = qs ? `${pathname}?${qs}` : pathname;
      syncRouteInNavStack(fullUrl);
    }
  }, [pathname, searchParams]);

  return null;
}

/** Fires session geo-init once after hydration and tracks internal route changes + scroll safety */
export default function SessionInit() {
  useEffect(() => {
    initSession().catch(() => {});
  }, []);

  return (
    <Suspense fallback={null}>
      <NavTracker />
    </Suspense>
  );
}
