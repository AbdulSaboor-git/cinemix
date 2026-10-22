"use client";
import Link from "next/link";
import Logo from "./logo";

export default function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="hidden md:block border-t border-[var(--border)] bg-[var(--bg-card)] mt-auto">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-[var(--page-x)] py-10 sm:py-12">
        <div className="flex flex-col gap-8 sm:gap-10 sm:flex-row sm:justify-between">
          {/* Logo */}
          <div className="max-w-full sm:max-w-[280px]">
            <Logo />
            <p className="text-[13px] text-[var(--text-muted)] leading-[1.8] max-w-[320px]">
              Discover and watch the greatest films and series of all time.
            </p>
          </div>

          {/* Nav groups */}
          <div className="grid grid-cols-3 gap-8 sm:flex sm:gap-14">
            <FooterGroup title="Explore">
              <FooterLink href="/explore?type=FILM">Movies</FooterLink>
              <FooterLink href="/explore?type=TV_SERIES">Series</FooterLink>
              <FooterLink href="/top250">Top 250</FooterLink>
              <FooterLink href="/premieres">Premieres</FooterLink>
            </FooterGroup>
            <FooterGroup title="Genres">
              <FooterLink href="/explore?genres=11">Action</FooterLink>
              <FooterLink href="/explore?genres=2">Drama</FooterLink>
              <FooterLink href="/explore?genres=13">Comedy</FooterLink>
              <FooterLink href="/explore?genres=6">Sci-Fi</FooterLink>
            </FooterGroup>
            <FooterGroup title="Settings">
              <FooterLink href="/preferences">Preferences</FooterLink>
              <FooterLink href="/profile">Profile</FooterLink>
              <FooterLink
                href="https://kinopoiskapiunofficial.tech"
                target="_blank"
              >
                Get API Key
              </FooterLink>
            </FooterGroup>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-8 sm:mt-10 pt-5 sm:pt-6 border-t border-[var(--border)] flex flex-col sm:flex-row justify-between items-center gap-1 sm:gap-2">
          <p className="text-[12px] text-[var(--text-muted)]">
            © {year} CineMix
          </p>
          <p className="text-[11px] text-[var(--text-muted)]">
            For entertainment purposes only.
          </p>
        </div>
      </div>
    </footer>
  );
}

function FooterGroup({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-[11px] font-bold uppercase tracking-[1.5px] text-[var(--text-dim)] mb-3 sm:mb-4">
        {title}
      </p>
      <div className="flex flex-col gap-[10px]">{children}</div>
    </div>
  );
}

function FooterLink({
  href,
  children,
  target,
}: {
  href: string;
  children: React.ReactNode;
  target?: string;
}) {
  return (
    <Link
      href={href}
      target={target}
      rel={target === "_blank" ? "noreferrer" : undefined}
      className="text-[13px] text-[var(--text-muted)] no-underline transition-colors duration-200 hover:text-[var(--text)]"
    >
      {children}
    </Link>
  );
}
