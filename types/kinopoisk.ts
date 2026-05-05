export interface Film {
  filmId?: number;
  kinopoiskId: number;
  imdbId?: string;
  nameRu?: string;
  nameEn?: string;
  nameOriginal?: string;
  posterUrl: string;
  posterUrlPreview: string;
  coverUrl?: string;
  logoUrl?: string;
  reviewsCount?: number;
  ratingGoodReview?: number;
  ratingKinopoisk?: number;
  ratingImdb?: number;
  rating?: number;
  webUrl?: string;
  year?: number;
  filmLength?: number;
  slogan?: string;
  description?: string;
  shortDescription?: string;
  type?: "FILM" | "TV_SHOW" | "TV_SERIES" | "MINI_SERIES" | "VIDEO";
  ratingAgeLimits?: string;
  ratingMpaa?: string;
  countries?: { country: string }[];
  genres?: { genre: string }[];
  startYear?: number;
  endYear?: number;
  serial?: boolean;
  completed?: boolean;
}

export interface FilmsResponse {
  total: number;
  totalPages: number;
  items: Film[];
}

export interface Staff {
  staffId: number;
  nameRu?: string;
  nameEn?: string;
  description?: string;
  posterUrl?: string;
  professionText?: string;
  professionKey?: string;
}

export interface PersonDetail {
  personId: number;
  nameRu?: string;
  nameEn?: string;
  posterUrl?: string;
  birthday?: string;
  birthplace?: string;
  death?: string;
  age?: number;
  profession?: string;
  films?: PersonFilm[];
}

export interface PersonFilm {
  filmId: number;
  nameRu?: string;
  nameEn?: string;
  rating?: string;
  description?: string;
  professionKey?: string;
  general?: boolean;
}

export interface VideoItem {
  url: string;
  name: string;
  site: string;
}

export interface VideosResponse {
  total: number;
  items: VideoItem[];
}

export interface Genre {
  id: number;
  genre: string;
}

export interface Country {
  id: number;
  country: string;
}

export interface FiltersResponse {
  genres: Genre[];
  countries: Country[];
}
