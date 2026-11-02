"use client";
// components/HomeClient.tsx
import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import {
  getTopFilms,
  getPremieres,
  getRecentReleases,
  getUpcomingPremieres,
  getCuratedHomeSection,
  discoverTasteMatchedFilms,
  isRussianDomesticFilm,
  deduplicateFilms,
  hydrateFilmWithCache,
  queueFilmMetaHydration,
  verifyApiKeys,
} from "@/lib/kinopoisk";
import { Film } from "@/types/kinopoisk";
import HeroBanner from "@/components/HeroBanner";
import FilmRow from "@/components/FilmRow";
import NoKeyBanner from "@/components/ui/NoKeyBanner";
import {
  getPreferences,
  hasApiKeys,
  hasVerifiedApiKey,
  Preferences,
} from "@/lib/preferences";
import { getList } from "@/lib/userLists";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";

const NOW = new Date();
const CURRENT_MONTH = NOW.toLocaleString("en-US", {
  month: "long",
}).toUpperCase();
const CURRENT_YEAR = NOW.getFullYear();

// ── In-memory snapshot so navigating back to Home via bottom navbar is 0ms instant ──
interface HomeSnapshot {
  timestamp: number;
  sections: Preferences["homeSections"];
  popularFilms: Film[];
  top250Films: Film[];
  recentReleaseFilms: Film[];
  premiereFilms: Film[];
  seriesFilms: Film[];
  actionFilms: Film[];
  dramaFilms: Film[];
  scifiFilms: Film[];
  awaitFilms: Film[];
  comedyFilms: Film[];
  horrorFilms: Film[];
  forYouFilms: Film[];
  watchLaterFilms: Film[];
  secondaryLoaded: boolean;
}

const SNAPSHOT_TTL_MS = 5 * 60 * 1000; // 5 minutes
let homeCache: HomeSnapshot | null = null;

if (typeof window !== "undefined") {
  window.addEventListener("cinemix-cache-clear", () => {
    homeCache = null;
  });
}

/**
 * Mounts heavy below-the-fold FilmRows only when the user scrolls within 350px of them.
 */
function LazySection({
  children,
  minHeight = 260,
}: {
  children: React.ReactNode;
  minHeight?: number;
}) {
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || visible) return;

    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          io.disconnect();
        }
      },
      { rootMargin: "350px 0px" },
    );

    io.observe(el);
    return () => io.disconnect();
  }, [visible]);

  return (
    <div ref={ref} style={{ minHeight: visible ? undefined : minHeight }}>
      {visible ? children : null}
    </div>
  );
}

export default function HomeClient() {
  useDocumentTitle("Home");

  const [popularFilms, setPopularFilms] = useState<Film[]>([]);
  const [top250Films, setTop250Films] = useState<Film[]>([]);
  const [recentReleaseFilms, setRecentReleaseFilms] = useState<Film[]>([]);
  const [seriesFilms, setSeriesFilms] = useState<Film[]>([]);
  const [actionFilms, setActionFilms] = useState<Film[]>([]);
  const [dramaFilms, setDramaFilms] = useState<Film[]>([]);
  const [scifiFilms, setScifiFilms] = useState<Film[]>([]);
  const [awaitFilms, setAwaitFilms] = useState<Film[]>([]);
  const [comedyFilms, setComedyFilms] = useState<Film[]>([]);
  const [horrorFilms, setHorrorFilms] = useState<Film[]>([]);
  const [premiereFilms, setPremiereFilms] = useState<Film[]>([]);

  // Personalized rows (Bug #6 Fixed: watchLaterFilms state is bound and rendered!)
  const [watchLaterFilms, setWatchLaterFilms] = useState<Film[]>([]);
  const [forYouFilms, setForYouFilms] = useState<Film[]>([]);
  const [forYouLoading, setForYouLoading] = useState(false);
  const forYouRequestRef = useRef(0);
  const fetchTimestampRef = useRef<number>(homeCache?.timestamp ?? Date.now());

  const [loaded, setLoaded] = useState<boolean>(false);
  const [secondaryLoaded, setSecondaryLoaded] = useState<boolean>(false);
  const [noKey, setNoKey] = useState(false);
  const [keyEpoch, setKeyEpoch] = useState(0);
  const [sections, setSections] = useState<Preferences["homeSections"] | null>(
    null,
  );

  // Bug #3 Fixed: Uses fetchTimestampRef (refreshed whenever network data is fetched)
  // so expired timestamps are never preserved across fresh reloads.
  useEffect(() => {
    if (!loaded || !sections || noKey || !hasApiKeys()) return;
    homeCache = {
      timestamp: fetchTimestampRef.current,
      sections,
      popularFilms,
      top250Films,
      recentReleaseFilms,
      premiereFilms,
      seriesFilms,
      actionFilms,
      dramaFilms,
      scifiFilms,
      awaitFilms,
      comedyFilms,
      horrorFilms,
      forYouFilms,
      watchLaterFilms,
      secondaryLoaded,
    };
  }, [
    loaded,
    sections,
    noKey,
    popularFilms,
    top250Films,
    recentReleaseFilms,
    premiereFilms,
    seriesFilms,
    actionFilms,
    dramaFilms,
    scifiFilms,
    awaitFilms,
    comedyFilms,
    horrorFilms,
    forYouFilms,
    watchLaterFilms,
    secondaryLoaded,
  ]);

  const syncPersonalRows = useCallback(() => {
    if (!hasApiKeys()) {
      homeCache = null;
      setNoKey(true);
      setLoaded(false);
      setForYouFilms([]);
      setWatchLaterFilms([]);
      setForYouLoading(false);
      return;
    }

    const requestId = ++forYouRequestRef.current;
    setForYouLoading(true);
    verifyApiKeys()
      .then((valid) => {
        if (requestId !== forYouRequestRef.current) return;
        if (!valid || !hasApiKeys()) {
          homeCache = null;
          setNoKey(true);
          setLoaded(false);
          setForYouFilms([]);
          setWatchLaterFilms([]);
          setForYouLoading(false);
          return;
        }

        const wl = getList("watchlater").slice(0, 15);
        const hydratedWL = wl.map((e, idx) => {
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
          if (
            idx < 6 &&
            (!item.year || !item.genres || item.genres.length === 0)
          ) {
            queueFilmMetaHydration(e.film_id, false);
          }
          return item;
        });
        setWatchLaterFilms(hydratedWL);

        return discoverTasteMatchedFilms(
          { lens: "FOR_YOU", hideWatched: true },
          1,
        ).then((res) => {
          if (requestId === forYouRequestRef.current) {
            if (!hasApiKeys()) {
              setNoKey(true);
              setForYouFilms([]);
            } else {
              setForYouFilms(res.items.slice(0, 20));
            }
          }
        });
      })
      .catch(() => {
        if (requestId === forYouRequestRef.current) {
          setForYouFilms([]);
          if (!hasApiKeys()) {
            homeCache = null;
            setNoKey(true);
            setLoaded(false);
          }
        }
      })
      .finally(() => {
        if (requestId === forYouRequestRef.current) {
          setForYouLoading(false);
        }
      });
  }, []);

  useEffect(() => {
    const validSnap =
      hasVerifiedApiKey() &&
      homeCache !== null &&
      Date.now() - homeCache.timestamp < SNAPSHOT_TTL_MS
        ? homeCache
        : null;
    if (!validSnap || validSnap.forYouFilms.length === 0) {
      syncPersonalRows();
    }

    let metaDebounceTimer: ReturnType<typeof setTimeout> | null = null;

    const onSessionOrStorage = () => {
      if (!hasApiKeys()) {
        homeCache = null;
        setNoKey(true);
        setLoaded(false);
        setForYouFilms([]);
        setWatchLaterFilms([]);
        setForYouLoading(false);
      } else {
        setNoKey((prev) => {
          if (prev) setKeyEpoch((e) => e + 1);
          return false;
        });
        syncPersonalRows();
      }
    };

    const onMetaUpdated = () => {
      if (!hasApiKeys()) return;
      if (metaDebounceTimer) clearTimeout(metaDebounceTimer);
      metaDebounceTimer = setTimeout(() => {
        setForYouFilms((prev) =>
          prev.length > 0 ? prev.map((f) => hydrateFilmWithCache(f)) : prev,
        );
        setWatchLaterFilms((prev) =>
          prev.length > 0 ? prev.map((f) => hydrateFilmWithCache(f)) : prev,
        );
      }, 300);
    };

    window.addEventListener("cinemix-session-change", onSessionOrStorage);
    window.addEventListener("storage", onSessionOrStorage);
    window.addEventListener("cinemix-meta-updated", onMetaUpdated);
    return () => {
      if (metaDebounceTimer) clearTimeout(metaDebounceTimer);
      window.removeEventListener("cinemix-session-change", onSessionOrStorage);
      window.removeEventListener("storage", onSessionOrStorage);
      window.removeEventListener("cinemix-meta-updated", onMetaUpdated);
    };
  }, [syncPersonalRows]);

  useEffect(() => {
    if (!hasApiKeys()) {
      homeCache = null;
      setNoKey(true);
      setLoaded(false);
      return;
    }

    setNoKey(false);
    const prefs = getPreferences();
    const s = prefs.homeSections;
    const regionMode = prefs.contentRegionMode ?? "GLOBAL_FIRST";
    setSections(s);

    const validSnap =
      hasVerifiedApiKey() &&
      homeCache !== null &&
      Date.now() - homeCache.timestamp < SNAPSHOT_TTL_MS
        ? homeCache
        : null;

    if (validSnap) {
      fetchTimestampRef.current = validSnap.timestamp;
      setPopularFilms(validSnap.popularFilms);
      setTop250Films(validSnap.top250Films);
      setRecentReleaseFilms(validSnap.recentReleaseFilms ?? []);
      setPremiereFilms(validSnap.premiereFilms);
      setSeriesFilms(validSnap.seriesFilms);
      setActionFilms(validSnap.actionFilms);
      setDramaFilms(validSnap.dramaFilms);
      setScifiFilms(validSnap.scifiFilms);
      setAwaitFilms(validSnap.awaitFilms);
      setComedyFilms(validSnap.comedyFilms);
      setHorrorFilms(validSnap.horrorFilms);
      setForYouFilms(validSnap.forYouFilms);
      setWatchLaterFilms(validSnap.watchLaterFilms ?? []);
      setSecondaryLoaded(validSnap.secondaryLoaded);
      setLoaded(true);
      if (validSnap.secondaryLoaded) {
        return;
      }
    }

    let mounted = true;
    let stage2Timer: ReturnType<typeof setTimeout> | null = null;

    verifyApiKeys().then((keyOk) => {
      if (!mounted) return;
      if (!keyOk || !hasApiKeys()) {
        homeCache = null;
        setNoKey(true);
        setLoaded(false);
        return;
      }

      // Stage 1 (High Priority): Above-the-Fold (Popular + Top 250)
      Promise.allSettled([
        s.popular
          ? getCuratedHomeSection(
              {
                collection: "TOP_POPULAR_MOVIES",
                type: "FILM",
                ratingFrom: 6.8,
              },
              "high",
            )
          : Promise.resolve(null),
        s.top250
          ? getTopFilms("TOP_250_MOVIES", 1, "high")
          : Promise.resolve(null),
      ]).then(([popular, top250]) => {
        if (!mounted) return;
        if (!hasApiKeys()) {
          homeCache = null;
          setNoKey(true);
          setLoaded(false);
          return;
        }
        // Bug #3 Fixed: Always refresh fetchTimestampRef to Date.now() when fresh data arrives
        fetchTimestampRef.current = Date.now();

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

        // Stage 2 runs in LOW priority so navigating to Explore / Top 250 / Premieres preempts it in 0ms!
        stage2Timer = setTimeout(() => {
          if (!mounted) return;

          Promise.allSettled([
            s.recentReleases
              ? getRecentReleases("low")
              : Promise.resolve(null),
            s.premieres
              ? getPremieres(CURRENT_YEAR, CURRENT_MONTH, "low")
              : Promise.resolve(null),
            s.series
              ? getCuratedHomeSection(
                  { type: "TV_SERIES", ratingFrom: 7.2 },
                  "low",
                )
              : Promise.resolve(null),
            s.action
              ? getCuratedHomeSection(
                  {
                    type: "FILM",
                    genreId: 11,
                    ratingFrom: 6.8,
                  },
                  "low",
                )
              : Promise.resolve(null),
            s.drama
              ? getCuratedHomeSection(
                  {
                    type: "FILM",
                    genreId: 2,
                    ratingFrom: 7.0,
                  },
                  "low",
                )
              : Promise.resolve(null),
            s.scifi
              ? getCuratedHomeSection(
                  {
                    type: "FILM",
                    genreId: 6,
                    ratingFrom: 6.8,
                  },
                  "low",
                )
              : Promise.resolve(null),
            s.upcoming ? getUpcomingPremieres("low") : Promise.resolve(null),
            s.comedy
              ? getCuratedHomeSection(
                  {
                    type: "FILM",
                    genreId: 13,
                    ratingFrom: 6.5,
                  },
                  "low",
                )
              : Promise.resolve(null),
            s.horror
              ? getCuratedHomeSection(
                  {
                    type: "FILM",
                    genreId: 17,
                    ratingFrom: 6.2,
                  },
                  "low",
                )
              : Promise.resolve(null),
          ]).then(
            ([
              recentReleases,
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
              fetchTimestampRef.current = Date.now();
              const todayStr = new Date().toISOString().slice(0, 10);

              if (
                recentReleases.status === "fulfilled" &&
                recentReleases.value
              ) {
                const rItems = recentReleases.value.items;
                const globalR = rItems.filter((f) => !isRussianDomesticFilm(f));
                const domesticR = rItems.filter((f) =>
                  isRussianDomesticFilm(f),
                );
                const finalR =
                  regionMode === "GLOBAL_FIRST"
                    ? globalR.length >= 6
                      ? globalR
                      : [...globalR, ...domesticR]
                    : rItems;
                setRecentReleaseFilms(finalR);
              }

              let shownPremiereIds = new Set<number>();
              if (premieres.status === "fulfilled" && premieres.value) {
                // Exclude unreleased future dates (`premiereRu > todayStr`) from "New This Month"
                const pItems = premieres.value.items.filter((f) => {
                  const yr = f.year ?? f.startYear;
                  if (yr && yr < CURRENT_YEAR) return false;
                  if (f.premiereRu && f.premiereRu.slice(0, 10) > todayStr) {
                    return false;
                  }
                  return true;
                });
                const globalP = pItems.filter((f) => !isRussianDomesticFilm(f));
                const domesticP = pItems.filter((f) =>
                  isRussianDomesticFilm(f),
                );
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
                const domesticU = uItems.filter((f) =>
                  isRussianDomesticFilm(f),
                );
                const regionCuratedU =
                  regionMode === "GLOBAL_FIRST"
                    ? globalU.length >= 6
                      ? globalU
                      : [...globalU, ...domesticU]
                    : uItems;

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
        }, 150);
      });
    });

    return () => {
      mounted = false;
      if (stage2Timer) clearTimeout(stage2Timer);
    };
  }, [keyEpoch]);

  const heroSlides = useMemo(() => {
    const heroPool = deduplicateFilms([...popularFilms, ...top250Films]).filter(
      (f) => !isRussianDomesticFilm(f),
    );
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
    return rotatedCandidates.slice(0, 5);
  }, [popularFilms, top250Films]);

  const secondHero = useMemo(
    () =>
      top250Films.find(
        (f) =>
          f.coverUrl &&
          !heroSlides.some((h) => h.kinopoiskId === f.kinopoiskId),
      ) ??
      top250Films[5] ??
      null,
    [top250Films, heroSlides],
  );

  const thirdHero = useMemo(
    () =>
      awaitFilms.find((f) => f.coverUrl && !isRussianDomesticFilm(f)) ??
      scifiFilms.find((f) => f.coverUrl) ??
      null,
    [awaitFilms, scifiFilms],
  );

  if (noKey) return <NoKeyBanner />;
  if (!loaded || !sections) return <HomeSkeleton />;

  const s = sections;

  return (
    <div className="fade-in">
      {heroSlides.length > 0 && <HeroBanner films={heroSlides} />}

      <div className="relative z-[2] pt-5 sm:pt-8">
        {/* ── Above the Fold (Mounted Immediately) ── */}
        {s.popular && popularFilms.length > 0 && (
          <FilmRow
            title="Trending Blockbusters"
            films={popularFilms.slice(0, 20)}
            href="/explore?type=FILM&order=NUM_VOTE"
          />
        )}
        {(forYouLoading || forYouFilms.length > 0) && (
          <FilmRow
            title="For You"
            films={forYouFilms}
            href="/explore?lens=FOR_YOU"
            isLoading={forYouLoading}
          />
        )}
        {watchLaterFilms.length > 0 && (
          <FilmRow
            title="From Your Watch Later"
            films={watchLaterFilms}
            href="/watchlater"
          />
        )}
        {s.recentReleases && recentReleaseFilms.length > 0 && (
          <FilmRow
            title="Recent Releases"
            films={recentReleaseFilms.slice(0, 20)}
            href="/explore?lens=RECENT_RELEASES"
          />
        )}
        {s.top250 && top250Films.length > 0 && (
          <FilmRow
            title="Top 250 — All Time Greats"
            films={top250Films.slice(0, 20)}
            href="/top250"
          />
        )}

        {/* ── Below the Fold (Lazy-mounted as the user scrolls down) ── */}
        {s.premieres && premiereFilms.length > 0 && (
          <LazySection>
            <FilmRow
              title="New This Month"
              films={premiereFilms.slice(0, 20)}
              href="/premieres"
            />
          </LazySection>
        )}
        {s.series && seriesFilms.length > 0 && (
          <LazySection>
            <FilmRow
              title="Popular Global Series"
              films={seriesFilms.slice(0, 20)}
              href="/explore?type=TV_SERIES&order=NUM_VOTE"
            />
          </LazySection>
        )}
        {s.action && actionFilms.length > 0 && (
          <LazySection>
            <FilmRow
              title="Action & Adventure"
              films={actionFilms.slice(0, 20)}
              href="/explore?type=FILM&genres=11&order=NUM_VOTE"
            />
          </LazySection>
        )}

        {secondHero && (
          <LazySection minHeight={340}>
            <div className="my-5 sm:my-8">
              <HeroBanner film={secondHero} />
            </div>
          </LazySection>
        )}

        {s.drama && dramaFilms.length > 0 && (
          <LazySection>
            <FilmRow
              title="Acclaimed Drama"
              films={dramaFilms.slice(0, 20)}
              href="/explore?type=FILM&genres=2&order=NUM_VOTE"
            />
          </LazySection>
        )}
        {s.scifi && scifiFilms.length > 0 && (
          <LazySection>
            <FilmRow
              title="Sci-Fi & Fantasy"
              films={scifiFilms.slice(0, 20)}
              href="/explore?type=FILM&genres=6&order=NUM_VOTE"
            />
          </LazySection>
        )}
        {s.comedy && comedyFilms.length > 0 && (
          <LazySection>
            <FilmRow
              title="Hit Comedies"
              films={comedyFilms.slice(0, 20)}
              href="/explore?type=FILM&genres=13&order=NUM_VOTE"
            />
          </LazySection>
        )}

        {thirdHero && (
          <LazySection minHeight={340}>
            <div className="my-5 sm:my-8">
              <HeroBanner film={thirdHero} />
            </div>
          </LazySection>
        )}

        {s.horror && horrorFilms.length > 0 && (
          <LazySection>
            <FilmRow
              title="Horror & Suspense"
              films={horrorFilms.slice(0, 20)}
              href="/explore?type=FILM&genres=17&order=NUM_VOTE"
            />
          </LazySection>
        )}
        {/* Bug #12 Fixed: Links to current month so remaining current-month upcoming releases are not skipped */}
        {s.upcoming && awaitFilms.length > 0 && (
          <LazySection>
            <FilmRow
              title="Coming Soon"
              films={awaitFilms.slice(0, 20)}
              href={`/premieres?year=${CURRENT_YEAR}&month=${CURRENT_MONTH}`}
            />
          </LazySection>
        )}
        {s.top250 && top250Films.length > 20 && (
          <LazySection>
            <FilmRow
              title="Critically Acclaimed"
              films={top250Films.slice(20, 40)}
              href="/top250"
            />
          </LazySection>
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
                  className="skeleton flex-shrink-0 rounded-[var(--radius-lg)] w-[112px] h-[168px] sm:w-[175px] sm:h-[263px]"
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
