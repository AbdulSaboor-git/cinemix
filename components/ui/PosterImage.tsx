"use client";
import React, { useState, useEffect } from "react";
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

export default function PosterImage({
  src,
  alt,
  title,
  fallbackType = "film",
  priority = false,
  className = "w-full h-full relative overflow-hidden bg-[var(--surface)]",
  imgClassName = "w-full h-full object-cover block",
}: PosterImageProps) {
  const [error, setError] = useState(false);

  useEffect(() => {
    setError(false);
  }, [src]);

  if (!src || error) {
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
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        fetchPriority={priority ? "high" : "auto"}
        draggable={false}
        onError={() => setError(true)}
        className={imgClassName}
      />
    </div>
  );
}
