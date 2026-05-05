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

export default function FilmRow({ title, films, href, showIndex, size = "md" }: FilmRowProps) {
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
    const walk = (x - startX) * 1.5; // multiplier for drag sensitivity
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollLeft = scrollLeft - walk;
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  if (!films.length) return null;

  return (
    <section style={{ marginBottom: "52px" }}>
      <div className="section-header" style={{ padding: "0 clamp(16px,4vw,48px)", marginBottom: "18px" }}>
        <h2 style={{
          fontFamily: "var(--font-display)",
          fontSize: "clamp(18px, 2.5vw, 24px)",
          letterSpacing: "1.5px", color: "white",
        }}>{title}</h2>
        {href && (
          <Link href={href} style={{
            fontSize: "11px", fontWeight: 700, color: "var(--accent)",
            textDecoration: "none", display: "flex", alignItems: "center",
            gap: 4, letterSpacing: "1px", textTransform: "uppercase",
            flexShrink: 0, opacity: 0.9,
            transition: "opacity 0.2s",
          }}>
            See all
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
              <path d="M5 12h14M12 5l7 7-7 7"/>
            </svg>
          </Link>
        )}
      </div>
      <div
        ref={scrollContainerRef}
        className="scroll-row"
        style={{
          padding: "4px 16px 16px ",
          cursor: isDragging ? "grabbing" : "grab",
          userSelect: isDragging ? "none" : "auto",
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
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
