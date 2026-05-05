import Top250Client from "@/components/Top250Client";
interface Props { searchParams: Promise<{ page?: string }> }
export default async function Top250Page({ searchParams }: Props) {
  const p = await searchParams;
  return <Top250Client page={p.page} />;
}
