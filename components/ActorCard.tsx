"use client";
import Link from "next/link";
import { Staff } from "@/types/kinopoisk";
import { translateRole, isRussian } from "@/lib/translate";
import { useAutoTranslate, useTranslate } from "@/hooks/useTranslate";
import PosterImage from "@/components/ui/PosterImage";

export default function ActorCard({ actor }: { actor: Staff }) {
  const autoTranslate = useAutoTranslate();
  const rawName =
    autoTranslate && actor.nameEn && !isRussian(actor.nameEn)
      ? actor.nameEn
      : actor.nameRu || actor.nameEn || "";
  const translatedName = useTranslate(rawName);
  const name = translatedName || rawName;

  const roleMapped = actor.description
    ? translateRole(actor.description, autoTranslate)
    : "";
  const translatedRole = useTranslate(roleMapped);
  const roleDisplay = translatedRole || roleMapped;

  return (
    <Link href={`/person/${actor.staffId}`} className="no-underline">
      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-lg)] overflow-hidden text-center h-full cursor-pointer transition-all duration-200 active:scale-95 sm:hover:scale-105 hover:border-[rgba(229,9,20,0.3)] hover:shadow-[0_8px_24px_rgba(0,0,0,0.4)]">
        <PosterImage
          src={actor.posterUrl}
          alt={name}
          title={name}
          fallbackType="person"
          className="w-full aspect-[2/3] relative overflow-hidden bg-[var(--surface)]"
        />
        <div className="p-[8px_6px] sm:p-[10px_8px]">
          <p className="text-[11px] sm:text-[12px] font-semibold text-[var(--text)] leading-[1.3] mb-0.5 line-clamp-2">
            {name}
          </p>
          {roleDisplay && (
            <p className="text-[10px] sm:text-[11px] text-[var(--text-muted)] italic overflow-hidden text-ellipsis whitespace-nowrap">
              {roleDisplay}
            </p>
          )}
        </div>
      </div>
    </Link>
  );
}
