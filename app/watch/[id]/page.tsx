import WatchPageClient from "@/components/WatchPageClient";

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ mode?: string }>;
}

export default async function WatchPage({ params, searchParams }: Props) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const initialMode =
    sp?.mode?.toLowerCase() === "trailer" ? "trailer" : "watch";
  return <WatchPageClient filmId={id} initialMode={initialMode} />;
}
