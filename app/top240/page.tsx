import Top240Client from "@/components/Top240Client";
interface Props {
  searchParams: Promise<{ page?: string }>;
}
export default async function Top240Page({ searchParams }: Props) {
  const p = await searchParams;
  return <Top240Client page={p.page} />;
}
