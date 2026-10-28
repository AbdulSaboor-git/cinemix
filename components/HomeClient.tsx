"use client";
// components/HomeClient.tsx
import { useEffect, useState, useCallback } from "react";
import {
  getTopFilms,
  getPremieres,
  getUpcomingPremieres,
  getCuratedHomeSection,
  discoverTasteMatchedFilms,
  isRussianDomesticFilm,
  deduplicateFilms,
  hydrateFilmWithCache,
  queueFilmMetaHydration,
} from "@/lib/kinopoisk";
import { Film } from "@/types/kinopoisk";
import HeroBanner from "@/components/HeroBanner";
import FilmRow from "@/components/FilmRow";
import NoKeyBanner from "@/components/ui/NoKeyBanner";
import { getPreferences, hasApiKeys, Preferences } from "@/lib/preferences";
import { getList } from "@/lib/userLists";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { SESSION_KEY } from "@/lib/session";

const NOW = new Date();
const CURRENT_MONTH = NOW.toLocaleString("en-US", {
  month: "long",
}).toUpperCase();
const CURRENT_YEAR = NOW.getFullYear();

const NEXT_MONTH_DATE = new Date(CURRENT_YEAR, NOW.getMonth() + 1, 1);
const NEXT_MONTH = NEXT_MONTH_DATE.toLocaleString("en-US", {
  month: "long",
}).toUpperCase();
const NEXT_MONTH_YEAR = NEXT_MONTH_DATE.getFullYear();

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

  // Personalized rows (Watch Later + unified "For You", no "Recently Watched")
  const [watchLaterFilms, setWatchLaterFilms] = useState<Film[]>([]);
  const [forYouFilms, setForYouFilms] = useState<Film[]>([]);

  const [loaded, setLoaded] = useState(false);
  const [secondaryLoaded, setSecondaryLoaded] = useState(false);
  const [noKey, setNoKey] = useState(false);
  const [sections, setSections] = useState<Preferences["homeSections"] | null>(
    null,
  );

  // Sync Watch Later & For You recommendations reactively whenever user lists change
  const syncPersonalRows = useCallback(() => {
    const wl = getList("watchlater").slice(0, 15);
    const hydratedWL = wl.map((e) => {
      const item = hydrateFilmWithCache({
        kinopoiskId: e.film_id,
        filmId: e.film_id,
        nameEn: e.film_name,
        nameRu: e.film_name,
        posterUrl: e.poster_url || "",
        posterUrlPreview: e.poster_url || "",
        year: e.year ?? undefined,
        ratingKinopoisk: e.rating ?? undefined,
      });
      if (!item.year || !item.genres || item.genres.length === 0) {
        queueFilmMetaHydration(e.film_id, true);
      }
      return item;
    });
    setWatchLaterFilms(hydratedWL);

    if (hasApiKeys()) {
      discoverTasteMatchedFilms({ lens: "FOR_YOU", hideWatched: true }, 1)
        .then((res) => {
          if (res.items && res.items.length > 0) {
            setForYouFilms(res.items.slice(0, 20));
          }
        })
        .catch(() => {});
    }
  }, []);

  useEffect(() => {
    syncPersonalRows();
    const onStorage = (e: StorageEvent) => {
      if (!e.key || e.key === SESSION_KEY) syncPersonalRows();
    };
    const onMetaUpdated = () => {
      const wl = getList("watchlater").slice(0, 15);
      setWatchLaterFilms(
        wl.map((e) =>
          hydrateFilmWithCache({
            kinopoiskId: e.film_id,
            filmId: e.film_id,
            nameEn: e.film_name,
            nameRu: e.film_name,
            posterUrl: e.poster_url || "",
            posterUrlPreview: e.poster_url || "",
            year: e.year ?? undefined,
            ratingKinopoisk: e.rating ?? undefined,
          }),
        ),
      );
      setForYouFilms((prev) => prev.map((f) => hydrateFilmWithCache(f)));
    };

    window.addEventListener("cinemix-session-change", syncPersonalRows);
    window.addEventListener("storage", onStorage);
    window.addEventListener("cinemix-meta-updated", onMetaUpdated);
    return () => {
      window.removeEventListener("cinemix-session-change", syncPersonalRows);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("cinemix-meta-updated", onMetaUpdated);
    };
  }, [syncPersonalRows]);

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
        s.upcoming ? getUpcomingPremieres() : Promise.resolve(null),
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

          let shownPremiereIds = new Set<number>();
          if (premieres.status === "fulfilled" && premieres.value) {
            // Exclude old theatrical re-releases from "New This Month"
            const pItems = premieres.value.items.filter((f) => {
              const yr = f.year ?? f.startYear;
              return !yr || yr >= CURRENT_YEAR;
            });
            const globalP = pItems.filter((f) => !isRussianDomesticFilm(f));
            const domesticP = pItems.filter((f) => isRussianDomesticFilm(f));
            const finalP =
              regionMode === "GLOBAL_FIRST"
                ? globalP.length >= 6
                  ? globalP
                  : [...globalP, ...domesticP]
                : pItems;
            setPremiereFilms(finalP);
            shownPremiereIds = new Set(
              finalP
                .slice(0, 10)
                .map((f) => f.kinopoiskId ?? f.filmId ?? 0)
                .filter(Boolean),
            );
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
            const uItems = upcoming.value.items.filter((f) => {
              const yr = f.year ?? f.startYear;
              return !yr || yr >= CURRENT_YEAR;
            });
            const globalU = uItems.filter((f) => !isRussianDomesticFilm(f));
            const domesticU = uItems.filter((f) => isRussianDomesticFilm(f));
            const regionCuratedU =
              regionMode === "GLOBAL_FIRST"
                ? globalU.length >= 6
                  ? globalU
                  : [...globalU, ...domesticU]
                : uItems;

            // Avoid duplicating the first cards already shown in "New This Month" when plenty of upcoming premieres exist
            const deduplicatedAgainstCurrent = regionCuratedU.filter(
              (f) => !shownPremiereIds.has(f.kinopoiskId ?? f.filmId ?? 0),
            );
            setAwaitFilms(
              deduplicatedAgainstCurrent.length >= 8
                ? deduplicatedAgainstCurrent
                : regionCuratedU,
            );
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

  // Curate 5 daily-rotating spotlight slides seeded by today's date (changes automatically every day)
  const heroPool = deduplicateFilms([
    ...popularFilms,
    ...top250Films,
    ...premiereFilms,
    ...scifiFilms,
    ...actionFilms,
  ]).filter((f) => !isRussianDomesticFilm(f));
  const heroWithCovers = heroPool.filter((f) => f.coverUrl);
  const candidateSlides =
    heroWithCovers.length >= 5 ? heroWithCovers : heroPool;

  const dayKey = new Date().toISOString().slice(0, 10);
  let daySeed = 0;
  for (let i = 0; i < dayKey.length; i++) {
    daySeed = (daySeed * 31 + dayKey.charCodeAt(i)) % 1000003;
  }
  const rotatedCandidates = [...candidateSlides];
  if (rotatedCandidates.length > 5) {
    let seed = daySeed + 17;
    for (let i = rotatedCandidates.length - 1; i > 0; i--) {
      seed = (seed * 16807) % 2147483647;
      const j = seed % (i + 1);
      [rotatedCandidates[i], rotatedCandidates[j]] = [
        rotatedCandidates[j],
        rotatedCandidates[i],
      ];
    }
  }
  const heroSlides = rotatedCandidates.slice(0, 5);

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

      <div className="relative z-[2] pt-5 sm:pt-8">
        {/* {watchLaterFilms.length > 0 && (
          <FilmRow
            title="From Your Watch Later"
            films={watchLaterFilms}
            href="/profile/watchlater"
          />
        )} */}

        {s.popular && popularFilms.length > 0 && (
          <FilmRow
            title="Trending Blockbusters"
            films={popularFilms.slice(0, 20)}
            href="/explore?type=FILM&order=NUM_VOTE"
          />
        )}
        {forYouFilms.length > 0 && (
          <FilmRow
            title="For You"
            films={forYouFilms}
            href="/explore?lens=FOR_YOU"
          />
        )}
        {s.top250 && top250Films.length > 0 && (
          <FilmRow
            title="Top 250 — All Time Greats"
            films={top250Films.slice(0, 20)}
            href="/top250"
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
          <div className="my-5 sm:my-8">
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
          <div className="my-5 sm:my-8">
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
            href={`/premieres?year=${NEXT_MONTH_YEAR}&month=${NEXT_MONTH}`}
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
            <div className="flex gap-[12px] sm:gap-[14px] overflow-x-auto pb-2 scrollbar-none">
              {Array.from({ length: 6 }).map((_, j) => (
                <div
                  key={j}
                  className="skeleton flex-shrink-0 rounded-[12px] w-[126px] h-[189px] sm:w-[175px] sm:h-[263px]"
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
      <div className="skeleton w-full h-[350px] sm:h-[480px] md:h-[600px] lg:h-[760px]" />
      <div className="flex flex-col gap-8 sm:gap-14 px-[var(--page-x)] py-6 sm:py-12">
        {[0, 1, 2].map((i) => (
          <div key={i}>
            <div className="skeleton h-[18px] sm:h-[20px] w-[140px] sm:w-[160px] rounded-[6px] mb-3.5 sm:mb-5" />
            <div className="flex gap-[10px] sm:gap-[14px] overflow-x-auto pb-2 scrollbar-hide">
              {Array.from({ length: 7 }).map((_, j) => (
                <div
                  key={j}
                  className="skeleton flex-shrink-0 rounded-[10px] sm:rounded-[12px] w-[126px] h-[189px] sm:w-[175px] sm:h-[263px]"
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
