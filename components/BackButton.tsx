import React from "react";

export default function BackButton({
  desktopOnly = false,
}: {
  desktopOnly?: boolean;
}) {
  return (
    <button
      onClick={() => window.history.back()}
      className={`items-center gap-[6px] text-[var(--text-muted)] bg-transparent border-none cursor-pointer text-[13px] 
        mb-6 px-4 lg:px-6 py-[6px] font-[var(--font-body)] hover:text-[var(--text)] transition-colors ${desktopOnly ? "hidden md:inline-flex" : "inline-flex"}`}
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
      >
        <path d="M15 18l-6-6 6-6" />
      </svg>
      Back
    </button>
  );
}
