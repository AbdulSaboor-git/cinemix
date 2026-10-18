import type { Metadata } from "next";
import Top250Client from "@/components/Top250Client";

export const metadata: Metadata = {
  title: "Top 250",
  description:
    "Browse the official Kinopoisk Top 250 movies and TV series of all time.",
};

interface Props {
  searchParams: Promise<{ page?: string; type?: string }>;
}

export default async function Top250Page({ searchParams }: Props) {
  const p = await searchParams;
  return <Top250Client page={p.page} type={p.type} />;
}
