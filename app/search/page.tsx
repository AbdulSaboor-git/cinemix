import SimpleExploreClient from "@/components/SimpleExploreClient";

interface Props {
  searchParams: Promise<{
    q?: string;
    page?: string;
    type?: string;
    sort?: string;
    rated?: string;
  }>;
}

export default async function SearchPage({ searchParams }: Props) {
  const p = await searchParams;
  return (
    <SimpleExploreClient
      q={p.q}
      page={p.page}
      type={p.type}
      order={p.sort}
      rated={p.rated}
    />
  );
}
