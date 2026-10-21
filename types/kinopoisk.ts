export type CollectionType =
  | "TOP_POPULAR_ALL"
  | "TOP_POPULAR_MOVIES"
  | "TOP_250_MOVIES"
  | "TOP_250_TV_SHOWS"
  | "POPULAR_SERIES"
  | "CLOSES_RELEASES"
  | "VAMPIRE_THEME"
  | "COMICS_THEME"
  | "FAMILY"
  | "OSKAR_WINNERS_2021"
  | "LOVE_THEME"
  | "ZOMBIE_THEME"
  | "CATASTROPHE_THEME"
  | "KIDS_ANIMATION_THEME"
  // Legacy aliases transparently mapped to v2.2 collections
  | "TOP_100_POPULAR_FILMS"
  | "TOP_250_BEST_FILMS"
  | "TOP_AWAIT_FILMS";

export type MediaTypeFilter =
  | "ALL"
  | "FILM"
  | "TV_SERIES"
  | "TV_SHOW"
  | "MINI_SERIES";

export type ExploreSortOrder =
  | "NUM_VOTE"
  | "RATING"
  | "IMDB_RATING"
  | "KP_RATING"
  | "YEAR"
  | "HIDDEN_GEMS"
  | "CRITICS"
  | "TITLE"
  | "RANDOM";

export type SortDirection = "DESC" | "ASC";

export type RatingSource = "AUTO" | "IMDB" | "KP" | "AVERAGE" | "CRITICS";

export type RuntimeBucket = "ANY" | "SHORT" | "MEDIUM" | "LONG" | "STANDARD" | "EPIC";

export type AgeTierFilter = "FAMILY" | "TEEN" | "MATURE";

export type SeriesStatusFilter = "ALL" | "COMPLETED" | "ONGOING";

export interface SavedExplorePreset {
  id: string;
  name: string;
  params: Record<string, string>;
  queryString?: string;
  createdAt: number | string;
}

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
  rating?: number | string;
  webUrl?: string;
  year?: number;
  filmLength?: number;
  duration?: number;
  premiereRu?: string;
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

export type StaffMember = Staff;

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
  growth?: number | string;
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

export interface ImageItem {
  imageUrl: string;
  previewUrl: string;
}

export type GalleryImageType =
  | "STILL"
  | "SHOOTING"
  | "POSTER"
  | "WALLPAPER"
  | "FAN_ART"
  | "PROMO"
  | "CONCEPT"
  | "COVER"
  | "SCREENSHOT";

export interface ImagesResponse {
  total: number;
  totalPages: number;
  items: ImageItem[];
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
  totalPositiveReviews?: number;
  totalNegativeReviews?: number;
  totalNeutralReviews?: number;
  items: Review[];
}

// ─── Awards ──────────────────────────────────────────────────────────────────

export interface AwardPerson {
  kinopoiskId: number;
  webUrl?: string;
  nameRu?: string;
  nameEn?: string;
  sex?: string;
  posterUrl?: string;
  growth?: number;
  birthday?: string;
  death?: string;
  age?: number;
  birthplace?: string;
  deathplace?: string;
  profession?: string;
}

export interface Award {
  name: string;
  win: boolean;
  imageUrl?: string;
  nominationName: string;
  year: number;
  persons?: AwardPerson[];
}

export interface AwardResponse {
  total: number;
  items: Award[];
}

// ─── Distributions ───────────────────────────────────────────────────────────

export interface DistributionCompany {
  name: string;
}

export interface Distribution {
  type: string;
  subType?: string;
  date?: string;
  reRelease?: boolean;
  country?: { country: string };
  companies?: DistributionCompany[];
}

export interface DistributionResponse {
  total: number;
  items: Distribution[];
}

// ─── API Key Quota ────────────────────────────────────────────────────────────

export interface ApiKeyQuota {
  value: number;
  used: number;
}

export interface ApiKeyResponse {
  totalQuota: ApiKeyQuota;
  dailyQuota: ApiKeyQuota;
  accountType: "FREE" | "BASIC" | "EXTENDED";
}