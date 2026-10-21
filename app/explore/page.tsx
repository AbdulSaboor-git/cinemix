import BrowseClient from "@/components/BrowseClient";

export interface ExploreSearchParams {
  type?: string;
  excludeTypes?: string;
  order?: string;
  dir?: string;
  page?: string;
  genres?: string;
  excludeGenres?: string;
  genreMode?: string;
  countries?: string;
  excludeCountries?: string;
  excludeRu?: string;
  ratingFrom?: string;
  ratingTo?: string;
  ratingSource?: string;
  minVotes?: string;
  requireImdb?: string;
  yearFrom?: string;
  yearTo?: string;
  runtime?: string;
  age?: string;
  excludeAge?: string;
  status?: string;
  keyword?: string;
  collection?: string;
  lens?: string;
  hideWatched?: string;
  hideFavorites?: string;
  hideWatchLater?: string;
  view?: string;
}

interface Props {
  searchParams: Promise<ExploreSearchParams>;
}

export default async function BrowsePage({ searchParams }: Props) {
  const p = await searchParams;
  return <BrowseClient {...p} />;
}
