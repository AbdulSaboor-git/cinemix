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
  Shuffle,
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
      const tag = (e.target as HTMLElement)?.tagName;
      const isEditing =
        tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (window.innerWidth >= 1024) {
          inputRef.current?.focus();
        } else {
          setSearchOpen(true);
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
  }, []);

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
        className={`fixed top-0 left-0 right-0 z-[200] flex items-center gap-3 transition-all duration-300 px-3.5 md:px-[var(--page-x)] h-[var(--nav-height)] select-none ${
          scrolled
            ? "bg-[#080808]/92 backdrop-blur-[22px] shadow-[0_1px_0_var(--border)]"
            : "bg-gradient-to-b from-black/90 via-black/60 to-transparent backdrop-blur-[12px]"
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

        {/* Mobile spacer */}
        <div className="flex-1 md:hidden" />

        {/* Desktop search */}
        <div ref={desktopSearchRef} className="hidden lg:block relative">
          <form onSubmit={handleSubmit}>
            <div className="relative">
              <input
                ref={inputRef}
                value={search}
                onChange={(e) => handleSearchChange(e.target.value)}
                onKeyDown={(e) => handleKeyNav(e, suggestions.length)}
                onFocus={() => search.trim().length >= 2 && setSugVisible(true)}
                placeholder="Search films, series… "
                className="bg-[rgba(255,255,255,0.07)] border border-[var(--border)] rounded-[20px] py-[7px] pl-9 pr-8 text-[var(--text)] text-[13px] outline-none placeholder:text-[var(--text-muted)] transition-[width,border-color,background] duration-300 w-[200px] focus:w-[270px] focus:border-[rgba(229,9,20,0.5)] focus:bg-[rgba(255,255,255,0.1)]"
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

        {/* Desktop Random Roulette + Profile + Preferences */}
        <div className="hidden md:flex items-center gap-1 ml-1">
          {/* <Link
            href="/explore?order=RANDOM"
            className="no-underline"
            title="Random Film Roulette"
          >
            <NavIconBtn active={false} aria-label="Random Film Roulette">
              <Shuffle width={18} />
            </NavIconBtn>
          </Link> */}
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

        {/* Mobile App Bar Actions: Search + Preferences */}
        <div className="flex lg:hidden items-center gap-1">
          <NavIconBtn
            onClick={() => setSearchOpen((v) => !v)}
            active={searchOpen}
            aria-label="Search"
          >
            {searchOpen ? <X width={19} /> : <Search width={19} />}
          </NavIconBtn>

          <Link href="/preferences" className="md:hidden no-underline">
            <NavIconBtn
              active={pathname === "/preferences"}
              aria-label="Preferences"
            >
              <Settings width={19} />
            </NavIconBtn>
          </Link>
        </div>
      </nav>

      {/* ── Mobile Search Drawer ── */}
      {searchOpen && (
        <div
          ref={mobileSearchRef}
          className="lg:hidden fixed left-0 right-0 z-[190] bg-[#0b0b0df5] backdrop-blur-[24px] shadow-[0_8px_32px_rgba(0,0,0,0.75)] border-b border-[var(--border)] px-3.5 py-2.5 slide-down"
          style={{ top: "var(--nav-height)" }}
        >
          <form onSubmit={handleSubmit}>
            <div className="relative">
              <input
                ref={mobileInputRef}
                value={search}
                onChange={(e) => handleSearchChange(e.target.value)}
                onKeyDown={(e) => handleKeyNav(e, suggestions.length)}
                placeholder="Search films, series, actors…"
                className="pl-10 pr-9 text-[14px] py-2.5 rounded-full input"
              />
              <Search className="absolute left-[14px] top-1/2 -translate-y-1/2 opacity-45 pointer-events-none w-4 h-4" />
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

      {/* ── Native Android Material-Style Bottom Navigation Bar (Mobile < md) ── */}
      <div
        className="md:hidden fixed bottom-0 left-0 right-0 z-[200] flex items-center justify-around px-1 pt-1.5 bg-[#0a0a0cf2] backdrop-blur-[28px] border-t border-white/[0.08] select-none [-webkit-touch-callout:none]"
        style={{ paddingBottom: "max(6px, env(safe-area-inset-bottom))" }}
      >
        {BOTTOM_NAV_LINKS.map(({ href, label, Icon }) => {
          const active = isActive(href);
          return (
            <Link
              key={href}
              href={href}
              aria-label={label}
              className="no-underline flex-1 flex flex-col items-center justify-center py-0.5 active:scale-90 transition-transform duration-150"
            >
              <div
                className={`flex items-center justify-center w-12 h-7 rounded-full transition-all duration-200 ${
                  active
                    ? "bg-[rgba(229,9,20,0.2)] text-[var(--accent)]"
                    : "text-[var(--text-muted)]"
                }`}
              >
                <Icon
                  size={19}
                  strokeWidth={active ? 2.4 : 1.9}
                  className={
                    active ? "drop-shadow-[0_0_8px_rgba(229,9,20,0.5)]" : ""
                  }
                />
              </div>
              <span
                className={`text-[10px] mt-0.5 leading-tight tracking-[0.2px] transition-colors ${
                  active
                    ? "font-bold text-white"
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
      className={`w-9 h-9 rounded-full md:rounded-[8px] flex items-center justify-center cursor-pointer transition-all duration-[160ms] text-[var(--text)] active:scale-90 ${
        active
          ? "bg-[var(--accent-dim)] border border-[rgba(229,9,20,0.3)] text-white"
          : "bg-transparent border border-transparent hover:bg-[rgba(255,255,255,0.08)] active:bg-[rgba(255,255,255,0.12)]"
      }`}
    >
      {children}
    </button>
  );
}
