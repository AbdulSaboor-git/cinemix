import SearchClient from "@/components/SearchClient";
interface Props { searchParams: Promise<{ q?: string; page?: string }> }
export default async function SearchPage({ searchParams }: Props) {
  const p = await searchParams;
  return <SearchClient q={p.q} page={p.page} />;
}
