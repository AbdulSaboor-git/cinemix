"use client";
import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";

const NAV_LINKS = [
  { href: "/",                      label: "Home" },
  { href: "/browse?type=FILM",      label: "Movies" },
  { href: "/browse?type=TV_SERIES", label: "Series" },
  { href: "/top250",                label: "Top 250" },
];

export default function Navbar() {
  const [scrolled,   setScrolled]   = useState(false);
  const [search,     setSearch]     = useState("");
  const [menuOpen,   setMenuOpen]   = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [isMobile,   setIsMobile]   = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const router   = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  useEffect(() => {
    setMenuOpen(false);
    setSearchOpen(false);
  }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [menuOpen]);

  useEffect(() => {
    if (searchOpen) setTimeout(() => inputRef.current?.focus(), 50);
  }, [searchOpen]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (search.trim()) {
      router.push(`/search?q=${encodeURIComponent(search.trim())}`);
      setSearch("");
      setSearchOpen(false);
    }
  };

  const isActive = (href: string) => {
    const base = href.split("?")[0];
    return base === "/" ? pathname === "/" : pathname.startsWith(base);
  };

  return (
    <>
      {/* Main nav bar */}
      <nav style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
        height: "var(--nav-height)",
        background: "rgba(8,8,8,0.97)",
        backdropFilter: scrolled ? "blur(16px)" : "none",
        borderBottom: scrolled ? "1px solid var(--border)" : "1px solid transparent",
        transition: "background 0.3s, backdrop-filter 0.3s, border-color 0.3s",
        display: "flex", alignItems: "center", padding: "0 clamp(16px,4vw,48px)", gap: 8,
      }}>
        {/* Logo */}
        <Link href="/" style={{ textDecoration: "none", flexShrink: 0, marginRight: 8 }}>
          <span style={{
            fontFamily: "var(--font-display)", fontSize: "clamp(20px,3vw,26px)",
            letterSpacing: "3px", color: "var(--accent)",
            textShadow: "0 0 20px var(--accent-glow)",
          }}>CINEMIX</span>
        </Link>

        {/* Desktop nav links */}
        {!isMobile && (
          <div style={{ display: "flex", gap: 2, flex: 1 }}>
            {NAV_LINKS.map(({ href, label }) => (
              <Link key={href} href={href} style={{
                textDecoration: "none", padding: "6px 14px", borderRadius: "6px",
                fontSize: "13px", fontWeight: 500,
                color: isActive(href) ? "white" : "var(--text-dim)",
                background: isActive(href) ? "var(--accent-dim)" : "transparent",
                border: isActive(href) ? "1px solid rgba(229,9,20,0.25)" : "1px solid transparent",
                transition: "all 0.18s ease",
              }}>{label}</Link>
            ))}
          </div>
        )}

        {/* Spacer on mobile */}
        {isMobile && <div style={{ flex: 1 }} />}

        {/* Desktop search */}
        {!isMobile && (
          <form onSubmit={handleSearch}>
            <div style={{ position: "relative" }}>
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search…"
                style={{
                  background: "var(--surface)", border: "1px solid var(--border)",
                  borderRadius: "20px", padding: "8px 16px 8px 36px",
                  color: "var(--text)", fontSize: "13px", width: "190px",
                  outline: "none", fontFamily: "var(--font-body)",
                  transition: "width 0.3s, border-color 0.2s",
                }}
                onFocus={e => {
                  (e.target as HTMLInputElement).style.width = "250px";
                  (e.target as HTMLInputElement).style.borderColor = "rgba(229,9,20,0.5)";
                }}
                onBlur={e => {
                  (e.target as HTMLInputElement).style.width = "190px";
                  (e.target as HTMLInputElement).style.borderColor = "var(--border)";
                }}
              />
              <svg style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", opacity: 0.4, pointerEvents: "none" }}
                width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
              </svg>
            </div>
          </form>
        )}

        {/* Mobile icons */}
        {isMobile && (
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <IconBtn onClick={() => setSearchOpen(v => !v)} active={searchOpen} aria-label="Search">
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
              </svg>
            </IconBtn>
            <IconBtn onClick={() => setMenuOpen(v => !v)} aria-label="Menu">
              {menuOpen ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
                </svg>
              )}
            </IconBtn>
          </div>
        )}
      </nav>

      {/* Mobile search drop-down */}
      {isMobile && searchOpen && (
        <div style={{
          position: "fixed", top: "var(--nav-height)", left: 0, right: 0, zIndex: 99,
          background: "rgba(8,8,8,0.98)", backdropFilter: "blur(16px)",
          borderBottom: "1px solid var(--border)", padding: "14px 16px",
          animation: "slideDown 0.2s ease",
        }}>
          <form onSubmit={handleSearch}>
            <div style={{ position: "relative" }}>
              <input
                ref={inputRef}
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search films, series…"
                className="input"
                style={{ paddingLeft: 42, fontSize: "15px" }}
              />
              <svg style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", opacity: 0.4, pointerEvents: "none" }}
                width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
              </svg>
              {search && (
                <button type="button" onClick={() => setSearch("")}
                  style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 4 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              )}
            </div>
          </form>
        </div>
      )}

      {/* Mobile full-screen menu */}
      {isMobile && menuOpen && (
        <div className="mobile-menu" style={{ justifyContent: "space-between" }}>
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 40 }}>
              <span style={{ fontFamily: "var(--font-display)", fontSize: "26px", letterSpacing: "3px", color: "var(--accent)" }}>CINEMIX</span>
              <IconBtn onClick={() => setMenuOpen(false)} aria-label="Close menu">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </IconBtn>
            </div>
            <nav style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {NAV_LINKS.map(({ href, label }) => (
                <Link key={href} href={href} style={{
                  textDecoration: "none", padding: "18px 20px", borderRadius: 12,
                  fontFamily: "var(--font-display)", fontSize: "28px", letterSpacing: "2px",
                  color: isActive(href) ? "white" : "var(--text-dim)",
                  background: isActive(href) ? "var(--accent-dim)" : "transparent",
                  border: `1px solid ${isActive(href) ? "rgba(229,9,20,0.2)" : "transparent"}`,
                  transition: "all 0.18s",
                }}>{label}</Link>
              ))}
            </nav>
          </div>
          <p style={{ fontSize: "12px", color: "var(--text-muted)", textAlign: "center", paddingBottom: 8 }}>
            © {new Date().getFullYear()} CineMix
          </p>
        </div>
      )}
    </>
  );
}

function IconBtn({ children, onClick, active, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return (
    <button
      onClick={onClick}
      {...props}
      style={{
        background: active ? "var(--accent-dim)" : "none",
        border: `1px solid ${active ? "rgba(229,9,20,0.3)" : "transparent"}`,
        borderRadius: 8, color: "var(--text)", cursor: "pointer",
        padding: 8, display: "flex", alignItems: "center", justifyContent: "center",
        transition: "all 0.18s",
      }}
    >
      {children}
    </button>
  );
}
