"use client";
import { useEffect } from "react";
import { initSession } from "@/lib/session";

/** Fires session geo-init once after hydration — silent, no UI */
export default function SessionInit() {
  useEffect(() => {
    initSession().catch(() => {});
  }, []);
  return null;
}
