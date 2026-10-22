"use client";
import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Star,
  SlidersHorizontal,
  ShieldAlert,
  ArrowUpDown,
} from "lucide-react";
import {
  getPremieres,
  isRussianDomesticFilm,
  queueFilmMetaHydration,
  hydrateFilmWithCache,
} from "@/lib/kinopoisk";
import { Film } from "@/types/kinopoisk";
import {
  translateGenre,
  translateCountry,
  formatDateSafe,
} from "@/lib/translate";
import { useAutoTranslate, useFilmTitle } from "@/hooks/useTranslate";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { hasApiKeys, getPreferences } from "@/lib/preferences";
import { getQuickCertBadge } from "@/lib/parentalGuide";
import {
  useHydratedFilm,
  useFilmLongPress,
  FilmLongPressPortal,
} from "@/components/FilmCard";
import ParentalGuideModal from "@/components/ParentalGuideModal";
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
  const [sortBy, setSortBy] = useState<"DATE" | "RATING">("DATE");
  const [parentalModalFilm, setParentalModalFilm] = useState<Film | null>(null);

  const didMountRef = useRef(false);

  useDocumentTitle(`Premieres — ${MONTH_FULL[monthIdx]} ${year}`);

  const load = useCallback((y: number, mi: number) => {
    if (!hasApiKeys()) {
      setNoKey(true);
      setLoading(false);
      return;
    }
    setLoading(true);
    setFilms([]);
    getPremieres(y, MONTHS[mi])
      .then((d) => {
        const list = d.items ?? [];
        setFilms(list);
      })
      .catch(() => setFilms([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load(year, monthIdx);
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

  // Silent background regional curation controlled directly by Preferences
  const displayedFilms = useMemo(() => {
    const regionMode =
      typeof window !== "undefined"
        ? (getPreferences().contentRegionMode ?? "GLOBAL_FIRST")
        : "GLOBAL_FIRST";
    const base =
      regionMode === "GLOBAL_FIRST"
        ? films.filter((f) => !isRussianDomesticFilm(f))
        : films;
    const pool = base.length > 0 ? base : films;

    return [...pool].sort((a, b) => {
      if (sortBy === "RATING") {
        const ha = hydrateFilmWithCache(a);
        const hb = hydrateFilmWithCache(b);
        const rA = ha.ratingImdb ?? ha.ratingKinopoisk ?? 0;
        const rB = hb.ratingImdb ?? hb.ratingKinopoisk ?? 0;
        return rB - rA;
      }
      const dA = a.premiereRu ? new Date(a.premiereRu).getTime() || 0 : 0;
      const dB = b.premiereRu ? new Date(b.premiereRu).getTime() || 0 : 0;
      return dA - dB;
    });
  }, [films, sortBy]);

  // Queue background hydration for the first batch of premieres immediately on load
  useEffect(() => {
    if (displayedFilms.length === 0) return;
    displayedFilms.slice(0, 18).forEach((f, idx) => {
      const fid = f.kinopoiskId ?? f.filmId;
      if (fid) {
        queueFilmMetaHydration(fid, idx < 6);
      }
    });
  }, [displayedFilms]);

  const handleCloseParentalGuide = useCallback(() => {
    setParentalModalFilm(null);
  }, []);

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
          <div className="inline-flex items-center gap-1.5">
            {/* <SlidersHorizontal size={13} className="text-[var(--text-muted)]" /> */}
            <ArrowUpDown size={18} />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as "DATE" | "RATING")}
              className="select text-[12px] py-1.5 px-3 rounded-[8px]"
            >
              <option value="DATE">Release Date</option>
              <option value="RATING">Rating</option>
            </select>
          </div>
        }
      />

      {/* Month / Year Navigator */}
      <div className="flex flex-col gap-3 mb-5 sm:mb-6">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={prevMonth}
            className="flex-shrink-0 w-8 h-8 sm:w-9 sm:h-9 rounded-full border border-[var(--border)] bg-[var(--bg-elevated)] flex items-center justify-center cursor-pointer hover:border-[var(--border-hover)] active:scale-95 transition-all text-[var(--text)]"
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
            className="flex-shrink-0 w-8 h-8 sm:w-9 sm:h-9 rounded-full border border-[var(--border)] bg-[var(--bg-elevated)] flex items-center justify-center cursor-pointer hover:border-[var(--border-hover)] active:scale-95 transition-all text-[var(--text)]"
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
              className="w-7 h-7 rounded-full border border-[var(--border)] bg-[var(--bg-elevated)] flex items-center justify-center cursor-pointer hover:border-[var(--border-hover)] active:scale-95 transition-all text-[12px] text-[var(--text)]"
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
              className="w-7 h-7 rounded-full border border-[var(--border)] bg-[var(--bg-elevated)] flex items-center justify-center cursor-pointer hover:border-[var(--border-hover)] active:scale-95 transition-all text-[12px] text-[var(--text)]"
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
        <div className="grid gap-3.5 sm:gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="skeleton h-[128px] rounded-[12px]" />
          ))}
        </div>
      ) : displayedFilms.length === 0 ? (
        <EmptyState
          icon={<Calendar size={36} />}
          title="No Premieres Found"
          description="Try selecting a different month or year."
        />
      ) : (
        <div className="grid gap-3.5 sm:gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {displayedFilms.map((film, i) => {
            const fid = film.kinopoiskId ?? film.filmId ?? i;
            return (
              <div
                className="cursor-pointer"
                onClick={() => router.push(`/film/${fid}`)}
                key={fid}
              >
                <PremiereCard
                  key={fid}
                  film={film}
                  index={i}
                  autoTranslate={autoTranslate}
                  onOpenParentalGuide={(enrichedFilm) =>
                    setParentalModalFilm(enrichedFilm)
                  }
                />
              </div>
            );
          })}
        </div>
      )}

      {parentalModalFilm && (
        <ParentalGuideModal
          open={Boolean(parentalModalFilm)}
          onClose={handleCloseParentalGuide}
          film={parentalModalFilm}
        />
      )}
    </PageContainer>
  );
}

function PremiereCard({
  film: rawFilm,
  index,
  autoTranslate,
  onOpenParentalGuide,
}: {
  film: Film;
  index: number;
  autoTranslate: boolean;
  onOpenParentalGuide: (film: Film) => void;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const posterWrapRef = useRef<HTMLDivElement>(null);

  // Pass `requireFullDetail = true` so PremiereCard always hydrates MPAA/age rating, duration, and rating
  const film = useHydratedFilm(rawFilm, cardRef, true);
  const name = useFilmTitle(film, autoTranslate);
  const id = film.kinopoiskId ?? film.filmId ?? 0;

  const {
    popupOpen,
    popupEntered,
    originDelta,
    closePopup,
    setPopupOpen,
    setPopupEntered,
    historyPushedRef,
    bindLongPress,
  } = useFilmLongPress(id, posterWrapRef);

  const safePremiereDate = formatDateSafe(film.premiereRu, {
    month: "short",
    day: "numeric",
  });
  const durationMins = film.filmLength ?? film.duration;
  const ageCert = getQuickCertBadge(film);
  const displayRating =
    film.ratingImdb ??
    film.ratingKinopoisk ??
    (typeof film.rating === "number" && film.rating > 0 && film.rating <= 10
      ? film.rating
      : undefined);
  const awaitRating =
    !displayRating && film.ratingAwait && film.ratingAwait > 0
      ? `${Math.round(film.ratingAwait)}%`
      : null;

  return (
    <>
      <div
        ref={cardRef}
        className={`flex gap-3 bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-lg)] p-3 hover:border-[rgba(229,9,20,0.3)] active:bg-[var(--bg-elevated)] transition-all duration-200 h-full group select-none [-webkit-touch-callout:none] ${
          popupOpen ? "opacity-0 scale-95 pointer-events-none" : ""
        }`}
        onTouchStart={bindLongPress.onTouchStart}
        onTouchMove={bindLongPress.onTouchMove}
        onTouchEnd={bindLongPress.onTouchEnd}
        onTouchCancel={bindLongPress.onTouchCancel}
        onMouseDown={bindLongPress.onMouseDown}
        onMouseMove={bindLongPress.onMouseMove}
        onMouseUp={bindLongPress.onMouseUp}
        onMouseLeave={bindLongPress.onMouseLeave}
        onClickCapture={bindLongPress.onClickCapture}
        onContextMenu={bindLongPress.onContextMenu}
      >
        {/* Poster */}
        <div className="no-underline flex-shrink-0">
          <div
            ref={posterWrapRef}
            className="w-[72px] sm:w-[80px] rounded-[8px] overflow-hidden aspect-[2/3] relative bg-[var(--surface)]"
          >
            <PosterImage
              src={film.posterUrlPreview || film.posterUrl}
              alt={name}
              title={name}
              size="sm"
              fallbackType="mini"
              priority={index < 6}
            />
          </div>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0 flex flex-col justify-between py-[2px]">
          <div>
            <div className="flex items-start justify-between gap-2 mb-1">
              <div className="no-underline min-w-0 flex-1">
                <p className="font-semibold text-[var(--text)] text-[13px] sm:text-[14px] leading-[1.3] m-0 group-hover:text-white transition-colors line-clamp-2">
                  {name}
                </p>
              </div>

              {/* Age / MPAA Certification Badge (Clickable for Parental Guide) */}
              {ageCert && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onOpenParentalGuide(film);
                  }}
                  title="View Parental Guide"
                  className={`flex-shrink-0 text-[10px] font-bold rounded-[5px] px-1.5 py-[2px] border cursor-pointer inline-flex items-center gap-1 transition-colors ${
                    ageCert.isMature
                      ? "bg-[rgba(229,9,20,0.15)] border-[rgba(229,9,20,0.45)] text-[var(--accent)] hover:bg-[rgba(229,9,20,0.25)]"
                      : "bg-[var(--bg-elevated)] border-[var(--border-hover)] text-[var(--text)] hover:border-white"
                  }`}
                >
                  <ShieldAlert size={9} />
                  {ageCert.label}
                </button>
              )}
            </div>

            {film.genres && film.genres.length > 0 && (
              <p className="text-[11px] text-[var(--text-muted)] capitalize mb-1 truncate m-0">
                {film.genres
                  .slice(0, 2)
                  .map((g) => translateGenre(g.genre, autoTranslate))
                  .join(" · ")}
              </p>
            )}
            {film.countries && film.countries.length > 0 && (
              <p className="text-[11px] text-[var(--text-muted)] truncate m-0">
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
            {displayRating !== undefined && displayRating > 0 ? (
              <span className="inline-flex items-center gap-1 text-[12px] text-[#f5c518] font-bold font-display">
                <Star size={10} fill="#f5c518" stroke="#f5c518" />
                {displayRating.toFixed(1)}
              </span>
            ) : awaitRating ? (
              <span className="inline-flex items-center gap-1 text-[11px] text-[#f5c518] font-bold font-display">
                <Star size={10} fill="#f5c518" stroke="#f5c518" />
                {awaitRating}
              </span>
            ) : null}
          </div>
        </div>
      </div>

      {/* Long-Press Centered Quick-Peek Portal (with Top-Left MPAA/Age Badge) */}
      <FilmLongPressPortal
        film={film}
        popupOpen={popupOpen}
        popupEntered={popupEntered}
        originDelta={originDelta}
        closePopup={closePopup}
        setPopupOpen={setPopupOpen}
        setPopupEntered={setPopupEntered}
        historyPushedRef={historyPushedRef}
      />
    </>
  );
}
