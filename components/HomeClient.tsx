"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { getTopFilms, getFilmsByFilter, getPremieres } from "@/lib/kinopoisk";
import { Film } from "@/types/kinopoisk";
import HeroBanner from "@/components/HeroBanner";
import FilmRow from "@/components/FilmRow";
import { getPreferences, hasApiKeys, Preferences } from "@/lib/preferences";

const CURRENT_MONTH = new Date()
  .toLocaleString("en-US", { month: "long" })
  .toUpperCase();
const CURRENT_YEAR = new Date().getFullYear();

function NoKeyBanner() {
  return (
    <div
      style={{
        minHeight: "calc(100vh - var(--nav-height))",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "40px clamp(16px,4vw,48px)",
        background: "var(--bg)",
      }}
    >
      <div style={{ maxWidth: 480, textAlign: "center", animation: "fadeUp 0.4s ease both" }}>
        <div
          style={{
            width: 72, height: 72, borderRadius: "50%",
            background: "var(--accent-dim)",
            border: "1px solid rgba(229,9,20,0.25)",
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 28px",
            boxShadow: "0 0 40px var(--accent-glow)",
          }}
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.8">
            <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
          </svg>
        </div>
        <h2 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(24px,4vw,32px)", letterSpacing: "2px", color: "var(--text)", marginBottom: 12 }}>
          API KEY REQUIRED
        </h2>
        <p style={{ fontSize: "14px", color: "var(--text-dim)", lineHeight: 1.7, marginBottom: 32, fontFamily: "var(--font-body)" }}>
          CineMix needs a Kinopoisk API key to load content. Get a free key at{" "}
          <a href="https://kinopoiskapiunofficial.tech" target="_blank" rel="noreferrer" style={{ color: "var(--accent)", textDecoration: "none" }}>
            kinopoiskapiunofficial.tech
          </a>{" "}
          and add it in your preferences.
        </p>
        <Link href="/preferences" style={{ textDecoration: "none" }}>
          <div
            style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              background: "var(--accent)", borderRadius: "var(--radius)",
              padding: "12px 28px", fontSize: "14px", fontWeight: 700, color: "white",
              cursor: "pointer", fontFamily: "var(--font-body)", letterSpacing: "0.5px",
              boxShadow: "0 0 24px var(--accent-glow)",
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14" />
            </svg>
            Open Preferences
          </div>
        </Link>
      </div>
    </div>
  );
}

export default function HomeClient() {
  const [popularFilms, setPopularFilms] = useState<Film[]>([]);
  const [top250Films, setTop250Films] = useState<Film[]>([]);
  const [seriesFilms, setSeriesFilms] = useState<Film[]>([]);
  const [actionFilms, setActionFilms] = useState<Film[]>([]);
  const [dramaFilms, setDramaFilms] = useState<Film[]>([]);
  const [scifiFilms, setScifiFilms] = useState<Film[]>([]);
  const [awaitFilms, setAwaitFilms] = useState<Film[]>([]);
  const [comedyFilms, setComedyFilms] = useState<Film[]>([]);
  const [hrrorFilms, setHorrorFilms] = useState<Film[]>([]);
  const [premiereFilms, setPremiereFilms] = useState<Film[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [noKey, setNoKey] = useState(false);
  const [sections, setSections] = useState<Preferences["homeSections"] | null>(null);

  useEffect(() => {
    if (!hasApiKeys()) { setNoKey(true); return; }

    const prefs = getPreferences();
    const s = prefs.homeSections;
    setSections(s);

    const fetches = [
      s.popular   ? getTopFilms("TOP_100_POPULAR_FILMS") : Promise.resolve(null),
      s.top250    ? getTopFilms("TOP_250_BEST_FILMS")    : Promise.resolve(null),
      s.series    ? getFilmsByFilter({ type: "TV_SERIES", order: "RATING", ratingFrom: 7 }) : Promise.resolve(null),
      s.action    ? getFilmsByFilter({ genres: 1, order: "RATING", ratingFrom: 7 })         : Promise.resolve(null),
      s.drama     ? getFilmsByFilter({ genres: 2, order: "RATING", ratingFrom: 7 })         : Promise.resolve(null),
      s.scifi     ? getFilmsByFilter({ genres: 6, order: "RATING", ratingFrom: 7 })         : Promise.resolve(null),
      s.upcoming  ? getTopFilms("TOP_AWAIT_FILMS")                                           : Promise.resolve(null),
      s.comedy    ? getFilmsByFilter({ genres: 13, order: "RATING", ratingFrom: 6 })        : Promise.resolve(null),
      s.horror    ? getFilmsByFilter({ genres: 17, order: "RATING", ratingFrom: 6 })        : Promise.resolve(null),
      s.premieres ? getPremieres(CURRENT_YEAR, CURRENT_MONTH).catch(() => ({ items: [], total: 0, totalPages: 1 })) : Promise.resolve(null),
    ];

    Promise.allSettled(fetches).then(
      ([popular, top250, series, action, drama, scifi, await_, comedy, horror, premieres]) => {
        if (popular.status   === "fulfilled" && popular.value)   setPopularFilms(popular.value.items);
        if (top250.status    === "fulfilled" && top250.value)    setTop250Films(top250.value.items);
        if (series.status    === "fulfilled" && series.value)    setSeriesFilms(series.value.items);
        if (action.status    === "fulfilled" && action.value)    setActionFilms(action.value.items);
        if (drama.status     === "fulfilled" && drama.value)     setDramaFilms(drama.value.items);
        if (scifi.status     === "fulfilled" && scifi.value)     setScifiFilms(scifi.value.items);
        if (await_.status    === "fulfilled" && await_.value)    setAwaitFilms(await_.value.items);
        if (comedy.status    === "fulfilled" && comedy.value)    setComedyFilms(comedy.value.items);
        if (horror.status    === "fulfilled" && horror.value)    setHorrorFilms(horror.value.items);
        if (premieres.status === "fulfilled" && premieres.value) setPremiereFilms(premieres.value.items);
        setLoaded(true);
      },
    );
  }, []);

  if (noKey) return <NoKeyBanner />;
  if (!loaded) return <HomeSkeleton />;

  const s = sections!;
  const heroFilm = popularFilms.find((f) => f.coverUrl) ?? popularFilms[0] ?? null;
  const secondHero = top250Films.find((f) => f.coverUrl && f !== heroFilm) ?? top250Films[1] ?? null;
  const thirdHero = awaitFilms.find((f) => f.coverUrl) ?? null;

  return (
    <div className="fade-in">
      {heroFilm && <HeroBanner film={heroFilm} />}
      <div style={{ position: "relative", zIndex: 2 }}>
        {s.popular   && popularFilms.length   > 0 && <FilmRow title="Trending Now"            films={popularFilms.slice(0,20)}   href="/explore?type=FILM" />}
        {s.top250    && top250Films.length     > 0 && <FilmRow title="Top 250 — All Time Greats" films={top250Films.slice(0,20)}  href="/top250" showIndex />}
        {s.premieres && premiereFilms.length   > 0 && <FilmRow title="New This Month"          films={premiereFilms.slice(0,20)} />}
        {s.series    && seriesFilms.length     > 0 && <FilmRow title="Top Series"              films={seriesFilms.slice(0,20)}   href="/explore?type=TV_SERIES" />}
        {s.action    && actionFilms.length     > 0 && <FilmRow title="Action & Adventure"      films={actionFilms.slice(0,20)}   href="/explore?type=FILM&genres=1" />}
        {secondHero && <div style={{ margin: "16px 0" }}><HeroBanner film={secondHero} /></div>}
        {s.drama     && dramaFilms.length      > 0 && <FilmRow title="Drama"                   films={dramaFilms.slice(0,20)}    href="/explore?type=FILM&genres=2" />}
        {s.scifi     && scifiFilms.length      > 0 && <FilmRow title="Sci-Fi & Thriller"       films={scifiFilms.slice(0,20)}    href="/explore?type=FILM&genres=6" />}
        {s.comedy    && comedyFilms.length     > 0 && <FilmRow title="Comedy"                  films={comedyFilms.slice(0,20)}   href="/explore?type=FILM&genres=13" />}
        {thirdHero && <div style={{ margin: "16px 0" }}><HeroBanner film={thirdHero} /></div>}
        {s.horror    && hrrorFilms.length      > 0 && <FilmRow title="Horror"                  films={hrrorFilms.slice(0,20)}    href="/explore?type=FILM&genres=17" />}
        {s.upcoming  && awaitFilms.length      > 0 && <FilmRow title="Coming Soon"             films={awaitFilms.slice(0,20)} />}
        {s.top250    && top250Films.length     > 20 && <FilmRow title="Critically Acclaimed"    films={top250Films.slice(20,40)}  href="/top250" />}
      </div>
    </div>
  );
}

function HomeSkeleton() {
  return (
    <div style={{ minHeight: "100vh" }}>
      <div className="skeleton" style={{ width: "100%", height: "clamp(500px,90vh,800px)" }} />
      <div style={{ padding: "48px clamp(16px,4vw,48px)", display: "flex", flexDirection: "column", gap: 48 }}>
        {[1, 2, 3, 4].map((i) => (
          <div key={i}>
            <div className="skeleton" style={{ height: 26, width: 200, borderRadius: 6, marginBottom: 20 }} />
            <div style={{ display: "flex", gap: 16, overflow: "hidden" }}>
              {Array.from({ length: 6 }).map((_, j) => (
                <div key={j} className="skeleton" style={{ width: 180, height: 270, borderRadius: 12, flexShrink: 0 }} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
