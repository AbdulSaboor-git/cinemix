"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { searchFilms } from "@/lib/kinopoisk";
import { Film } from "@/types/kinopoisk";
import { getEnglishName } from "@/lib/translate";

const NAV_LINKS = [
  { href: "/",                      label: "Home" },
  { href: "/browse?type=FILM",      label: "Movies" },
  { href: "/browse?type=TV_SERIES", label: "Series" },
  { href: "/top250",                label: "Top 250" },
  { href: "/browse",                label: "Browse" },
];

export default function Navbar() {
  const [scrolled,     setScrolled]     = useState(false);
  const [search,       setSearch]       = useState("");
  const [menuOpen,     setMenuOpen]     = useState(false);
  const [searchOpen,   setSearchOpen]   = useState(false);
  const [isMobile,     setIsMobile]     = useState(false);
  const [suggestions,  setSuggestions]  = useState<Film[]>([]);
  const [sugLoading,   setSugLoading]   = useState(false);
  const [sugVisible,   setSugVisible]   = useState(false);
  const [selectedIdx,  setSelectedIdx]  = useState(-1);
  const inputRef    = useRef<HTMLInputElement>(null);
  const mobileRef   = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
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
    setSugVisible(false);
  }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [menuOpen]);

  useEffect(() => {
    if (searchOpen) setTimeout(() => mobileRef.current?.focus(), 50);
  }, [searchOpen]);

  // Search suggestions with debounce
  const fetchSuggestions = useCallback((q: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (q.trim().length < 2) {
      setSuggestions([]);
      setSugVisible(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setSugLoading(true);
      try {
        const res = await searchFilms(q.trim(), 1);
        setSuggestions(res.items.slice(0, 6));
        setSugVisible(true);
        setSelectedIdx(-1);
      } catch {
        setSuggestions([]);
      } finally {
        setSugLoading(false);
      }
    }, 280);
  }, []);

  const handleSearchChange = (val: string) => {
    setSearch(val);
    fetchSuggestions(val);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!sugVisible || suggestions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIdx(i => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIdx(i => Math.max(i - 1, -1));
    } else if (e.key === "Escape") {
      setSugVisible(false);
      setSelectedIdx(-1);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedIdx >= 0 && suggestions[selectedIdx]) {
      const film = suggestions[selectedIdx];
      const id = film.kinopoiskId ?? film.filmId;
      router.push(`/film/${id}`);
    } else if (search.trim()) {
      router.push(`/search?q=${encodeURIComponent(search.trim())}`);
    }
    setSearch("");
    setSugVisible(false);
    setSearchOpen(false);
  };

  const isActive = (href: string) => {
    const base = href.split("?")[0];
    return base === "/" ? pathname === "/" : pathname.startsWith(base);
  };

  const SuggestionDropdown = ({ forMobile = false }: { forMobile?: boolean }) => (
    sugVisible && suggestions.length > 0 ? (
      <div style={{
        position: "absolute",
        top: forMobile ? "calc(100% + 8px)" : "calc(100% + 8px)",
        left: 0, right: 0,
        background: "rgba(17,17,17,0.98)",
        backdropFilter: "blur(20px)",
        border: "1px solid var(--border)",
        borderRadius: "12px",
        overflow: "hidden",
        zIndex: 200,
        boxShadow: "0 16px 48px rgba(0,0,0,0.6)",
        animation: "slideDown 0.15s ease",
      }}>
        {sugLoading && (
          <div style={{ padding: "10px 16px", fontSize: "12px", color: "var(--text-muted)" }}>Searching…</div>
        )}
        {suggestions.map((film, i) => {
          const name = getEnglishName(film.nameRu, film.nameEn, film.nameOriginal);
          const rating = film.ratingKinopoisk ?? film.ratingImdb ?? film.rating;
          return (
            <Link
              key={film.kinopoiskId ?? film.filmId ?? i}
              href={`/film/${film.kinopoiskId ?? film.filmId}`}
              style={{ textDecoration: "none" }}
              onClick={() => { setSugVisible(false); setSearch(""); }}
            >
              <div style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "10px 14px",
                background: i === selectedIdx ? "var(--bg-elevated)" : "transparent",
                borderBottom: i < suggestions.length - 1 ? "1px solid var(--border)" : "none",
                transition: "background 0.1s",
                cursor: "pointer",
              }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "var(--bg-elevated)"}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = i === selectedIdx ? "var(--bg-elevated)" : "transparent"}
              >
                {/* Mini poster */}
                <div style={{ width: 32, height: 48, borderRadius: 4, overflow: "hidden", flexShrink: 0, background: "var(--surface)" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={film.posterUrlPreview || film.posterUrl}
                    alt={name}
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
                  />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: "13px", fontWeight: 600, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {name}
                  </p>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 2 }}>
                    {film.year && <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>{film.year}</span>}
                    {film.genres?.[0] && (
                      <span style={{ fontSize: "10px", color: "var(--text-muted)", textTransform: "capitalize" }}>
                        {film.genres[0].genre}
                      </span>
                    )}
                  </div>
                </div>
                {rating && (
                  <div style={{ display: "flex", alignItems: "center", gap: 3, flexShrink: 0 }}>
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="#f5c518">
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                    </svg>
                    <span style={{ fontSize: "12px", color: "#f5c518", fontWeight: 600 }}>
                      {typeof rating === "number" ? rating.toFixed(1) : rating}
                    </span>
                  </div>
                )}
              </div>
            </Link>
          );
        })}
        <Link href={`/search?q=${encodeURIComponent(search.trim())}`} style={{ textDecoration: "none" }}
          onClick={() => { setSugVisible(false); setSearch(""); }}>
          <div style={{
            padding: "10px 14px", fontSize: "12px",
            color: "var(--accent)", fontWeight: 600,
            background: "var(--bg-card)", cursor: "pointer",
            display: "flex", alignItems: "center", gap: 6,
          }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
            </svg>
            See all results for &ldquo;{search}&rdquo;
          </div>
        </Link>
      </div>
    ) : null
  );

  return (
    <>
      <nav style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
        height: "var(--nav-height)",
        background: scrolled ? "rgba(8,8,8,0.97)" : "rgba(8,8,8,0.85)",
        backdropFilter: scrolled ? "blur(16px)" : "blur(8px)",
        borderBottom: scrolled ? "1px solid var(--border)" : "1px solid transparent",
        transition: "all 0.3s",
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

        {isMobile && <div style={{ flex: 1 }} />}

        {/* Desktop search with suggestions */}
        {!isMobile && (
          <div ref={containerRef} style={{ position: "relative" }}>
            <form onSubmit={handleSubmit}>
              <div style={{ position: "relative" }}>
                <input
                  ref={inputRef}
                  value={search}
                  onChange={e => handleSearchChange(e.target.value)}
                  onKeyDown={handleKeyDown}
                  onFocus={() => search.trim().length >= 2 && setSugVisible(true)}
                  onBlur={() => setTimeout(() => setSugVisible(false), 200)}
                  placeholder="Search films, actors…"
                  style={{
                    background: "var(--surface)", border: "1px solid var(--border)",
                    borderRadius: "20px", padding: "8px 16px 8px 36px",
                    color: "var(--text)", fontSize: "13px", width: "190px",
                    outline: "none", fontFamily: "var(--font-body)",
                    transition: "width 0.3s, border-color 0.2s",
                  }}
                  onFocusCapture={e => {
                    (e.target as HTMLInputElement).style.width = "260px";
                    (e.target as HTMLInputElement).style.borderColor = "rgba(229,9,20,0.5)";
                  }}
                  onBlurCapture={e => {
                    (e.target as HTMLInputElement).style.width = "190px";
                    (e.target as HTMLInputElement).style.borderColor = "var(--border)";
                  }}
                />
                <svg style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", opacity: sugLoading ? 1 : 0.4, pointerEvents: "none" }}
                  width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
                </svg>
              </div>
            </form>
            <SuggestionDropdown />
          </div>
        )}

        {/* Mobile icons */}
        {isMobile && (
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <IconBtn onClick={() => setSearchOpen(v => !v)} active={searchOpen} aria-label="Search">
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
              </svg>
            </IconBtn>
            <IconBtn onClick={() => setMenuOpen(v => !v)} aria-label="Menu">
              {menuOpen ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
                </svg>
              )}
            </IconBtn>
          </div>
        )}
      </nav>

      {/* Mobile search dropdown */}
      {isMobile && searchOpen && (
        <div style={{
          position: "fixed", top: "var(--nav-height)", left: 0, right: 0, zIndex: 99,
          background: "rgba(8,8,8,0.98)", backdropFilter: "blur(16px)",
          borderBottom: "1px solid var(--border)", padding: "14px 16px",
          animation: "slideDown 0.2s ease",
        }}>
          <form onSubmit={handleSubmit}>
            <div style={{ position: "relative" }}>
              <input
                ref={mobileRef}
                value={search}
                onChange={e => handleSearchChange(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Search films, series, actors…"
                className="input"
                style={{ paddingLeft: 42, fontSize: "15px" }}
              />
              <svg style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", opacity: 0.4, pointerEvents: "none" }}
                width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
              </svg>
              {search && (
                <button type="button" onClick={() => { setSearch(""); setSuggestions([]); setSugVisible(false); }}
                  style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 4 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              )}
              <SuggestionDropdown forMobile />
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
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
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
    <button onClick={onClick} {...props}
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
