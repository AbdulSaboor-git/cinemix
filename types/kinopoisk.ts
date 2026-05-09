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
  ratingGoodReviewVoteCount?: number;
  ratingKinopoisk?: number;
  ratingKinopoiskVoteCount?: number;
  ratingImdb?: number;
  ratingImdbVoteCount?: number;
  ratingFilmCritics?: number;
  ratingFilmCriticsVoteCount?: number;
  ratingAwait?: number;
  ratingAwaitCount?: number;
  ratingRfCritics?: number;
  ratingRfCriticsVoteCount?: number;
  rating?: number;
  webUrl?: string;
  year?: number;
  filmLength?: number;
  slogan?: string;
  description?: string;
  shortDescription?: string;
  editorAnnotation?: string;
  isTicketsAvailable?: boolean;
  productionStatus?: string;
  type?: "FILM" | "TV_SHOW" | "TV_SERIES" | "MINI_SERIES" | "VIDEO";
  ratingAgeLimits?: string;
  ratingMpaa?: string;
  hasImax?: boolean;
  has3D?: boolean;
  countries?: { country: string }[];
  genres?: { genre: string }[];
  startYear?: number;
  endYear?: number;
  serial?: boolean;
  completed?: boolean;
  lastSync?: string;
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
  webUrl?: string;
  nameRu?: string;
  nameEn?: string;
  sex?: "MALE" | "FEMALE" | "UNKNOWN";
  posterUrl?: string;
  birthday?: string;
  birthplace?: string;
  death?: string;
  deathplace?: string;
  age?: number;
  hasAwards?: number;
  profession?: string;
  facts?: string[];
  spouses?: PersonSpouse[];
  films?: PersonFilm[];
}

export interface PersonSpouse {
  personId: number;
  name?: string;
  divorced?: boolean;
  divorcedReason?: string;
  sex?: string;
  children?: number;
  webUrl?: string;
  relation?: string;
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

export interface Fact {
  text: string;
  type: "FACT" | "BLOOPER";
  spoiler: boolean;
}

export interface FactsResponse {
  total: number;
  items: Fact[];
}

export interface BoxOfficeItem {
  type: string;
  amount: number;
  currencyCode: string;
  name: string;
  symbol: string;
}

export interface BoxOfficeResponse {
  total: number;
  items: BoxOfficeItem[];
}

export interface Season {
  number: number;
  episodes: Episode[];
}

export interface Episode {
  seasonNumber: number;
  episodeNumber: number;
  nameRu?: string;
  nameEn?: string;
  synopsis?: string;
  releaseDate?: string;
}

export interface SeasonsResponse {
  total: number;
  items: Season[];
}

export interface SimilarFilm {
  filmId: number;
  nameRu?: string;
  nameEn?: string;
  nameOriginal?: string;
  posterUrl: string;
  posterUrlPreview: string;
  relationType: string;
}

export interface SimilarsResponse {
  total: number;
  items: SimilarFilm[];
}

export interface Image {
  imageUrl: string;
  previewUrl: string;
}

export interface ImagesResponse {
  total: number;
  totalPages: number;
  items: Image[];
}

export interface Review {
  kinopoiskId: number;
  type: string;
  date: string;
  positiveRating: number;
  negativeRating: number;
  author: string;
  title?: string;
  description: string;
}

export interface ReviewsResponse {
  total: number;
  totalPages: number;
  items: Review[];
}
