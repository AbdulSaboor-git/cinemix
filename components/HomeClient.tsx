"use client";
// components/HomeClient.tsx
import { useEffect, useState } from "react";
import { getTopFilms, getFilmsByFilter, getPremieres } from "@/lib/kinopoisk";
import { Film } from "@/types/kinopoisk";
import HeroBanner from "@/components/HeroBanner";
import FilmRow from "@/components/FilmRow";
import NoKeyBanner from "@/components/ui/NoKeyBanner";
import { getPreferences, hasApiKeys, Preferences } from "@/lib/preferences";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";

const CURRENT_MONTH = new Date()
  .toLocaleString("en-US", { month: "long" })
  .toUpperCase();
const CURRENT_YEAR = new Date().getFullYear();

export default function HomeClient() {
  useDocumentTitle("Home");

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
  const [secondaryLoaded, setSecondaryLoaded] = useState(false);
  const [noKey, setNoKey] = useState(false);
  const [sections, setSections] = useState<Preferences["homeSections"] | null>(
    null,
  );

  useEffect(() => {
    if (!hasApiKeys()) {
      setNoKey(true);
      return;
    }

    let mounted = true;
    const prefs = getPreferences();
    const s = prefs.homeSections;
    setSections(s);

    // Stage 1: Load Hero + Trending + Top 250 first so the page renders immediately
    Promise.allSettled([
      s.popular ? getTopFilms("TOP_POPULAR_ALL") : Promise.resolve(null),
      s.top250 ? getTopFilms("TOP_250_MOVIES") : Promise.resolve(null),
    ]).then(([popular, top250]) => {
      if (!mounted) return;
      if (popular.status === "fulfilled" && popular.value) {
        setPopularFilms(popular.value.items);
      }
      if (top250.status === "fulfilled" && top250.value) {
        setTop250Films(top250.value.items);
      }
      setLoaded(true);

      // Stage 2: Load remaining rows progressively in the background
      Promise.allSettled([
        s.premieres
          ? getPremieres(CURRENT_YEAR, CURRENT_MONTH)
          : Promise.resolve(null),
        s.series
          ? getFilmsByFilter({
              type: "TV_SERIES",
              order: "RATING",
              ratingFrom: 7,
            })
          : Promise.resolve(null),
        s.action
          ? getFilmsByFilter({ genres: 11, order: "RATING", ratingFrom: 7 })
          : Promise.resolve(null),
        s.drama
          ? getFilmsByFilter({ genres: 2, order: "RATING", ratingFrom: 7 })
          : Promise.resolve(null),
        s.scifi
          ? getFilmsByFilter({ genres: 6, order: "RATING", ratingFrom: 7 })
          : Promise.resolve(null),
        s.upcoming ? getTopFilms("CLOSES_RELEASES") : Promise.resolve(null),
        s.comedy
          ? getFilmsByFilter({ genres: 13, order: "RATING", ratingFrom: 6 })
          : Promise.resolve(null),
        s.horror
          ? getFilmsByFilter({ genres: 17, order: "RATING", ratingFrom: 6 })
          : Promise.resolve(null),
      ]).then(
        ([
          premieres,
          series,
          action,
          drama,
          scifi,
          upcoming,
          comedy,
          horror,
        ]) => {
          if (!mounted) return;
          if (premieres.status === "fulfilled" && premieres.value) {
            setPremiereFilms(premieres.value.items);
          }
          if (series.status === "fulfilled" && series.value) {
            setSeriesFilms(series.value.items);
          }
          if (action.status === "fulfilled" && action.value) {
            setActionFilms(action.value.items);
          }
          if (drama.status === "fulfilled" && drama.value) {
            setDramaFilms(drama.value.items);
          }
          if (scifi.status === "fulfilled" && scifi.value) {
            setScifiFilms(scifi.value.items);
          }
          if (upcoming.status === "fulfilled" && upcoming.value) {
            setAwaitFilms(upcoming.value.items);
          }
          if (comedy.status === "fulfilled" && comedy.value) {
            setComedyFilms(comedy.value.items);
          }
          if (horror.status === "fulfilled" && horror.value) {
            setHorrorFilms(horror.value.items);
          }
          setSecondaryLoaded(true);
        },
      );
    });

    return () => {
      mounted = false;
    };
  }, []);

  if (noKey) return <NoKeyBanner />;
  if (!loaded) return <HomeSkeleton />;

  const s = sections!;

  const heroFilm =
    popularFilms.find((f) => f.coverUrl) ??
    popularFilms[0] ??
    top250Films.find((f) => f.coverUrl) ??
    top250Films[0] ??
    null;
  const secondHero =
    top250Films.find((f) => f.coverUrl && f !== heroFilm) ??
    top250Films[1] ??
    null;
  const thirdHero = awaitFilms.find((f) => f.coverUrl) ?? null;

  return (
    <div className="fade-in">
      {heroFilm && <HeroBanner film={heroFilm} />}

      <div className="relative z-[2] pt-6 sm:pt-8">
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
          <FilmRow
            title="New This Month"
            films={premiereFilms.slice(0, 20)}
            href="/premieres"
          />
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
            href="/explore?type=FILM&genres=11"
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
            title="Sci-Fi & Fantasy"
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
          <FilmRow
            title="Coming Soon"
            films={awaitFilms.slice(0, 20)}
            href="/explore?order=YEAR"
          />
        )}
        {s.top250 && top250Films.length > 20 && (
          <FilmRow
            title="Critically Acclaimed"
            films={top250Films.slice(20, 40)}
            href="/top250"
          />
        )}

        {!secondaryLoaded && (
          <div className="px-[var(--page-x)] py-4">
            <div className="skeleton h-[20px] w-[160px] rounded-[6px] mb-4" />
            <div className="flex gap-[14px] overflow-x-auto pb-2 scrollbar-none">
              {Array.from({ length: 6 }).map((_, j) => (
                <div
                  key={j}
                  className="skeleton flex-shrink-0 rounded-[12px] w-[130px] h-[195px] sm:w-[175px] sm:h-[263px]"
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function HomeSkeleton() {
  return (
    <div className="min-h-screen animate-pulse">
      <div className="skeleton w-full h-[360px] sm:h-[480px] md:h-[600px] lg:h-[800px]" />
      <div className="flex flex-col gap-10 sm:gap-14 px-[var(--page-x)] py-8 sm:py-12">
        {[0, 1, 2].map((i) => (
          <div key={i}>
            <div className="skeleton h-[18px] sm:h-[20px] w-[140px] sm:w-[160px] rounded-[6px] mb-4 sm:mb-5" />
            <div className="flex gap-[10px] sm:gap-[14px] overflow-x-auto pb-2 scrollbar-hide">
              {Array.from({ length: 7 }).map((_, j) => (
                <div
                  key={j}
                  className="skeleton flex-shrink-0 rounded-[10px] sm:rounded-[12px] w-[130px] h-[195px] sm:w-[175px] sm:h-[263px]"
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
