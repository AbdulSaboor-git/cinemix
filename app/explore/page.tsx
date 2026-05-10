import BrowseClient from "@/components/BrowseClient";

interface Props {
  searchParams: Promise<{
    type?: string;
    order?: string;
    page?: string;
    genres?: string;
    countries?: string;
    ratingFrom?: string;
    ratingTo?: string;
    yearFrom?: string;
    yearTo?: string;
  }>;
}

export default async function BrowsePage({ searchParams }: Props) {
  const p = await searchParams;
  return (
    <BrowseClient
      type={p.type}
      order={p.order}
      page={p.page}
      genres={p.genres}
      countries={p.countries}
      ratingFrom={p.ratingFrom}
      ratingTo={p.ratingTo}
      yearFrom={p.yearFrom}
      yearTo={p.yearTo}
    />
  );
}
