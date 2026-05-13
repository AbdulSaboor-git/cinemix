"use client";
import { useState } from "react";
import { Staff } from "@/types/kinopoisk";
import Link from "next/link";

export default function ActorCard({ actor }: { actor: Staff }) {
  const [imgError, setImgError] = useState(false);
  const name = actor.nameEn || actor.nameRu || "";

  return (
    <Link href={`/person/${actor.staffId}`} className="no-underline">
      <div
        className="bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-lg)] overflow-hidden text-center h-full
        cursor-pointer transition-all duration-200
        active:scale-95 sm:hover:scale-105
        hover:border-[rgba(229,9,20,0.3)] hover:shadow-[0_8px_24px_rgba(0,0,0,0.4)]"
      >
        {!imgError ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={actor.posterUrl || ""}
            alt={name}
            className="w-full aspect-[2/3] object-cover block bg-[var(--surface)]"
            onError={() => setImgError(true)}
            draggable={false}
          />
        ) : (
          <div className="w-full aspect-[2/3] flex flex-col items-center justify-center gap-2 bg-gradient-to-br from-[#1a1a2e] to-[#16213e]">
            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--text-muted)"
              strokeWidth="1.5"
            >
              <circle cx="12" cy="7" r="4" />
              <path d="M20 21a8 8 0 1 0-16 0" />
            </svg>
            <span className="text-[10px] text-[var(--text-muted)] px-2 leading-tight">
              {name}
            </span>
          </div>
        )}
        <div className="p-[8px_6px] sm:p-[10px_8px]">
          <p className="text-[11px] sm:text-[12px] font-semibold text-[var(--text)] leading-[1.3] mb-0.5 line-clamp-2">
            {name}
          </p>
          {actor.description && (
            <p className="text-[10px] sm:text-[11px] text-[var(--text-muted)] italic overflow-hidden text-ellipsis whitespace-nowrap">
              {actor.description}
            </p>
          )}
        </div>
      </div>
    </Link>
  );
}
