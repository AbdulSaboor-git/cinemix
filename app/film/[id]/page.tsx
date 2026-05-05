import FilmPageClient from "@/components/FilmPageClient";
interface Props { params: Promise<{ id: string }> }
export default async function FilmPage({ params }: Props) {
  const { id } = await params;
  return <FilmPageClient filmId={id} />;
}
