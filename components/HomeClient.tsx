"use client";
// components/HomeClient.tsx
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

// ─────────────────────────── No API Key State ───────────────────────────
function NoKeyBanner() {
  return (
    <div
      className="min-h-[calc(100vh-var(--nav-height))] flex items-center justify-center
        bg-[var(--bg)] px-4 sm:px-[var(--page-x)] py-12"
    >
      <div className="w-full max-w-[480px] text-center fade-up">
        {/* Icon */}
        <div
          className="w-[64px] h-[64px] sm:w-[72px] sm:h-[72px] rounded-full mx-auto mb-6 sm:mb-7
            flex items-center justify-center bg-[var(--accent-dim)]
            border border-[rgba(229,9,20,0.2)]"
          style={{ boxShadow: "0 0 48px var(--accent-glow)" }}
        >
          <svg
            width="26"
            height="26"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--accent)"
            strokeWidth="1.8"
          >
            <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
          </svg>
        </div>

        <h2 className="font-display text-[clamp(20px,5vw,30px)] tracking-[2px] text-[var(--text)] mb-4">
          API KEY REQUIRED
        </h2>

        <p className="text-[13px] sm:text-[14px] text-[var(--text-dim)] leading-[1.8] mb-8 px-2">
          CineMix needs a Kinopoisk API key to load content. Get a free key at{" "}
          <a
            href="https://kinopoiskapiunofficial.tech"
            target="_blank"
            rel="noreferrer"
            className="text-[var(--accent)] hover:underline break-all"
          >
            kinopoiskapiunofficial.tech
          </a>{" "}
          then add it in preferences.
        </p>

        <Link href="/preferences" className="no-underline inline-flex">
          <span className="btn btn-primary px-6 sm:px-8 py-[11px] text-[13px] sm:text-[14px]">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
            >
              <circle cx="12" cy="12" r="3" />
              <path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14" />
            </svg>
            Open Preferences
          </span>
        </Link>
      </div>
    </div>
  );
}

// ─────────────────────────── Main Client ───────────────────────────
export default function HomeClient() {
  const [popularFilms, setPopularFilms] = useState<Film[]>([]);
  const [top250Films, setTop250Films] = useState<Film[]>([]);
  const [seriesFilms, setSeriesFilms] = useState<Film[]>([]);
  const [actionFilms, setActionFilms] = useState<Film[]>([]);
  const [dramaFilms, setDramaFilms] = useState<Film[]>([]);
  const [scifiFilms, setScifiFilms] = useState<Film[]>([]);
  const [awaitFilms, setAwaitFilms] = useState<Film[]>([]);
  const [comedyFilms, setComedyFilms] = useState<Film[]>([]);
  const [horrorFilms, setHorrorFilms] = useState<Film[]>([]);
  const [premiereFilms, setPremiereFilms] = useState<Film[]>([]);

  const [loaded, setLoaded] = useState(false);
  const [noKey, setNoKey] = useState(false);
  const [sections, setSections] = useState<Preferences["homeSections"] | null>(
    null,
  );

  useEffect(() => {
    if (!hasApiKeys()) {
      setNoKey(true);
      return;
    }

    const prefs = getPreferences();
    const s = prefs.homeSections;
    setSections(s);

    const fetches = [
      s.popular ? getTopFilms("TOP_100_POPULAR_FILMS") : Promise.resolve(null),
      s.top250 ? getTopFilms("TOP_250_BEST_FILMS") : Promise.resolve(null),
      s.series
        ? getFilmsByFilter({
            type: "TV_SERIES",
            order: "RATING",
            ratingFrom: 7,
          })
        : Promise.resolve(null),
      s.action
        ? getFilmsByFilter({ genres: 1, order: "RATING", ratingFrom: 7 })
        : Promise.resolve(null),
      s.drama
        ? getFilmsByFilter({ genres: 2, order: "RATING", ratingFrom: 7 })
        : Promise.resolve(null),
      s.scifi
        ? getFilmsByFilter({ genres: 6, order: "RATING", ratingFrom: 7 })
        : Promise.resolve(null),
      s.upcoming ? getTopFilms("TOP_AWAIT_FILMS") : Promise.resolve(null),
      s.comedy
        ? getFilmsByFilter({ genres: 13, order: "RATING", ratingFrom: 6 })
        : Promise.resolve(null),
      s.horror
        ? getFilmsByFilter({ genres: 17, order: "RATING", ratingFrom: 6 })
        : Promise.resolve(null),
      s.premieres
        ? getPremieres(CURRENT_YEAR, CURRENT_MONTH).catch(() => ({
            items: [],
            total: 0,
            totalPages: 1,
          }))
        : Promise.resolve(null),
    ];

    Promise.allSettled(fetches).then(
      ([
        popular,
        top250,
        series,
        action,
        drama,
        scifi,
        upcoming,
        comedy,
        horror,
        premieres,
      ]) => {
        if (popular.status === "fulfilled" && popular.value)
          setPopularFilms(popular.value.items);
        if (top250.status === "fulfilled" && top250.value)
          setTop250Films(top250.value.items);
        if (series.status === "fulfilled" && series.value)
          setSeriesFilms(series.value.items);
        if (action.status === "fulfilled" && action.value)
          setActionFilms(action.value.items);
        if (drama.status === "fulfilled" && drama.value)
          setDramaFilms(drama.value.items);
        if (scifi.status === "fulfilled" && scifi.value)
          setScifiFilms(scifi.value.items);
        if (upcoming.status === "fulfilled" && upcoming.value)
          setAwaitFilms(upcoming.value.items);
        if (comedy.status === "fulfilled" && comedy.value)
          setComedyFilms(comedy.value.items);
        if (horror.status === "fulfilled" && horror.value)
          setHorrorFilms(horror.value.items);
        if (premieres.status === "fulfilled" && premieres.value)
          setPremiereFilms(premieres.value.items);
        setLoaded(true);
      },
    );
  }, []);

  if (noKey) return <NoKeyBanner />;
  if (!loaded) return <HomeSkeleton />;

  const s = sections!;

  const heroFilm =
    popularFilms.find((f) => f.coverUrl) ?? popularFilms[0] ?? null;
  const secondHero =
    top250Films.find((f) => f.coverUrl && f !== heroFilm) ??
    top250Films[1] ??
    null;
  const thirdHero = awaitFilms.find((f) => f.coverUrl) ?? null;

  return (
    <div className="fade-in">
      {heroFilm && <HeroBanner film={heroFilm} />}

      <div className="relative z-[2]">
        {s.popular && popularFilms.length > 0 && (
          <FilmRow
            title="Trending Now"
            films={popularFilms.slice(0, 20)}
            href="/explore?type=FILM"
          />
        )}
        {s.top250 && top250Films.length > 0 && (
          <FilmRow
            title="Top 250 — All Time Greats"
            films={top250Films.slice(0, 20)}
            href="/top250"
            showIndex
          />
        )}
        {s.premieres && premiereFilms.length > 0 && (
          <FilmRow title="New This Month" films={premiereFilms.slice(0, 20)} />
        )}
        {s.series && seriesFilms.length > 0 && (
          <FilmRow
            title="Top Series"
            films={seriesFilms.slice(0, 20)}
            href="/explore?type=TV_SERIES"
          />
        )}
        {s.action && actionFilms.length > 0 && (
          <FilmRow
            title="Action & Adventure"
            films={actionFilms.slice(0, 20)}
            href="/explore?type=FILM&genres=1"
          />
        )}

        {secondHero && (
          <div className="my-6 sm:my-8">
            <HeroBanner film={secondHero} />
          </div>
        )}

        {s.drama && dramaFilms.length > 0 && (
          <FilmRow
            title="Drama"
            films={dramaFilms.slice(0, 20)}
            href="/explore?type=FILM&genres=2"
          />
        )}
        {s.scifi && scifiFilms.length > 0 && (
          <FilmRow
            title="Sci-Fi & Thriller"
            films={scifiFilms.slice(0, 20)}
            href="/explore?type=FILM&genres=6"
          />
        )}
        {s.comedy && comedyFilms.length > 0 && (
          <FilmRow
            title="Comedy"
            films={comedyFilms.slice(0, 20)}
            href="/explore?type=FILM&genres=13"
          />
        )}

        {thirdHero && (
          <div className="my-6 sm:my-8">
            <HeroBanner film={thirdHero} />
          </div>
        )}

        {s.horror && horrorFilms.length > 0 && (
          <FilmRow
            title="Horror"
            films={horrorFilms.slice(0, 20)}
            href="/explore?type=FILM&genres=17"
          />
        )}
        {s.upcoming && awaitFilms.length > 0 && (
          <FilmRow title="Coming Soon" films={awaitFilms.slice(0, 20)} />
        )}
        {s.top250 && top250Films.length > 20 && (
          <FilmRow
            title="Critically Acclaimed"
            films={top250Films.slice(20, 40)}
            href="/top250"
          />
        )}
      </div>
    </div>
  );
}

// ─────────────────────────── Loading Skeleton ───────────────────────────
function HomeSkeleton() {
  return (
    <div className="min-h-screen animate-pulse">
      {/* Hero skeleton */}
      <div className="skeleton w-full h-[300px] sm:h-[480px] md:h-[680px] lg:h-[800px]" />

      {/* Row skeletons */}
      <div className="flex flex-col gap-10 sm:gap-14 px-[var(--page-x)] py-8 sm:py-12">
        {[0, 1, 2, 3].map((i) => (
          <div key={i}>
            <div className="skeleton h-[18px] sm:h-[20px] w-[140px] sm:w-[160px] rounded-[6px] mb-4 sm:mb-5" />
            {/* Scrollable card row */}
            <div className="flex gap-[10px] sm:gap-[14px] overflow-x-auto pb-2 scrollbar-hide">
              {Array.from({ length: 7 }).map((_, j) => (
                <div
                  key={j}
                  className="skeleton flex-shrink-0 rounded-[10px] sm:rounded-[12px]"
                  style={{ width: "130px", height: "195px" }}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
