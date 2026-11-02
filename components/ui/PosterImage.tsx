"use client";
import { useState, useEffect, useRef, useMemo } from "react";
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
import { isRussian, resolveEnglishAlias } from "@/lib/translate";

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
  disableEnglishLookup?: boolean;
  className?: string;
  imgClassName?: string;
}

// ─── Persistent Client-Side English Poster Cache & Micro-Batcher ─────────────

// Bumped to v2 so previously cached year-insensitive posters (e.g. Oldboy 2003 vs 2013) are invalidated
const EN_POSTER_STORAGE_KEY = "cinemix_en_posters_v2";
const HIT_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const MISS_WITH_IMDB_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours
const MISS_TITLE_ONLY_TTL_MS = 30 * 60 * 1000; // 30 minutes

interface CachedPosterEntry {
  url: string | null;
  imdbId?: string | null;
  hasImdbId?: boolean;
  hasYear?: boolean;
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
  hasYear: boolean,
): CachedPosterEntry | undefined {
  if (!key) return undefined;
  const store = getPosterStore();
  const entry = store[key];
  if (!entry) return undefined;

  // If we now have an imdbId or release year that wasn't available when cached, re-resolve
  if (hasImdbId && !entry.hasImdbId) {
    delete store[key];
    return undefined;
  }
  if (hasYear && !entry.hasYear) {
    delete store[key];
    return undefined;
  }

  const age = Date.now() - (entry.ts || 0);
  if (entry.url) {
    if (age > HIT_TTL_MS) {
      delete store[key];
      return undefined;
    }
    return entry;
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
  hasYear: boolean,
): void {
  if (!key || typeof window === "undefined") return;
  const store = getPosterStore();
  store[key] = {
    url: sanitizePosterUrl(url),
    imdbId: imdbId || undefined,
    hasImdbId,
    hasYear,
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
  nameRu?: string | null;
  year?: number | string | null;
  type?: string | null;
}

const inflightClientRequests = new Map<string, Promise<string | null>>();
const pendingBatchMap = new Map<
  string,
  {
    item: BatchRequestItem;
    hasImdbId: boolean;
    hasYear: boolean;
    resolve: (url: string | null) => void;
  }
>();
let batchTimer: ReturnType<typeof setTimeout> | null = null;

function flushPosterBatch(): void {
  batchTimer = null;
  if (pendingBatchMap.size === 0) return;

  const entries = Array.from(pendingBatchMap.values());
  pendingBatchMap.clear();

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
              entry.hasYear,
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
  hasYear: boolean,
): Promise<string | null> {
  const existing = inflightClientRequests.get(item.key);
  if (existing) return existing;

  const promise = new Promise<string | null>((resolve) => {
    pendingBatchMap.set(item.key, {
      item,
      hasImdbId,
      hasYear,
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

  if (cleanUrl.includes("images.metahub.space/poster/")) {
    return isLarge
      ? cleanUrl.replace("/poster/medium/", "/poster/large/")
      : cleanUrl.replace("/poster/large/", "/poster/medium/");
  }

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
  disableEnglishLookup = false,
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

  const [mounted, setMounted] = useState(false);
  const [metaTick, setMetaTick] = useState(0);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Only re-evaluate when THIS specific film's metadata updates
  useEffect(() => {
    if (isPerson || !kpFilmId) return;
    const onMetaUpdated = (e: Event) => {
      const detail = (e as CustomEvent<{ filmId?: number; filmIds?: number[] }>)
        .detail;
      if (
        detail?.filmId === kpFilmId ||
        (Array.isArray(detail?.filmIds) && detail.filmIds.includes(kpFilmId)) ||
        (!detail?.filmId && !detail?.filmIds)
      ) {
        setMetaTick((t) => t + 1);
      }
    };
    window.addEventListener("cinemix-meta-updated", onMetaUpdated);
    return () =>
      window.removeEventListener("cinemix-meta-updated", onMetaUpdated);
  }, [isPerson, kpFilmId]);

  const cachedMeta: CompactFilmMeta | undefined = useMemo(
    () => (mounted && kpFilmId > 0 ? getCachedFilmMeta(kpFilmId) : undefined),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mounted, kpFilmId, metaTick],
  );

  const resolvedImdbId = propImdbId || cachedMeta?.imdbId || null;
  const resolvedYear = useMemo(() => {
    const raw = propYear ?? cachedMeta?.year ?? cachedMeta?.startYear ?? null;
    if (raw === null || raw === undefined || raw === "" || raw === "null") {
      return null;
    }
    const m = String(raw).match(/\b(18\d{2}|19\d{2}|20\d{2})\b/);
    return m ? parseInt(m[1], 10) : null;
  }, [propYear, cachedMeta?.year, cachedMeta?.startYear]);

  const resolvedType = cachedMeta?.type || null;

  const displayTitle = (title || alt || "").trim();
  const aliasTitle = useMemo(
    () =>
      resolveEnglishAlias(
        cachedMeta?.nameRu || (isRussian(displayTitle) ? displayTitle : null),
        cachedMeta?.nameOriginal,
      ),
    [cachedMeta?.nameRu, cachedMeta?.nameOriginal, displayTitle],
  );

  const origLatinTitle = useMemo(() => {
    const candidates = [
      aliasTitle,
      cachedMeta?.nameEn,
      displayTitle,
      cachedMeta?.nameOriginal,
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
  }, [aliasTitle, cachedMeta?.nameEn, cachedMeta?.nameOriginal, displayTitle]);

  const shouldUseEnglishPoster = useMemo(() => {
    if (isPerson || !autoTranslate || disableEnglishLookup) return false;
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
    return Boolean(
      resolvedImdbId || origLatinTitle || cachedMeta?.nameRu || displayTitle,
    );
  }, [
    isPerson,
    autoTranslate,
    disableEnglishLookup,
    src,
    cachedMeta,
    resolvedImdbId,
    origLatinTitle,
    displayTitle,
  ]);

  // Include year and imdbId in lookupKey so same-name remakes (e.g. Oldboy 2003 vs Oldboy 2013)
  // never collide and unhydrated cards automatically upgrade once their year or imdbId arrives
  const lookupKey = useMemo(() => {
    if (!shouldUseEnglishPoster) return "";
    const yPart = resolvedYear ? String(resolvedYear) : "noyear";
    const iPart = resolvedImdbId ? resolvedImdbId.toLowerCase() : "";
    const tPart = (
      aliasTitle ||
      (displayTitle && !isRussian(displayTitle) ? displayTitle : "") ||
      origLatinTitle ||
      ""
    )
      .toLowerCase()
      .trim();

    if (kpFilmId > 0) {
      return `kp:${kpFilmId}:y=${yPart}:i=${iPart}:t=${tPart}`;
    }
    if (iPart) return `imdb:${iPart}:y=${yPart}`;
    if (tPart) return `title:${tPart}:y=${yPart}`;
    return "";
  }, [
    shouldUseEnglishPoster,
    kpFilmId,
    resolvedImdbId,
    resolvedYear,
    aliasTitle,
    displayTitle,
    origLatinTitle,
  ]);

  const cleanOriginalKpSrc = sanitizePosterUrl(src);
  const optimizedKpSrc = optimizePosterUrl(src, size, fallbackType, priority);

  const [resolvedEnRawUrl, setResolvedEnRawUrl] = useState<string | null>(null);
  const [activeSrc, setActiveSrc] = useState<string | null>(optimizedKpSrc);
  const [error, setError] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // Sync state when props, size, or synchronous cache changes
  useEffect(() => {
    if (!shouldUseEnglishPoster) {
      setResolvedEnRawUrl(null);
      setActiveSrc(optimizedKpSrc);
      setError(false);
      return;
    }

    const cached = lookupKey
      ? getCachedEnglishPoster(
          lookupKey,
          Boolean(resolvedImdbId),
          Boolean(resolvedYear),
        )
      : undefined;

    if (cached !== undefined) {
      setResolvedEnRawUrl(cached.url);
      const nextUrl = cached.url
        ? optimizePosterUrl(cached.url, size, fallbackType, priority)
        : optimizedKpSrc;
      setActiveSrc(nextUrl);
      setError(false);
    } else {
      setActiveSrc(optimizedKpSrc);
      setError(false);
    }
  }, [
    shouldUseEnglishPoster,
    lookupKey,
    resolvedImdbId,
    resolvedYear,
    optimizedKpSrc,
    size,
    fallbackType,
    priority,
  ]);

  // Trigger asynchronous English poster upgrade when near viewport
  useEffect(() => {
    if (!shouldUseEnglishPoster || !lookupKey) return;
    const cached = getCachedEnglishPoster(
      lookupKey,
      Boolean(resolvedImdbId),
      Boolean(resolvedYear),
    );
    if (cached !== undefined) return;

    let cancelled = false;

    const startResolution = () => {
      const englishTitle =
        aliasTitle ||
        (displayTitle && !isRussian(displayTitle)
          ? displayTitle
          : origLatinTitle);

      requestEnglishPoster(
        {
          key: lookupKey,
          imdbId: resolvedImdbId,
          title: englishTitle,
          origTitle: cachedMeta?.nameOriginal || origLatinTitle,
          nameRu:
            cachedMeta?.nameRu ||
            (isRussian(displayTitle) ? displayTitle : null),
          year: resolvedYear,
          type: resolvedType,
        },
        Boolean(resolvedImdbId),
        Boolean(resolvedYear),
      ).then((enUrl) => {
        if (cancelled) return;
        if (enUrl) {
          setResolvedEnRawUrl(enUrl);
          const sizedEn = optimizePosterUrl(
            enUrl,
            size,
            fallbackType,
            priority,
          );
          if (sizedEn) {
            setActiveSrc(sizedEn);
            setError(false);
          }
        }
      });
    };

    const el = containerRef.current;
    if (priority || !el || typeof IntersectionObserver === "undefined") {
      startResolution();
      return () => {
        cancelled = true;
      };
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          observer.disconnect();
          startResolution();
        }
      },
      { rootMargin: "280px" },
    );

    observer.observe(el);
    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, [
    shouldUseEnglishPoster,
    lookupKey,
    resolvedImdbId,
    aliasTitle,
    displayTitle,
    origLatinTitle,
    cachedMeta?.nameOriginal,
    cachedMeta?.nameRu,
    resolvedYear,
    resolvedType,
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
                Boolean(resolvedYear),
              );
            }
            setResolvedEnRawUrl(null);
            setActiveSrc(optimizedKpSrc);
            return;
          }
          if (cleanOriginalKpSrc && activeSrc !== cleanOriginalKpSrc) {
            setActiveSrc(cleanOriginalKpSrc);
            return;
          }
          setError(true);
        }}
        className={`${imgClassName} transition-opacity duration-200 ease-out ${
          loaded ? "opacity-100" : "opacity-0"
        }`}
      />
    </div>
  );
}
