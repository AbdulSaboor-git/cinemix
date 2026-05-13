"use client";
import { useEffect, useState } from "react";
import { getPerson } from "@/lib/kinopoisk";
import { PersonDetail, PersonFilm } from "@/types/kinopoisk";
import Link from "next/link";
import { useTranslate } from "@/hooks/useTranslate";

const PROF_LABELS: Record<string, string> = {
  ACTOR: "Actor",
  DIRECTOR: "Director",
  WRITER: "Writer",
  PRODUCER: "Producer",
  COMPOSER: "Composer",
  EDITOR: "Editor",
  OPERATOR: "Cinematographer",
  DESIGN: "Production Design",
  VOICE_DIRECTOR: "Voice Director",
  UNKNOWN: "",
};
const PROF_ORDER = [
  "ACTOR",
  "DIRECTOR",
  "WRITER",
  "PRODUCER",
  "COMPOSER",
  "OPERATOR",
  "DESIGN",
  "EDITOR",
  "VOICE_DIRECTOR",
];

export default function PersonClient({ personId }: { personId: string }) {
  const id = parseInt(personId);
  const [person, setPerson] = useState<PersonDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [activeProf, setActiveProf] = useState<string>("ALL");
  const [showSpoilers, setShowSpoilers] = useState(false);

  useEffect(() => {
    if (isNaN(id)) {
      setError(true);
      setLoading(false);
      return;
    }
    setLoading(true);
    getPerson(id)
      .then((p) => setPerson(p))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <LoadingSkeleton />;
  if (error || !person)
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center gap-4 px-4 text-center">
        <p className="text-[20px] sm:text-[22px] font-display">
          Person not found
        </p>
        <Link href="/" className="text-[var(--accent)]">
          ← Back to home
        </Link>
      </div>
    );

  const name = person.nameEn || person.nameRu || "Unknown";
  const allFilms = person.films || [];
  const sortFilms = (films: PersonFilm[]) =>
    removeDuplicates(films).sort(
      (a, b) =>
        (parseFloat(b.rating || "0") || 0) - (parseFloat(a.rating || "0") || 0),
    );

  // remove films with duplicate filmId
  const removeDuplicates = (films: PersonFilm[]) => {
    const seen = new Set();
    return films.filter((f) => {
      if (seen.has(f.filmId)) return false;
      seen.add(f.filmId);
      return true;
    });
  };

  const profGroups: Record<string, PersonFilm[]> = {};
  for (const film of allFilms) {
    const key = film.professionKey || "UNKNOWN";
    if (!profGroups[key]) profGroups[key] = [];
    profGroups[key].push(film);
  }

  const availableProfs = PROF_ORDER.filter((p) => profGroups[p]?.length > 0);
  const otherProfs = Object.keys(profGroups).filter(
    (p) => !PROF_ORDER.includes(p) && profGroups[p].length > 0,
  );
  const displayedFilms =
    activeProf === "ALL"
      ? sortFilms(allFilms)
      : sortFilms(profGroups[activeProf] || []);
  const profession =
    person.profession ||
    (availableProfs[0] ? PROF_LABELS[availableProfs[0]] : "");

  return (
    <div className="min-h-screen pb-20">
      {/* Hero */}
      <div className="bg-gradient-to-b from-[var(--bg-card)] to-[var(--bg)] border-b border-[var(--border)] mb-8 sm:mb-10 px-4 sm:px-[var(--page-x)] py-6 sm:py-10">
        <button
          onClick={() => window.history.back()}
          className="inline-flex items-center gap-[6px] text-[var(--text-muted)] bg-transparent border-none cursor-pointer text-[13px] mb-5 sm:mb-6 p-0"
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

        <div className="flex gap-5 sm:gap-[clamp(20px,4vw,40px)] items-start">
          {/* Photo */}
          <div className="rounded-[var(--radius-lg)] overflow-hidden border border-[var(--border)] shadow-[0_8px_32px_rgba(0,0,0,0.5)] flex-shrink-0 w-[90px] sm:w-[130px] md:w-[200px]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={person.posterUrl || ""}
              alt={name}
              className="w-full aspect-[2/3] object-cover block bg-[var(--surface)]"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
              draggable={false}
            />
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            {profession && (
              <p className="text-[11px] sm:text-[12px] text-[var(--accent)] uppercase tracking-[1.5px] font-semibold mb-1 sm:mb-2">
                {profession}
              </p>
            )}
            <h1 className="font-display leading-none tracking-[1px] sm:tracking-[2px] mb-2 sm:mb-4 text-[clamp(22px,5vw,64px)]">
              {name}
            </h1>

            {/* Info grid — 2-col on mobile */}
            <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-x-4 gap-y-3 sm:gap-6 mb-4">
              {person.sex && person.sex !== "UNKNOWN" && (
                <InfoItem
                  label="Gender"
                  value={person.sex === "MALE" ? "Male" : "Female"}
                />
              )}
              {person.birthday && (
                <InfoItem
                  label="Born"
                  value={new Date(person.birthday).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                />
              )}
              {person.birthplace && (
                <InfoItem label="From" value={person.birthplace} />
              )}
              {person.age && !person.death && (
                <InfoItem label="Age" value={String(person.age)} />
              )}
              {person.death && (
                <InfoItem
                  label="Died"
                  value={new Date(person.death).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                />
              )}
              {person.deathplace && (
                <InfoItem label="Died in" value={person.deathplace} />
              )}
              {person.hasAwards !== undefined && person.hasAwards > 0 && (
                <InfoItem label="Awards" value={`${person.hasAwards}`} />
              )}
              <InfoItem label="Credits" value={String(allFilms.length)} />
            </div>

            {person.spouses && person.spouses.length > 0 && (
              <div className="mt-2">
                <p className="text-[11px] text-[var(--text-muted)] uppercase tracking-[0.8px] mb-[6px]">
                  Relationships
                </p>
                <div className="flex flex-wrap gap-[6px] sm:gap-2">
                  {person.spouses.map((s, i) => (
                    <span
                      key={i}
                      className="text-[11px] sm:text-[12px] text-[var(--text-dim)] bg-[var(--bg-card)] border border-[var(--border)] rounded-[6px] px-[8px] sm:px-[10px] py-1"
                    >
                      {s.name || "Unknown"}
                      {s.divorced ? " (divorced)" : ""}
                      {s.children
                        ? ` · ${s.children} child${s.children !== 1 ? "ren" : ""}`
                        : ""}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {person.facts && person.facts.length > 0 && (
              <div className="mt-3 sm:mt-4">
                <p className="text-[11px] text-[var(--text-muted)] uppercase tracking-[0.8px] mb-[6px]">
                  Facts
                </p>
                <ul className="list-none flex flex-col gap-[6px]">
                  {person.facts.slice(0, 5).map((fact, i) => (
                    <li
                      key={i}
                      className="text-[12px] sm:text-[13px] text-[var(--text-dim)] leading-[1.6] pl-3 border-l-2 border-[var(--accent)]"
                      dangerouslySetInnerHTML={{ __html: fact }}
                    />
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Filmography */}
      <div className="px-4 sm:px-[var(--page-x)]">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-5 sm:mb-6">
          <h2 className="font-display tracking-[1.5px] text-[clamp(18px,3vw,30px)]">
            FILMOGRAPHY
          </h2>
          <span className="text-[12px] sm:text-[13px] text-[var(--text-muted)]">
            {displayedFilms.length} credit
            {displayedFilms.length !== 1 ? "s" : ""}
          </span>
        </div>

        {/* Prof tabs — horizontally scrollable on mobile */}
        <div className="flex gap-[6px] mb-6 sm:mb-7 overflow-x-auto pb-1 -mx-4 px-4 sm:mx-0 sm:px-0 scrollbar-none flex-nowrap sm:flex-wrap">
          <ProfTab
            label={`All (${allFilms.length})`}
            active={activeProf === "ALL"}
            onClick={() => setActiveProf("ALL")}
          />
          {availableProfs.map((p) => (
            <ProfTab
              key={p}
              label={`${PROF_LABELS[p] || p} (${profGroups[p].length})`}
              active={activeProf === p}
              onClick={() => setActiveProf(p)}
            />
          ))}
          {otherProfs.map((p) => (
            <ProfTab
              key={p}
              label={`${PROF_LABELS[p] || p} (${profGroups[p].length})`}
              active={activeProf === p}
              onClick={() => setActiveProf(p)}
            />
          ))}
        </div>

        {displayedFilms.length === 0 ? (
          <p className="text-[var(--text-muted)] text-[14px] sm:text-[15px]">
            No credits in this category.
          </p>
        ) : (
          <div className="flex flex-col gap-[2px]">
            {displayedFilms.map((film, i) => (
              <FilmEntry
                key={`${film.filmId}`}
                film={film}
                showSpoilers={showSpoilers}
              />
            ))}
          </div>
        )}

        <button
          onClick={() => setShowSpoilers((v) => !v)}
          className="mt-6 text-[12px] text-[var(--text-muted)] bg-transparent border-none cursor-pointer p-0 underline min-h-[40px]"
          style={{ fontFamily: "var(--font-body)" }}
        >
          {showSpoilers ? "Hide character spoilers" : "Show character spoilers"}
        </button>
      </div>
    </div>
  );
}

function ProfTab({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-shrink-0 px-3 sm:px-4 py-2 rounded-[8px] text-[12px] sm:text-[13px] font-semibold cursor-pointer transition-all duration-[180ms] min-h-[36px]
        ${active ? "bg-[var(--accent)] text-white border border-[var(--accent)]" : "bg-[var(--bg-elevated)] text-[var(--text-dim)] border border-[var(--border)] hover:border-[var(--border-hover)]"}`}
    >
      {label}
    </button>
  );
}

function FilmEntry({
  film,
  showSpoilers,
}: {
  film: PersonFilm;
  showSpoilers: boolean;
}) {
  const name = film.nameEn || film.nameRu || "Unknown";
  const rating = parseFloat(film.rating || "0") || null;
  const profLabel = film.professionKey
    ? {
        ACTOR: "Actor",
        DIRECTOR: "Director",
        WRITER: "Writer",
        PRODUCER: "Producer",
        COMPOSER: "Composer",
        OPERATOR: "DOP",
        DESIGN: "Prod. Design",
        EDITOR: "Editor",
      }[film.professionKey] || film.professionKey
    : null;

  return (
    <Link href={`/film/${film.filmId}`} className="no-underline">
      <div className="flex items-center gap-3 sm:gap-4 px-3 sm:px-4 py-[12px] sm:py-[14px] rounded-[10px] border border-transparent transition-all duration-[180ms] cursor-pointer hover:bg-[var(--bg-card)] hover:border-[var(--border)] active:bg-[var(--bg-card)] sm:hover:translate-x-1">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-[13px] sm:text-[15px] font-semibold text-[var(--text)] overflow-hidden text-ellipsis whitespace-nowrap">
              {name}
            </p>
            {profLabel && (
              <span className="text-[10px] text-[var(--text-muted)] bg-[var(--surface)] rounded-[4px] px-[6px] py-[2px] flex-shrink-0">
                {profLabel}
              </span>
            )}
            {!film.general && (
              <span className="text-[10px] text-[var(--text-muted)] bg-[var(--bg-elevated)] rounded-[4px] px-[6px] py-[2px] flex-shrink-0">
                minor
              </span>
            )}
          </div>
          {film.description && (
            <p className="text-[11px] sm:text-[12px] text-[var(--text-muted)] mt-[2px] italic">
              {showSpoilers
                ? film.description
                : film.description.length > 40
                  ? film.description.slice(0, 40) + "…"
                  : film.description}
            </p>
          )}
        </div>
        {rating && rating > 0 && (
          <div className="flex items-center gap-1 flex-shrink-0">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="#f5c518">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
            <span className="font-display text-[15px] sm:text-[16px] text-[#f5c518]">
              {rating.toFixed(1)}
            </span>
          </div>
        )}
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--text-muted)"
          strokeWidth="2"
          className="flex-shrink-0"
        >
          <path d="M9 18l6-6-6-6" />
        </svg>
      </div>
    </Link>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] sm:text-[11px] text-[var(--text-muted)] uppercase tracking-[0.8px] mb-[2px]">
        {label}
      </p>
      <p className="text-[12px] sm:text-[14px] text-[var(--text-dim)] font-medium truncate">
        {value}
      </p>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="min-h-screen px-4 sm:px-[var(--page-x)] py-8 sm:py-10">
      <div className="skeleton h-[22px] w-20 rounded-[6px] mb-5 sm:mb-6" />
      <div className="flex gap-5 sm:gap-10">
        <div className="skeleton w-[90px] sm:w-[200px] flex-shrink-0 rounded-[12px] aspect-[2/3]" />
        <div className="flex-1 flex flex-col gap-3 sm:gap-4">
          <div className="skeleton h-9 sm:h-12 w-[60%] rounded-[8px]" />
          <div className="skeleton h-4 sm:h-5 w-[40%] rounded-[8px]" />
          <div className="flex gap-3 sm:gap-6 mt-3 sm:mt-4">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="skeleton h-10 w-[100px] sm:w-[120px] rounded-[8px]"
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
