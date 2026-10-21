"use client";
import React, { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import {
  Star,
  ChevronRight,
  User,
  Search,
  Heart,
  Clock,
  ShieldAlert,
  Sparkles,
  Film as FilmIcon,
  Tv,
  SlidersHorizontal,
} from "lucide-react";
import {
  getPerson,
  getFilm,
  getCachedFilmMeta,
  CompactFilmMeta,
} from "@/lib/kinopoisk";
import { PersonDetail, PersonFilm, Film } from "@/types/kinopoisk";
import {
  useTranslate,
  useTranslateHtml,
  useAutoTranslate,
  useFilmTitle,
} from "@/hooks/useTranslate";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { useListStatus } from "@/hooks/useListStatus";
import {
  translateRelation,
  translateRole,
  translateGenre,
  translateCountry,
  isRussian,
  formatDateSafe,
} from "@/lib/translate";
import { hasApiKeys } from "@/lib/preferences";
import { toggleFavorite, toggleWatchLater } from "@/lib/userLists";
import { useToast } from "@/lib/toast";
import BackButton from "@/components/BackButton";
import ParentalGuideModal from "@/components/ParentalGuideModal";
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

type CreditSortMode = "RATING" | "YEAR_DESC" | "YEAR_ASC" | "VOTES" | "TITLE";

function formatAgeCert(
  ratingMpaa?: string,
  ratingAgeLimits?: string,
): { label: string; isMature: boolean } | null {
  const mpaaMap: Record<string, string> = {
    g: "G",
    pg: "PG",
    pg13: "PG-13",
    "pg-13": "PG-13",
    r: "R",
    nc17: "NC-17",
    "nc-17": "NC-17",
  };
  const mpaa = ratingMpaa
    ? mpaaMap[ratingMpaa.toLowerCase()] || ratingMpaa.toUpperCase()
    : null;
  const ageNum = ratingAgeLimits
    ? ratingAgeLimits.replace(/^age/i, "") + "+"
    : null;

  if (mpaa && ageNum) {
    return {
      label: `${mpaa} · ${ageNum}`,
      isMature: mpaa === "R" || mpaa === "NC-17" || ageNum === "18+",
    };
  }
  if (mpaa) {
    return {
      label: mpaa,
      isMature: mpaa === "R" || mpaa === "NC-17",
    };
  }
  if (ageNum) {
    return {
      label: ageNum,
      isMature: ageNum === "18+",
    };
  }
  return null;
}

function formatVotesShort(v?: number): string | null {
  if (!v || v <= 0) return null;
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${Math.round(v / 1_000)}K`;
  return String(v);
}

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

  // Filmography Controls
  const [mainRolesOnly, setMainRolesOnly] = useState(false);
  const [creditSearch, setCreditSearch] = useState("");
  const [creditSort, setCreditSort] = useState<CreditSortMode>("RATING");

  // Enriched film metadata map (filmId -> CompactFilmMeta) for year, PG/18+ age rating, runtime, poster, IMDb score, votes, genres
  const [metaMap, setMetaMap] = useState<Record<number, CompactFilmMeta>>({});
  const [parentalModalFilm, setParentalModalFilm] = useState<Film | null>(null);

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
      .then((p) => {
        setPerson(p);
        // Seed initial metaMap from localStorage cache immediately
        const seeded: Record<number, CompactFilmMeta> = {};
        for (const f of p.films || []) {
          const cached = getCachedFilmMeta(f.filmId);
          if (cached) seeded[f.filmId] = cached;
        }
        setMetaMap(seeded);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [id]);

  const allFilms = useMemo(() => person?.films || [], [person]);

  const profGroups = useMemo(() => {
    const groups: Record<string, PersonFilm[]> = {};
    for (const film of allFilms) {
      const key = film.professionKey || "UNKNOWN";
      if (!groups[key]) groups[key] = [];
      groups[key].push(film);
    }
    return groups;
  }, [allFilms]);

  const availableProfs = useMemo(
    () => PROF_ORDER.filter((p) => profGroups[p]?.length > 0),
    [profGroups],
  );
  const otherProfs = useMemo(
    () =>
      Object.keys(profGroups).filter(
        (p) => !PROF_ORDER.includes(p) && profGroups[p].length > 0,
      ),
    [profGroups],
  );

  const resolvedActiveProf = activeProf ?? (availableProfs[0] || "ALL");

  // Deduplicate, filter, and sort credits
  const filteredAndSortedFilms = useMemo(() => {
    const baseList =
      resolvedActiveProf === "ALL"
        ? allFilms
        : profGroups[resolvedActiveProf] || [];

    const seen = new Set<number>();
    const deduped: PersonFilm[] = [];
    for (const f of baseList) {
      if (!f.filmId || seen.has(f.filmId)) continue;
      seen.add(f.filmId);
      deduped.push(f);
    }

    const q = creditSearch.trim().toLowerCase();
    const afterFilter = deduped.filter((f) => {
      if (mainRolesOnly && !f.general) return false;
      if (q) {
        const nEn = (f.nameEn || "").toLowerCase();
        const nRu = (f.nameRu || "").toLowerCase();
        const desc = (f.description || "").toLowerCase();
        const metaYear = metaMap[f.filmId]?.year
          ? String(metaMap[f.filmId].year)
          : "";
        if (
          !nEn.includes(q) &&
          !nRu.includes(q) &&
          !desc.includes(q) &&
          !metaYear.includes(q)
        ) {
          return false;
        }
      }
      return true;
    });

    return [...afterFilter].sort((a, b) => {
      const mA = metaMap[a.filmId];
      const mB = metaMap[b.filmId];
      const rA =
        mA?.ratingImdb ??
        mA?.ratingKinopoisk ??
        (parseFloat(a.rating || "0") || 0);
      const rB =
        mB?.ratingImdb ??
        mB?.ratingKinopoisk ??
        (parseFloat(b.rating || "0") || 0);

      if (creditSort === "YEAR_DESC") {
        return (mB?.year ?? 0) - (mA?.year ?? 0) || rB - rA;
      }
      if (creditSort === "YEAR_ASC") {
        return (mA?.year ?? 9999) - (mB?.year ?? 9999) || rB - rA;
      }
      if (creditSort === "VOTES") {
        return (mB?.votes ?? 0) - (mA?.votes ?? 0) || rB - rA;
      }
      if (creditSort === "TITLE") {
        const tA = (a.nameEn || a.nameRu || "").toLowerCase();
        const tB = (b.nameEn || b.nameRu || "").toLowerCase();
        return tA.localeCompare(tB);
      }
      return rB - rA;
    });
  }, [
    allFilms,
    profGroups,
    resolvedActiveProf,
    mainRolesOnly,
    creditSearch,
    creditSort,
    metaMap,
  ]);

  const filmTotalPages = Math.max(
    1,
    Math.ceil(filteredAndSortedFilms.length / FILMOGRAPHY_PAGE_SIZE),
  );

  const displayedFilms = useMemo(
    () =>
      showAllFilms
        ? filteredAndSortedFilms
        : filteredAndSortedFilms.slice(
            (filmPage - 1) * FILMOGRAPHY_PAGE_SIZE,
            filmPage * FILMOGRAPHY_PAGE_SIZE,
          ),
    [filteredAndSortedFilms, showAllFilms, filmPage],
  );

  // Progressively enrich the visible credits so every row displays Year, Age/MPAA rating (PG-13/R/18+), Runtime, Poster, Genres & Votes
  useEffect(() => {
    if (displayedFilms.length === 0) return;
    let cancelled = false;

    const toFetch = displayedFilms
      .slice(0, 20)
      .map((f) => f.filmId)
      .filter((fid) => {
        const existing = getCachedFilmMeta(fid);
        return (
          !existing ||
          (existing.year === undefined &&
            existing.ratingAgeLimits === undefined &&
            existing.ratingMpaa === undefined)
        );
      });

    // Sync any newly cached entries first
    setMetaMap((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const f of displayedFilms) {
        const cached = getCachedFilmMeta(f.filmId);
        if (cached && !next[f.filmId]) {
          next[f.filmId] = cached;
          changed = true;
        }
      }
      return changed ? next : prev;
    });

    if (toFetch.length === 0) return;

    (async () => {
      for (const fid of toFetch) {
        if (cancelled) break;
        try {
          await getFilm(fid);
          if (cancelled) break;
          const updatedMeta = getCachedFilmMeta(fid);
          if (updatedMeta) {
            setMetaMap((prev) => ({ ...prev, [fid]: updatedMeta }));
          }
        } catch {
          // ignore individual failure
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [displayedFilms]);

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

  const professionLabel =
    translatedProfession ||
    (availableProfs[0] ? PROF_LABELS[availableProfs[0]] : "") ||
    person.profession ||
    "";

  const formattedBirthday = formatDateSafe(person.birthday);
  const formattedDeath = formatDateSafe(person.death);

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
                {formattedBirthday && (
                  <InfoItem label="Born" value={formattedBirthday} />
                )}
                {person.birthplace && (
                  <TranslatedInfoItem label="From" value={person.birthplace} />
                )}
                {person.age !== undefined &&
                  person.age > 0 &&
                  !person.death && (
                    <InfoItem label="Age" value={String(person.age)} />
                  )}
                {person.growth !== undefined && Number(person.growth) > 0 && (
                  <InfoItem label="Height" value={`${person.growth} cm`} />
                )}
                {formattedDeath && (
                  <InfoItem label="Died" value={formattedDeath} />
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
          title="FILMOGRAPHY & CREDITS"
          count={filteredAndSortedFilms.length}
        />

        {/* Profession Category Tabs */}
        <TabBar className="mb-4">
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

        {/* Filmography Filter & Sort Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5 bg-[var(--bg-card)] border border-[var(--border)] rounded-[12px] p-3">
          <div className="flex items-center gap-2 flex-wrap">
            {/* Search within credits */}
            <div className="relative flex-1 sm:flex-initial sm:w-[240px]">
              <Search
                size={13}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none"
              />
              <input
                type="text"
                value={creditSearch}
                onChange={(e) => {
                  setCreditSearch(e.target.value);
                  setFilmPage(1);
                }}
                placeholder="Search title, role, or year…"
                className="input w-full pl-8 pr-3 py-1.5 text-[12px] rounded-[8px]"
              />
            </div>

            {/* Main Roles Only Toggle */}
            <button
              type="button"
              onClick={() => {
                setMainRolesOnly((v) => !v);
                setFilmPage(1);
              }}
              className={`px-3 py-1.5 rounded-[8px] text-[12px] font-semibold border cursor-pointer transition-all inline-flex items-center gap-1.5 ${
                mainRolesOnly
                  ? "bg-[var(--accent-dim)] border-[var(--accent)] text-white"
                  : "bg-[var(--bg-elevated)] border-[var(--border)] text-[var(--text-dim)] hover:text-white"
              }`}
            >
              <Sparkles size={12} />
              Main Roles Only
            </button>
          </div>

          <div className="flex items-center gap-2">
            <SlidersHorizontal size={13} className="text-[var(--text-muted)]" />
            <select
              value={creditSort}
              onChange={(e) => {
                setCreditSort(e.target.value as CreditSortMode);
                setFilmPage(1);
              }}
              className="select text-[12px] py-1.5 px-3 rounded-[8px]"
              aria-label="Sort credits by"
            >
              <option value="RATING">Sort: Highest Rated</option>
              <option value="YEAR_DESC">Sort: Newest Release Year</option>
              <option value="YEAR_ASC">Sort: Oldest Release Year</option>
              <option value="VOTES">Sort: Most Popular (Votes)</option>
              <option value="TITLE">Sort: Title (A–Z)</option>
            </select>
          </div>
        </div>

        {/* Credits List */}
        {displayedFilms.length === 0 ? (
          <p className="text-[var(--text-muted)] text-[14px] sm:text-[15px] py-8 text-center">
            No credits match your current filter.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {displayedFilms.map((film, i) => (
              <FilmEntry
                key={`${film.filmId}-${i}`}
                film={film}
                meta={metaMap[film.filmId]}
                autoTranslate={autoTranslate}
                onOpenParentalGuide={(meta) =>
                  setParentalModalFilm({
                    kinopoiskId: film.filmId,
                    filmId: film.filmId,
                    nameRu: film.nameRu,
                    nameEn: film.nameEn,
                    year: meta?.year,
                    ratingMpaa: meta?.ratingMpaa,
                    ratingAgeLimits: meta?.ratingAgeLimits,
                    posterUrl: meta?.posterUrl || meta?.posterUrlPreview || "",
                    posterUrlPreview: meta?.posterUrlPreview || "",
                  })
                }
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
                  Page {filmPage} of {filmTotalPages}
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
                : `Show all (${filteredAndSortedFilms.length})`}
            </button>
          </div>
        )}
      </div>

      {parentalModalFilm && (
        <ParentalGuideModal
          open={Boolean(parentalModalFilm)}
          onClose={() => setParentalModalFilm(null)}
          film={parentalModalFilm}
        />
      )}
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
  meta,
  autoTranslate,
  onOpenParentalGuide,
}: {
  film: PersonFilm;
  meta?: CompactFilmMeta;
  autoTranslate: boolean;
  onOpenParentalGuide: (meta?: CompactFilmMeta) => void;
}) {
  const { toast } = useToast();
  const { isFav, isWL } = useListStatus(film.filmId);

  const name = useFilmTitle(film, autoTranslate);
  const roleMapped = film.description
    ? translateRole(film.description, autoTranslate)
    : "";
  const roleTranslated = useTranslate(roleMapped);
  const roleDisplay = roleTranslated || roleMapped;

  const baseRating = parseFloat(film.rating || "0") || null;
  const kpRating = meta?.ratingKinopoisk ?? baseRating;
  const imdbRating = meta?.ratingImdb;
  const votesLabel = formatVotesShort(meta?.votes);

  const profLabel = film.professionKey
    ? PROF_LABELS[film.professionKey] || film.professionKey
    : null;

  const ageCert = formatAgeCert(meta?.ratingMpaa, meta?.ratingAgeLimits);

  const yearDisplay =
    meta?.year || meta?.startYear
      ? meta.serial && meta.startYear
        ? `${meta.startYear}–${meta.endYear || "…"}`
        : String(meta.year ?? meta.startYear)
      : null;

  const isSeries =
    meta?.serial || meta?.type === "TV_SERIES" || meta?.type === "MINI_SERIES";

  const runtimeDisplay =
    meta?.filmLength && meta.filmLength > 0
      ? `${Math.floor(meta.filmLength / 60)}h ${meta.filmLength % 60}m`
      : null;

  const primaryGenres = (meta?.genres ?? [])
    .slice(0, 2)
    .map((g) =>
      translateGenre(typeof g === "string" ? g : g.genre, autoTranslate),
    )
    .filter(Boolean);

  const primaryCountry = meta?.countries?.[0]
    ? translateCountry(
        typeof meta.countries[0] === "string"
          ? meta.countries[0]
          : meta.countries[0].country,
        autoTranslate,
      )
    : null;

  const filmEntryPayload = {
    film_id: film.filmId,
    film_name: name,
    poster_url: meta?.posterUrlPreview || null,
    year: meta?.year ?? meta?.startYear ?? null,
    rating: imdbRating ?? kpRating ?? null,
  };

  return (
    <div className="flex items-center gap-3 sm:gap-4 px-3 sm:px-4 py-3 rounded-[12px] border border-[var(--border)] bg-[var(--bg-card)]/60 transition-all duration-[180ms] hover:bg-[var(--bg-card)] hover:border-[var(--border-hover)] group">
      {/* Mini Poster */}
      <Link
        href={`/film/${film.filmId}`}
        className="no-underline flex-shrink-0"
      >
        <PosterImage
          src={meta?.posterUrlPreview}
          alt={name}
          title={name}
          fallbackType="mini"
          className="w-[42px] sm:w-[48px] h-[63px] sm:h-[72px] rounded-[7px] overflow-hidden bg-[var(--surface)] relative border border-white/5"
        />
      </Link>

      {/* Main Credit Info & Indicative Metrics */}
      <div className="flex-1 min-w-0">
        {/* Row 1: Title + Release Year + Media Type + Age/MPAA Rating Badge + Profession Pill */}
        <div className="flex items-center gap-2 flex-wrap">
          <Link
            href={`/film/${film.filmId}`}
            className="no-underline text-[var(--text)] group-hover:text-white"
          >
            <p className="text-[14px] sm:text-[15px] font-bold m-0 truncate max-w-[260px] sm:max-w-[420px]">
              {name}
            </p>
          </Link>

          {/* Release Year Badge */}
          {yearDisplay && (
            <span className="text-[11px] font-semibold text-[#f5c518] bg-[rgba(245,197,24,0.12)] border border-[rgba(245,197,24,0.3)] rounded-[5px] px-1.5 py-[1px] flex-shrink-0">
              {yearDisplay}
            </span>
          )}

          {/* Age / MPAA Rating Badge (PG, PG-13, R, 16+, 18+ - Clickable for Parental Guide) */}
          {ageCert && (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onOpenParentalGuide(meta);
              }}
              title="Click to inspect Parental Guide & Content Advisories"
              className={`text-[10px] font-bold rounded-[5px] px-1.5 py-[1px] border cursor-pointer inline-flex items-center gap-1 flex-shrink-0 transition-colors ${
                ageCert.isMature
                  ? "bg-[rgba(229,9,20,0.15)] border-[rgba(229,9,20,0.45)] text-[var(--accent)] hover:bg-[rgba(229,9,20,0.25)]"
                  : "bg-[var(--bg-elevated)] border-[var(--border-hover)] text-[var(--text)] hover:border-white"
              }`}
            >
              <ShieldAlert size={10} />
              {ageCert.label}
            </button>
          )}

          {/* Media Type Pill (Movie vs Series) */}
          {meta && (
            <span className="text-[10px] text-[var(--text-dim)] bg-[var(--bg-elevated)] border border-[var(--border)] rounded-[4px] px-1.5 py-[1px] inline-flex items-center gap-1 flex-shrink-0">
              {isSeries ? <Tv size={10} /> : <FilmIcon size={10} />}
              {isSeries ? "Series" : "Movie"}
            </span>
          )}

          {/* Profession Pill (Actor, Producer, Director, etc.) */}
          {profLabel && (
            <span className="text-[10px] font-medium text-[var(--text-muted)] bg-[var(--surface)] rounded-[4px] px-[7px] py-[2px] flex-shrink-0">
              {profLabel}
            </span>
          )}

          {/* Lead vs Supporting indicator */}
          {film.general ? (
            <span className="text-[10px] font-semibold text-[#4ade80] bg-[rgba(34,197,94,0.12)] border border-[rgba(34,197,94,0.3)] rounded-[4px] px-[6px] py-[1px] flex-shrink-0">
              Lead
            </span>
          ) : (
            <span className="text-[10px] text-[var(--text-muted)] bg-[var(--bg-elevated)] rounded-[4px] px-[6px] py-[1px] flex-shrink-0">
              Supporting
            </span>
          )}
        </div>

        {/* Row 2: Character Role + Runtime + Genres + Country */}
        <div className="flex items-center gap-2 flex-wrap mt-1 text-[11px] sm:text-[12px] text-[var(--text-muted)]">
          {roleDisplay && (
            <span className="text-[var(--text-dim)] italic font-medium">
              as {roleDisplay}
            </span>
          )}
          {runtimeDisplay && <span>· {runtimeDisplay}</span>}
          {primaryGenres.length > 0 && (
            <span className="capitalize">· {primaryGenres.join(", ")}</span>
          )}
          {primaryCountry && (
            <span className="hidden md:inline">· {primaryCountry}</span>
          )}
        </div>
      </div>

      {/* Right Column: Dual IMDb + KP Ratings, Vote Count & Quick List Actions */}
      <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
        <div className="flex flex-col items-end gap-0.5">
          <div className="flex items-center gap-2">
            {imdbRating && imdbRating > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[rgba(245,197,24,0.14)] border border-[rgba(245,197,24,0.35)] text-[#f5c518] text-[11px] sm:text-[12px] font-bold">
                <Star size={10} fill="#f5c518" stroke="#f5c518" />
                IMDb {imdbRating.toFixed(1)}
              </span>
            )}
            {kpRating && kpRating > 0 && (
              <div className="flex items-center gap-1">
                <Star size={11} fill="#f5c518" stroke="#f5c518" />
                <span className="font-display text-[15px] sm:text-[17px] text-[#f5c518]">
                  {kpRating.toFixed(1)}
                </span>
              </div>
            )}
          </div>
          {votesLabel && (
            <span className="text-[10px] text-[var(--text-muted)]">
              {votesLabel} votes
            </span>
          )}
        </div>

        {/* Quick In Favorites & Watch Later buttons */}
        <div className="hidden sm:flex items-center gap-1">
          <button
            type="button"
            onClick={() => {
              const added = toggleFavorite(filmEntryPayload);
              toast.success(
                added ? "Added to Favorites" : "Removed from Favorites",
              );
            }}
            title={isFav ? "In Favorites" : "Add to Favorites"}
            className={`w-8 h-8 rounded-full border flex items-center justify-center cursor-pointer transition-all ${
              isFav
                ? "bg-[var(--accent-dim)] border-[var(--accent)] text-[var(--accent)]"
                : "bg-[var(--bg-elevated)] border-[var(--border)] text-[var(--text-muted)] hover:text-white"
            }`}
          >
            <Heart
              size={13}
              fill={isFav ? "var(--accent)" : "none"}
              stroke={isFav ? "var(--accent)" : "currentColor"}
            />
          </button>
          <button
            type="button"
            onClick={() => {
              const added = toggleWatchLater(filmEntryPayload);
              toast.info(
                added ? "Saved to Watch Later" : "Removed from Watch Later",
              );
            }}
            title={isWL ? "In Watch Later" : "Save to Watch Later"}
            className={`w-8 h-8 rounded-full border flex items-center justify-center cursor-pointer transition-all ${
              isWL
                ? "bg-[rgba(96,165,250,0.14)] border-[#60a5fa] text-[#60a5fa]"
                : "bg-[var(--bg-elevated)] border-[var(--border)] text-[var(--text-muted)] hover:text-white"
            }`}
          >
            <Clock size={13} />
          </button>
        </div>

        <Link
          href={`/film/${film.filmId}`}
          className="no-underline text-[var(--text-muted)] group-hover:text-white"
          aria-label={`Open ${name}`}
        >
          <ChevronRight size={16} strokeWidth={2} />
        </Link>
      </div>
    </div>
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
