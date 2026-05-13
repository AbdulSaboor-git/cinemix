"use client";
import { Film } from "@/types/kinopoisk";
import FilmCard from "./FilmCard";
import Link from "next/link";
import { useRef, useState } from "react";

interface FilmRowProps {
  title: string;
  films: Film[];
  href?: string;
  showIndex?: boolean;
  size?: "sm" | "md" | "lg";
}

export default function FilmRow({
  title,
  films,
  href,
  showIndex,
  size = "md",
}: FilmRowProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setStartX(e.pageX - (scrollContainerRef.current?.offsetLeft || 0));
    setScrollLeft(scrollContainerRef.current?.scrollLeft || 0);
  };
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    e.preventDefault();
    const x = e.pageX - (scrollContainerRef.current?.offsetLeft || 0);
    const walk = (x - startX) * 1.5;
    if (scrollContainerRef.current)
      scrollContainerRef.current.scrollLeft = scrollLeft - walk;
  };
  const handleMouseUp = () => setIsDragging(false);

  if (!films.length) return null;

  return (
    <section className="mb-10 md:mb-14">
      {/* Header */}
      <div className="flex items-baseline justify-between gap-4 px-[var(--page-x)] mb-4">
        <h2 className="font-display uppercase text-[clamp(18px,2.5vw,24px)]  text-white leading-none">
          {title}
        </h2>
        {href && (
          <Link
            href={href}
            className="text-[11px] font-bold text-[var(--accent)] no-underline flex items-center gap-1 tracking-[1px] uppercase flex-shrink-0 opacity-80 hover:opacity-100 transition-opacity"
          >
            See all
            <svg
              width="11"
              height="11"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
            >
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </Link>
        )}
      </div>

      {/* Scrollable row — full bleed with side padding on first/last items */}
      <div
        ref={scrollContainerRef}
        className="scroll-row  px-(--page-x)"
        style={{ cursor: isDragging ? "grabbing" : "grab" }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        draggable={false}
      >
        {films.map((film, i) => (
          <FilmCard
            key={film.kinopoiskId ?? film.filmId ?? i}
            film={film}
            variant="scroll"
            size={size}
            index={showIndex ? i : undefined}
          />
        ))}
      </div>
    </section>
  );
}
