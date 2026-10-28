"use client";
import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  FilmPosterFallback,
  sanitizePosterUrl,
} from "@/components/posterFallback";
import {
  getCachedFilmMeta,
  isRussianDomesticFilm,
  CompactFilmMeta,
} from "@/lib/kinopoisk";
import { useAutoTranslate } from "@/hooks/useTranslate";
import { isRussian } from "@/lib/translate";

export interface PosterImageProps {
  src?: string | null;
  alt: string;
  title?: string;
  filmId?: number;
  imdbId?: string | null;
  year?: number | string | null;
  size?: "sm" | "md" | "lg";
  fallbackType?: "film" | "person" | "mini";
  priority?: boolean;
  className?: string;
  imgClassName?: string;
}

// ─── Persistent Client-Side English Poster Cache & Micro-Batcher ─────────────

const EN_POSTER_STORAGE_KEY = "cinemix_en_posters_v1";
const HIT_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const MISS_WITH_IMDB_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours
const MISS_TITLE_ONLY_TTL_MS = 30 * 60 * 1000; // 30 minutes

interface CachedPosterEntry {
  url: string | null;
  imdbId?: string | null;
  hasImdbId?: boolean;
  ts: number;
}

let memoryPosterStore: Record<string, CachedPosterEntry> | null = null;
let persistTimer: ReturnType<typeof setTimeout> | null = null;

function getPosterStore(): Record<string, CachedPosterEntry> {
  if (memoryPosterStore) return memoryPosterStore;
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(EN_POSTER_STORAGE_KEY);
    memoryPosterStore = raw
      ? (JSON.parse(raw) as Record<string, CachedPosterEntry>)
      : {};
  } catch {
    memoryPosterStore = {};
  }
  return memoryPosterStore!;
}

function schedulePersistPosterStore(): void {
  if (typeof window === "undefined" || persistTimer) return;
  persistTimer = setTimeout(() => {
    persistTimer = null;
    try {
      const store = getPosterStore();
      const keys = Object.keys(store);
      if (keys.length > 1400) {
        const sorted = keys.sort(
          (a, b) => (store[a]?.ts ?? 0) - (store[b]?.ts ?? 0),
        );
        for (let i = 0; i < 250; i++) {
          delete store[sorted[i]];
        }
      }
      localStorage.setItem(EN_POSTER_STORAGE_KEY, JSON.stringify(store));
    } catch {
      // ignore storage quota errors
    }
  }, 400);
}

function getCachedEnglishPoster(
  key: string,
  hasImdbId: boolean,
): CachedPosterEntry | undefined {
  if (!key) return undefined;
  const store = getPosterStore();
  const entry = store[key];
  if (!entry) return undefined;

  const age = Date.now() - (entry.ts || 0);
  if (entry.url) {
    if (age > HIT_TTL_MS) {
      delete store[key];
      return undefined;
    }
    return entry;
  }

  // If previously missed without imdbId, but now imdbId is available, re-resolve!
  if (hasImdbId && !entry.hasImdbId) {
    delete store[key];
    return undefined;
  }

  const missTtl = entry.hasImdbId
    ? MISS_WITH_IMDB_TTL_MS
    : MISS_TITLE_ONLY_TTL_MS;
  if (age > missTtl) {
    delete store[key];
    return undefined;
  }
  return entry;
}

function setCachedEnglishPoster(
  key: string,
  url: string | null,
  imdbId: string | null,
  hasImdbId: boolean,
): void {
  if (!key || typeof window === "undefined") return;
  const store = getPosterStore();
  store[key] = {
    url: sanitizePosterUrl(url),
    imdbId: imdbId || undefined,
    hasImdbId,
    ts: Date.now(),
  };
  schedulePersistPosterStore();
}

// ─── Client Micro-Batcher for /api/poster ────────────────────────────────────

interface BatchRequestItem {
  key: string;
  imdbId?: string | null;
  title?: string | null;
  origTitle?: string | null;
  year?: number | string | null;
  type?: string | null;
}

const inflightClientRequests = new Map<string, Promise<string | null>>();
const pendingBatchMap = new Map<
  string,
  {
    item: BatchRequestItem;
    hasImdbId: boolean;
    resolve: (url: string | null) => void;
  }
>();
let batchTimer: ReturnType<typeof setTimeout> | null = null;

function flushPosterBatch(): void {
  batchTimer = null;
  if (pendingBatchMap.size === 0) return;

  const entries = Array.from(pendingBatchMap.values());
  pendingBatchMap.clear();

  // Chunk into batches of 24
  for (let i = 0; i < entries.length; i += 24) {
    const chunk = entries.slice(i, i + 24);
    const payload = chunk.map((c) => c.item);

    fetch("/api/poster", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: payload }),
    })
      .then((res) => (res.ok ? res.json() : { results: {} }))
      .then(
        (data: {
          results?: Record<
            string,
            { posterUrl?: string | null; imdbId?: string | null }
          >;
        }) => {
          const results = data?.results || {};
          for (const entry of chunk) {
            const match = results[entry.item.key];
            const resolvedUrl = sanitizePosterUrl(match?.posterUrl) || null;
            const resolvedImdb = match?.imdbId || entry.item.imdbId || null;
            setCachedEnglishPoster(
              entry.item.key,
              resolvedUrl,
              resolvedImdb,
              entry.hasImdbId || Boolean(resolvedImdb),
            );
            entry.resolve(resolvedUrl);
          }
        },
      )
      .catch(() => {
        for (const entry of chunk) {
          entry.resolve(null);
        }
      });
  }
}

function requestEnglishPoster(
  item: BatchRequestItem,
  hasImdbId: boolean,
): Promise<string | null> {
  const existing = inflightClientRequests.get(item.key);
  if (existing) return existing;

  const promise = new Promise<string | null>((resolve) => {
    pendingBatchMap.set(item.key, {
      item,
      hasImdbId,
      resolve: (url) => {
        inflightClientRequests.delete(item.key);
        resolve(url);
      },
    });
    if (!batchTimer) {
      batchTimer = setTimeout(flushPosterBatch, 18);
    }
  });

  inflightClientRequests.set(item.key, promise);
  return promise;
}

// ─── URL Extraction & Resolution Helpers ─────────────────────────────────────

function extractKpFilmId(url?: string | null): number | null {
  if (!url || typeof url !== "string") return null;
  const m = url.match(
    /\/images\/posters\/kp(?:_small)?\/(\d+)\.(?:jpg|jpeg|png|webp)/i,
  );
  if (!m || !m[1]) return null;
  const parsed = parseInt(m[1], 10);
  return !isNaN(parsed) && parsed > 0 ? parsed : null;
}

/**
 * Formats Amazon (`m.media-amazon.com`) or Kinopoisk poster URLs to the ideal
 * dimensions for `sm` / `md` / `lg` containers so cards load rapidly while
 * detail & quick-peek modals render at crisp high resolution.
 */
function optimizePosterUrl(
  rawUrl?: string | null,
  size?: "sm" | "md" | "lg",
  fallbackType?: "film" | "person" | "mini",
  priority?: boolean,
): string | null {
  const cleanUrl = sanitizePosterUrl(rawUrl);
  if (!cleanUrl) return null;

  const isLarge =
    size === "lg" || (priority && !size && fallbackType === "film");

  // Optimize Amazon / IMDb CDN poster dimensions dynamically
  if (cleanUrl.includes("m.media-amazon.com/images/")) {
    const targetParam = isLarge
      ? "_V1_QL85_UX780_"
      : size === "md"
        ? "_V1_QL80_UX480_"
        : "_V1_QL75_UX380_";

    if (/\._V1_.*?\.(jpg|jpeg|png)$/i.test(cleanUrl)) {
      return cleanUrl.replace(
        /\._V1_.*?\.(jpg|jpeg|png)$/i,
        `.${targetParam}.$1`,
      );
    }
    return cleanUrl;
  }

  // Optimize Cinemeta / Metahub fallback URLs
  if (cleanUrl.includes("images.metahub.space/poster/")) {
    return isLarge
      ? cleanUrl.replace("/poster/medium/", "/poster/large/")
      : cleanUrl.replace("/poster/large/", "/poster/medium/");
  }

  // Optimize Kinopoisk URLs
  if (isLarge) {
    return cleanUrl.replace("/images/posters/kp_small/", "/images/posters/kp/");
  }
  if (
    size === "sm" ||
    size === "md" ||
    (!priority && (fallbackType === "film" || fallbackType === "mini"))
  ) {
    return cleanUrl.replace("/images/posters/kp/", "/images/posters/kp_small/");
  }
  return cleanUrl;
}

export default function PosterImage({
  src,
  alt,
  title,
  filmId: propFilmId,
  imdbId: propImdbId,
  year: propYear,
  size,
  fallbackType = "film",
  priority = false,
  className = "w-full h-full relative overflow-hidden bg-[var(--surface)]",
  imgClassName = "w-full h-full object-cover block",
}: PosterImageProps) {
  const autoTranslate = useAutoTranslate();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  const isPerson = fallbackType === "person";
  const kpFilmId = useMemo(
    () => propFilmId || extractKpFilmId(src) || 0,
    [propFilmId, src],
  );

  const [metaTick, setMetaTick] = useState(0);

  // Listen for background film metadata hydration so newly discovered imdbId/year updates the poster
  useEffect(() => {
    if (isPerson || !kpFilmId) return;
    const onMetaUpdated = (e: Event) => {
      const detail = (e as CustomEvent<{ filmId?: number }>).detail;
      if (!detail?.filmId || detail.filmId === kpFilmId) {
        setMetaTick((t) => t + 1);
      }
    };
    window.addEventListener("cinemix-meta-updated", onMetaUpdated);
    return () =>
      window.removeEventListener("cinemix-meta-updated", onMetaUpdated);
  }, [isPerson, kpFilmId]);

  const cachedMeta: CompactFilmMeta | undefined = useMemo(
    () => (kpFilmId > 0 ? getCachedFilmMeta(kpFilmId) : undefined),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [kpFilmId, metaTick],
  );

  const resolvedImdbId = propImdbId || cachedMeta?.imdbId || null;
  const resolvedYear =
    propYear || cachedMeta?.year || cachedMeta?.startYear || null;
  const resolvedType = cachedMeta?.type || null;

  const displayTitle = (title || alt || "").trim();
  const origLatinTitle = useMemo(() => {
    const candidates = [
      cachedMeta?.nameEn,
      cachedMeta?.nameOriginal,
      displayTitle,
    ];
    for (const c of candidates) {
      if (
        c &&
        c.trim() &&
        c.trim().toLowerCase() !== "unknown" &&
        !isRussian(c)
      ) {
        return c.trim();
      }
    }
    return null;
  }, [cachedMeta?.nameEn, cachedMeta?.nameOriginal, displayTitle]);

  const shouldUseEnglishPoster = useMemo(() => {
    if (isPerson || !autoTranslate) return false;
    if (
      src &&
      (src.includes("m.media-amazon.com") ||
        src.includes("images.metahub.space"))
    ) {
      return false;
    }
    if (cachedMeta && isRussianDomesticFilm(cachedMeta) && !resolvedImdbId) {
      return false;
    }
    return Boolean(resolvedImdbId || origLatinTitle);
  }, [
    isPerson,
    autoTranslate,
    src,
    cachedMeta,
    resolvedImdbId,
    origLatinTitle,
  ]);

  const lookupKey = useMemo(() => {
    if (!shouldUseEnglishPoster) return "";
    if (kpFilmId > 0) return `kp:${kpFilmId}`;
    if (resolvedImdbId) return `imdb:${resolvedImdbId.toLowerCase()}`;
    if (origLatinTitle) {
      return `title:${origLatinTitle.toLowerCase()}:${resolvedYear || ""}`;
    }
    return "";
  }, [
    shouldUseEnglishPoster,
    kpFilmId,
    resolvedImdbId,
    origLatinTitle,
    resolvedYear,
  ]);

  const synchronousCachedEntry = useMemo(
    () =>
      lookupKey
        ? getCachedEnglishPoster(lookupKey, Boolean(resolvedImdbId))
        : undefined,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lookupKey, resolvedImdbId, metaTick],
  );

  const cleanOriginalKpSrc = sanitizePosterUrl(src);
  const optimizedKpSrc = optimizePosterUrl(src, size, fallbackType, priority);

  const initialEnglishUrl = synchronousCachedEntry?.url
    ? optimizePosterUrl(
        synchronousCachedEntry.url,
        size,
        fallbackType,
        priority,
      )
    : null;

  const needsAsyncLookup =
    shouldUseEnglishPoster &&
    Boolean(lookupKey) &&
    synchronousCachedEntry === undefined;

  const [resolvedEnRawUrl, setResolvedEnRawUrl] = useState<string | null>(
    synchronousCachedEntry?.url ?? null,
  );
  const [resolvingEn, setResolvingEn] = useState<boolean>(needsAsyncLookup);
  const [activeSrc, setActiveSrc] = useState<string | null>(() => {
    if (initialEnglishUrl) return initialEnglishUrl;
    if (needsAsyncLookup) return null;
    return optimizedKpSrc;
  });
  const [error, setError] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // Sync state when props, size, or synchronous cache changes
  useEffect(() => {
    if (!shouldUseEnglishPoster) {
      setResolvingEn(false);
      setResolvedEnRawUrl(null);
      setActiveSrc(optimizedKpSrc);
      setError(false);
      return;
    }

    const cached = lookupKey
      ? getCachedEnglishPoster(lookupKey, Boolean(resolvedImdbId))
      : undefined;

    if (cached !== undefined) {
      setResolvingEn(false);
      setResolvedEnRawUrl(cached.url);
      const nextUrl = cached.url
        ? optimizePosterUrl(cached.url, size, fallbackType, priority)
        : optimizedKpSrc;
      setActiveSrc(nextUrl);
      setError(false);
    } else if (lookupKey) {
      setResolvingEn(true);
      setError(false);
    } else {
      setResolvingEn(false);
      setActiveSrc(optimizedKpSrc);
      setError(false);
    }
  }, [
    shouldUseEnglishPoster,
    lookupKey,
    resolvedImdbId,
    optimizedKpSrc,
    size,
    fallbackType,
    priority,
  ]);

  // Trigger asynchronous English poster resolution (immediately if priority, or when near viewport)
  useEffect(() => {
    if (!shouldUseEnglishPoster || !lookupKey) return;
    const cached = getCachedEnglishPoster(lookupKey, Boolean(resolvedImdbId));
    if (cached !== undefined) return;

    let cancelled = false;
    let fallbackTimeout: ReturnType<typeof setTimeout> | null = null;

    const startResolution = () => {
      // Safety timer: if network is slow (>950ms), show Kinopoisk poster while continuing resolution
      fallbackTimeout = setTimeout(() => {
        if (!cancelled && optimizedKpSrc) {
          setResolvingEn(false);
          setActiveSrc((prev) => prev || optimizedKpSrc);
        }
      }, 950);

      requestEnglishPoster(
        {
          key: lookupKey,
          imdbId: resolvedImdbId,
          title:
            displayTitle && !isRussian(displayTitle)
              ? displayTitle
              : origLatinTitle,
          origTitle: origLatinTitle,
          year: resolvedYear,
          type: resolvedType,
        },
        Boolean(resolvedImdbId),
      ).then((enUrl) => {
        if (cancelled) return;
        if (fallbackTimeout) clearTimeout(fallbackTimeout);
        setResolvingEn(false);

        if (enUrl) {
          setResolvedEnRawUrl(enUrl);
          const sizedEn = optimizePosterUrl(
            enUrl,
            size,
            fallbackType,
            priority,
          );
          setActiveSrc(sizedEn || optimizedKpSrc);
          setError(false);
        } else {
          setResolvedEnRawUrl(null);
          setActiveSrc(optimizedKpSrc);
        }
      });
    };

    const el = containerRef.current;
    if (priority || !el || typeof IntersectionObserver === "undefined") {
      startResolution();
      return () => {
        cancelled = true;
        if (fallbackTimeout) clearTimeout(fallbackTimeout);
      };
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          observer.disconnect();
          startResolution();
        }
      },
      { rootMargin: "320px" },
    );

    observer.observe(el);
    return () => {
      cancelled = true;
      observer.disconnect();
      if (fallbackTimeout) clearTimeout(fallbackTimeout);
    };
  }, [
    shouldUseEnglishPoster,
    lookupKey,
    resolvedImdbId,
    displayTitle,
    origLatinTitle,
    resolvedYear,
    resolvedType,
    optimizedKpSrc,
    size,
    fallbackType,
    priority,
  ]);

  // Reset loaded state whenever activeSrc changes
  useEffect(() => {
    if (!activeSrc) {
      setLoaded(false);
      return;
    }
    const el = imgRef.current;
    if (el && el.complete && el.naturalWidth > 1) {
      setLoaded(true);
    } else {
      setLoaded(false);
    }
  }, [activeSrc]);

  // While waiting for the fast English poster micro-batch, show skeleton shimmer
  if (resolvingEn && !activeSrc) {
    return (
      <div ref={containerRef} className={className}>
        <div
          aria-hidden="true"
          className="absolute inset-0 skeleton pointer-events-none"
        />
      </div>
    );
  }

  if (!activeSrc || error) {
    return (
      <div ref={containerRef} className={className}>
        <FilmPosterFallback
          title={title || alt}
          variant={fallbackType}
          compact={fallbackType === "mini"}
        />
      </div>
    );
  }

  const sizedEnglishUrl = resolvedEnRawUrl
    ? optimizePosterUrl(resolvedEnRawUrl, size, fallbackType, priority)
    : null;

  return (
    <div ref={containerRef} className={className}>
      {!loaded && (
        <div
          aria-hidden="true"
          className="absolute inset-0 skeleton pointer-events-none"
        />
      )}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={imgRef}
        src={activeSrc}
        alt={alt}
        referrerPolicy="no-referrer"
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        fetchPriority={priority ? "high" : "auto"}
        draggable={false}
        onLoad={(e) => {
          const img = e.currentTarget;
          // Catch 1x1 spacer pixels or redirected no-poster URLs
          if (
            img.naturalWidth <= 1 ||
            img.naturalHeight <= 1 ||
            !sanitizePosterUrl(img.currentSrc)
          ) {
            if (
              sizedEnglishUrl &&
              activeSrc === sizedEnglishUrl &&
              optimizedKpSrc &&
              activeSrc !== optimizedKpSrc
            ) {
              setActiveSrc(optimizedKpSrc);
              return;
            }
            setError(true);
            return;
          }
          setLoaded(true);
        }}
        onError={() => {
          // 1. If English poster URL failed to load, fall back to optimized Kinopoisk poster
          if (
            sizedEnglishUrl &&
            activeSrc === sizedEnglishUrl &&
            optimizedKpSrc &&
            activeSrc !== optimizedKpSrc
          ) {
            if (lookupKey) {
              setCachedEnglishPoster(
                lookupKey,
                null,
                resolvedImdbId,
                Boolean(resolvedImdbId),
              );
            }
            setResolvedEnRawUrl(null);
            setActiveSrc(optimizedKpSrc);
            return;
          }
          // 2. If kp_small failed to load, fall back to original kp poster
          if (cleanOriginalKpSrc && activeSrc !== cleanOriginalKpSrc) {
            setActiveSrc(cleanOriginalKpSrc);
            return;
          }
          // 3. Otherwise show FilmPosterFallback
          setError(true);
        }}
        className={`${imgClassName} transition-opacity duration-300 ease-out ${
          loaded ? "opacity-100" : "opacity-0"
        }`}
      />
    </div>
  );
}
