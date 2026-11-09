import BrowseClient from "@/components/BrowseClient";
import type { ExploreSearchParams } from "@/app/explore/page";

interface Props {
  searchParams: Promise<ExploreSearchParams>;
}

export default async function AdvancedExplorePage({ searchParams }: Props) {
  const p = await searchParams;
  return <BrowseClient {...p} />;
}
