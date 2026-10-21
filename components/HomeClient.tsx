"use client";
// components/HomeClient.tsx
import { useEffect, useState } from "react";
import {
  getTopFilms,
  getPremieres,
  getCuratedHomeSection,
  getSimilarFilms,
  isRussianDomesticFilm,
  deduplicateFilms,
  getCachedFilmMeta,
} from "@/lib/kinopoisk";
import { Film } from "@/types/kinopoisk";
import HeroBanner from "@/components/HeroBanner";
import FilmRow from "@/components/FilmRow";
import NoKeyBanner from "@/components/ui/NoKeyBanner";
import { getPreferences, hasApiKeys, Preferences } from "@/lib/preferences";
import { getList } from "@/lib/userLists";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { SESSION_KEY } from "@/lib/session";

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

  // Personalized rows
  const [recentHistoryFilms, setRecentHistoryFilms] = useState<Film[]>([]);
  const [watchLaterFilms, setWatchLaterFilms] = useState<Film[]>([]);
  const [becauseYouWatched, setBecauseYouWatched] = useState<{
    seedTitle: string;
    items: Film[];
  } | null>(null);

  const [loaded, setLoaded] = useState(false);
  const [secondaryLoaded, setSecondaryLoaded] = useState(false);
  const [noKey, setNoKey] = useState(false);
  const [sections, setSections] = useState<Preferences["homeSections"] | null>(
    null,
  );

  // Sync personal lists (Continue Watching & Watch Later) reactively
  useEffect(() => {
    const syncLists = () => {
      const hist = getList("history").slice(0, 15);
      const wl = getList("watchlater").slice(0, 15);

      setRecentHistoryFilms(
        hist.map((e) => {
          const cached = getCachedFilmMeta(e.film_id);
          return {
            ...cached,
            kinopoiskId: e.film_id,
            filmId: e.film_id,
            nameEn: e.film_name || cached?.nameEn,
            nameRu: e.film_name || cached?.nameRu,
            posterUrl: e.poster_url || cached?.posterUrl || "",
            posterUrlPreview: e.poster_url || cached?.posterUrlPreview || "",
            year: e.year ?? cached?.year,
            ratingKinopoisk: e.rating ?? cached?.ratingKinopoisk,
          };
        }),
      );

      setWatchLaterFilms(
        wl.map((e) => {
          const cached = getCachedFilmMeta(e.film_id);
          return {
            ...cached,
            kinopoiskId: e.film_id,
            filmId: e.film_id,
            nameEn: e.film_name || cached?.nameEn,
            nameRu: e.film_name || cached?.nameRu,
            posterUrl: e.poster_url || cached?.posterUrl || "",
            posterUrlPreview: e.poster_url || cached?.posterUrlPreview || "",
            year: e.year ?? cached?.year,
            ratingKinopoisk: e.rating ?? cached?.ratingKinopoisk,
          };
        }),
      );
    };

    syncLists();
    const onStorage = (e: StorageEvent) => {
      if (!e.key || e.key === SESSION_KEY) syncLists();
    };
    window.addEventListener("cinemix-session-change", syncLists);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("cinemix-session-change", syncLists);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  useEffect(() => {
    if (!hasApiKeys()) {
      setNoKey(true);
      return;
    }

    let mounted = true;
    const prefs = getPreferences();
    const s = prefs.homeSections;
    const regionMode = prefs.contentRegionMode ?? "GLOBAL_FIRST";
    setSections(s);

    // Stage 1: Load Hollywood/Global Trending + Top 250 first so the page renders immediately
    Promise.allSettled([
      s.popular
        ? getCuratedHomeSection({
            collection: "TOP_POPULAR_MOVIES",
            type: "FILM",
            ratingFrom: 6.8,
          })
        : Promise.resolve(null),
      s.top250 ? getTopFilms("TOP_250_MOVIES") : Promise.resolve(null),
    ]).then(([popular, top250]) => {
      if (!mounted) return;
      if (popular.status === "fulfilled" && popular.value) {
        setPopularFilms(popular.value);
      }
      if (top250.status === "fulfilled" && top250.value) {
        const rawTop = top250.value.items;
        setTop250Films(
          regionMode === "GLOBAL_FIRST"
            ? rawTop.filter((f) => !isRussianDomesticFilm(f))
            : rawTop,
        );
      }
      setLoaded(true);

      // Personalized "Because You Watched / Loved" row
      const seedEntry = getList("history")[0] ?? getList("favorites")[0];
      if (seedEntry) {
        getSimilarFilms(seedEntry.film_id)
          .then((sim) => {
            if (!mounted || !sim.items?.length) return;
            const mapped: Film[] = sim.items.slice(0, 16).map((sf) => {
              const cached = getCachedFilmMeta(sf.filmId);
              return {
                ...cached,
                kinopoiskId: sf.filmId,
                filmId: sf.filmId,
                nameRu: sf.nameRu ?? cached?.nameRu,
                nameEn: sf.nameEn ?? cached?.nameEn,
                nameOriginal: sf.nameOriginal ?? cached?.nameOriginal,
                posterUrl: sf.posterUrl || cached?.posterUrl || "",
                posterUrlPreview:
                  sf.posterUrlPreview || cached?.posterUrlPreview || "",
              };
            });
            setBecauseYouWatched({
              seedTitle: seedEntry.film_name,
              items: mapped,
            });
          })
          .catch(() => {});
      }

      // Stage 2: Load remaining Hollywood/Global-curated rows progressively
      Promise.allSettled([
        s.premieres
          ? getPremieres(CURRENT_YEAR, CURRENT_MONTH)
          : Promise.resolve(null),
        s.series
          ? getCuratedHomeSection({ type: "TV_SERIES", ratingFrom: 7.2 })
          : Promise.resolve(null),
        s.action
          ? getCuratedHomeSection({
              type: "FILM",
              genreId: 11,
              ratingFrom: 6.8,
            })
          : Promise.resolve(null),
        s.drama
          ? getCuratedHomeSection({
              type: "FILM",
              genreId: 2,
              ratingFrom: 7.0,
            })
          : Promise.resolve(null),
        s.scifi
          ? getCuratedHomeSection({
              type: "FILM",
              genreId: 6,
              ratingFrom: 6.8,
            })
          : Promise.resolve(null),
        s.upcoming ? getTopFilms("CLOSES_RELEASES") : Promise.resolve(null),
        s.comedy
          ? getCuratedHomeSection({
              type: "FILM",
              genreId: 13,
              ratingFrom: 6.5,
            })
          : Promise.resolve(null),
        s.horror
          ? getCuratedHomeSection({
              type: "FILM",
              genreId: 17,
              ratingFrom: 6.2,
            })
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
            const pItems = premieres.value.items;
            const filteredP =
              regionMode === "GLOBAL_FIRST"
                ? pItems.filter((f) => !isRussianDomesticFilm(f))
                : pItems;
            setPremiereFilms(filteredP.length >= 6 ? filteredP : pItems);
          }
          if (series.status === "fulfilled" && series.value) {
            setSeriesFilms(series.value);
          }
          if (action.status === "fulfilled" && action.value) {
            setActionFilms(action.value);
          }
          if (drama.status === "fulfilled" && drama.value) {
            setDramaFilms(drama.value);
          }
          if (scifi.status === "fulfilled" && scifi.value) {
            setScifiFilms(scifi.value);
          }
          if (upcoming.status === "fulfilled" && upcoming.value) {
            const uItems = upcoming.value.items;
            const filteredU =
              regionMode === "GLOBAL_FIRST"
                ? uItems.filter((f) => !isRussianDomesticFilm(f))
                : uItems;
            setAwaitFilms(filteredU.length >= 6 ? filteredU : uItems);
          }
          if (comedy.status === "fulfilled" && comedy.value) {
            setComedyFilms(comedy.value);
          }
          if (horror.status === "fulfilled" && horror.value) {
            setHorrorFilms(horror.value);
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

  // Curate 5 high-impact global spotlight slides for the top Hero Carousel
  const heroPool = deduplicateFilms([...popularFilms, ...top250Films]).filter(
    (f) => !isRussianDomesticFilm(f),
  );
  const heroWithCovers = heroPool.filter((f) => f.coverUrl);
  const heroSlides =
    heroWithCovers.length >= 3
      ? heroWithCovers.slice(0, 5)
      : heroPool.slice(0, 5);

  const secondHero =
    top250Films.find(
      (f) =>
        f.coverUrl && !heroSlides.some((h) => h.kinopoiskId === f.kinopoiskId),
    ) ??
    top250Films[5] ??
    null;
  const thirdHero =
    awaitFilms.find((f) => f.coverUrl && !isRussianDomesticFilm(f)) ??
    scifiFilms.find((f) => f.coverUrl) ??
    null;

  return (
    <div className="fade-in">
      {heroSlides.length > 0 && <HeroBanner films={heroSlides} />}

      <div className="relative z-[2] pt-6 sm:pt-8">
        {recentHistoryFilms.length > 0 && (
          <FilmRow
            title="Recently Watched"
            films={recentHistoryFilms}
            href="/profile/history"
          />
        )}

        {watchLaterFilms.length > 0 && (
          <FilmRow
            title="From Your Watch Later"
            films={watchLaterFilms}
            href="/profile/watchlater"
          />
        )}

        {becauseYouWatched && becauseYouWatched.items.length > 0 && (
          <FilmRow
            title={`Because You Watched “${becauseYouWatched.seedTitle}”`}
            films={becauseYouWatched.items}
            href="/explore?lens=FOR_YOU"
          />
        )}

        {s.popular && popularFilms.length > 0 && (
          <FilmRow
            title="Trending Blockbusters"
            films={popularFilms.slice(0, 20)}
            href="/explore?type=FILM&order=NUM_VOTE"
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
            title="Popular Global Series"
            films={seriesFilms.slice(0, 20)}
            href="/explore?type=TV_SERIES&order=NUM_VOTE"
          />
        )}
        {s.action && actionFilms.length > 0 && (
          <FilmRow
            title="Action & Adventure"
            films={actionFilms.slice(0, 20)}
            href="/explore?type=FILM&genres=11&order=NUM_VOTE"
          />
        )}

        {secondHero && (
          <div className="my-6 sm:my-8">
            <HeroBanner film={secondHero} />
          </div>
        )}

        {s.drama && dramaFilms.length > 0 && (
          <FilmRow
            title="Acclaimed Drama"
            films={dramaFilms.slice(0, 20)}
            href="/explore?type=FILM&genres=2&order=NUM_VOTE"
          />
        )}
        {s.scifi && scifiFilms.length > 0 && (
          <FilmRow
            title="Sci-Fi & Fantasy"
            films={scifiFilms.slice(0, 20)}
            href="/explore?type=FILM&genres=6&order=NUM_VOTE"
          />
        )}
        {s.comedy && comedyFilms.length > 0 && (
          <FilmRow
            title="Hit Comedies"
            films={comedyFilms.slice(0, 20)}
            href="/explore?type=FILM&genres=13&order=NUM_VOTE"
          />
        )}

        {thirdHero && (
          <div className="my-6 sm:my-8">
            <HeroBanner film={thirdHero} />
          </div>
        )}

        {s.horror && horrorFilms.length > 0 && (
          <FilmRow
            title="Horror & Suspense"
            films={horrorFilms.slice(0, 20)}
            href="/explore?type=FILM&genres=17&order=NUM_VOTE"
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
