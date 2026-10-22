"use client";
import { useState, useEffect, useRef, useCallback } from "react";
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
    films && films.length > 0 ? films.slice(0, 5) : film ? [film] : [];
  const [activeIdx, setActiveIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const [parentalOpen, setParentalOpen] = useState(false);
  const [dragOffsetX, setDragOffsetX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const swipedRef = useRef(false);

  const safeIdx = slides.length > 0 ? activeIdx % slides.length : 0;
  const currentFilm = slides[safeIdx] ?? slides[0];
  const autoTranslate = useAutoTranslate();
  const { toast } = useToast();

  const goNext = useCallback(() => {
    if (slides.length <= 1) return;
    setActiveIdx((prev) => (prev + 1) % slides.length);
  }, [slides.length]);

  const goPrev = useCallback(() => {
    if (slides.length <= 1) return;
    setActiveIdx((prev) => (prev - 1 + slides.length) % slides.length);
  }, [slides.length]);

  useEffect(() => {
    if (slides.length <= 1 || paused || parentalOpen || isDragging) return;
    const t = setInterval(goNext, 6500);
    return () => clearInterval(t);
  }, [slides.length, paused, parentalOpen, isDragging, goNext]);

  const id = currentFilm
    ? (currentFilm.kinopoiskId ?? currentFilm.filmId ?? 0)
    : 0;
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
    rating: currentFilm.ratingImdb ?? currentFilm.ratingKinopoisk ?? null,
  };

  const handleFav = () => {
    const added = toggleFavorite(filmEntry);
    toast.success(added ? "Added to Favorites" : "Removed from Favorites");
  };

  const handleWL = () => {
    const added = toggleWatchLater(filmEntry);
    toast.info(added ? "Saved to Watch Later" : "Removed from Watch Later");
  };

  // Touch & Pointer swipe handlers for smooth mobile/tablet/desktop swiping
  const handleSwipeStart = (clientX: number, clientY: number) => {
    if (slides.length <= 1) return;
    touchStartX.current = clientX;
    touchStartY.current = clientY;
    swipedRef.current = false;
    setIsDragging(true);
  };

  const handleSwipeMove = (clientX: number, clientY: number) => {
    if (touchStartX.current === null || touchStartY.current === null) return;
    const dx = clientX - touchStartX.current;
    const dy = clientY - touchStartY.current;
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 10) {
      swipedRef.current = true;
      setDragOffsetX(Math.max(-140, Math.min(140, dx * 0.45)));
    }
  };

  const handleSwipeEnd = (clientX: number) => {
    if (touchStartX.current === null) return;
    const dx = clientX - touchStartX.current;
    if (Math.abs(dx) >= 48) {
      if (dx < 0) goNext();
      else goPrev();
    }
    touchStartX.current = null;
    touchStartY.current = null;
    setDragOffsetX(0);
    setIsDragging(false);
  };

  return (
    <div
      className="relative w-full overflow-hidden h-[380px] sm:h-[490px] md:h-[600px] lg:h-[min(85vh,760px)] group select-none touch-pan-y bg-[#080808]"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => {
        setPaused(false);
        if (isDragging) {
          touchStartX.current = null;
          setDragOffsetX(0);
          setIsDragging(false);
        }
      }}
      onTouchStart={(e) => {
        const t = e.touches[0];
        if (t) handleSwipeStart(t.clientX, t.clientY);
      }}
      onTouchMove={(e) => {
        const t = e.touches[0];
        if (t) handleSwipeMove(t.clientX, t.clientY);
      }}
      onTouchEnd={(e) => {
        const t = e.changedTouches[0];
        if (t) handleSwipeEnd(t.clientX);
      }}
      onPointerDown={(e) => {
        if (e.pointerType === "mouse" && e.button === 0) {
          handleSwipeStart(e.clientX, e.clientY);
        }
      }}
      onPointerMove={(e) => {
        if (e.pointerType === "mouse" && isDragging) {
          handleSwipeMove(e.clientX, e.clientY);
        }
      }}
      onPointerUp={(e) => {
        if (e.pointerType === "mouse" && isDragging) {
          handleSwipeEnd(e.clientX);
        }
      }}
    >
      {/* Pre-rendered layered slides for butter-smooth crossfade + subtle zoom animation */}
      {slides.map((slide, idx) => {
        const isCurrent = idx === safeIdx;
        const bgUrl =
          slide.coverUrl || slide.posterUrl || slide.posterUrlPreview;
        if (!bgUrl) return null;
        return (
          <div
            key={slide.kinopoiskId ?? slide.filmId ?? idx}
            aria-hidden={!isCurrent}
            className={`absolute inset-0 transition-all duration-700 ease-out ${
              isCurrent
                ? "opacity-100 scale-100 z-[1]"
                : "opacity-0 scale-[1.04] z-0 pointer-events-none"
            }`}
            style={
              isCurrent && dragOffsetX !== 0
                ? {
                    transform: `translateX(${dragOffsetX}px) scale(1.01)`,
                    transition: "none",
                  }
                : undefined
            }
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={bgUrl}
              alt={slide.nameEn || slide.nameOriginal || slide.nameRu || "Hero"}
              loading={idx === 0 ? "eager" : "lazy"}
              fetchPriority={idx === 0 ? "high" : "auto"}
              decoding="async"
              draggable={false}
              className="w-full h-full object-cover object-[center_20%]"
            />
          </div>
        );
      })}

      {/* Gradient layers */}
      <div className="hero-gradient-left absolute inset-0 z-[2] pointer-events-none" />
      <div className="hero-gradient-bottom absolute inset-0 z-[2] pointer-events-none" />
      <div className="absolute inset-0 bg-gradient-to-b from-[rgba(0,0,0,0.45)] via-transparent to-transparent z-[2] pointer-events-none" />

      {/* Content */}
      <div
        key={`hero-meta-${id}`}
        className="absolute bottom-0 left-0 right-0 z-[3] px-4 sm:px-[var(--page-x)] pb-8 sm:pb-[7%] fade-up"
      >
        <div className="max-w-[620px]">
          {/* Type badge */}
          {currentFilm.type && (
            <div className="flex items-center gap-2 mb-2.5 sm:mb-3">
              <div className="inline-flex items-center gap-[5px] bg-[var(--accent)] rounded-[4px] px-2.5 py-[3px] text-[10px] sm:text-[11px] font-bold tracking-[1.2px] uppercase text-white shadow-[0_2px_12px_rgba(229,9,20,0.45)]">
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
            </div>
          )}

          <h1
            className="font-display uppercase leading-[0.95] tracking-[2px] text-white mb-2.5 sm:mb-3.5 line-clamp-2"
            style={{
              fontSize: "clamp(26px, 5.5vw, 70px)",
              textShadow: "0 4px 24px rgba(0,0,0,0.75)",
            }}
          >
            {name}
          </h1>

          {/* Meta row — clean & decluttered (no KP badge anywhere; PG/18+ hidden on mobile) */}
          <div className="flex items-center gap-2.5 sm:gap-3 flex-wrap mb-3 sm:mb-3.5">
            {ratingDisplay && (
              <div className="flex items-center gap-[5px] bg-black/50 backdrop-blur-md border border-[rgba(245,197,24,0.35)] rounded-[5px] px-2 py-0.5">
                <Star size={11} fill="#f5c518" stroke="#f5c518" />
                <span className="font-display text-[#f5c518] text-[14px] sm:text-[16px]">
                  {ratingDisplay}
                </span>
                {imdbScore && (
                  <span className="text-[10px] text-white/70 font-semibold">
                    IMDb
                  </span>
                )}
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

            {/* Age / MPAA rating hidden on mobile (< sm) to keep mobile Hero clean */}
            {(currentFilm.ratingAgeLimits || currentFilm.ratingMpaa) && (
              <button
                type="button"
                onClick={() => setParentalOpen(true)}
                title="View Parental Guide"
                className="hidden sm:inline-flex items-center gap-1 bg-black/50 backdrop-blur-md border border-[rgba(255,255,255,0.28)] hover:border-[var(--accent)] rounded-[5px] px-2 py-[2px] text-[11px] text-white/85 cursor-pointer transition-colors"
              >
                <ShieldAlert size={11} className="text-[var(--accent)]" />
                {currentFilm.ratingMpaa
                  ? currentFilm.ratingMpaa.toUpperCase()
                  : `${currentFilm.ratingAgeLimits!.replace("age", "")}+`}
              </button>
            )}
          </div>

          {/* Genres & Countries (desktop/tablet only) */}
          <div className="hidden sm:flex flex-wrap gap-2 mb-3.5">
            {currentFilm.genres?.slice(0, 4).map((g) => (
              <Link
                key={g.genre}
                href={`/explore?genres=${encodeURIComponent(g.genre)}`}
                className="no-underline"
              >
                <span className="tag tag-dim hover:border-white/30 transition-colors capitalize">
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

          {/* CTAs — On mobile: only Watch Now & Details; on sm+: also In Favorites & Watch Later */}
          <div className="flex gap-2.5 sm:gap-3 flex-wrap items-center">
            <Link
              href={`/watch/${id}`}
              className="no-underline"
              onClick={(e) => {
                if (swipedRef.current) e.preventDefault();
              }}
            >
              <span className="btn btn-primary px-4 sm:px-[22px] py-2 sm:py-[11px] text-[12px] sm:text-[14px]">
                <Play size={14} fill="white" stroke="white" />
                Watch Now
              </span>
            </Link>

            <Link
              href={`/film/${id}`}
              className="no-underline"
              onClick={(e) => {
                if (swipedRef.current) e.preventDefault();
              }}
            >
              <span className="btn btn-secondary px-4 sm:px-[20px] py-2 sm:py-[11px] text-[12px] sm:text-[14px]">
                <Info size={14} strokeWidth={2.2} />
                Details
              </span>
            </Link>

            <button
              type="button"
              onClick={handleFav}
              title={isFav ? "In Favorites" : "Add to Favorites"}
              className={`hidden sm:inline-flex btn btn-secondary px-3.5 py-[11px] text-[13px] ${
                isFav
                  ? "!border-[rgba(229,9,20,0.6)] !bg-[rgba(229,9,20,0.2)] !text-white"
                  : ""
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
              title={isWL ? "In Watch Later" : "Save to Watch Later"}
              className={`hidden sm:inline-flex btn btn-secondary px-3.5 py-[11px] text-[13px] ${
                isWL
                  ? "!border-[rgba(96,165,250,0.6)] !bg-[rgba(96,165,250,0.18)] !text-[#60a5fa]"
                  : ""
              }`}
            >
              <Clock size={14} />
              <span className="hidden md:inline">
                {isWL ? "In Watch Later" : "Watch Later"}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Carousel Controls (Prev/Next + Animated Dots) */}
      {slides.length > 1 && (
        <>
          <div className="hidden sm:flex items-center gap-2 absolute right-6 bottom-8 z-[4]">
            <button
              type="button"
              onClick={goPrev}
              aria-label="Previous spotlight film"
              className="w-10 h-10 rounded-full bg-black/55 hover:bg-[var(--accent)] border border-white/15 flex items-center justify-center text-white cursor-pointer transition-all backdrop-blur-md"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              type="button"
              onClick={goNext}
              aria-label="Next spotlight film"
              className="w-10 h-10 rounded-full bg-black/55 hover:bg-[var(--accent)] border border-white/15 flex items-center justify-center text-white cursor-pointer transition-all backdrop-blur-md"
            >
              <ChevronRight size={18} />
            </button>
          </div>

          <div className="absolute bottom-3 sm:bottom-5 left-1/2 -translate-x-1/2 z-[4] flex items-center gap-1.5">
            {slides.map((s, idx) => {
              const active = idx === safeIdx;
              return (
                <button
                  key={s.kinopoiskId ?? s.filmId ?? idx}
                  type="button"
                  onClick={() => setActiveIdx(idx)}
                  aria-label={`Slide ${idx + 1}`}
                  className={`h-1.5 rounded-full border-none cursor-pointer transition-all duration-300 p-0 ${
                    active
                      ? "w-7 bg-[var(--accent)] shadow-[0_0_8px_var(--accent)]"
                      : "w-2 bg-white/35 hover:bg-white/60"
                  }`}
                />
              );
            })}
          </div>
        </>
      )}

      <ParentalGuideModal
        open={parentalOpen}
        onClose={() => setParentalOpen(false)}
        film={currentFilm}
      />
    </div>
  );
}
