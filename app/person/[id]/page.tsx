import PersonClient from "@/components/PersonClient";
interface Props { params: Promise<{ id: string }> }
export default async function PersonPage({ params }: Props) {
  const { id } = await params;
  return <PersonClient personId={id} />;
}
