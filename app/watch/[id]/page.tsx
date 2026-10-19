import WatchPageClient from "@/components/WatchPageClient";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function WatchPage({ params }: Props) {
  const { id } = await params;
  return <WatchPageClient filmId={id} />;
}
