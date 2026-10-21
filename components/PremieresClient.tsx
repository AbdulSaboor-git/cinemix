"use client";
import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Star,
  Globe,
  SlidersHorizontal,
} from "lucide-react";
import { getPremieres, isRussianDomesticFilm } from "@/lib/kinopoisk";
import { Film } from "@/types/kinopoisk";
import {
  translateGenre,
  translateCountry,
  formatDateSafe,
} from "@/lib/translate";
import { useAutoTranslate, useFilmTitle } from "@/hooks/useTranslate";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { hasApiKeys, getPreferences } from "@/lib/preferences";
import PageContainer from "@/components/ui/PageContainer";
import PageHeader from "@/components/ui/PageHeader";
import TabBar from "@/components/ui/TabBar";
import TabPill from "@/components/ui/TabPill";
import PosterImage from "@/components/ui/PosterImage";
import EmptyState from "@/components/ui/EmptyState";
import NoKeyBanner from "@/components/ui/NoKeyBanner";

const MONTHS = [
  "JANUARY",
  "FEBRUARY",
  "MARCH",
  "APRIL",
  "MAY",
  "JUNE",
  "JULY",
  "AUGUST",
  "SEPTEMBER",
  "OCTOBER",
  "NOVEMBER",
  "DECEMBER",
];
const MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];
const MONTH_FULL = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const NOW = new Date();
const CUR_YEAR = NOW.getFullYear();
const CUR_MONTH_IDX = NOW.getMonth();

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

export default function PremieresClient({
  year: yearParam,
  month: monthParam,
}: {
  year?: string;
  month?: string;
}) {
  const router = useRouter();
  const autoTranslate = useAutoTranslate();

  const initYear = yearParam ? parseInt(yearParam, 10) : CUR_YEAR;
  const initMonthIdx = monthParam
    ? MONTHS.indexOf(monthParam.toUpperCase())
    : CUR_MONTH_IDX;

  const [noKey, setNoKey] = useState(false);
  const [year, setYear] = useState(initYear);
  const [monthIdx, setMonthIdx] = useState(
    clamp(initMonthIdx < 0 ? CUR_MONTH_IDX : initMonthIdx, 0, 11),
  );
  const [films, setFilms] = useState<Film[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter & Sort Controls
  const [globalOnly, setGlobalOnly] = useState(false);
  const [sortBy, setSortBy] = useState<"DATE" | "RATING">("DATE");

  const didMountRef = useRef(false);

  useDocumentTitle(`Premieres — ${MONTH_FULL[monthIdx]} ${year}`);

  useEffect(() => {
    const prefs = getPreferences();
    if (prefs.contentRegionMode === "GLOBAL_FIRST") {
      setGlobalOnly(true);
    }
  }, []);

  const load = useCallback((y: number, mi: number) => {
    if (!hasApiKeys()) {
      setNoKey(true);
      setLoading(false);
      return;
    }
    setLoading(true);
    setFilms([]);
    getPremieres(y, MONTHS[mi])
      .then((d) => setFilms(d.items ?? []))
      .catch(() => setFilms([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load(year, monthIdx);
    // Only replace URL when user changes year/month or if URL doesn't already match
    const targetMonth = MONTHS[monthIdx];
    if (
      didMountRef.current &&
      (String(year) !== yearParam ||
        targetMonth !== (monthParam || "").toUpperCase())
    ) {
      router.replace(`/premieres?year=${year}&month=${targetMonth}`, {
        scroll: false,
      });
    }
    didMountRef.current = true;
  }, [year, monthIdx, load, router, yearParam, monthParam]);

  const displayedFilms = useMemo(() => {
    const base = globalOnly
      ? films.filter((f) => !isRussianDomesticFilm(f))
      : films;
    return [...base].sort((a, b) => {
      if (sortBy === "RATING") {
        const rA = a.ratingKinopoisk ?? a.ratingImdb ?? 0;
        const rB = b.ratingKinopoisk ?? b.ratingImdb ?? 0;
        return rB - rA;
      }
      const dA = a.premiereRu ? new Date(a.premiereRu).getTime() || 0 : 0;
      const dB = b.premiereRu ? new Date(b.premiereRu).getTime() || 0 : 0;
      return dA - dB;
    });
  }, [films, globalOnly, sortBy]);

  if (noKey) return <NoKeyBanner />;

  const prevMonth = () => {
    if (monthIdx === 0) {
      setMonthIdx(11);
      setYear((y) => y - 1);
    } else {
      setMonthIdx((m) => m - 1);
    }
  };
  const nextMonth = () => {
    if (monthIdx === 11) {
      setMonthIdx(0);
      setYear((y) => y + 1);
    } else {
      setMonthIdx((m) => m + 1);
    }
  };

  const isCurrent = year === CUR_YEAR && monthIdx === CUR_MONTH_IDX;

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Calendar"
        eyebrowIcon={<Calendar size={14} stroke="var(--accent)" />}
        title="PREMIERES"
        subtitle={
          <>
            <span className="font-semibold text-[var(--text)]">
              {MONTH_FULL[monthIdx]} {year}
            </span>
            {!loading && (
              <span className="text-[var(--text-muted)] ml-2">
                · {displayedFilms.length} premiere
                {displayedFilms.length !== 1 ? "s" : ""}
              </span>
            )}
          </>
        }
        rightSlot={
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setGlobalOnly((v) => !v)}
              className={`px-3 py-1.5 rounded-[8px] text-[12px] font-semibold border cursor-pointer inline-flex items-center gap-1.5 ${
                globalOnly
                  ? "bg-[rgba(34,197,94,0.14)] border-[#22c55e] text-[#4ade80]"
                  : "bg-[var(--bg-elevated)] border-[var(--border)] text-[var(--text-dim)] hover:text-white"
              }`}
            >
              <Globe size={12} />
              {globalOnly ? "Hollywood & Global Only" : "All Regions"}
            </button>

            <div className="inline-flex items-center gap-1.5">
              <SlidersHorizontal
                size={13}
                className="text-[var(--text-muted)]"
              />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as "DATE" | "RATING")}
                className="select text-[12px] py-1.5 px-3 rounded-[8px]"
              >
                <option value="DATE">Sort: Release Date</option>
                <option value="RATING">Sort: Rating</option>
              </select>
            </div>
          </div>
        }
      />

      {/* Month / Year Navigator */}
      <div className="flex flex-col gap-3 mb-6">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={prevMonth}
            className="flex-shrink-0 w-8 h-8 sm:w-9 sm:h-9 rounded-full border border-[var(--border)] bg-[var(--bg-elevated)] flex items-center justify-center cursor-pointer hover:border-[var(--border-hover)] transition-colors text-[var(--text)]"
            aria-label="Previous month"
          >
            <ChevronLeft size={14} strokeWidth={2.5} />
          </button>

          <TabBar className="flex-1">
            {MONTH_LABELS.map((lbl, i) => (
              <TabPill
                key={lbl}
                active={monthIdx === i}
                onClick={() => setMonthIdx(i)}
                className="!px-3 !py-1.5 !text-[11px] sm:!text-[12px]"
              >
                {lbl}
              </TabPill>
            ))}
          </TabBar>

          <button
            type="button"
            onClick={nextMonth}
            className="flex-shrink-0 w-8 h-8 sm:w-9 sm:h-9 rounded-full border border-[var(--border)] bg-[var(--bg-elevated)] flex items-center justify-center cursor-pointer hover:border-[var(--border-hover)] transition-colors text-[var(--text)]"
            aria-label="Next month"
          >
            <ChevronRight size={14} strokeWidth={2.5} />
          </button>
        </div>

        {/* Year row */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setYear((y) => y - 1)}
              className="w-7 h-7 rounded-full border border-[var(--border)] bg-[var(--bg-elevated)] flex items-center justify-center cursor-pointer hover:border-[var(--border-hover)] transition-colors text-[12px] text-[var(--text)]"
              aria-label="Previous year"
            >
              −
            </button>
            <span className="font-display text-[18px] tracking-[1px] text-[var(--text)] min-w-[50px] text-center">
              {year}
            </span>
            <button
              type="button"
              onClick={() => setYear((y) => y + 1)}
              className="w-7 h-7 rounded-full border border-[var(--border)] bg-[var(--bg-elevated)] flex items-center justify-center cursor-pointer hover:border-[var(--border-hover)] transition-colors text-[12px] text-[var(--text)]"
              aria-label="Next year"
            >
              +
            </button>
          </div>

          {!isCurrent && (
            <button
              type="button"
              onClick={() => {
                setYear(CUR_YEAR);
                setMonthIdx(CUR_MONTH_IDX);
              }}
              className="text-[11px] text-[var(--accent)] bg-transparent border border-[rgba(229,9,20,0.3)] rounded-[8px] px-3 py-[5px] cursor-pointer hover:border-[var(--accent)] transition-colors"
            >
              This month
            </button>
          )}
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid gap-4 sm:gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="skeleton h-[132px] rounded-[12px]" />
          ))}
        </div>
      ) : displayedFilms.length === 0 ? (
        <EmptyState
          icon={<Calendar size={36} />}
          title="No Premieres Found"
          description="Try selecting a different month or toggling 'All Regions'."
        />
      ) : (
        <div className="grid gap-4 sm:gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {displayedFilms.map((film, i) => (
            <PremiereCard
              key={film.kinopoiskId ?? film.filmId ?? i}
              film={film}
              autoTranslate={autoTranslate}
            />
          ))}
        </div>
      )}
    </PageContainer>
  );
}

function PremiereCard({
  film,
  autoTranslate,
}: {
  film: Film;
  autoTranslate: boolean;
}) {
  const name = useFilmTitle(film, autoTranslate);
  const id = film.kinopoiskId ?? film.filmId;
  const safePremiereDate = formatDateSafe(film.premiereRu, {
    month: "short",
    day: "numeric",
  });
  const durationMins = film.filmLength ?? film.duration;

  return (
    <Link href={`/film/${id}`} className="no-underline group">
      <div className="flex gap-3 bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-lg)] p-3 hover:border-[rgba(229,9,20,0.3)] transition-all duration-200 h-full">
        {/* Poster */}
        <PosterImage
          src={film.posterUrlPreview || film.posterUrl}
          alt={name}
          title={name}
          fallbackType="mini"
          className="w-[70px] sm:w-[80px] flex-shrink-0 rounded-[8px] overflow-hidden aspect-[2/3] relative bg-[var(--surface)]"
        />

        {/* Info */}
        <div className="flex-1 min-w-0 flex flex-col justify-between py-[2px]">
          <div>
            <p className="font-semibold text-[var(--text)] text-[13px] sm:text-[14px] leading-[1.3] mb-1 group-hover:text-white transition-colors line-clamp-2">
              {name}
            </p>
            {film.genres && film.genres.length > 0 && (
              <p className="text-[11px] text-[var(--text-muted)] capitalize mb-1">
                {film.genres
                  .slice(0, 2)
                  .map((g) => translateGenre(g.genre, autoTranslate))
                  .join(" · ")}
              </p>
            )}
            {film.countries && film.countries.length > 0 && (
              <p className="text-[11px] text-[var(--text-muted)]">
                {film.countries
                  .slice(0, 2)
                  .map((c) => translateCountry(c.country, autoTranslate))
                  .join(", ")}
              </p>
            )}
          </div>
          <div className="flex items-center justify-between mt-2 flex-wrap gap-2">
            {safePremiereDate && (
              <span className="text-[11px] text-[var(--accent)] font-semibold">
                {safePremiereDate}
              </span>
            )}
            {durationMins !== undefined && durationMins > 0 && (
              <span className="text-[11px] text-[var(--text-muted)]">
                {Math.floor(durationMins / 60)}h {durationMins % 60}m
              </span>
            )}
            {film.ratingKinopoisk && (
              <span className="inline-flex items-center gap-1 text-[12px] text-[#f5c518] font-bold font-display">
                <Star size={10} fill="#f5c518" stroke="#f5c518" />
                {film.ratingKinopoisk.toFixed(1)}
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
