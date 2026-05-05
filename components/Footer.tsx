"use client";
import Link from "next/link";

export default function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer style={{
      borderTop: "1px solid var(--border)",
      padding: "40px clamp(16px,4vw,48px)",
      background: "var(--bg-card)",
      marginTop: "auto",
    }}>
      <div style={{ maxWidth: 1400, margin: "0 auto", display: "flex", flexWrap: "wrap", gap: 32, justifyContent: "space-between", alignItems: "flex-start" }}>
        {/* Brand */}
        <div>
          <span style={{
            fontFamily: "var(--font-display)", fontSize: "24px",
            letterSpacing: "3px", color: "var(--accent)",
            display: "block", marginBottom: 10,
          }}>CINEMIX</span>
          <p style={{ fontSize: "12px", color: "var(--text-muted)", maxWidth: 260, lineHeight: 1.7 }}>
            Discover and watch the greatest films and series of all time.
          </p>
        </div>

        {/* Nav links */}
        <div style={{ display: "flex", gap: 48, flexWrap: "wrap" }}>
          <FooterGroup title="Browse">
            <FooterLink href="/browse?type=FILM">Movies</FooterLink>
            <FooterLink href="/browse?type=TV_SERIES">Series</FooterLink>
            <FooterLink href="/top250">Top 250</FooterLink>
            <FooterLink href="/browse?order=YEAR">New Releases</FooterLink>
          </FooterGroup>
          <FooterGroup title="Genres">
            <FooterLink href="/browse?genres=1">Action</FooterLink>
            <FooterLink href="/browse?genres=2">Drama</FooterLink>
            <FooterLink href="/browse?genres=10">Comedy</FooterLink>
            <FooterLink href="/browse?genres=6">Sci-Fi</FooterLink>
          </FooterGroup>
        </div>
      </div>

      <div style={{
        maxWidth: 1400, margin: "28px auto 0",
        borderTop: "1px solid var(--border)", paddingTop: 20,
        display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12,
      }}>
        <p style={{ fontSize: "12px", color: "var(--text-muted)" }}>
          © {year} CineMix. Data provided by Kinopoisk API.
        </p>
        <p style={{ fontSize: "11px", color: "var(--text-muted)" }}>
          For entertainment purposes only.
        </p>
      </div>
    </footer>
  );
}

function FooterGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "1.5px", color: "var(--text-dim)", marginBottom: 12 }}>{title}</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>{children}</div>
    </div>
  );
}

function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} style={{ fontSize: "13px", color: "var(--text-muted)", textDecoration: "none", transition: "color 0.2s" }}
      onMouseEnter={e => { (e.target as HTMLElement).style.color = "var(--text)"; }}
      onMouseLeave={e => { (e.target as HTMLElement).style.color = "var(--text-muted)"; }}>
      {children}
    </Link>
  );
}
