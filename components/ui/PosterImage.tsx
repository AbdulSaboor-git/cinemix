"use client";
import React, { useState, useEffect, useRef } from "react";
import { User, Film } from "lucide-react";
import { FilmPosterFallback } from "@/components/posterFallback";

export interface PosterImageProps {
  src?: string | null;
  alt: string;
  title?: string;
  size?: "sm" | "md" | "lg";
  fallbackType?: "film" | "person" | "mini";
  priority?: boolean;
  className?: string;
  imgClassName?: string;
}

/**
 * Converts full-size 2MB Kinopoisk poster URLs (/images/posters/kp/...) into
 * fast ~20KB thumbnail URLs (/images/posters/kp_small/...) for cards & thumbnails,
 * while keeping full-resolution posters when `size="lg"` or `priority={true}` (without `size="sm"`).
 */
function optimizePosterUrl(
  rawUrl?: string | null,
  size?: "sm" | "md" | "lg",
  fallbackType?: "film" | "person" | "mini",
  priority?: boolean,
): string | null {
  if (!rawUrl) return null;
  if (size === "lg") return rawUrl;
  if (
    size === "sm" ||
    size === "md" ||
    (!priority && (fallbackType === "film" || fallbackType === "mini"))
  ) {
    return rawUrl.replace("/images/posters/kp/", "/images/posters/kp_small/");
  }
  return rawUrl;
}

export default function PosterImage({
  src,
  alt,
  title,
  size,
  fallbackType = "film",
  priority = false,
  className = "w-full h-full relative overflow-hidden bg-[var(--surface)]",
  imgClassName = "w-full h-full object-cover block",
}: PosterImageProps) {
  const optimizedSrc = optimizePosterUrl(src, size, fallbackType, priority);
  const [activeSrc, setActiveSrc] = useState<string | null>(optimizedSrc);
  const [error, setError] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const imgRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    setActiveSrc(optimizedSrc);
    setError(false);
    const el = imgRef.current;
    if (el && el.complete && el.naturalWidth > 0) {
      setLoaded(true);
    } else {
      setLoaded(false);
    }
  }, [optimizedSrc]);

  if (!activeSrc || error) {
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
        src={activeSrc}
        alt={alt}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        fetchPriority={priority ? "high" : "auto"}
        draggable={false}
        onLoad={() => setLoaded(true)}
        onError={() => {
          // If kp_small thumbnail failed to load, automatically retry once with full-res original src
          if (src && activeSrc !== src) {
            setActiveSrc(src);
            return;
          }
          setError(true);
        }}
        className={`${imgClassName} transition-opacity duration-300 ease-out ${
          loaded ? "opacity-100" : "opacity-0"
        }`}
      />
    </div>
  );
}
