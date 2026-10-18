"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Star, ChevronRight, User } from "lucide-react";
import { getPerson } from "@/lib/kinopoisk";
import { PersonDetail, PersonFilm } from "@/types/kinopoisk";
import {
  useTranslate,
  useTranslateHtml,
  useAutoTranslate,
  useFilmTitle,
} from "@/hooks/useTranslate";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import {
  translateRelation,
  translateRole,
  isRussian,
} from "@/lib/translate";
import { hasApiKeys } from "@/lib/preferences";
import BackButton from "@/components/BackButton";
import PageContainer from "@/components/ui/PageContainer";
import SectionHeader from "@/components/ui/SectionHeader";
import TabBar from "@/components/ui/TabBar";
import TabPill from "@/components/ui/TabPill";
import PosterImage from "@/components/ui/PosterImage";
import EmptyState from "@/components/ui/EmptyState";
import NoKeyBanner from "@/components/ui/NoKeyBanner";

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
  HIMSELF: "Self",
  HERSELF: "Self",
  UNKNOWN: "Other",
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

const FILMOGRAPHY_PAGE_SIZE = 20;

export default function PersonClient({ personId }: { personId: string }) {
  const id = parseInt(personId, 10);
  const autoTranslate = useAutoTranslate();
  const [noKey, setNoKey] = useState(false);
  const [person, setPerson] = useState<PersonDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [activeProf, setActiveProf] = useState<string | null>(null);
  const [filmPage, setFilmPage] = useState(1);
  const [showAllFilms, setShowAllFilms] = useState(false);

  const rawName =
    person && autoTranslate && person.nameEn && !isRussian(person.nameEn)
      ? person.nameEn
      : person?.nameRu || person?.nameEn || "Unknown";
  const translatedName = useTranslate(rawName);
  const name = translatedName || rawName;

  const translatedProfession = useTranslate(person?.profession);

  useDocumentTitle(person ? name : "Person");

  useEffect(() => {
    if (!hasApiKeys()) {
      setNoKey(true);
      setLoading(false);
      return;
    }
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

  if (noKey) return <NoKeyBanner />;
  if (loading) return <LoadingSkeleton />;
  if (error || !person) {
    return (
      <PageContainer className="flex items-center justify-center">
        <EmptyState
          icon={<User size={44} />}
          title="Person Not Found"
          description="The requested actor or crew member could not be loaded."
          actionLabel="Back to Home"
          actionHref="/"
        />
      </PageContainer>
    );
  }

  const allFilms = person.films || [];
  const removeDuplicates = (films: PersonFilm[]) => {
    const seen = new Set<number>();
    return films.filter((f) => {
      if (seen.has(f.filmId)) return false;
      seen.add(f.filmId);
      return true;
    });
  };

  const sortFilms = (films: PersonFilm[]) =>
    removeDuplicates(films).sort(
      (a, b) =>
        (parseFloat(b.rating || "0") || 0) - (parseFloat(a.rating || "0") || 0),
    );

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

  const resolvedActiveProf = activeProf ?? (availableProfs[0] || "ALL");

  const allDisplayedFilms =
    resolvedActiveProf === "ALL"
      ? sortFilms(allFilms)
      : sortFilms(profGroups[resolvedActiveProf] || []);

  const filmTotalPages = Math.ceil(
    allDisplayedFilms.length / FILMOGRAPHY_PAGE_SIZE,
  );
  const displayedFilms = showAllFilms
    ? allDisplayedFilms
    : allDisplayedFilms.slice(
        (filmPage - 1) * FILMOGRAPHY_PAGE_SIZE,
        filmPage * FILMOGRAPHY_PAGE_SIZE,
      );

  const professionLabel =
    translatedProfession ||
    (availableProfs[0] ? PROF_LABELS[availableProfs[0]] : "") ||
    person.profession ||
    "";

  return (
    <div className="min-h-screen pb-20">
      {/* Hero */}
      <div className="bg-gradient-to-b from-[var(--bg-card)] to-[var(--bg)] border-b border-[var(--border)] mb-8 sm:mb-10">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-[var(--page-x)] py-6 sm:py-10">
          <BackButton />

          <div className="flex gap-5 sm:gap-[clamp(20px,4vw,40px)] items-start">
            {/* Photo */}
            <PosterImage
              src={person.posterUrl}
              alt={name}
              title={name}
              fallbackType="person"
              priority
              className="rounded-[var(--radius-lg)] overflow-hidden border border-[var(--border)] shadow-[0_8px_32px_rgba(0,0,0,0.5)] flex-shrink-0 w-[95px] sm:w-[140px] md:w-[200px] aspect-[2/3] relative bg-[var(--surface)]"
            />

            {/* Info */}
            <div className="flex-1 min-w-0">
              {professionLabel && (
                <p className="text-[11px] sm:text-[12px] text-[var(--accent)] uppercase tracking-[1.5px] font-semibold mb-1 sm:mb-2">
                  {professionLabel}
                </p>
              )}
              <h1 className="font-display leading-none tracking-[1px] sm:tracking-[2px] mb-2 sm:mb-4 text-[clamp(22px,5vw,64px)]">
                {name}
              </h1>

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
                    value={new Date(person.birthday).toLocaleDateString(
                      "en-US",
                      {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      },
                    )}
                  />
                )}
                {person.birthplace && (
                  <TranslatedInfoItem label="From" value={person.birthplace} />
                )}
                {person.age !== undefined && person.age > 0 && !person.death && (
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
                  <TranslatedInfoItem
                    label="Died in"
                    value={person.deathplace}
                  />
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
                      <SpouseTag
                        key={i}
                        name={s.name}
                        relation={s.relation}
                        divorced={s.divorced}
                        childrenCount={s.children}
                      />
                    ))}
                  </div>
                </div>
              )}

              {person.facts && person.facts.length > 0 && (
                <div className="mt-3 sm:mt-4">
                  <p className="text-[11px] text-[var(--text-muted)] uppercase tracking-[0.8px] mb-[6px]">
                    Facts
                  </p>
                  <ul className="list-none flex flex-col gap-[6px] p-0 m-0">
                    {person.facts.slice(0, 5).map((fact, i) => (
                      <TranslatedFact key={i} html={fact} />
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Filmography */}
      <div className="max-w-[1440px] mx-auto px-4 sm:px-[var(--page-x)]">
        <SectionHeader
          title="FILMOGRAPHY"
          count={allDisplayedFilms.length}
        />

        <TabBar className="mb-6">
          <TabPill
            active={resolvedActiveProf === "ALL"}
            onClick={() => {
              setActiveProf("ALL");
              setFilmPage(1);
              setShowAllFilms(false);
            }}
          >
            All ({allFilms.length})
          </TabPill>
          {availableProfs.map((p) => (
            <TabPill
              key={p}
              active={resolvedActiveProf === p}
              onClick={() => {
                setActiveProf(p);
                setFilmPage(1);
                setShowAllFilms(false);
              }}
            >
              {PROF_LABELS[p] || p} ({profGroups[p].length})
            </TabPill>
          ))}
          {otherProfs.map((p) => (
            <TabPill
              key={p}
              active={resolvedActiveProf === p}
              onClick={() => {
                setActiveProf(p);
                setFilmPage(1);
                setShowAllFilms(false);
              }}
            >
              {PROF_LABELS[p] || p} ({profGroups[p].length})
            </TabPill>
          ))}
        </TabBar>

        {displayedFilms.length === 0 ? (
          <p className="text-[var(--text-muted)] text-[14px] sm:text-[15px]">
            No credits in this category.
          </p>
        ) : (
          <div className="flex flex-col gap-[2px]">
            {displayedFilms.map((film, i) => (
              <FilmEntry
                key={`${film.filmId}-${i}`}
                film={film}
                autoTranslate={autoTranslate}
              />
            ))}
          </div>
        )}

        {filmTotalPages > 1 && (
          <div className="flex items-center gap-2 mt-6 flex-wrap">
            {!showAllFilms && (
              <>
                <button
                  type="button"
                  disabled={filmPage <= 1}
                  onClick={() => setFilmPage((p) => p - 1)}
                  className="px-3 py-[7px] rounded-[8px] text-[12px] font-semibold border border-[var(--border)] bg-[var(--bg-elevated)] text-[var(--text-dim)] disabled:opacity-40 cursor-pointer hover:border-[var(--border-hover)] disabled:cursor-default"
                >
                  ← Prev
                </button>
                <span className="text-[12px] text-[var(--text-muted)] px-2">
                  {filmPage} / {filmTotalPages}
                </span>
                <button
                  type="button"
                  disabled={filmPage >= filmTotalPages}
                  onClick={() => setFilmPage((p) => p + 1)}
                  className="px-3 py-[7px] rounded-[8px] text-[12px] font-semibold border border-[var(--border)] bg-[var(--bg-elevated)] text-[var(--text-dim)] disabled:opacity-40 cursor-pointer hover:border-[var(--border-hover)] disabled:cursor-default"
                >
                  Next →
                </button>
              </>
            )}
            <button
              type="button"
              onClick={() => setShowAllFilms((v) => !v)}
              className="text-[12px] text-[var(--accent)] underline bg-transparent border-none cursor-pointer ml-1"
            >
              {showAllFilms
                ? "Paginate list"
                : `Show all (${allDisplayedFilms.length})`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function SpouseTag({
  name,
  relation,
  divorced,
  childrenCount,
}: {
  name?: string;
  relation?: string;
  divorced?: boolean;
  childrenCount?: number;
}) {
  const translatedName = useTranslate(name || "");
  const relationLabel = relation ? translateRelation(relation) : null;
  return (
    <span className="text-[11px] sm:text-[12px] text-[var(--text-dim)] bg-[var(--bg-card)] border border-[var(--border)] rounded-[6px] px-[8px] sm:px-[10px] py-1">
      {translatedName || name || "Unknown"}
      {relationLabel ? ` (${relationLabel})` : ""}
      {divorced ? " · divorced" : ""}
      {childrenCount
        ? ` · ${childrenCount} child${childrenCount !== 1 ? "ren" : ""}`
        : ""}
    </span>
  );
}

function TranslatedInfoItem({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  const translated = useTranslate(value);
  return <InfoItem label={label} value={translated || value} />;
}

function TranslatedFact({ html }: { html: string }) {
  const text = useTranslateHtml(html);
  return (
    <li className="text-[12px] sm:text-[13px] text-[var(--text-dim)] leading-[1.6] pl-3 border-l-2 border-[var(--accent)]">
      {text}
    </li>
  );
}

function FilmEntry({
  film,
  autoTranslate,
}: {
  film: PersonFilm;
  autoTranslate: boolean;
}) {
  const name = useFilmTitle(film, autoTranslate);
  const roleMapped = film.description
    ? translateRole(film.description, autoTranslate)
    : "";
  const roleTranslated = useTranslate(roleMapped);
  const roleDisplay = roleTranslated || roleMapped;

  const rating = parseFloat(film.rating || "0") || null;
  const profLabel = film.professionKey
    ? PROF_LABELS[film.professionKey] || film.professionKey
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
          {roleDisplay && (
            <p className="text-[11px] sm:text-[12px] text-[var(--text-muted)] mt-[2px] italic">
              {roleDisplay}
            </p>
          )}
        </div>
        {rating && rating > 0 && (
          <div className="flex items-center gap-1 flex-shrink-0">
            <Star size={11} fill="#f5c518" stroke="#f5c518" />
            <span className="font-display text-[15px] sm:text-[16px] text-[#f5c518]">
              {rating.toFixed(1)}
            </span>
          </div>
        )}
        <ChevronRight
          size={14}
          stroke="var(--text-muted)"
          strokeWidth={2}
          className="flex-shrink-0"
        />
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
    <PageContainer>
      <div className="skeleton h-[22px] w-20 rounded-[6px] mb-5 sm:mb-6" />
      <div className="flex gap-5 sm:gap-10">
        <div className="skeleton w-[95px] sm:w-[200px] flex-shrink-0 rounded-[12px] aspect-[2/3]" />
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
    </PageContainer>
  );
}
