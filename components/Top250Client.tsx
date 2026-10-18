"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Star, Trophy, Film as FilmIcon, Tv } from "lucide-react";
import { getTopFilms } from "@/lib/kinopoisk";
import { translateGenre, translateCountry } from "@/lib/translate";
import { useAutoTranslate, useFilmTitle } from "@/hooks/useTranslate";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { hasApiKeys } from "@/lib/preferences";
import { Film } from "@/types/kinopoisk";
import Pagination from "@/components/Pagination";
import PageContainer from "@/components/ui/PageContainer";
import PageHeader from "@/components/ui/PageHeader";
import TabBar from "@/components/ui/TabBar";
import TabPill from "@/components/ui/TabPill";
import PosterImage from "@/components/ui/PosterImage";
import EmptyState from "@/components/ui/EmptyState";
import NoKeyBanner from "@/components/ui/NoKeyBanner";

const PAGE_SIZE = 20;

type TopCollection = "TOP_250_MOVIES" | "TOP_250_TV_SHOWS";

function Top250Row({
  film,
  rank,
  autoTranslate,
}: {
  film: Film;
  rank: number;
  autoTranslate: boolean;
}) {
  const name = useFilmTitle(film, autoTranslate);
  const rating =
    film.ratingKinopoisk?.toFixed(1) ??
    film.ratingImdb?.toFixed(1) ??
    (typeof film.rating === "number" ? film.rating.toFixed(1) : film.rating);
  const id = film.kinopoiskId ?? film.filmId;

  const rankSize =
    rank <= 10
      ? "text-[22px] sm:text-[28px]"
      : rank <= 50
        ? "text-[18px] sm:text-[22px]"
        : "text-[15px] sm:text-[18px]";
  const rankColor =
    rank <= 3
      ? "text-[#f5c518]"
      : rank <= 10
        ? "text-[rgba(245,197,24,0.65)]"
        : "text-[var(--text-muted)]";

  return (
    <Link href={`/film/${id}`} className="no-underline group">
      <div className="flex items-center gap-2 sm:gap-4 md:gap-5 px-2 sm:px-4 py-[10px] sm:py-3 rounded-[10px] border border-white/5 transition-all duration-[180ms] cursor-pointer hover:bg-[var(--bg-card)] hover:border-[var(--border)] active:bg-[var(--bg-card)] sm:group-hover:translate-x-1">
        {/* Rank */}
        <div
          className={`w-7 sm:w-10 text-right flex-shrink-0 font-display leading-none ${rankSize} ${rankColor}`}
        >
          {rank}
        </div>

        {/* Poster */}
        <PosterImage
          src={film.posterUrlPreview || film.posterUrl}
          alt={name}
          title={name}
          fallbackType="mini"
          className="w-[36px] sm:w-[44px] h-[54px] sm:h-[66px] rounded-[6px] overflow-hidden flex-shrink-0 bg-[var(--surface)] relative"
        />

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="text-[13px] sm:text-[14px] md:text-[15px] font-semibold text-[var(--text)] overflow-hidden text-ellipsis whitespace-nowrap mb-[2px] sm:mb-1 group-hover:text-white transition-colors">
            {name}
          </p>
          <div className="flex gap-2 items-center flex-wrap">
            {film.year && (
              <span className="text-[11px] sm:text-[12px] text-[var(--text-muted)]">
                {film.year}
              </span>
            )}
            {film.countries?.[0] && (
              <span className="hidden md:inline text-[11px] text-[var(--text-muted)]">
                · {translateCountry(film.countries[0].country, autoTranslate)}
              </span>
            )}
            {film.genres?.slice(0, 2).map((g) => (
              <span
                key={g.genre}
                className="hidden sm:inline text-[11px] text-[var(--text-dim)] capitalize"
              >
                · {translateGenre(g.genre, autoTranslate)}
              </span>
            ))}
          </div>
        </div>

        {/* Rating */}
        {rating && (
          <div className="flex items-center gap-[4px] sm:gap-[5px] flex-shrink-0">
            <Star size={12} fill="#f5c518" stroke="#f5c518" />
            <span className="text-[#f5c518] font-display text-[15px] sm:text-[18px] md:text-[20px]">
              {rating}
            </span>
          </div>
        )}
      </div>
    </Link>
  );
}

export default function Top250Client({
  page: pg,
  type: tp,
}: {
  page?: string;
  type?: string;
}) {
  const page = Math.max(1, parseInt(pg || "1", 10));
  const collectionType: TopCollection =
    tp === "TOP_250_TV_SHOWS" ? "TOP_250_TV_SHOWS" : "TOP_250_MOVIES";

  const [noKey, setNoKey] = useState(false);
  const [films, setFilms] = useState<Film[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(250);
  const [loading, setLoading] = useState(true);
  const autoTranslate = useAutoTranslate();

  useDocumentTitle(
    collectionType === "TOP_250_TV_SHOWS"
      ? "Top 250 TV Series"
      : "Top 250 Movies",
  );

  useEffect(() => {
    if (!hasApiKeys()) {
      setNoKey(true);
      setLoading(false);
      return;
    }
    setLoading(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
    getTopFilms(collectionType, page)
      .then((d) => {
        const items = d.items ?? [];
        setFilms(items);
        setTotal(d.total || 250);
        setTotalPages(
          d.totalPages && d.totalPages > 1
            ? d.totalPages
            : Math.ceil((d.total || 250) / PAGE_SIZE),
        );
      })
      .catch(() => setFilms([]))
      .finally(() => setLoading(false));
  }, [page, collectionType]);

  if (noKey) return <NoKeyBanner />;

  const getGlobalRank = (localIndex: number) =>
    (page - 1) * PAGE_SIZE + localIndex + 1;

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Audience Rating"
        eyebrowIcon={<Star size={14} fill="#f5c518" stroke="#f5c518" />}
        eyebrowColor="#f5c518"
        title="TOP 250"
        subtitle={
          collectionType === "TOP_250_TV_SHOWS"
            ? "The highest-rated television series of all time, ranked by audience score."
            : "The greatest films of all time, ranked by audience score."
        }
        rightSlot={
          !loading && total > 0 ? (
            <span className="text-[12px] sm:text-[13px] text-[var(--text-muted)]">
              {total.toLocaleString()} ranked titles
            </span>
          ) : null
        }
      />

      <TabBar className="mb-6">
        <TabPill
          active={collectionType === "TOP_250_MOVIES"}
          href="/top250?type=TOP_250_MOVIES"
        >
          <FilmIcon size={13} />
          Top 250 Movies
        </TabPill>
        <TabPill
          active={collectionType === "TOP_250_TV_SHOWS"}
          href="/top250?type=TOP_250_TV_SHOWS"
        >
          <Tv size={13} />
          Top 250 Series
        </TabPill>
      </TabBar>

      {loading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: PAGE_SIZE }).map((_, i) => (
            <div
              key={i}
              className="skeleton h-[68px] sm:h-[76px] rounded-[10px]"
            />
          ))}
        </div>
      ) : films.length === 0 ? (
        <EmptyState
          icon={<Trophy size={36} />}
          title="Failed to Load Top 250"
          description="Please check your API key quota or try again in a moment."
          actionLabel="Explore Films"
          actionHref="/explore"
        />
      ) : (
        <div className="flex flex-col gap-[2px] sm:gap-[3px]">
          {films.map((film, i) => (
            <Top250Row
              key={film.kinopoiskId ?? film.filmId ?? i}
              film={film}
              rank={getGlobalRank(i)}
              autoTranslate={autoTranslate}
            />
          ))}
        </div>
      )}

      <Pagination
        page={page}
        totalPages={totalPages}
        buildHref={(p) =>
          `/top250?type=${encodeURIComponent(collectionType)}&page=${p}`
        }
      />
    </PageContainer>
  );
}
