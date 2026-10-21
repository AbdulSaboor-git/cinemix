"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Film as FilmIcon,
  Tv,
  Clapperboard,
  Star,
  Play,
  Info,
  Heart,
  Clock,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
} from "lucide-react";
import { Film } from "@/types/kinopoisk";
import { translateCountry, translateGenre } from "@/lib/translate";
import {
  useAutoTranslate,
  useFilmTitle,
  useTranslate,
} from "@/hooks/useTranslate";
import { useListStatus } from "@/hooks/useListStatus";
import { toggleFavorite, toggleWatchLater } from "@/lib/userLists";
import { useToast } from "@/lib/toast";
import ParentalGuideModal from "@/components/ParentalGuideModal";

interface HeroBannerProps {
  film?: Film;
  films?: Film[];
}

export default function HeroBanner({ film, films }: HeroBannerProps) {
  const slides =
    films && films.length > 0 ? films.slice(0, 6) : film ? [film] : [];
  const [activeIdx, setActiveIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const [parentalOpen, setParentalOpen] = useState(false);

  const currentFilm = slides[activeIdx] ?? slides[0];
  const autoTranslate = useAutoTranslate();
  const { toast } = useToast();

  useEffect(() => {
    if (slides.length <= 1 || paused || parentalOpen) return;
    const t = setInterval(() => {
      setActiveIdx((prev) => (prev + 1) % slides.length);
    }, 7000);
    return () => clearInterval(t);
  }, [slides.length, paused, parentalOpen]);

  const id = currentFilm ? (currentFilm.kinopoiskId ?? currentFilm.filmId ?? 0) : 0;
  const name = useFilmTitle(currentFilm, autoTranslate);
  const rawDesc =
    currentFilm?.shortDescription ||
    currentFilm?.description?.slice(0, 220) ||
    "";
  const desc = useTranslate(rawDesc);
  const { isFav, isWL } = useListStatus(id);

  if (!currentFilm) return null;

  const imdbScore = currentFilm.ratingImdb;
  const kpScore = currentFilm.ratingKinopoisk;
  const numericRating =
    imdbScore ??
    kpScore ??
    (typeof currentFilm.rating === "number" ? currentFilm.rating : undefined);
  const ratingDisplay = numericRating
    ? numericRating.toFixed(1)
    : currentFilm.ratingAwait
      ? `${Math.round(currentFilm.ratingAwait)}%`
      : undefined;

  const filmEntry = {
    film_id: id,
    film_name: name,
    poster_url: currentFilm.posterUrlPreview || currentFilm.posterUrl || null,
    year: currentFilm.year ?? currentFilm.startYear ?? null,
    rating: currentFilm.ratingKinopoisk ?? currentFilm.ratingImdb ?? null,
  };

  const handleFav = () => {
    const added = toggleFavorite(filmEntry);
    toast.success(added ? "Added to Favorites" : "Removed from Favorites");
  };

  const handleWL = () => {
    const added = toggleWatchLater(filmEntry);
    toast.info(added ? "Saved to Watch Later" : "Removed from Watch Later");
  };

  return (
    <div
      className="relative w-full overflow-hidden h-[390px] sm:h-[500px] md:h-[620px] lg:h-[min(86vh,780px)] group"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* Background */}
      {(currentFilm.coverUrl || currentFilm.posterUrl) && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={currentFilm.coverUrl || currentFilm.posterUrl}
          src={currentFilm.coverUrl || currentFilm.posterUrl}
          alt={name}
          fetchPriority="high"
          decoding="async"
          className="absolute inset-0 w-full h-full object-cover object-[center_20%] transition-opacity duration-500"
        />
      )}

      {/* Gradient layers */}
      <div className="hero-gradient-left absolute inset-0" />
      <div className="hero-gradient-bottom absolute inset-0" />
      <div className="absolute inset-0 bg-gradient-to-b from-[rgba(0,0,0,0.45)] via-transparent to-transparent" />

      {/* Content */}
      <div className="absolute bottom-0 left-0 right-0 px-4 sm:px-[var(--page-x)] pb-8 sm:pb-[8%]">
        <div className="max-w-[620px]">
          {/* Type & Slide Counter badge */}
          <div className="flex items-center gap-2 mb-3">
            {currentFilm.type && (
              <div className="inline-flex items-center gap-[5px] bg-[var(--accent)] rounded-[4px] px-2.5 py-[3px] text-[10px] sm:text-[11px] font-bold tracking-[1.2px] uppercase text-white">
                {currentFilm.type === "FILM" ? (
                  <>
                    <FilmIcon size={12} />
                    <span>Featured Film</span>
                  </>
                ) : currentFilm.type === "TV_SERIES" ||
                  currentFilm.type === "MINI_SERIES" ? (
                  <>
                    <Tv size={12} />
                    <span>Featured Series</span>
                  </>
                ) : (
                  <>
                    <Clapperboard size={12} />
                    <span>Featured Show</span>
                  </>
                )}
              </div>
            )}
            {slides.length > 1 && (
              <span className="text-[11px] font-semibold text-white/60 bg-black/45 backdrop-blur-md px-2.5 py-[2px] rounded-[4px] border border-white/10">
                #{activeIdx + 1} of {slides.length}
              </span>
            )}
          </div>

          <h1
            className="font-display uppercase leading-[0.95] tracking-[2px] text-white mb-3 sm:mb-4 line-clamp-2"
            style={{
              fontSize: "clamp(26px, 5.5vw, 72px)",
              textShadow: "0 4px 24px rgba(0,0,0,0.7)",
            }}
          >
            {name}
          </h1>

          {/* Meta row */}
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap mb-2.5 sm:mb-3">
            {imdbScore ? (
              <div className="flex items-center gap-[4px] bg-black/50 backdrop-blur-md border border-[rgba(245,197,24,0.35)] rounded-[5px] px-2 py-0.5">
                <Star size={11} fill="#f5c518" stroke="#f5c518" />
                <span className="font-display text-[#f5c518] text-[14px] sm:text-[16px]">
                  {imdbScore.toFixed(1)}
                </span>
                <span className="text-[10px] text-white/65 font-semibold">
                  IMDb
                </span>
              </div>
            ) : ratingDisplay ? (
              <div className="flex items-center gap-[4px] sm:gap-[5px]">
                <Star size={12} fill="#f5c518" stroke="#f5c518" />
                <span className="font-display text-[#f5c518] text-[15px] sm:text-[18px]">
                  {ratingDisplay}
                </span>
              </div>
            ) : null}

            {kpScore && imdbScore && (
              <div className="flex items-center gap-[4px] bg-black/50 backdrop-blur-md border border-white/15 rounded-[5px] px-2 py-0.5">
                <span className="font-display text-white text-[14px] sm:text-[16px]">
                  {kpScore.toFixed(1)}
                </span>
                <span className="text-[10px] text-white/60 font-semibold">
                  KP
                </span>
              </div>
            )}

            {currentFilm.year && (
              <span className="text-[var(--text-dim)] text-[12px] sm:text-[13px] font-medium">
                {currentFilm.year}
              </span>
            )}
            {currentFilm.filmLength && currentFilm.filmLength > 0 && (
              <span className="text-[var(--text-dim)] text-[12px] sm:text-[13px]">
                {Math.floor(currentFilm.filmLength / 60)}h{" "}
                {currentFilm.filmLength % 60}m
              </span>
            )}
            {(currentFilm.ratingAgeLimits || currentFilm.ratingMpaa) && (
              <button
                type="button"
                onClick={() => setParentalOpen(true)}
                title="View Parental Guide"
                className="inline-flex items-center gap-1 bg-black/50 backdrop-blur-md border border-[rgba(255,255,255,0.28)] hover:border-[var(--accent)] rounded-[5px] px-2 py-[2px] text-[10px] sm:text-[11px] text-white/85 cursor-pointer transition-colors"
              >
                <ShieldAlert size={11} className="text-[var(--accent)]" />
                {currentFilm.ratingMpaa
                  ? currentFilm.ratingMpaa.toUpperCase()
                  : `${currentFilm.ratingAgeLimits!.replace("age", "")}+`}
              </button>
            )}
          </div>

          {/* Genres & Countries */}
          <div className="hidden sm:flex flex-wrap gap-2 mb-3 sm:mb-4">
            {currentFilm.genres?.slice(0, 4).map((g) => (
              <Link
                key={g.genre}
                href={`/explore?genres=${encodeURIComponent(g.genre)}`}
                className="no-underline"
              >
                <span className="tag tag-dim hover:border-white/30 transition-colors">
                  {translateGenre(g.genre, autoTranslate)}
                </span>
              </Link>
            ))}
            {currentFilm.countries?.slice(0, 2).map((c) => (
              <Link
                key={c.country}
                href={`/explore?countries=${encodeURIComponent(c.country)}`}
                className="no-underline"
              >
                <span className="tag tag-dim hover:border-white/30 transition-colors">
                  {translateCountry(c.country, autoTranslate)}
                </span>
              </Link>
            ))}
          </div>

          {/* Description */}
          {desc && (
            <p className="hidden sm:block text-[13px] md:text-[15px] leading-[1.65] text-[rgba(240,240,240,0.78)] mb-4 sm:mb-5 line-clamp-2 md:line-clamp-3 max-w-[520px]">
              {desc}
            </p>
          )}

          {/* Action Buttons */}
          <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap">
            <Link href={`/watch/${id}`} className="no-underline">
              <button
                type="button"
                className="btn btn-primary px-4 sm:px-6 py-2.5 sm:py-3 text-[13px] sm:text-[14px]"
              >
                <Play size={13} fill="white" stroke="white" />
                Watch Now
              </button>
            </Link>
            <Link href={`/film/${id}`} className="no-underline">
              <button
                type="button"
                className="btn btn-secondary px-4 sm:px-5 py-2.5 sm:py-3 text-[13px] sm:text-[14px]"
              >
                <Info size={13} strokeWidth={2} />
                More Info
              </button>
            </Link>

            <button
              type="button"
              onClick={handleFav}
              title={isFav ? "In Favorites" : "Add to Favorites"}
              className={`btn py-2.5 sm:py-3 px-3.5 text-[12px] sm:text-[13px] border backdrop-blur-md ${
                isFav
                  ? "bg-[rgba(229,9,20,0.25)] border-[rgba(229,9,20,0.65)] text-white"
                  : "bg-black/45 border-white/20 text-white hover:border-white/40"
              }`}
            >
              <Heart
                size={14}
                fill={isFav ? "var(--accent)" : "none"}
                stroke={isFav ? "var(--accent)" : "currentColor"}
              />
              <span className="hidden md:inline">
                {isFav ? "In Favorites" : "Favorite"}
              </span>
            </button>

            <button
              type="button"
              onClick={handleWL}
              title={isWL ? "In Watch Later" : "Watch Later"}
              className={`btn py-2.5 sm:py-3 px-3.5 text-[12px] sm:text-[13px] border backdrop-blur-md ${
                isWL
                  ? "bg-[rgba(96,165,250,0.25)] border-[rgba(96,165,250,0.65)] text-[#93c5fd]"
                  : "bg-black/45 border-white/20 text-white hover:border-white/40"
              }`}
            >
              <Clock size={14} stroke={isWL ? "#60a5fa" : "currentColor"} />
              <span className="hidden md:inline">
                {isWL ? "In Watch Later" : "Watch Later"}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Multi-Slide Controls & Dots */}
      {slides.length > 1 && (
        <div className="absolute bottom-3 sm:bottom-6 right-4 sm:right-[var(--page-x)] flex items-center gap-2 z-10">
          <div className="flex items-center gap-1.5 mr-1">
            {slides.map((s, idx) => (
              <button
                key={s.kinopoiskId ?? s.filmId ?? idx}
                type="button"
                aria-label={`Slide ${idx + 1}`}
                onClick={() => setActiveIdx(idx)}
                className={`h-1.5 rounded-full transition-all duration-300 cursor-pointer border-none p-0 ${
                  idx === activeIdx
                    ? "w-6 bg-[var(--accent)]"
                    : "w-2 bg-white/35 hover:bg-white/60"
                }`}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={() =>
              setActiveIdx((prev) => (prev - 1 + slides.length) % slides.length)
            }
            aria-label="Previous featured film"
            className="w-8 h-8 rounded-full bg-black/55 border border-white/20 text-white flex items-center justify-center cursor-pointer hover:bg-black/80 hover:border-white/40 transition-all"
          >
            <ChevronLeft size={15} />
          </button>
          <button
            type="button"
            onClick={() => setActiveIdx((prev) => (prev + 1) % slides.length)}
            aria-label="Next featured film"
            className="w-8 h-8 rounded-full bg-black/55 border border-white/20 text-white flex items-center justify-center cursor-pointer hover:bg-black/80 hover:border-white/40 transition-all"
          >
            <ChevronRight size={15} />
          </button>
        </div>
      )}

      <ParentalGuideModal
        open={parentalOpen}
        onClose={() => setParentalOpen(false)}
        film={currentFilm}
      />
    </div>
  );
}
