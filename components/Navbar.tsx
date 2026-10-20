"use client";
// components/Navbar.tsx
import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import {
  Home,
  Compass,
  BarChart2,
  Clapperboard,
  User,
  Search,
  Settings,
  X,
} from "lucide-react";
import { useSearchSuggestions } from "@/hooks/useSearchSuggestions";
import SearchSuggestionDropdown from "@/components/SearchSuggestionDropdown";
import Logo from "./logo";

const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/explore", label: "Explore" },
  { href: "/top250", label: "Top 250" },
  { href: "/premieres", label: "Premieres" },
];

const BOTTOM_NAV_LINKS = [
  { href: "/", label: "Home", Icon: Home },
  { href: "/explore", label: "Explore", Icon: Compass },
  { href: "/top250", label: "Top 250", Icon: BarChart2 },
  { href: "/premieres", label: "Premieres", Icon: Clapperboard },
  { href: "/profile", label: "Profile", Icon: User },
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
        className={`fixed top-0 left-0 right-0 z-[200] flex items-center gap-3 transition-all duration-300 px-4 md:px-[var(--page-x)] h-[var(--nav-height)] bg-gradient-to-br from-black/85 to-black/35 backdrop-blur-[20px] ${
          scrolled ? "shadow-[0_1px_0_var(--border)]" : "shadow-none"
        }`}
      >
        <Logo />

        {/* Desktop nav links */}
        <div className="hidden md:flex items-center gap-0.5 flex-1">
          {NAV_LINKS.map(({ href, label }) => (
            <button
              key={href}
              type="button"
              onClick={() => router.push(href)}
              className={`px-3.5 cursor-pointer py-1.5 rounded-md text-[13px] font-medium transition-all duration-180 ${
                isActive(href)
                  ? "text-white bg-[var(--accent-dim)] border border-[rgba(229,9,20,0.25)]"
                  : "text-[var(--text-dim)] border border-transparent hover:text-white hover:bg-[rgba(255,255,255,0.06)]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Mobile: push icons to right */}
        <div className="flex-1 md:hidden" />

        {/* Desktop search */}
        <div className="hidden lg:block relative">
          <form onSubmit={handleSubmit}>
            <div className="relative">
              <input
                ref={inputRef}
                value={search}
                onChange={(e) => handleSearchChange(e.target.value)}
                onKeyDown={(e) => handleKeyNav(e, suggestions.length)}
                onFocus={() => search.trim().length >= 2 && setSugVisible(true)}
                onBlur={() => setTimeout(() => setSugVisible(false), 200)}
                placeholder="Search films, series…"
                className="bg-[rgba(255,255,255,0.07)] border border-[var(--border)] rounded-[20px] py-[7px] pl-9 pr-8 text-[var(--text)] text-[13px] outline-none placeholder:text-[var(--text-muted)] transition-[width,border-color,background] duration-300 w-[190px] focus:w-[260px] focus:border-[rgba(229,9,20,0.5)] focus:bg-[rgba(255,255,255,0.1)]"
              />
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none opacity-40 w-[13px] h-[13px]" />
              {search && (
                <button
                  type="button"
                  onClick={() => {
                    setSearch("");
                    clearSuggestions();
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
              <Settings width={20} />
            </NavIconBtn>
          </Link>
          <Link href="/profile" className="no-underline" title="Profile">
            <NavIconBtn
              active={pathname.startsWith("/profile")}
              aria-label="Profile"
            >
              <User width={20} />
            </NavIconBtn>
          </Link>
        </div>

        {/* Mobile top-right: search + preferences */}
        <div className="flex lg:hidden items-center gap-[2px]">
          <NavIconBtn
            onClick={() => setSearchOpen((v) => !v)}
            active={searchOpen}
            aria-label="Search"
          >
            <Search width={20} />
          </NavIconBtn>

          <Link href="/preferences" className="md:hidden no-underline">
            <NavIconBtn
              active={pathname === "/preferences"}
              aria-label="Preferences"
            >
              <Settings width={20} />
            </NavIconBtn>
          </Link>
        </div>
      </nav>

      {/* ── Mobile search bar ── */}
      {searchOpen && (
        <div
          className="lg:hidden fixed left-0 right-0 z-[190] bg-[rgba(8,8,8,0.98)] backdrop-blur-[20px] shadow-[0_1px_0_var(--border)] px-4 py-3 slide-down"
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
                className="pl-10 pr-9 text-[15px] py-3 input"
              />
              <Search className="absolute left-[14px] top-1/2 -translate-y-1/2 opacity-40 pointer-events-none w-4 h-4" />
              {search && (
                <button
                  type="button"
                  onClick={() => {
                    setSearch("");
                    clearSuggestions();
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
            <div className="relative">
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

      {/* ── Mobile Bottom Nav ── */}
      <div
        className="md:hidden fixed bottom-0 left-0 right-0 z-[200] flex items-center justify-around px-2 py-2 bg-black/60 backdrop-blur-[24px] border-t border-[var(--border)] safe-bottom"
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
                className={`relative flex items-center justify-center w-11 h-11 rounded-[12px] transition-all duration-200 ${
                  active
                    ? "bg-[rgba(229,9,20,0.15)] text-[rgb(229,9,20)]"
                    : "text-[var(--text-muted)] hover:text-[var(--text)]"
                }`}
              >
                <Icon
                  size={22}
                  strokeWidth={active ? 2.4 : 1.8}
                  className={
                    active ? "drop-shadow-[0_0_6px_rgba(229,9,20,0.5)]" : ""
                  }
                />
              </div>
            </Link>
          );
        })}
      </div>
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
      className={`w-9 h-9 rounded-[8px] flex items-center justify-center cursor-pointer transition-all duration-[180ms] text-[var(--text)] ${
        active
          ? "bg-[var(--accent-dim)] border border-[rgba(229,9,20,0.3)] text-white"
          : "bg-transparent border border-transparent hover:bg-[rgba(255,255,255,0.08)]"
      }`}
    >
      {children}
    </button>
  );
}
