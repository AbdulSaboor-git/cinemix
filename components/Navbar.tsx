"use client";
// components/Navbar.tsx
import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, usePathname } from "next/navigation";
import {
  Home,
  Compass,
  BarChart2,
  Clapperboard,
  Newspaper,
} from "lucide-react";
import { Film } from "@/types/kinopoisk";
import { getEnglishName } from "@/lib/translate";
import { useSearchSuggestions } from "@/hooks/useSearchSuggestions";
import Logo from "./logo";
import { lockScroll, unlockScroll } from "@/lib/scrollLock";

const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/explore", label: "Explore" },
  { href: "/top240", label: "Top 240" },
  { href: "/premieres", label: "Premieres" },
  { href: "/news", label: "News" },
];

const BOTTOM_NAV_LINKS = [
  { href: "/", label: "Home", Icon: Home },
  { href: "/explore", label: "Explore", Icon: Compass },
  { href: "/top240", label: "Top 240", Icon: BarChart2 },
  { href: "/premieres", label: "Premieres", Icon: Clapperboard },
  { href: "/news", label: "News", Icon: Newspaper },
];

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const mobileInputRef = useRef<HTMLInputElement>(null);
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

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  useEffect(() => {
    setSearchOpen(false);
    clearSuggestions();
  }, [pathname, clearSuggestions]);

  useEffect(() => {
    if (searchOpen) {
      const t = setTimeout(() => mobileInputRef.current?.focus(), 60);
      return () => clearTimeout(t);
    }
  }, [searchOpen]);

  const handleSearchChange = (val: string) => {
    setSearch(val);
    fetchSuggestions(val, 6);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const selected = suggestions[selectedIdx];
    if (selected) {
      router.push(`/film/${selected.kinopoiskId ?? selected.filmId}`);
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

  return (
    <>
      {/* ── Main Nav ── */}
      <nav
        className={`fixed top-0 left-0 right-0 z-[200] flex items-center gap-3 transition-all duration-300
          px-4 md:px-[clamp(16px,4vw,48px)] h-(--nav-height)
          bg-linear-to-br from-black/80 to-black/20 backdrop-blur-[20px]
          ${scrolled ? "shadow-[0_1px_0_var(--border)]" : "shadow-none"}`}
      >
        <Logo />

        {/* Desktop nav links */}
        <div className="hidden md:flex items-center gap-0.5 flex-1">
          {NAV_LINKS.map(({ href, label }) => (
            <button
              key={href}
              onClick={() => router.push(href)}
              className={`px-3.5 cursor-pointer py-1.5 rounded-md text-[13px] font-medium transition-all duration-180 ${
                isActive(href)
                  ? "text-white bg-(--accent-dim) border border-[rgba(229,9,20,0.25)]"
                  : "text-(--text-dim) border border-transparent hover:text-white hover:bg-[rgba(255,255,255,0.06)]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Mobile: push icons to right */}
        <div className="flex-1 md:hidden" />

        {/* Desktop search */}
        <div className="hidden md:block relative">
          <form onSubmit={handleSubmit}>
            <div className="relative">
              <input
                ref={inputRef}
                value={search}
                onChange={(e) => handleSearchChange(e.target.value)}
                onKeyDown={(e) => handleKeyNav(e, suggestions.length)}
                onFocus={() => search.trim().length >= 2 && setSugVisible(true)}
                onBlur={() => setTimeout(() => setSugVisible(false), 200)}
                placeholder="Search films, actors…"
                className="bg-[rgba(255,255,255,0.07)] border border-[var(--border)] rounded-[20px] py-[7px] pl-9 pr-4
                  text-[var(--text)] text-[13px] outline-none placeholder:text-[var(--text-muted)]
                  transition-[width,border-color,background] duration-300
                  w-[190px] focus:w-[260px] focus:border-[rgba(229,9,20,0.5)] focus:bg-[rgba(255,255,255,0.1)]"
              />
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none opacity-40 w-[13px] h-[13px]" />
            </div>
          </form>
          {sugVisible && suggestions.length > 0 && (
            <SuggestionDropdown
              suggestions={suggestions}
              selectedIdx={selectedIdx}
              sugLoading={sugLoading}
              search={search}
              onSelect={() => {
                clearSuggestions();
                setSearch("");
              }}
            />
          )}
        </div>

        {/* Desktop profile + preferences */}
        <div className="hidden md:flex items-center gap-1 ml-1">
          <Link
            href="/preferences"
            className="no-underline"
            title="Preferences"
          >
            <NavIconBtn
              active={pathname === "/preferences"}
              aria-label="Preferences"
            >
              <SettingsIcon />
            </NavIconBtn>
          </Link>
          <Link href="/profile" className="no-underline" title="Profile">
            <NavIconBtn
              active={pathname.startsWith("/profile")}
              aria-label="Profile"
            >
              <ProfileIcon />
            </NavIconBtn>
          </Link>
        </div>

        {/* Mobile top-right: search + profile + preferences (no hamburger) */}
        <div className="flex md:hidden items-center gap-[2px]">
          <NavIconBtn
            onClick={() => setSearchOpen((v) => !v)}
            active={searchOpen}
            aria-label="Search"
          >
            <SearchIcon className="w-[19px] h-[19px]" />
          </NavIconBtn>

          <Link href="/profile" className="no-underline">
            <NavIconBtn
              active={pathname.startsWith("/profile")}
              aria-label="Profile"
            >
              <ProfileIcon />
            </NavIconBtn>
          </Link>

          <Link href="/preferences" className="no-underline">
            <NavIconBtn
              active={pathname === "/preferences"}
              aria-label="Preferences"
            >
              <SettingsIcon />
            </NavIconBtn>
          </Link>
        </div>
      </nav>

      {/* ── Mobile search bar ── */}
      {searchOpen && (
        <div
          className="md:hidden fixed left-0 right-0 z-[99] bg-[rgba(8,8,8,0.98)] backdrop-blur-[20px]
            shadow-[0_1px_0_var(--border)] px-4 py-3 slide-down"
          style={{ top: "var(--nav-height)" }}
        >
          <form onSubmit={handleSubmit}>
            <div className="relative">
              <input
                ref={mobileInputRef}
                value={search}
                onChange={(e) => handleSearchChange(e.target.value)}
                onKeyDown={(e) => handleKeyNav(e, suggestions.length)}
                onBlur={() => setTimeout(() => setSugVisible(false), 200)}
                placeholder="Search films, series, actors…"
                className="input pl-10 text-[15px] px-4 py-3"
              />
              <SearchIcon className="absolute left-[14px] top-1/2 -translate-y-1/2 opacity-40 pointer-events-none w-4 h-4" />
              {search && (
                <button
                  type="button"
                  onClick={() => {
                    setSearch("");
                    clearSuggestions();
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]
                    bg-transparent border-none cursor-pointer p-1 hover:text-[var(--text)] transition-colors"
                  aria-label="Clear search"
                >
                  <CloseIcon size={14} />
                </button>
              )}
            </div>
          </form>
          {sugVisible && suggestions.length > 0 && (
            <div className="relative">
              <SuggestionDropdown
                suggestions={suggestions}
                selectedIdx={selectedIdx}
                sugLoading={sugLoading}
                search={search}
                onSelect={() => {
                  clearSuggestions();
                  setSearch("");
                  setSearchOpen(false);
                }}
              />
            </div>
          )}
        </div>
      )}

      {/* ── Mobile Bottom Nav ── */}
      <div
        className="md:hidden fixed bottom-0 left-0 right-0 z-[200]
          flex items-center justify-around
          px-2 py-2
          bg-black/60 backdrop-blur-[24px]
          border-t border-[var(--border)]
          safe-bottom"
        style={{ paddingBottom: "max(8px, env(safe-area-inset-bottom))" }}
      >
        {BOTTOM_NAV_LINKS.map(({ href, label, Icon }) => {
          const active = isActive(href);
          return (
            <Link
              key={href}
              href={href}
              aria-label={label}
              className="no-underline flex-1 flex justify-center"
            >
              <div
                className={`relative flex items-center justify-center w-11 h-11 rounded-[12px]
                  transition-all duration-200
                  ${
                    active
                      ? "bg-[rgba(229,9,20,0.15)] text-[rgb(229,9,20)]"
                      : "text-[var(--text-muted)] hover:text-[var(--text)]"
                  }`}
              >
                <Icon
                  size={22}
                  strokeWidth={active ? 2.4 : 1.8}
                  // Fill the icon slightly when active for that polished "selected" feel
                  className={
                    active ? "drop-shadow-[0_0_6px_rgba(229,9,20,0.5)]" : ""
                  }
                />
                {/* Active dot indicator */}
                {/* {active && (
                  <span
                    className="absolute bottom-[5px] left-1/2 -translate-x-1/2
                      w-1 h-1 rounded-full bg-[rgb(229,9,20)]"
                  />
                )} */}
              </div>
            </Link>
          );
        })}
      </div>
    </>
  );
}

// ─────────────────────────── Suggestion Dropdown ───────────────────────────
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
      className="absolute top-[calc(100%+8px)] left-0 right-0 z-[200] overflow-hidden slide-down
        bg-[rgba(15,15,15,0.98)] backdrop-blur-[24px] border border-[var(--border)]
        rounded-[12px] shadow-[0_20px_60px_rgba(0,0,0,0.7)]"
    >
      {sugLoading && (
        <div className="px-4 py-[10px] text-[11px] text-[var(--text-muted)]">
          Searching…
        </div>
      )}
      {suggestions.map((film, i) => {
        const id = film.kinopoiskId ?? film.filmId;
        const name = getEnglishName(
          film.nameRu,
          film.nameEn,
          film.nameOriginal,
        );
        const rating = film.ratingKinopoisk ?? film.ratingImdb ?? film.rating;
        const poster = film.posterUrlPreview ?? film.posterUrl;
        return (
          <Link
            key={id}
            href={`/film/${id}`}
            className="no-underline"
            onClick={onSelect}
          >
            <div
              className={`flex items-center gap-[10px] px-[14px] py-[10px] cursor-pointer
                transition-colors duration-100
                ${i === selectedIdx ? "bg-[var(--bg-elevated)]" : "hover:bg-[var(--bg-elevated)]"}
                ${i < suggestions.length - 1 ? "border-b border-[var(--border)]" : ""}`}
            >
              <div className="relative w-8 h-12 rounded-[4px] overflow-hidden flex-shrink-0 bg-[var(--surface)]">
                {poster ? (
                  <Image
                    src={poster}
                    alt={name}
                    fill
                    sizes="32px"
                    className="object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center opacity-20">
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                    >
                      <path d="M21 3H3v18h18V3zm-9 14l-5-5 1.4-1.4 3.6 3.6 7.6-7.6L20 8l-8 9z" />
                    </svg>
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold text-[var(--text)] truncate">
                  {name}
                </p>
                <div className="flex gap-[6px] items-center mt-[2px]">
                  {film.year && (
                    <span className="text-[11px] text-[var(--text-muted)]">
                      {film.year}
                    </span>
                  )}
                  {film.genres?.[0] && (
                    <span className="text-[10px] text-[var(--text-muted)] capitalize">
                      · {film.genres[0].genre}
                    </span>
                  )}
                </div>
              </div>
              {rating !== undefined && rating !== null && (
                <div className="flex items-center gap-[3px] flex-shrink-0">
                  <svg
                    width="9"
                    height="9"
                    viewBox="0 0 24 24"
                    fill="var(--gold)"
                  >
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                  </svg>
                  <span className="text-[11px] text-[var(--gold)] font-semibold">
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
        className="no-underline"
        onClick={onSelect}
      >
        <div
          className="flex items-center gap-[6px] px-[14px] py-[10px] text-[12px] font-semibold
          text-[var(--accent)] bg-[var(--bg-card)] cursor-pointer
          hover:bg-[var(--bg-elevated)] transition-colors duration-100"
        >
          <SearchIcon className="w-3 h-3" />
          See all results for &ldquo;{search}&rdquo;
        </div>
      </Link>
    </div>
  );
}

// ─────────────────────────── Reusable Icon Button ───────────────────────────
function NavIconBtn({
  children,
  active,
  onClick,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      {...props}
      className={`w-9 h-9 rounded-[8px] flex items-center justify-center cursor-pointer
        transition-all duration-[180ms] text-[var(--text)]
        ${
          active
            ? "bg-[var(--accent-dim)] border border-[rgba(229,9,20,0.3)] text-white"
            : "bg-transparent border border-transparent hover:bg-[rgba(255,255,255,0.08)]"
        }`}
    >
      {children}
    </button>
  );
}

// ─────────────────────────── SVG Icons ───────────────────────────
function SearchIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
    >
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.35-4.35" />
    </svg>
  );
}

function CloseIcon({
  className = "",
  size = 20,
}: {
  className?: string;
  size?: number;
}) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function ProfileIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07M8.46 8.46a5 5 0 0 0 0 7.07" />
      <path
        d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"
        strokeOpacity="0.45"
      />
    </svg>
  );
}
