"use client";
import { useRef, useState } from "react";
import { Film } from "@/types/kinopoisk";
import FilmCard from "./FilmCard";
import SectionHeader from "@/components/ui/SectionHeader";

interface FilmRowProps {
  title: string;
  films: Film[];
  href?: string;
  showIndex?: boolean;
  size?: "sm" | "md" | "lg";
  isLoading?: boolean;
}

const SKELETON_SIZE_CLASSES = {
  sm: "w-[110px] h-[165px] sm:w-[140px] sm:h-[210px]",
  md: "w-[126px] h-[189px] sm:w-[175px] sm:h-[263px]",
  lg: "w-[156px] h-[234px] sm:w-[220px] sm:h-[330px]",
};

export default function FilmRow({
  title,
  films,
  href,
  showIndex,
  size = "md",
  isLoading = false,
}: FilmRowProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const startXRef = useRef(0);
  const scrollLeftRef = useRef(0);
  const draggedRef = useRef(false);

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    draggedRef.current = false;
    startXRef.current = e.pageX - (scrollContainerRef.current?.offsetLeft || 0);
    scrollLeftRef.current = scrollContainerRef.current?.scrollLeft || 0;
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    const x = e.pageX - (scrollContainerRef.current?.offsetLeft || 0);
    const delta = x - startXRef.current;
    if (Math.abs(delta) > 6) {
      draggedRef.current = true;
      e.preventDefault();
    }
    const walk = delta * 1.4;
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollLeft = scrollLeftRef.current - walk;
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleClickCapture = (e: React.MouseEvent) => {
    if (draggedRef.current) {
      e.preventDefault();
      e.stopPropagation();
      draggedRef.current = false;
    }
  };

  if (!isLoading && !films.length) return null;

  return (
    <section className="mb-10 md:mb-14" aria-busy={isLoading}>
      <div className="px-[var(--page-x)]">
        <SectionHeader title={title} href={href} className="mb-2" />
      </div>

      {isLoading ? (
        <div className="scroll-row" aria-hidden="true">
          {Array.from({ length: 7 }, (_, i) => (
            <div
              key={i}
              className={`skeleton flex-shrink-0 rounded-[10px] sm:rounded-[12px] ${SKELETON_SIZE_CLASSES[size]}`}
            />
          ))}
        </div>
      ) : (
        <div
          ref={scrollContainerRef}
          className="scroll-row"
          style={{ cursor: isDragging ? "grabbing" : "grab" }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onClickCapture={handleClickCapture}
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
      )}
    </section>
  );
}
