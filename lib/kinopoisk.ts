import {
  Film, FilmsResponse, Staff, VideosResponse, PersonDetail,
  FiltersResponse, FactsResponse, BoxOfficeResponse, SeasonsResponse,
  SimilarsResponse, ReviewsResponse
} from "@/types/kinopoisk";
import { getApiKeys } from "@/lib/preferences";

const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "https://kinopoiskapiunofficial.tech/api";

// Track exhausted keys with timestamp (24h window)
const exhausted = new Map<string, number>();

function getKey(): string {
  const now = Date.now();
  for (const [k, t] of exhausted) {
    if (now - t > 24 * 60 * 60 * 1000) exhausted.delete(k);
  }
  const keys = getApiKeys();
  const available = keys.filter(k => !exhausted.has(k));
  if (!available.length) throw new Error("All API keys exhausted for today.");
  return available[0];
}

function markExhausted(key: string) {
  exhausted.set(key, Date.now());
  const keys = getApiKeys();
  console.warn(`[CineMix] Key ${key.slice(0, 8)}… exhausted. ${keys.filter(k => !exhausted.has(k)).length} remaining.`);
}

async function apiFetch<T>(path: string, revalidate = 3600): Promise<T> {
  const keys = getApiKeys();
  let lastError: Error | null = null;
  for (let attempt = 0; attempt < Math.max(keys.length, 1); attempt++) {
    const key = getKey();
    const res = await fetch(`${BASE_URL}${path}`, {
      headers: { "X-API-KEY": key, "Content-Type": "application/json" },
      next: { revalidate },
    });
    if (res.status === 402 || res.status === 429) {
      markExhausted(key);
      lastError = new Error(`Key exhausted: ${key.slice(0, 8)}…`);
      continue;
    }
    if (!res.ok) throw new Error(`API error: ${res.status} ${path}`);
    return res.json();
  }
  throw lastError ?? new Error("All API keys exhausted.");
}

function normalizeFilmsResponse(raw: Record<string, unknown>): FilmsResponse {
  // API v2.2/films returns `items`, v2.2/films/top returns `films`
  const items = (raw.items ?? raw.films ?? []) as Film[];
  const normalized = items.map(f => ({
    ...f,
    // BUG FIX: top list uses filmId, not kinopoiskId
    kinopoiskId: f.kinopoiskId ?? f.filmId ?? 0,
  }));
  return {
    items: normalized,
    total: (raw.total as number) ?? normalized.length,
    totalPages: (raw.totalPages as number) ?? 1,
  };
}

// ─── Films ──────────────────────────────────────────────────────────────────

export async function getTopFilms(
  type: "TOP_100_POPULAR_FILMS" | "TOP_250_BEST_FILMS" | "TOP_AWAIT_FILMS" = "TOP_100_POPULAR_FILMS",
  page = 1
): Promise<FilmsResponse> {
  const raw = await apiFetch<Record<string, unknown>>(`/v2.2/films/top?type=${type}&page=${page}`);
  return normalizeFilmsResponse(raw);
}

export async function getFilmsByFilter(params: {
  genres?: number;
  countries?: number;
  order?: "RATING" | "NUM_VOTE" | "YEAR";
  type?: "ALL" | "FILM" | "TV_SHOW" | "TV_SERIES" | "MINI_SERIES";
  ratingFrom?: number;
  ratingTo?: number;
  yearFrom?: number;
  yearTo?: number;
  keyword?: string;
  page?: number;
}): Promise<FilmsResponse> {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => v !== undefined && q.set(k, String(v)));
  const raw = await apiFetch<Record<string, unknown>>(`/v2.2/films?${q.toString()}`);
  return normalizeFilmsResponse(raw);
}

export async function getFilm(id: number): Promise<Film> {
  return apiFetch(`/v2.2/films/${id}`);
}

export async function getFilmStaff(filmId: number): Promise<Staff[]> {
  return apiFetch(`/v1/staff?filmId=${filmId}`);
}

export async function getFilmVideos(filmId: number): Promise<VideosResponse> {
  return apiFetch(`/v2.2/films/${filmId}/videos`);
}

export async function searchFilms(keyword: string, page = 1): Promise<FilmsResponse> {
  const raw = await apiFetch<Record<string, unknown>>(
    `/v2.1/films/search-by-keyword?keyword=${encodeURIComponent(keyword)}&page=${page}`
  );
  // BUG FIX: search API returns `films` not `items`, and uses `filmId` not `kinopoiskId`
  return normalizeFilmsResponse(raw);
}

export async function getRelatedFilms(filmId: number): Promise<Film[]> {
  // BUG FIX: Returns array directly (not wrapped), each item has filmId not kinopoiskId
  const items = await apiFetch<Film[]>(`/v2.1/films/${filmId}/sequels_and_prequels`);
  return items.map(f => ({ ...f, kinopoiskId: f.kinopoiskId ?? f.filmId ?? 0 }));
}

export async function getSimilarFilms(filmId: number): Promise<SimilarsResponse> {
  return apiFetch(`/v2.2/films/${filmId}/similars`);
}

export async function getPerson(personId: number): Promise<PersonDetail> {
  return apiFetch(`/v1/staff/${personId}`, 86400);
}

export async function getFilters(): Promise<FiltersResponse> {
  return apiFetch(`/v2.2/films/filters`, 86400);
}

// ─── New endpoints not previously implemented ────────────────────────────────

export async function getFilmFacts(filmId: number): Promise<FactsResponse> {
  return apiFetch(`/v2.2/films/${filmId}/facts`);
}

export async function getFilmBoxOffice(filmId: number): Promise<BoxOfficeResponse> {
  return apiFetch(`/v2.2/films/${filmId}/box_office`);
}

export async function getFilmSeasons(filmId: number): Promise<SeasonsResponse> {
  return apiFetch(`/v2.2/films/${filmId}/seasons`);
}

export async function getFilmImages(filmId: number, type = "STILL", page = 1): Promise<{ total: number; totalPages: number; items: { imageUrl: string; previewUrl: string }[] }> {
  return apiFetch(`/v2.2/films/${filmId}/images?type=${type}&page=${page}`);
}

export async function getFilmReviews(filmId: number, page = 1): Promise<ReviewsResponse> {
  return apiFetch(`/v1/reviews?filmId=${filmId}&page=${page}`);
}

export async function searchPersons(name: string): Promise<{ total: number; items: { kinopoiskId: number; nameRu?: string; nameEn?: string; posterUrl?: string }[] }> {
  const raw = await apiFetch<Record<string, unknown>>(
    `/v1/persons?name=${encodeURIComponent(name)}`
  );
  return raw as { total: number; items: { kinopoiskId: number; nameRu?: string; nameEn?: string; posterUrl?: string }[] };
}

export async function getPremieres(year: number, month: string): Promise<FilmsResponse> {
  const raw = await apiFetch<Record<string, unknown>>(`/v2.2/films/premieres?year=${year}&month=${month}`);
  return normalizeFilmsResponse(raw);
}
