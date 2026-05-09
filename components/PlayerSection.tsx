"use client";
import { useState, useEffect } from "react";
import { Film } from "@/types/kinopoisk";

interface PlayerSectionProps {
  filmId: number;
  film: Film;
}

const PLAYER_BASE =
  process.env.NEXT_PUBLIC_PLAYER_BASE_URL || "https://sitebysite.lat/film";

export default function PlayerSection({ filmId, film }: PlayerSectionProps) {
  const [playerActive, setPlayerActive] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Block popup windows from the embedded player
  useEffect(() => {
    const originalOpen = window.open;
    window.open = function (url, target, features) {
      // Allow fullscreen but block blank popups
      if (target === "_blank" || !target) return null;
      return originalOpen.call(window, url, target, features);
    };

    return () => {
      window.open = originalOpen;
    };
  }, []);

  // Detect mobile screen size
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const name = film.nameOriginal || film.nameRu || film.nameEn || "Unknown";
  const playerUrl = `${PLAYER_BASE}/${filmId}/`;

  return (
    <div
      style={{
        width: "100%",
        background: "var(--bg)",
        position: "relative",
      }}
    >
      {!playerActive ? (
        /* Thumbnail / play gate */
        <div
          style={{
            position: "relative",
            width: "100%",
            aspectRatio: "16/9",
            maxHeight: "75vh",
            overflow: "hidden",
            cursor: "pointer",
            background: "#000",
          }}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setPlayerActive(true);
          }}
        >
          {/* Poster as thumbnail */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={film.coverUrl || film.posterUrl}
            alt={name}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              objectPosition: "center 30%",
              filter: "brightness(0.4)",
            }}
          />

          {/* Gradient */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "radial-gradient(circle at center, transparent 30%, rgba(0,0,0,0.7) 100%)",
            }}
          />

          {/* Play button */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 20,
              pointerEvents: "none",
            }}
          >
            <div
              style={{
                width: 88,
                height: 88,
                borderRadius: "50%",
                background: "rgba(229,9,20,0.9)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow:
                  "0 0 60px var(--accent-glow), 0 0 120px rgba(229,9,20,0.2)",
                transition: "transform 0.2s ease, box-shadow 0.2s ease",
                pointerEvents: "auto",
              }}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setPlayerActive(true);
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.transform = "scale(1.1)";
                (e.currentTarget as HTMLElement).style.boxShadow =
                  "0 0 80px var(--accent-glow), 0 0 160px rgba(229,9,20,0.3)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.transform = "scale(1)";
                (e.currentTarget as HTMLElement).style.boxShadow =
                  "0 0 60px var(--accent-glow), 0 0 120px rgba(229,9,20,0.2)";
              }}
            >
              <svg
                width="32"
                height="32"
                viewBox="0 0 24 24"
                fill="white"
                style={{ marginLeft: 4, pointerEvents: "none" }}
              >
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
            </div>

            <div style={{ textAlign: "center" }}>
              <p
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "clamp(24px, 3vw, 40px)",
                  letterSpacing: "1px",
                  color: "white",
                  marginBottom: 8,
                }}
              >
                {name}
              </p>
              <p style={{ fontSize: "14px", color: "rgba(255,255,255,0.5)" }}>
                Click to watch
              </p>
            </div>
          </div>

          {/* Pulsing ring */}
          <style>{`
            @keyframes pulse-ring {
              0% { transform: scale(1); opacity: 0.6; }
              100% { transform: scale(1.5); opacity: 0; }
            }
          `}</style>
          <div
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -54px)",
              width: 88,
              height: 88,
              borderRadius: "50%",
              border: "2px solid var(--accent)",
              animation: "pulse-ring 2s ease-out infinite",
              pointerEvents: "none",
            }}
          />
        </div>
      ) : (
        /* Active player */
        <div
          style={{
            position: "relative",
            width: "100%",
            height: "100%",
            aspectRatio: "16/9",
            maxHeight: "75vh",
            background: "#000",
            zIndex: 20,
          }}
        >
          <iframe
            src={playerUrl}
            allowFullScreen
            style={{
              position: "absolute",
              inset: 0,
              top: isMobile ? "0%" : "-76%",
              width: "100%",
              height: isMobile ? "300%" : "180%",
              border: "none",
              display: "block",
              background: "#000",
            }}
            allow="autoplay; fullscreen; picture-in-picture; encrypted-media; "
            title={name}
          />

          {/* Close/back button */}
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setPlayerActive(false);
            }}
            style={{
              position: "absolute",
              top: 16,
              right: 16,
              background: "rgba(0,0,0,0.8)",
              backdropFilter: "blur(8px)",
              border: "1px solid rgba(255,255,255,0.2)",
              borderRadius: "8px",
              padding: "8px 14px",
              color: "white",
              fontSize: "13px",
              fontWeight: 500,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontFamily: "var(--font-body)",
              zIndex: 10,
            }}
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
