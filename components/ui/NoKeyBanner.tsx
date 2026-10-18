"use client";
import Link from "next/link";
import { KeyRound, Settings } from "lucide-react";

export default function NoKeyBanner() {
  return (
    <div className="min-h-[calc(100vh-var(--nav-height))] flex items-center justify-center bg-[var(--bg)] px-4 sm:px-[var(--page-x)] py-12">
      <div className="w-full max-w-[480px] text-center fade-up">
        <div
          className="w-[64px] h-[64px] sm:w-[72px] sm:h-[72px] rounded-full mx-auto mb-6 sm:mb-7 flex items-center justify-center bg-[var(--accent-dim)] border border-[rgba(229,9,20,0.2)]"
          style={{ boxShadow: "0 0 48px var(--accent-glow)" }}
        >
          <KeyRound size={26} stroke="var(--accent)" strokeWidth={1.8} />
        </div>

        <h2 className="font-display text-[clamp(20px,5vw,30px)] tracking-[2px] text-[var(--text)] mb-4">
          API KEY REQUIRED
        </h2>

        <p className="text-[13px] sm:text-[14px] text-[var(--text-dim)] leading-[1.8] mb-8 px-2">
          CineMix needs a Kinopoisk API key to load content. Get a free key at{" "}
          <a
            href="https://kinopoiskapiunofficial.tech"
            target="_blank"
            rel="noreferrer"
            className="text-[var(--accent)] hover:underline break-all"
          >
            kinopoiskapiunofficial.tech
          </a>{" "}
          then add it in preferences.
        </p>

        <Link href="/preferences" className="no-underline inline-flex">
          <span className="btn btn-primary px-6 sm:px-8 py-[11px] text-[13px] sm:text-[14px]">
            <Settings size={14} strokeWidth={2.5} />
            Open Preferences
          </span>
        </Link>
      </div>
    </div>
  );
}
