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
      {/* ── Top App Bar (Modern glassy transparent effect, full width) ── */}
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

        {/* Right Action Icons (Consistent Order: Search -> Preferences -> Profile) */}
        <div className="flex items-center gap-1">
          {/* Mobile & Tablet Search Toggle (< lg) */}
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

          {/* Preferences Button (All breakpoints) */}
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

          {/* Desktop Profile Button (md+; on mobile Profile is in the bottom bar) */}
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

      {/* ── Mobile Bottom Navigation Bar (Floating, Centered, Oval, Glassy) ── */}
      <div
        className="md:hidden fixed z-[200] flex items-center justify-around px-2 py-2 bg-[#08080a]/60 backdrop-blur-[24px] [-webkit-backdrop-filter:blur(24px)] border border-white/[0.1] shadow-[0_8px_32px_rgba(0,0,0,0.4)] select-none [-webkit-touch-callout:none] rounded-full w-[92%] max-w-[400px] left-1/2 -translate-x-1/2"
        style={{ bottom: "max(24px, env(safe-area-inset-bottom))" }}
      >
        {BOTTOM_NAV_LINKS.map(({ href, label, Icon }) => {
          const active = isActive(href);
          return (
            <Link
              key={href}
              href={href}
              aria-label={label}
              className="no-underline flex-1 flex flex-col items-center justify-center active:scale-95 transition-transform duration-150"
            >
              <div
                className={`flex items-center justify-center w-12 h-8 rounded-full transition-all duration-200 ${
                  active
                    ? "bg-[rgba(229,9,20,0.18)] text-[var(--accent)]"
                    : "text-[var(--text-muted)]"
                }`}
              >
                <Icon
                  size={18}
                  strokeWidth={active ? 2.3 : 1.85}
                  className={
                    active ? "drop-shadow-[0_0_8px_rgba(229,9,20,0.45)]" : ""
                  }
                />
              </div>
              <span
                className={`text-[10px] mt-1 leading-tight tracking-[0.2px] transition-colors ${
                  active
                    ? "font-semibold text-white"
                    : "font-medium text-[var(--text-muted)]"
                }`}
              >
                {label}
              </span>
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
