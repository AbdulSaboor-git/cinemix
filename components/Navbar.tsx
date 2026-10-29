"use client";
// components/Navbar.tsx
import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { Search, Settings, User, X } from "lucide-react";
import { useSearchSuggestions } from "@/hooks/useSearchSuggestions";
import SearchSuggestionDropdown from "@/components/SearchSuggestionDropdown";
import Logo from "./logo";

const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/explore", label: "Explore" },
  { href: "/top250", label: "Top 250" },
  { href: "/premieres", label: "Premieres" },
];

type NavIconProps = { active: boolean; className?: string };

/* ── Custom Bottom Nav Icons (Outline when inactive, Duotone/Filled when active) ── */
function HomeNavIcon({ active, className }: NavIconProps) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      className={className}
    >
      <path
        d="M3 10.5L12 3L21 10.5V19.5C21 20.3284 20.3284 21 19.5 21H4.5C3.67157 21 3 20.3284 3 19.5V10.5Z"
        fill={active ? "currentColor" : "none"}
        fillOpacity={active ? 0.22 : 0}
        stroke="currentColor"
        strokeWidth={active ? 2.1 : 1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M9.5 21V14.5C9.5 13.9477 9.94772 13.5 10.5 13.5H13.5C14.0523 13.5 14.5 13.9477 14.5 14.5V21"
        stroke="currentColor"
        strokeWidth={active ? 2.1 : 1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ExploreNavIcon({ active, className }: NavIconProps) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      className={className}
    >
      <circle
        cx="12"
        cy="12"
        r="9"
        fill={active ? "currentColor" : "none"}
        fillOpacity={active ? 0.2 : 0}
        stroke="currentColor"
        strokeWidth={active ? 2.1 : 1.8}
      />
      <polygon
        points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"
        fill={active ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth={active ? 2.1 : 1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Top250NavIcon({ active, className }: NavIconProps) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      className={className}
    >
      {/* Trophy Cup */}
      <path
        d="M6 4H18V9C18 12.3137 15.3137 15 12 15C8.68629 15 6 12.3137 6 9V4Z"
        fill={active ? "currentColor" : "none"}
        fillOpacity={active ? 0.22 : 0}
        stroke="currentColor"
        strokeWidth={active ? 2.1 : 1.8}
        strokeLinejoin="round"
      />
      {/* Handles */}
      <path
        d="M6 6H4C3.44772 6 3 6.44772 3 7V8C3 9.65685 4.34315 11 6 11M18 6H20C20.5523 6 21 6.44772 21 7V8C21 9.65685 19.6569 11 18 11"
        stroke="currentColor"
        strokeWidth={active ? 2.1 : 1.8}
        strokeLinecap="round"
      />
      {/* Stem & Base */}
      <path
        d="M12 15V20M8 20H16"
        stroke="currentColor"
        strokeWidth={active ? 2.1 : 1.8}
        strokeLinecap="round"
      />
      {/* Center Star Accent */}
      <circle cx="12" cy="9.2" r={active ? "1.6" : "1.2"} fill="currentColor" />
    </svg>
  );
}

function PremieresNavIcon({ active, className }: NavIconProps) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      className={className}
    >
      {/* Perforated Cinema Ticket */}
      <path
        d="M3 8.5C3 7.39543 3.89543 6.5 5 6.5H19C20.1046 6.5 21 7.39543 21 8.5V10C19.8954 10 19 10.8954 19 12C19 13.1046 19.8954 14 21 14V15.5C21 16.6046 20.1046 17.5 19 17.5H5C3.89543 17.5 3 16.6046 3 15.5V14C4.10457 14 5 13.1046 5 12C5 10.8954 4.10457 10 3 10V8.5Z"
        fill={active ? "currentColor" : "none"}
        fillOpacity={active ? 0.22 : 0}
        stroke="currentColor"
        strokeWidth={active ? 2.1 : 1.8}
        strokeLinejoin="round"
      />
      {/* Premiere Star in Center */}
      <path
        d="M12 9.2L12.8 11.1L14.8 11.3L13.3 12.6L13.7 14.6L12 13.5L10.3 14.6L10.7 12.6L9.2 11.3L11.2 11.1L12 9.2Z"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth="0.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ProfileNavIcon({ active, className }: NavIconProps) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      className={className}
    >
      <circle
        cx="12"
        cy="8"
        r="4"
        fill={active ? "currentColor" : "none"}
        fillOpacity={active ? 0.22 : 0}
        stroke="currentColor"
        strokeWidth={active ? 2.1 : 1.8}
      />
      <path
        d="M5 19.5C5 16.4624 8.13401 14 12 14C15.866 14 19 16.4624 19 19.5C19 20.0523 18.5523 20.5 18 20.5H6C5.44772 20.5 5 20.0523 5 19.5Z"
        fill={active ? "currentColor" : "none"}
        fillOpacity={active ? 0.22 : 0}
        stroke="currentColor"
        strokeWidth={active ? 2.1 : 1.8}
        strokeLinecap="round"
      />
    </svg>
  );
}

const BOTTOM_NAV_LINKS = [
  { href: "/", label: "Home", Icon: HomeNavIcon },
  { href: "/explore", label: "Explore", Icon: ExploreNavIcon },
  { href: "/top250", label: "Top 250", Icon: Top250NavIcon },
  { href: "/premieres", label: "Premieres", Icon: PremieresNavIcon },
  { href: "/profile", label: "Profile", Icon: ProfileNavIcon },
];

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const mobileInputRef = useRef<HTMLInputElement>(null);
  const desktopSearchRef = useRef<HTMLDivElement>(null);
  const mobileSearchRef = useRef<HTMLDivElement>(null);

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
    const handler = () => setScrolled(window.scrollY > 12);
    handler();
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

  useEffect(() => {
    if (!sugVisible) return;
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      const inDesktop = desktopSearchRef.current?.contains(target);
      const inMobile = mobileSearchRef.current?.contains(target);
      if (!inDesktop && !inMobile) {
        setSugVisible(false);
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [sugVisible, setSugVisible]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSugVisible(false);
        setSearchOpen(false);
        inputRef.current?.blur();
        mobileInputRef.current?.blur();
        return;
      }

      const tag = (e.target as HTMLElement)?.tagName;
      const isEditing =
        tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (window.innerWidth >= 1024) {
          inputRef.current?.focus();
        } else {
          setSearchOpen((prev) => !prev);
        }
      } else if (e.key === "/" && !isEditing) {
        e.preventDefault();
        if (window.innerWidth >= 1024) {
          inputRef.current?.focus();
        } else {
          setSearchOpen(true);
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [setSugVisible]);

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
      {/* ── Top App Bar ── */}
      <nav
        className={`fixed top-0 left-0 right-0 z-[199] flex items-center gap-3 px-3.5 md:px-[var(--page-x)] h-[var(--nav-height)] select-none backdrop-blur-[24px] [-webkit-backdrop-filter:blur(24px)] transition-[background-color,border-color,box-shadow] duration-300 border-b ${
          scrolled
            ? "bg-[#08080a]/60 border-white/[0.1] shadow-[0_8px_32px_rgba(0,0,0,0.4)]"
            : "bg-[#08080a]/30 border-transparent"
        }`}
      >
        <Logo />

        {/* Desktop Nav Links */}
        <div className="hidden md:flex items-center gap-1 flex-1 ml-1">
          {NAV_LINKS.map(({ href, label }) => {
            const active = isActive(href);
            return (
              <Link
                key={href}
                href={href}
                className={`no-underline px-3.5 py-1.5 rounded-[8px] text-[13px] font-medium transition-all duration-150 active:scale-95 ${
                  active
                    ? "text-white bg-[var(--accent-dim)] border border-[rgba(229,9,20,0.28)] shadow-[0_0_14px_rgba(229,9,20,0.12)]"
                    : "text-[var(--text-dim)] border border-transparent hover:text-white hover:bg-white/[0.06]"
                }`}
              >
                {label}
              </Link>
            );
          })}
        </div>

        {/* Mobile Spacer */}
        <div className="flex-1 md:hidden" />

        {/* Desktop Search Input (lg+) */}
        <div ref={desktopSearchRef} className="hidden lg:block relative">
          <form onSubmit={handleSubmit}>
            <div className="relative">
              <input
                ref={inputRef}
                value={search}
                onChange={(e) => handleSearchChange(e.target.value)}
                onKeyDown={(e) => handleKeyNav(e, suggestions.length)}
                onFocus={() => search.trim().length >= 2 && setSugVisible(true)}
                placeholder="Search films, series…"
                className="bg-white/[0.06] border border-[var(--border)] rounded-full py-[7px] pl-9 pr-8 text-[var(--text)] text-[13px] outline-none placeholder:text-[var(--text-muted)] transition-[width,border-color,background-color] duration-300 w-[210px] focus:w-[280px] focus:border-[rgba(229,9,20,0.5)] focus:bg-white/[0.09]"
              />
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none opacity-45"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => {
                    setSearch("");
                    clearSuggestions();
                    inputRef.current?.focus();
                  }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] bg-transparent border-none cursor-pointer p-1 hover:text-[var(--text)] transition-colors"
                  aria-label="Clear search"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </form>
          {sugVisible && suggestions.length > 0 && (
            <SearchSuggestionDropdown
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

        {/* Right Action Icons */}
        <div className="flex items-center gap-1">
          <div className="lg:hidden">
            <NavIconBtn
              onClick={() => setSearchOpen((v) => !v)}
              active={searchOpen}
              aria-label={searchOpen ? "Close search" : "Open search"}
              title="Search"
            >
              {searchOpen ? <X size={18} /> : <Search size={18} />}
            </NavIconBtn>
          </div>

          <Link
            href="/preferences"
            className="no-underline"
            title="Preferences"
          >
            <NavIconBtn
              active={pathname === "/preferences"}
              aria-label="Preferences"
            >
              <Settings size={18} />
            </NavIconBtn>
          </Link>

          <Link
            href="/profile"
            className="hidden md:inline-flex no-underline"
            title="Profile"
          >
            <NavIconBtn
              active={pathname.startsWith("/profile")}
              aria-label="Profile"
            >
              <User size={18} />
            </NavIconBtn>
          </Link>
        </div>
      </nav>

      {/* ── Mobile & Tablet Search Drawer ── */}
      {searchOpen && (
        <div
          ref={mobileSearchRef}
          className="lg:hidden fixed left-0 right-0 z-[190] bg-[#0a0a0d]/95 backdrop-blur-[20px] [-webkit-backdrop-filter:blur(20px)] shadow-[0_12px_36px_rgba(0,0,0,0.75)] border-b border-[var(--border)] px-3.5 py-2.5 slide-down"
          style={{ top: "var(--nav-height)" }}
        >
          <form onSubmit={handleSubmit}>
            <div className="relative">
              <input
                ref={mobileInputRef}
                value={search}
                onChange={(e) => handleSearchChange(e.target.value)}
                onKeyDown={(e) => handleKeyNav(e, suggestions.length)}
                onFocus={() => search.trim().length >= 2 && setSugVisible(true)}
                placeholder="Search films, series, actors…"
                className="w-full pl-10 pr-9 text-[14px] py-2.5 rounded-full input"
              />
              <Search
                size={15}
                className="absolute left-[14px] top-1/2 -translate-y-1/2 opacity-45 pointer-events-none"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => {
                    setSearch("");
                    clearSuggestions();
                    mobileInputRef.current?.focus();
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] bg-transparent border-none cursor-pointer p-1 hover:text-[var(--text)] transition-colors"
                  aria-label="Clear search"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </form>
          {sugVisible && suggestions.length > 0 && (
            <div className="relative mt-1">
              <SearchSuggestionDropdown
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

      {/* ── Mobile Bottom Navigation Bar (Concentric Pill, Custom Filled/Stroked Icons) ── */}
      <nav
        aria-label="Mobile bottom navigation"
        className="md:hidden fixed z-[200] flex items-center justify-between gap-1 p-1.5 bg-[#0a0a0e]/80 backdrop-blur-[28px] [-webkit-backdrop-filter:blur(28px)] border border-white/[0.12] shadow-[0_12px_36px_rgba(0,0,0,0.65)] select-none [-webkit-touch-callout:none] rounded-full w-[90%] max-w-[360px] left-1/2 -translate-x-1/2"
        style={{ bottom: "max(16px, env(safe-area-inset-bottom))" }}
      >
        {BOTTOM_NAV_LINKS.map(({ href, label, Icon }) => {
          const active = isActive(href);
          return (
            <Link
              key={href}
              href={href}
              aria-label={label}
              title={label}
              className={`no-underline flex-1 h-11 rounded-full flex items-center justify-center transition-all duration-200 active:scale-95 ${
                active
                  ? "bg-[rgba(229,9,20,0.18)] border border-[rgba(229,9,20,0.32)] text-[var(--accent)] shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_0_16px_rgba(229,9,20,0.15)]"
                  : "border border-transparent text-white/55 hover:text-white/85"
              }`}
            >
              <Icon
                active={active}
                className={`transition-transform duration-200 ${
                  active
                    ? "scale-105 drop-shadow-[0_0_8px_rgba(229,9,20,0.45)]"
                    : ""
                }`}
              />
            </Link>
          );
        })}
      </nav>
    </>
  );
}

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
      className={`w-9 h-9 rounded-full md:rounded-[9px] flex items-center justify-center cursor-pointer transition-all duration-150 text-[var(--text)] active:scale-90 ${
        active
          ? "bg-[var(--accent-dim)] border border-[rgba(229,9,20,0.3)] text-white shadow-[0_0_12px_rgba(229,9,20,0.15)]"
          : "bg-transparent border border-transparent hover:bg-white/[0.07] active:bg-white/[0.11]"
      }`}
    >
      {children}
    </button>
  );
}
