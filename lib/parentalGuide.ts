import { Film } from "@/types/kinopoisk";

export type ParentalCategoryKey =
  | "nudity"
  | "violence"
  | "profanity"
  | "alcohol"
  | "frightening";

export type SeverityLevel = "NONE" | "MILD" | "MODERATE" | "SEVERE" | "UNKNOWN";

export interface SeverityBreakdown {
  none: number;
  mild: number;
  moderate: number;
  severe: number;
  totalVotes: number;
}

export interface ParentalGuideItem {
  id: string;
  text: string;
  isSpoiler: boolean;
}

export interface ParentalCategory {
  key: ParentalCategoryKey;
  title: string;
  severity: SeverityLevel;
  votes: SeverityBreakdown;
  items: ParentalGuideItem[];
}

export interface ParentalCertificate {
  country: string;
  countryCode?: string;
  rating: string;
  reason?: string;
  attributes?: string[];
}

export interface ParentalGuideData {
  imdbId?: string | null;
  source: "imdb" | "hybrid" | "native";
  mpaaRating?: string | null;
  mpaaDescription?: string | null;
  mpaaReason?: string | null;
  ageLimit?: string | null;
  ageLimitDescription?: string | null;
  certificates: ParentalCertificate[];
  categories: ParentalCategory[];
  fetchedAt: string;
}

export const PARENTAL_CATEGORIES_ORDER: {
  key: ParentalCategoryKey;
  title: string;
  shortTitle: string;
}[] = [
  { key: "nudity", title: "Sex & Nudity", shortTitle: "Sex & Nudity" },
  { key: "violence", title: "Violence & Gore", shortTitle: "Violence" },
  { key: "profanity", title: "Profanity", shortTitle: "Profanity" },
  {
    key: "alcohol",
    title: "Alcohol, Drugs & Smoking",
    shortTitle: "Alcohol & Drugs",
  },
  {
    key: "frightening",
    title: "Frightening & Intense Scenes",
    shortTitle: "Frightening",
  },
];

export const MPAA_DESCRIPTIONS: Record<
  string,
  { label: string; summary: string; detail: string }
> = {
  G: {
    label: "General Audiences",
    summary: "All ages admitted.",
    detail:
      "Nothing that would offend parents for viewing by children. Contains minimal or no violence, no strong language, and no nudity or sexual content.",
  },
  PG: {
    label: "Parental Guidance Suggested",
    summary: "Some material may not be suitable for children.",
    detail:
      "Parents urged to give parental guidance. May contain some mild language, brief action or peril, and mild thematic elements.",
  },
  "PG-13": {
    label: "Parents Strongly Cautioned",
    summary: "Some material may be inappropriate for children under 13.",
    detail:
      "Parents are urged to be cautious. May include moderate action violence, brief strong language, suggestive themes, or intense sequences.",
  },
  R: {
    label: "Restricted",
    summary: "Under 17 requires accompanying parent or adult guardian.",
    detail:
      "Contains some adult material. Parents are urged to learn more about the film before taking their young children with them. May include strong violence, pervasive harsh language, nudity, or drug use.",
  },
  "NC-17": {
    label: "Adults Only",
    summary: "No one 17 and under admitted.",
    detail:
      "Clearly adult content. Children are not admitted. Contains explicit sexual content, graphic violence, or extreme mature themes.",
  },
};

export const AGE_LIMIT_DESCRIPTIONS: Record<
  string,
  { badge: string; label: string; detail: string }
> = {
  "0": {
    badge: "0+",
    label: "Universal — All Ages",
    detail: "Safe for viewers of all ages with no frightening or harmful scenes.",
  },
  "6": {
    badge: "6+",
    label: "Young Children (6+)",
    detail: "Suitable for children aged 6 and older; may contain mild fantasy peril.",
  },
  "12": {
    badge: "12+",
    label: "Teens (12+)",
    detail:
      "Recommended for viewers aged 12 and older; may include mild action, tension, or thematic drama.",
  },
  "16": {
    badge: "16+",
    label: "Mature Teens (16+)",
    detail:
      "Intended for viewers 16 and older; may feature intense action, moderate profanity, substance references, or mature themes.",
  },
  "18": {
    badge: "18+",
    label: "Adults Only (18+)",
    detail:
      "Restricted to adult audiences (18+); may contain graphic violence, strong language, sexual content, or intense psychological themes.",
  },
};

export function normalizeMpaaRating(raw?: string | null): string | null {
  if (!raw) return null;
  const clean = raw.trim().toUpperCase().replace(/\s+/g, "");
  if (clean === "PG13" || clean === "PG-13") return "PG-13";
  if (clean === "NC17" || clean === "NC-17") return "NC-17";
  if (clean === "G" || clean === "PG" || clean === "R") return clean;
  return raw.trim().toUpperCase();
}

export function normalizeAgeLimit(raw?: string | null): string | null {
  if (!raw) return null;
  const digits = raw.replace(/[^0-9]/g, "");
  return digits ? `${digits}+` : null;
}

// ─── Native Fallback & Smart Matrix ──────────────────────────────────────────

function inferCategorySeverities(
  mpaa: string | null,
  ageNum: number | null,
  genreNames: string[],
): Record<ParentalCategoryKey, { severity: SeverityLevel; notes: string[] }> {
  const genresLower = genreNames.map((g) => g.toLowerCase());
  const hasGenre = (...terms: string[]) =>
    terms.some((t) => genresLower.some((g) => g.includes(t)));

  const isKids =
    hasGenre("детский", "семейный", "мультфильм", "family", "children", "animation", "kids") &&
    !hasGenre("ужасы", "horror", "эротика", "erotic", "для взрослых", "adult");
  const isHorror = hasGenre("ужасы", "horror");
  const isActionCrimeWar = hasGenre(
    "боевик",
    "криминал",
    "военный",
    "action",
    "crime",
    "war",
  );
  const isThriller = hasGenre("триллер", "детектив", "thriller", "detective");
  const isRomanceErotic = hasGenre("эротика", "для взрослых", "erotic", "adult");
  const isRomance = hasGenre("мелодрама", "romance");
  const isDrama = hasGenre("драма", "биография", "drama", "biography");

  // Base level from age/MPAA: 0 = NONE, 1 = MILD, 2 = MODERATE, 3 = SEVERE
  let baseLevel = 1;
  if (mpaa === "G" || ageNum === 0 || ageNum === 6 || isKids) {
    baseLevel = 0;
  } else if (mpaa === "PG" || ageNum === 12) {
    baseLevel = 1;
  } else if (mpaa === "PG-13" || ageNum === 16) {
    baseLevel = 2;
  } else if (mpaa === "R" || mpaa === "NC-17" || ageNum === 18) {
    baseLevel = 3;
  }

  const toSeverity = (lvl: number): SeverityLevel => {
    const clamped = Math.max(0, Math.min(3, Math.round(lvl)));
    return (["NONE", "MILD", "MODERATE", "SEVERE"] as const)[clamped];
  };

  // 1. Sex & Nudity
  const nudityLvl = isRomanceErotic
    ? 3
    : isKids
      ? 0
      : isRomance
        ? Math.max(1, baseLevel - 1)
        : Math.max(0, baseLevel - 1);
  const nudityNotes: string[] = [];
  if (nudityLvl === 0) {
    nudityNotes.push("No nudity or sexual content indicated by the official age classification.");
  } else if (nudityLvl === 1) {
    nudityNotes.push("May contain brief romantic scenes, kissing, or mild suggestive dialogue.");
  } else if (nudityLvl === 2) {
    nudityNotes.push("May include moderate romantic or sensual sequences, revealing attire, or implied intimacy.");
  } else {
    nudityNotes.push("Rated for adult audiences; may contain explicit sexual situations, nudity, or mature romantic themes.");
  }

  // 2. Violence & Gore
  const violenceLvl = isKids
    ? baseLevel > 0
      ? 1
      : 0
    : isHorror || isActionCrimeWar
      ? Math.max(2, baseLevel)
      : isThriller
        ? Math.max(1, baseLevel)
        : Math.max(0, baseLevel - 1);
  const violenceNotes: string[] = [];
  if (violenceLvl === 0) {
    violenceNotes.push("Free of realistic violence or gore; at most mild comedic or slapstick action.");
  } else if (violenceLvl === 1) {
    violenceNotes.push("Contains mild action sequences, non-graphic conflict, or brief dramatic tension.");
  } else if (violenceLvl === 2) {
    violenceNotes.push("Features moderate combat, weapons use, action violence, or injury detail appropriate for teen/mature audiences.");
  } else {
    violenceNotes.push("Contains intense or graphic violence, blood/injury detail, or brutal combat sequences consistent with an adult rating.");
  }

  // 3. Profanity
  const profanityLvl = isKids
    ? 0
    : isActionCrimeWar || isDrama
      ? baseLevel
      : Math.max(0, baseLevel - 1);
  const profanityNotes: string[] = [];
  if (profanityLvl === 0) {
    profanityNotes.push("Clean dialogue suitable for general and family audiences.");
  } else if (profanityLvl === 1) {
    profanityNotes.push("May include infrequent mild slang or minor exclamations.");
  } else if (profanityLvl === 2) {
    profanityNotes.push("Contains moderate coarse language, swearing, or intense verbal confrontations.");
  } else {
    profanityNotes.push("Likely includes strong, frequent profanity or explicit adult dialogue.");
  }

  // 4. Alcohol, Drugs & Smoking
  const alcoholLvl = isKids
    ? 0
    : hasGenre("криминал", "драма", "биография", "crime", "drama", "biography")
      ? Math.max(1, baseLevel - 1)
      : Math.max(0, baseLevel - 1);
  const alcoholNotes: string[] = [];
  if (alcoholLvl === 0) {
    alcoholNotes.push("No notable depiction of substance abuse, smoking, or heavy drinking.");
  } else if (alcoholLvl === 1) {
    alcoholNotes.push("Characters may be seen socially drinking alcohol or smoking in background scenes.");
  } else if (alcoholLvl === 2) {
    alcoholNotes.push("Includes scenes involving alcohol consumption, tobacco use, or references to controlled substances.");
  } else {
    alcoholNotes.push("May depict explicit drug use, substance abuse, or heavy intoxication.");
  }

  // 5. Frightening & Intense Scenes
  const frightLvl = isKids
    ? 0
    : isHorror
      ? Math.max(2, baseLevel)
      : isThriller || isActionCrimeWar
        ? Math.max(1, baseLevel)
        : Math.max(0, baseLevel - 1);
  const frightNotes: string[] = [];
  if (frightLvl === 0) {
    frightNotes.push("Calm and family-friendly tone without disturbing or frightening imagery.");
  } else if (frightLvl === 1) {
    frightNotes.push("May feature mild suspense, emotional drama, or brief perilous moments.");
  } else if (frightLvl === 2) {
    frightNotes.push("Includes sustained suspense, intense dramatic sequences, or unsettling atmosphere.");
  } else {
    frightNotes.push("Features high-intensity sequences, psychological distress, jump scares, or disturbing themes.");
  }

  return {
    nudity: { severity: toSeverity(nudityLvl), notes: nudityNotes },
    violence: { severity: toSeverity(violenceLvl), notes: violenceNotes },
    profanity: { severity: toSeverity(profanityLvl), notes: profanityNotes },
    alcohol: { severity: toSeverity(alcoholLvl), notes: alcoholNotes },
    frightening: { severity: toSeverity(frightLvl), notes: frightNotes },
  };
}

export function buildNativeParentalGuide(film: Partial<Film>): ParentalGuideData {
  const mpaaRating = normalizeMpaaRating(film.ratingMpaa);
  const ageLimit = normalizeAgeLimit(film.ratingAgeLimits);
  const ageDigits = film.ratingAgeLimits
    ? parseInt(film.ratingAgeLimits.replace(/[^0-9]/g, ""), 10)
    : null;
  const ageNum = ageDigits !== null && !isNaN(ageDigits) ? ageDigits : null;

  const mpaaMeta = mpaaRating ? MPAA_DESCRIPTIONS[mpaaRating] : undefined;
  const ageMeta =
    ageNum !== null ? AGE_LIMIT_DESCRIPTIONS[String(ageNum)] : undefined;

  const genreNames = (film.genres ?? []).map((g) => g.genre);
  const inferred = inferCategorySeverities(mpaaRating, ageNum, genreNames);

  const certificates: ParentalCertificate[] = [];
  if (mpaaRating) {
    certificates.push({
      country: "United States",
      countryCode: "US",
      rating: mpaaRating,
      reason: mpaaMeta ? `${mpaaMeta.label} — ${mpaaMeta.summary}` : undefined,
    });
  }
  if (ageLimit) {
    certificates.push({
      country: "Age Classification",
      countryCode: "AGE",
      rating: ageLimit,
      reason: ageMeta?.label,
    });
  }

  const categories: ParentalCategory[] = PARENTAL_CATEGORIES_ORDER.map(
    ({ key, title }) => {
      const est = inferred[key];
      return {
        key,
        title,
        severity: est.severity,
        votes: {
          none: 0,
          mild: 0,
          moderate: 0,
          severe: 0,
          totalVotes: 0,
        },
        items: est.notes.map((text, idx) => ({
          id: `native-${key}-${idx}`,
          text,
          isSpoiler: false,
        })),
      };
    },
  );

  return {
    imdbId: film.imdbId ?? null,
    source: "native",
    mpaaRating,
    mpaaDescription: mpaaMeta
      ? `${mpaaMeta.label} — ${mpaaMeta.summary}`
      : null,
    mpaaReason: mpaaMeta?.detail ?? null,
    ageLimit,
    ageLimitDescription: ageMeta
      ? `${ageMeta.label}: ${ageMeta.detail}`
      : null,
    certificates,
    categories,
    fetchedAt: new Date().toISOString(),
  };
}

export function mergeParentalGuideWithFilm(
  apiData: Partial<ParentalGuideData> | null | undefined,
  film: Partial<Film>,
): ParentalGuideData {
  const native = buildNativeParentalGuide(film);
  if (!apiData || !apiData.categories || apiData.categories.length === 0) {
    return native;
  }

  const hasAnyImdbContent = apiData.categories.some(
    (c) =>
      c.items.length > 0 ||
      c.severity !== "UNKNOWN" ||
      c.votes.totalVotes > 0,
  );

  if (!hasAnyImdbContent && (!apiData.certificates || apiData.certificates.length === 0)) {
    return native;
  }

  const mpaaRating = apiData.mpaaRating || native.mpaaRating;
  const mpaaMeta = mpaaRating ? MPAA_DESCRIPTIONS[mpaaRating] : undefined;

  const mergedCategories: ParentalCategory[] = PARENTAL_CATEGORIES_ORDER.map(
    ({ key, title }) => {
      const fromImdb = apiData.categories?.find((c) => c.key === key);
      const fromNative = native.categories.find((c) => c.key === key)!;

      if (!fromImdb) return fromNative;

      const severity: SeverityLevel =
        fromImdb.severity && fromImdb.severity !== "UNKNOWN"
          ? fromImdb.severity
          : fromNative.severity;

      const items =
        fromImdb.items && fromImdb.items.length > 0
          ? fromImdb.items
          : fromNative.items;

      return {
        key,
        title,
        severity,
        votes: fromImdb.votes ?? fromNative.votes,
        items,
      };
    },
  );

  // Merge certificates without duplicates
  const certs = [...(apiData.certificates ?? [])];
  for (const nc of native.certificates) {
    const exists = certs.some(
      (c) =>
        c.country.toLowerCase() === nc.country.toLowerCase() &&
        c.rating.toLowerCase() === nc.rating.toLowerCase(),
    );
    if (!exists) certs.push(nc);
  }

  const isPureImdb = apiData.categories.some((c) => c.items.length > 0);

  return {
    imdbId: film.imdbId ?? apiData.imdbId ?? null,
    source: isPureImdb ? "imdb" : "hybrid",
    mpaaRating,
    mpaaDescription:
      apiData.mpaaDescription ||
      (mpaaMeta ? `${mpaaMeta.label} — ${mpaaMeta.summary}` : native.mpaaDescription),
    mpaaReason: apiData.mpaaReason || native.mpaaReason,
    ageLimit: native.ageLimit || apiData.ageLimit || null,
    ageLimitDescription:
      native.ageLimitDescription || apiData.ageLimitDescription || null,
    certificates: certs,
    categories: mergedCategories,
    fetchedAt: apiData.fetchedAt || new Date().toISOString(),
  };
}

// ─── Client Cache & Fetcher ──────────────────────────────────────────────────

const PG_CACHE_PREFIX = "cinemix_pg_cache_v1:";
const PG_TTL_IMDB_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const PG_TTL_NATIVE_MS = 60 * 60 * 1000; // 1 hour

const memoryPgCache = new Map<
  string,
  { data: ParentalGuideData; expiresAt: number }
>();
const inflightPg = new Map<string, Promise<ParentalGuideData>>();

function getCacheKey(film: Partial<Film>): string {
  if (film.imdbId) return `imdb:${film.imdbId}`;
  return `kp:${film.kinopoiskId ?? film.filmId ?? "unknown"}`;
}

function getCachedGuide(key: string): ParentalGuideData | null {
  const now = Date.now();
  const mem = memoryPgCache.get(key);
  if (mem && mem.expiresAt > now) return mem.data;

  if (typeof window !== "undefined") {
    try {
      const raw = localStorage.getItem(PG_CACHE_PREFIX + key);
      if (raw) {
        const parsed = JSON.parse(raw) as {
          data: ParentalGuideData;
          expiresAt: number;
        };
        if (parsed.expiresAt > now) {
          memoryPgCache.set(key, parsed);
          return parsed.data;
        }
        localStorage.removeItem(PG_CACHE_PREFIX + key);
      }
    } catch {
      // ignore storage errors
    }
  }
  return null;
}

function setCachedGuide(key: string, data: ParentalGuideData) {
  const ttl = data.source === "imdb" ? PG_TTL_IMDB_MS : PG_TTL_NATIVE_MS;
  const entry = { data, expiresAt: Date.now() + ttl };
  memoryPgCache.set(key, entry);

  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(PG_CACHE_PREFIX + key, JSON.stringify(entry));
    } catch {
      // ignore storage quota errors
    }
  }
}

export async function getParentalGuide(
  film: Partial<Film>,
): Promise<ParentalGuideData> {
  const cacheKey = getCacheKey(film);
  const cached = getCachedGuide(cacheKey);
  if (cached) {
    return mergeParentalGuideWithFilm(cached, film);
  }

  const imdbId = film.imdbId?.trim();
  if (!imdbId || !/^tt\d+$/i.test(imdbId)) {
    const native = buildNativeParentalGuide(film);
    setCachedGuide(cacheKey, native);
    return native;
  }

  const existing = inflightPg.get(cacheKey);
  if (existing) return existing;

  const promise = (async (): Promise<ParentalGuideData> => {
    try {
      const res = await fetch(
        `/api/parental-guide?imdbId=${encodeURIComponent(imdbId)}`,
      );
      if (!res.ok) {
        const fallback = buildNativeParentalGuide(film);
        setCachedGuide(cacheKey, fallback);
        return fallback;
      }
      const raw = (await res.json()) as Partial<ParentalGuideData>;
      const merged = mergeParentalGuideWithFilm(raw, film);
      setCachedGuide(cacheKey, merged);
      return merged;
    } catch {
      const fallback = buildNativeParentalGuide(film);
      setCachedGuide(cacheKey, fallback);
      return fallback;
    } finally {
      inflightPg.delete(cacheKey);
    }
  })();

  inflightPg.set(cacheKey, promise);
  return promise;
}

export function getQuickCertBadge(
  film?: Partial<Film> | null,
): { label: string; isMature: boolean } | null {
  if (!film) return null;
  const mpaa = normalizeMpaaRating(film.ratingMpaa);
  const age = normalizeAgeLimit(film.ratingAgeLimits);
  if (mpaa && age) {
    return {
      label: `${mpaa} · ${age}`,
      isMature: mpaa === "R" || mpaa === "NC-17" || age === "18+" || age === "18",
    };
  }
  if (mpaa) {
    return {
      label: mpaa,
      isMature: mpaa === "R" || mpaa === "NC-17",
    };
  }
  if (age) {
    return {
      label: age,
      isMature: age === "18+" || age === "18",
    };
  }
  return null;
}