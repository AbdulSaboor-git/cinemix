import WatchPageClient from "@/components/WatchPageClient";

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ player?: string }>;
}

export default async function WatchPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { player } = await searchParams;
  return <WatchPageClient filmId={id} initialPlayerId={player} />;
}
