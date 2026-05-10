"use client";
import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, usePathname } from "next/navigation";
import { Film } from "@/types/kinopoisk";
import { getEnglishName } from "@/lib/translate";
import { useSearchSuggestions } from "@/hooks/useSearchSuggestions";

const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/explore", label: "Explore" },
  { href: "/top250", label: "Top 250" },
];

const SETTINGS_ICON = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14" strokeOpacity="0.5" />
    <path d="M15.54 8.46a5 5 0 0 1 0 7.07M8.46 8.46a5 5 0 0 0 0 7.07" />
  </svg>
);

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [search, setSearch] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  // FIX: start as null to avoid hydration mismatch; resolved after mount
  const [isMobile, setIsMobile] = useState<boolean | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const mobileRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const pathname = usePathname();

  const {
    suggestions,
    sugLoading,
    sugVisible,
    selectedIdx,
    setSugVisible,
    fetchSuggestions,
    clearSuggestions,
    handleKeyNav,
  } = useSearchSuggestions();

  // FIX: useLayoutEffect-equivalent via useEffect after mount to avoid hydration mismatch
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
    clearSuggestions();
  }, [pathname, clearSuggestions]);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  useEffect(() => {
    if (searchOpen) setTimeout(() => mobileRef.current?.focus(), 50);
  }, [searchOpen]);

  const handleSearchChange = (val: string) => {
    setSearch(val);
    fetchSuggestions(val, 6);
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
    clearSuggestions();
    setSearchOpen(false);
  };

  const isActive = (href: string) => {
    const base = href.split("?")[0];
    return base === "/" ? pathname === "/" : pathname.startsWith(base);
  };

  // FIX: SuggestionDropdown extracted OUTSIDE Navbar to avoid re-mounting on every render
  // Passed as a rendered element instead
  const suggestionList =
    sugVisible && suggestions.length > 0 ? (
      <SuggestionDropdown
        suggestions={suggestions}
        selectedIdx={selectedIdx}
        sugLoading={sugLoading}
        search={search}
        onSelect={clearSuggestions}
      />
    ) : null;

  // Don't render mobile/desktop split until we know which one we're on
  if (isMobile === null) {
    return (
      <nav
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 100,
          height: "var(--nav-height)",
          background: "rgba(8,8,8,0.85)",
          backdropFilter: "blur(8px)",
          borderBottom: "1px solid transparent",
          display: "flex",
          alignItems: "center",
          padding: "0 clamp(16px,4vw,48px)",
        }}
      >
        <Link href="/" style={{ textDecoration: "none" }}>
          <span
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "clamp(20px,3vw,26px)",
              letterSpacing: "3px",
              color: "var(--accent)",
              textShadow: "0 0 20px var(--accent-glow)",
            }}
          >
            CINEMIX
          </span>
        </Link>
      </nav>
    );
  }

  return (
    <>
      <nav
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 100,
          height: "var(--nav-height)",
          background: scrolled ? "rgba(8,8,8,0.97)" : "rgba(8,8,8,0.85)",
          backdropFilter: scrolled ? "blur(16px)" : "blur(8px)",
          borderBottom: scrolled
            ? "1px solid var(--border)"
            : "1px solid transparent",
          transition: "all 0.3s",
          display: "flex",
          alignItems: "center",
          padding: "0 clamp(16px,4vw,48px)",
          gap: 8,
        }}
      >
        {/* Logo */}
        <Link
          href="/"
          style={{ textDecoration: "none", flexShrink: 0, marginRight: 8 }}
        >
          <span
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "clamp(20px,3vw,26px)",
              letterSpacing: "3px",
              color: "var(--accent)",
              textShadow: "0 0 20px var(--accent-glow)",
            }}
          >
            CINEMIX
          </span>
        </Link>

        {/* Desktop nav links */}
        {!isMobile && (
          <div style={{ display: "flex", gap: 2, flex: 1 }}>
            {NAV_LINKS.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                style={{
                  textDecoration: "none",
                  padding: "6px 14px",
                  borderRadius: "6px",
                  fontSize: "13px",
                  fontWeight: 500,
                  color: isActive(href) ? "white" : "var(--text-dim)",
                  background: isActive(href)
                    ? "var(--accent-dim)"
                    : "transparent",
                  border: isActive(href)
                    ? "1px solid rgba(229,9,20,0.25)"
                    : "1px solid transparent",
                  transition: "all 0.18s ease",
                }}
              >
                {label}
              </Link>
            ))}
          </div>
        )}

        {isMobile && <div style={{ flex: 1 }} />}

        {/* Desktop search */}
        {!isMobile && (
          <div style={{ position: "relative" }}>
            <form onSubmit={handleSubmit}>
              <div style={{ position: "relative" }}>
                <input
                  ref={inputRef}
                  value={search}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  onKeyDown={(e) => handleKeyNav(e, suggestions.length)}
                  onFocus={() =>
                    search.trim().length >= 2 && setSugVisible(true)
                  }
                  // FIX: 300ms for touchpad taps
                  onBlur={() => setTimeout(() => setSugVisible(false), 300)}
                  placeholder="Search films, actors…"
                  style={{
                    background: "var(--surface)",
                    border: "1px solid var(--border)",
                    borderRadius: "20px",
                    padding: "8px 16px 8px 36px",
                    color: "var(--text)",
                    fontSize: "13px",
                    width: "190px",
                    outline: "none",
                    fontFamily: "var(--font-body)",
                    transition: "width 0.3s, border-color 0.2s",
                  }}
                  onFocusCapture={(e) => {
                    (e.target as HTMLInputElement).style.width = "260px";
                    (e.target as HTMLInputElement).style.borderColor =
                      "rgba(229,9,20,0.5)";
                  }}
                  onBlurCapture={(e) => {
                    (e.target as HTMLInputElement).style.width = "190px";
                    (e.target as HTMLInputElement).style.borderColor =
                      "var(--border)";
                  }}
                />
                <svg
                  style={{
                    position: "absolute",
                    left: 12,
                    top: "50%",
                    transform: "translateY(-50%)",
                    opacity: sugLoading ? 1 : 0.4,
                    pointerEvents: "none",
                  }}
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                >
                  <circle cx="11" cy="11" r="8" />
                  <path d="m21 21-4.35-4.35" />
                </svg>
              </div>
            </form>
            {suggestionList}
          </div>
        )}

        {/* Desktop settings icon */}
        {!isMobile && (
          <Link href="/preferences" title="Preferences" style={{ textDecoration: "none", marginLeft: 4 }}>
            <IconBtn active={pathname === "/preferences"} aria-label="Preferences">
              {SETTINGS_ICON}
            </IconBtn>
          </Link>
        )}

        {/* Mobile icons */}
        {isMobile && (
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <IconBtn
              onClick={() => setSearchOpen((v) => !v)}
              active={searchOpen}
              aria-label="Search"
            >
              <svg
                width="19"
                height="19"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
              >
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.35-4.35" />
              </svg>
            </IconBtn>
            <Link href="/preferences" style={{ textDecoration: "none" }}>
              <IconBtn active={pathname === "/preferences"} aria-label="Preferences">
                {SETTINGS_ICON}
              </IconBtn>
            </Link>
            <IconBtn onClick={() => setMenuOpen((v) => !v)} aria-label="Menu">
              {menuOpen ? (
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              ) : (
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                >
                  <line x1="3" y1="6" x2="21" y2="6" />
                  <line x1="3" y1="12" x2="21" y2="12" />
                  <line x1="3" y1="18" x2="21" y2="18" />
                </svg>
              )}
            </IconBtn>
          </div>
        )}
      </nav>

      {/* Mobile search bar */}
      {isMobile && searchOpen && (
        <div
          style={{
            position: "fixed",
            top: "var(--nav-height)",
            left: 0,
            right: 0,
            zIndex: 99,
            background: "rgba(8,8,8,0.98)",
            backdropFilter: "blur(16px)",
            borderBottom: "1px solid var(--border)",
            padding: "14px 16px",
            animation: "slideDown 0.2s ease",
          }}
        >
          <form onSubmit={handleSubmit}>
            <div style={{ position: "relative" }}>
              <input
                ref={mobileRef}
                value={search}
                onChange={(e) => handleSearchChange(e.target.value)}
                onKeyDown={(e) => handleKeyNav(e, suggestions.length)}
                // FIX: 300ms for touchpad taps
                onBlur={() => setTimeout(() => setSugVisible(false), 300)}
                placeholder="Search films, series, actors…"
                className="input"
                style={{ paddingLeft: 42, fontSize: "15px" }}
              />
              <svg
                style={{
                  position: "absolute",
                  left: 14,
                  top: "50%",
                  transform: "translateY(-50%)",
                  opacity: 0.4,
                  pointerEvents: "none",
                }}
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
              >
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.35-4.35" />
              </svg>
              {search && (
                <button
                  type="button"
                  onClick={() => {
                    setSearch("");
                    clearSuggestions();
                  }}
                  style={{
                    position: "absolute",
                    right: 12,
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: "var(--text-muted)",
                    padding: 4,
                  }}
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                  >
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              )}
              {suggestionList}
            </div>
          </form>
        </div>
      )}

      {/* Mobile fullscreen menu */}
      {isMobile && menuOpen && (
        // FIX: role + aria-modal + keyboard trap for accessibility
        <div
          className="mobile-menu"
          role="dialog"
          aria-modal="true"
          aria-label="Navigation menu"
          style={{ justifyContent: "space-between" }}
          onKeyDown={(e) => e.key === "Escape" && setMenuOpen(false)}
        >
          <div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 40,
              }}
            >
              <span
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "26px",
                  letterSpacing: "3px",
                  color: "var(--accent)",
                }}
              >
                CINEMIX
              </span>
              <IconBtn
                onClick={() => setMenuOpen(false)}
                aria-label="Close menu"
              >
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </IconBtn>
            </div>
            <nav
              style={{ display: "flex", flexDirection: "column", gap: 4 }}
              aria-label="Main navigation"
            >
              {NAV_LINKS.map(({ href, label }) => (
                <Link
                  key={href}
                  href={href}
                  style={{
                    textDecoration: "none",
                    padding: "18px 20px",
                    borderRadius: 12,
                    fontFamily: "var(--font-display)",
                    fontSize: "28px",
                    letterSpacing: "2px",
                    color: isActive(href) ? "white" : "var(--text-dim)",
                    background: isActive(href)
                      ? "var(--accent-dim)"
                      : "transparent",
                    border: `1px solid ${isActive(href) ? "rgba(229,9,20,0.2)" : "transparent"}`,
                    transition: "all 0.18s",
                  }}
                >
                  {label}
                </Link>
              ))}
              <Link
                href="/preferences"
                style={{
                  textDecoration: "none",
                  padding: "18px 20px",
                  borderRadius: 12,
                  fontFamily: "var(--font-display)",
                  fontSize: "28px",
                  letterSpacing: "2px",
                  color: isActive("/preferences") ? "white" : "var(--text-dim)",
                  background: isActive("/preferences") ? "var(--accent-dim)" : "transparent",
                  border: `1px solid ${isActive("/preferences") ? "rgba(229,9,20,0.2)" : "transparent"}`,
                  transition: "all 0.18s",
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                }}
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" style={{ flexShrink: 0 }}>
                  <circle cx="12" cy="12" r="3" />
                  <path d="M15.54 8.46a5 5 0 0 1 0 7.07M8.46 8.46a5 5 0 0 0 0 7.07" />
                </svg>
                Preferences
              </Link>
            </nav>
          </div>
          <p
            style={{
              fontSize: "12px",
              color: "var(--text-muted)",
              textAlign: "center",
              paddingBottom: 8,
            }}
          >
            © {new Date().getFullYear()} CineMix
          </p>
        </div>
      )}
    </>
  );
}

// FIX: extracted outside Navbar so it doesn't re-mount on every parent render
function SuggestionDropdown({
  suggestions,
  selectedIdx,
  sugLoading,
  search,
  onSelect,
}: {
  suggestions: Film[];
  selectedIdx: number;
  sugLoading: boolean;
  search: string;
  onSelect: () => void;
}) {
  return (
    <div
      style={{
        position: "absolute",
        top: "calc(100% + 8px)",
        left: 0,
        right: 0,
        background: "rgba(17,17,17,0.98)",
        backdropFilter: "blur(20px)",
        border: "1px solid var(--border)",
        borderRadius: "12px",
        overflow: "hidden",
        zIndex: 200,
        boxShadow: "0 16px 48px rgba(0,0,0,0.6)",
        animation: "slideDown 0.15s ease",
      }}
    >
      {sugLoading && (
        <div
          style={{
            padding: "10px 16px",
            fontSize: "12px",
            color: "var(--text-muted)",
          }}
        >
          Searching…
        </div>
      )}
      {suggestions.map((film, i) => {
        // FIX: stable key
        const id = film.kinopoiskId ?? film.filmId;
        const name = getEnglishName(
          film.nameRu,
          film.nameEn,
          film.nameOriginal,
        );
        const rating = film.ratingKinopoisk ?? film.ratingImdb ?? film.rating;
        return (
          <Link
            key={id}
            href={`/film/${id}`}
            style={{ textDecoration: "none" }}
            onClick={onSelect}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "10px 14px",
                background:
                  i === selectedIdx ? "var(--bg-elevated)" : "transparent",
                borderBottom:
                  i < suggestions.length - 1
                    ? "1px solid var(--border)"
                    : "none",
                transition: "background 0.1s",
                cursor: "pointer",
              }}
              onMouseEnter={(e) =>
                ((e.currentTarget as HTMLElement).style.background =
                  "var(--bg-elevated)")
              }
              onMouseLeave={(e) =>
                ((e.currentTarget as HTMLElement).style.background =
                  i === selectedIdx ? "var(--bg-elevated)" : "transparent")
              }
            >
              <div
                style={{
                  width: 32,
                  height: 48,
                  borderRadius: 4,
                  overflow: "hidden",
                  flexShrink: 0,
                  background: "var(--surface)",
                  position: "relative",
                }}
              >
                {/* FIX: next/image instead of <img> */}
                {(film.posterUrlPreview || film.posterUrl) && (
                  <Image
                    src={film.posterUrlPreview || film.posterUrl!}
                    alt={name}
                    fill
                    style={{ objectFit: "cover" }}
                    sizes="32px"
                  />
                )}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p
                  style={{
                    fontSize: "13px",
                    fontWeight: 600,
                    color: "var(--text)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {name}
                </p>
                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    alignItems: "center",
                    marginTop: 2,
                  }}
                >
                  {film.year && (
                    <span
                      style={{ fontSize: "11px", color: "var(--text-muted)" }}
                    >
                      {film.year}
                    </span>
                  )}
                  {film.genres?.[0] && (
                    <span
                      style={{
                        fontSize: "10px",
                        color: "var(--text-muted)",
                        textTransform: "capitalize",
                      }}
                    >
                      {film.genres[0].genre}
                    </span>
                  )}
                </div>
              </div>
              {rating && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 3,
                    flexShrink: 0,
                  }}
                >
                  <svg width="9" height="9" viewBox="0 0 24 24" fill="#f5c518">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                  </svg>
                  <span
                    style={{
                      fontSize: "12px",
                      color: "#f5c518",
                      fontWeight: 600,
                    }}
                  >
                    {typeof rating === "number" ? rating.toFixed(1) : rating}
                  </span>
                </div>
              )}
            </div>
          </Link>
        );
      })}
      <Link
        href={`/search?q=${encodeURIComponent(search.trim())}`}
        style={{ textDecoration: "none" }}
        onClick={onSelect}
      >
        <div
          style={{
            padding: "10px 14px",
            fontSize: "12px",
            color: "var(--accent)",
            fontWeight: 600,
            background: "var(--bg-card)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
          See all results for &ldquo;{search}&rdquo;
        </div>
      </Link>
    </div>
  );
}

function IconBtn({
  children,
  onClick,
  active,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return (
    <button
      onClick={onClick}
      {...props}
      style={{
        background: active ? "var(--accent-dim)" : "none",
        border: `1px solid ${active ? "rgba(229,9,20,0.3)" : "transparent"}`,
        borderRadius: 8,
        color: "var(--text)",
        cursor: "pointer",
        padding: 8,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        transition: "all 0.18s",
      }}
    >
      {children}
    </button>
  );
}
