"use client";
import { useEffect, useRef } from "react";

/**
 * Intercepts the browser/mobile hardware Back button while a modal is open
 * so pressing hardware Back closes the modal cleanly, while clicking links
 * or buttons inside the modal (like "Watch Now") never gets undone by an
 * asynchronous history.back() call.
 */
export function useModalBack(isOpen: boolean, onClose: () => void) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!isOpen || typeof window === "undefined") return;

    const modalToken = `modal_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const openedHref = window.location.href;

    const currentState =
      typeof window.history.state === "object" && window.history.state !== null
        ? window.history.state
        : {};

    window.history.pushState(
      { ...currentState, cinemixModalToken: modalToken },
      "",
      openedHref,
    );

    const handlePopState = () => {
      onCloseRef.current();
    };

    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("popstate", handlePopState);
      // Clean up the modal token in-place using replaceState if still on the same URL,
      // avoiding history.back() which would cancel in-flight Next.js Link/router.push navigations.
      if (
        window.location.href === openedHref &&
        window.history.state &&
        window.history.state.cinemixModalToken === modalToken
      ) {
        const cleanedState = { ...window.history.state };
        delete cleanedState.cinemixModalToken;
        window.history.replaceState(cleanedState, "", window.location.href);
      }
    };
  }, [isOpen]);
}