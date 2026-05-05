"use client";
import { useState } from "react";
import { Staff } from "@/types/kinopoisk";
import Link from "next/link";

export default function ActorCard({ actor }: { actor: Staff }) {
  const [imgError, setImgError] = useState(false);
  const name = actor.nameEn || actor.nameRu || "";

  return (
    <Link href={`/person/${actor.staffId}`} style={{ textDecoration: "none" }}>
      <div style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-lg)",
        overflow: "hidden", textAlign: "center",
        transition: "all var(--transition)",
        cursor: "pointer",
      }}
        onMouseEnter={e => {
          (e.currentTarget as HTMLElement).style.borderColor = "rgba(229,9,20,0.3)";
          (e.currentTarget as HTMLElement).style.transform = "translateY(-3px)";
          (e.currentTarget as HTMLElement).style.boxShadow = "0 8px 24px rgba(0,0,0,0.4)";
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLElement).style.borderColor = "var(--border)";
          (e.currentTarget as HTMLElement).style.transform = "translateY(0)";
          (e.currentTarget as HTMLElement).style.boxShadow = "none";
        }}
      >
        {!imgError ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={actor.posterUrl || ""}
            alt={name}
            style={{ width: "100%", aspectRatio: "2/3", objectFit: "cover", display: "block", background: "var(--surface)" }}
            onError={() => setImgError(true)}
          />
        ) : (
          <div style={{
            width: "100%", aspectRatio: "2/3",
            display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center", gap: 8,
            background: "linear-gradient(135deg, #1a1a2e, #16213e)",
          }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5">
              <circle cx="12" cy="7" r="4"/><path d="M20 21a8 8 0 1 0-16 0"/>
            </svg>
            <span style={{ fontSize: "11px", color: "var(--text-muted)", padding: "0 8px" }}>{name}</span>
          </div>
        )}
        <div style={{ padding: "10px 8px" }}>
          <p style={{ fontSize: "12px", fontWeight: 600, color: "var(--text)", lineHeight: 1.3, marginBottom: 2 }}>{name}</p>
          {actor.description && (
            <p style={{
              fontSize: "11px", color: "var(--text-muted)",
              fontStyle: "italic",
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>{actor.description}</p>
          )}
        </div>
      </div>
    </Link>
  );
}
