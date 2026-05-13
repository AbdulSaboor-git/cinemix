"use client";
import { useState, useEffect } from "react";
import { Film } from "@/types/kinopoisk";
import { FilmPosterFallback } from "./posterFallback";

interface PlayerSectionProps {
  filmId: number;
  film: Film;
}

const PLAYER_BASE =
  process.env.NEXT_PUBLIC_PLAYER_BASE_URL || "https://sitebysite.lat/film";

export default function PlayerSection({ filmId, film }: PlayerSectionProps) {
  const [playerActive, setPlayerActive] = useState(false);

  useEffect(() => {
    const originalOpen = window.open;
    window.open = function (url, target, features) {
      if (target === "_blank" || !target) return null;
      return originalOpen.call(window, url, target, features);
    };
    return () => {
      window.open = originalOpen;
    };
  }, []);

  const name = film.nameOriginal || film.nameRu || film.nameEn || "Unknown";
  const playerUrl = `${PLAYER_BASE}/${filmId}/`;
  const [posterError, setPosterError] = useState(false);

  return (
    <div className="w-full bg-[var(--bg)] relative">
      {!playerActive ? (
        <div
          className="relative w-full overflow-hidden cursor-pointer bg-black aspect-video max-h-[75vh]"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setPlayerActive(true);
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {(film.coverUrl || film.posterUrl || film.posterUrlPreview) &&
          !posterError ? (
            <img
              src={film.coverUrl || film.posterUrl || film.posterUrlPreview}
              alt={name}
              className="w-full h-full object-cover object-[center_30%] brightness-[0.4]"
              onError={() => setPosterError(true)}
            />
          ) : (
            <FilmPosterFallback />
          )}

          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_30%,rgba(0,0,0,0.7)_100%)]" />
          {/* Play button + title */}
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 pointer-events-none">
            <div
              className="w-[88px] h-[88px] rounded-full bg-[rgba(229,9,20,0.9)] flex items-center justify-center pointer-events-auto transition-transform duration-200 hover:scale-110 shadow-[0_0_60px_var(--accent-glow),0_0_120px_rgba(229,9,20,0.2)]"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setPlayerActive(true);
              }}
            >
              <svg
                width="32"
                height="32"
                viewBox="0 0 24 24"
                fill="white"
                className="ml-1 pointer-events-none"
              >
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
            </div>
            <div className="text-center">
              <p className="font-display text-white mb-2 text-[clamp(20px,3vw,40px)] tracking-[1px]">
                {name}
              </p>
              <p className="text-[14px] text-[rgba(255,255,255,0.5)]">
                Click to watch
              </p>
            </div>
          </div>

          {/* Pulsing ring */}
          <style>{`@keyframes pulse-ring { 0%{transform:scale(1);opacity:0.6} 100%{transform:scale(1.5);opacity:0} }`}</style>
          <div
            className="absolute w-[88px] h-[88px] rounded-full border-2 border-[var(--accent)] pointer-events-none animate-[pulse-ring_2s_ease-out_infinite]"
            style={{
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -54px)",
            }}
          />
        </div>
      ) : (
        <div className="relative w-full bg-black z-20 aspect-video max-h-[75vh]">
          <iframe
            src={playerUrl}
            allowFullScreen
            className="absolute w-full border-none block bg-black top-0 md:-top-[89%] h-[300%] md:h-[180%]"
            allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
            title={name}
          />
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setPlayerActive(false);
            }}
            className="absolute top-[10px] right-4 bg-[rgba(0,0,0,0.8)] backdrop-blur-[8px] border border-[rgba(255,255,255,0.2)] rounded-[8px] px-[14px] py-2 text-white text-[13px] font-medium cursor-pointer flex items-center gap-[6px] z-10"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
            Close
          </button>
        </div>
      )}
    </div>
  );
}
