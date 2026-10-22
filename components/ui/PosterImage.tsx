"use client";
import React, { useState, useEffect, useRef } from "react";
import { User, Film } from "lucide-react";
import { FilmPosterFallback } from "@/components/posterFallback";

interface PosterImageProps {
  src?: string | null;
  alt: string;
  title?: string;
  fallbackType?: "film" | "person" | "mini";
  priority?: boolean;
  className?: string;
  imgClassName?: string;
}

/**
 * Converts full-size 2MB Kinopoisk poster URLs (/images/posters/kp/...) into
 * fast 20KB thumbnail URLs (/images/posters/kp_small/...) for cards & thumbnails.
 */
function optimizePosterUrl(
  rawUrl?: string | null,
  fallbackType?: "film" | "person" | "mini",
  priority?: boolean,
): string | null {
  if (!rawUrl) return null;
  if (!priority && (fallbackType === "film" || fallbackType === "mini")) {
    return rawUrl.replace("/images/posters/kp/", "/images/posters/kp_small/");
  }
  return rawUrl;
}

export default function PosterImage({
  src,
  alt,
  title,
  fallbackType = "film",
  priority = false,
  className = "w-full h-full relative overflow-hidden bg-[var(--surface)]",
  imgClassName = "w-full h-full object-cover block",
}: PosterImageProps) {
  const optimizedSrc = optimizePosterUrl(src, fallbackType, priority);
  const [error, setError] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const imgRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    setError(false);
    const el = imgRef.current;
    if (el && el.complete && el.naturalWidth > 0) {
      setLoaded(true);
    } else {
      setLoaded(false);
    }
  }, [optimizedSrc]);

  if (!optimizedSrc || error) {
    if (fallbackType === "person") {
      return (
        <div
          className={`${className} flex flex-col items-center justify-center gap-2 bg-gradient-to-br from-[#1a1a2e] to-[#16213e]`}
        >
          <User size={28} stroke="var(--text-muted)" strokeWidth={1.5} />
          {(title || alt) && (
            <span className="text-[10px] text-[var(--text-muted)] px-2 text-center leading-tight line-clamp-2">
              {title || alt}
            </span>
          )}
        </div>
      );
    }
    if (fallbackType === "mini") {
      return (
        <div
          className={`${className} flex items-center justify-center bg-[var(--surface)]`}
        >
          <Film size={13} stroke="var(--text-muted)" strokeWidth={2} />
        </div>
      );
    }
    return (
      <div className={className}>
        <FilmPosterFallback title={title || alt} />
      </div>
    );
  }

  return (
    <div className={className}>
      {!loaded && (
        <div
          aria-hidden="true"
          className="absolute inset-0 skeleton pointer-events-none"
        />
      )}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={imgRef}
        src={optimizedSrc}
        alt={alt}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        fetchPriority={priority ? "high" : "auto"}
        draggable={false}
        onLoad={() => setLoaded(true)}
        onError={() => {
          // If kp_small failed but original src differs, fall back cleanly
          setError(true);
        }}
        className={`${imgClassName} transition-opacity duration-300 ease-out ${
          loaded ? "opacity-100" : "opacity-0"
        }`}
      />
    </div>
  );
}
