"use client";
import { useEffect, useRef } from "react";

/**
 * Intercepts the browser/mobile hardware Back button while a modal is open
 * so pressing Back closes the modal cleanly without leaving the page or
 * double-popping history when closed via UI buttons.
 */
export function useModalBack(isOpen: boolean, onClose: () => void) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!isOpen || typeof window === "undefined") return;

    let poppedByBack = false;
    const modalToken = `modal_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    const currentState =
      typeof window.history.state === "object" && window.history.state !== null
        ? window.history.state
        : {};

    window.history.pushState(
      { ...currentState, cinemixModalToken: modalToken },
      "",
      window.location.href,
    );

    const handlePopState = () => {
      poppedByBack = true;
      onCloseRef.current();
    };

    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("popstate", handlePopState);
      if (
        !poppedByBack &&
        window.history.state &&
        window.history.state.cinemixModalToken === modalToken
      ) {
        window.history.back();
      }
    };
  }, [isOpen]);
}