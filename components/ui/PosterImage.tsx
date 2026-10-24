"use client";
import React, { useState, useEffect, useRef } from "react";
import {
  FilmPosterFallback,
  sanitizePosterUrl,
} from "@/components/posterFallback";

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

function optimizePosterUrl(
  rawUrl?: string | null,
  size?: "sm" | "md" | "lg",
  fallbackType?: "film" | "person" | "mini",
  priority?: boolean,
): string | null {
  const cleanUrl = sanitizePosterUrl(rawUrl);
  if (!cleanUrl) return null;
  if (size === "lg") return cleanUrl;
  if (
    size === "sm" ||
    size === "md" ||
    (!priority && (fallbackType === "film" || fallbackType === "mini"))
  ) {
    return cleanUrl.replace("/images/posters/kp/", "/images/posters/kp_small/");
  }
  return cleanUrl;
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
  const cleanOriginalSrc = sanitizePosterUrl(src);
  const optimizedSrc = optimizePosterUrl(src, size, fallbackType, priority);
  const [activeSrc, setActiveSrc] = useState<string | null>(optimizedSrc);
  const [error, setError] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const imgRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    setActiveSrc(optimizedSrc);
    setError(false);
    const el = imgRef.current;
    if (el && el.complete && el.naturalWidth > 1) {
      setLoaded(true);
    } else {
      setLoaded(false);
    }
  }, [optimizedSrc]);

  if (!activeSrc || error) {
    return (
      <div className={className}>
        <FilmPosterFallback
          title={title || alt}
          variant={fallbackType}
          compact={fallbackType === "mini"}
        />
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
        onLoad={(e) => {
          const img = e.currentTarget;
          // Catch 1x1 spacer pixels or redirected no-poster URLs
          if (
            img.naturalWidth <= 1 ||
            img.naturalHeight <= 1 ||
            !sanitizePosterUrl(img.currentSrc)
          ) {
            setError(true);
            return;
          }
          setLoaded(true);
        }}
        onError={() => {
          if (cleanOriginalSrc && activeSrc !== cleanOriginalSrc) {
            setActiveSrc(cleanOriginalSrc);
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
