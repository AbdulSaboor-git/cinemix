"use client";
import { useEffect, useState } from "react";
import { getTopFilms, getFilmsByFilter } from "@/lib/kinopoisk";
import { Film } from "@/types/kinopoisk";
import HeroBanner from "@/components/HeroBanner";
import FilmRow from "@/components/FilmRow";

export default function HomeClient() {
  const [popularFilms, setPopularFilms] = useState<Film[]>([]);
  const [top250Films,  setTop250Films]  = useState<Film[]>([]);
  const [seriesFilms,  setSeriesFilms]  = useState<Film[]>([]);
  const [actionFilms,  setActionFilms]  = useState<Film[]>([]);
  const [scifiFilms,   setScifiFilms]   = useState<Film[]>([]);
  const [awaitFilms,   setAwaitFilms]   = useState<Film[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    Promise.allSettled([
      getTopFilms("TOP_100_POPULAR_FILMS"),
      getTopFilms("TOP_250_BEST_FILMS"),
      getFilmsByFilter({ type: "TV_SERIES", order: "RATING", ratingFrom: 7 }),
      getFilmsByFilter({ genres: 1,         order: "RATING", ratingFrom: 7 }),  // Action
      getFilmsByFilter({ genres: 6,         order: "RATING", ratingFrom: 7 }),  // Sci-Fi
      getTopFilms("TOP_AWAIT_FILMS"),
    ]).then(([popular, top250, series, action, scifi, await_]) => {
      setPopularFilms(popular.status === "fulfilled" ? popular.value.items : []);
      setTop250Films( top250.status  === "fulfilled" ? top250.value.items  : []);
      setSeriesFilms( series.status  === "fulfilled" ? series.value.items  : []);
      setActionFilms( action.status  === "fulfilled" ? action.value.items  : []);
      setScifiFilms(  scifi.status   === "fulfilled" ? scifi.value.items   : []);
      setAwaitFilms(  await_.status  === "fulfilled" ? await_.value.items  : []);
      setLoaded(true);
    });
  }, []);

  if (!loaded) return <HomeSkeleton />;

  const heroFilm   = popularFilms.find(f => f.coverUrl) ?? popularFilms[0] ?? null;
  const secondHero = top250Films.find(f => f.coverUrl) ?? top250Films[0] ?? null;

  return (
    <div className="fade-in">
      {heroFilm && <HeroBanner film={heroFilm} />}

      <div style={{ marginTop: heroFilm ? "0px" : 0, position: "relative", zIndex: 2 }}>
        {popularFilms.length > 0 && (
          <FilmRow title="Trending Now" films={popularFilms.slice(0, 20)} href="/browse?type=FILM" />
        )}
        {top250Films.length > 0 && (
          <FilmRow title="Top 250 — All Time Greats" films={top250Films.slice(0, 20)} href="/top250" showIndex />
        )}
        {seriesFilms.length > 0 && (
          <FilmRow title="Top Series" films={seriesFilms.slice(0, 20)} href="/browse?type=TV_SERIES" />
        )}
        {actionFilms.length > 0 && (
          <FilmRow title="Action & Adventure" films={actionFilms.slice(0, 20)} href="/browse?type=FILM&genres=1" />
        )}

        {secondHero && (
          <div style={{ margin: "16px 0" }}>
            <HeroBanner film={secondHero} />
          </div>
        )}

        {scifiFilms.length > 0 && (
          <FilmRow title="Sci-Fi & Thriller" films={scifiFilms.slice(0, 20)} href="/browse?type=FILM&genres=6" />
        )}
        {awaitFilms.length > 0 && (
          <FilmRow title="Coming Soon" films={awaitFilms.slice(0, 20)} />
        )}
        {top250Films.length > 20 && (
          <FilmRow title="Critically Acclaimed" films={top250Films.slice(20, 40)} href="/top250" />
        )}
      </div>
    </div>
  );
}

function HomeSkeleton() {
  return (
    <div style={{ minHeight: "100vh" }}>
      <div className="skeleton" style={{ width: "100%", height: "clamp(500px,90vh,800px)" }} />
      <div style={{ padding: "48px clamp(16px,4vw,48px)", display: "flex", flexDirection: "column", gap: 48 }}>
        {[1, 2, 3].map(i => (
          <div key={i}>
            <div className="skeleton" style={{ height: 26, width: 200, borderRadius: 6, marginBottom: 20 }} />
            <div style={{ display: "flex", gap: 16 }}>
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
