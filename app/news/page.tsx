import type { Metadata } from "next";
import NewsClient from "@/components/NewsClient";

export const metadata: Metadata = {
  title: "News",
  description: "Latest news and editorial posts from Kinopoisk.",
};

interface Props {
  searchParams: Promise<{ page?: string }>;
}

export default async function NewsPage({ searchParams }: Props) {
  const p = await searchParams;
  return <NewsClient page={p.page} />;
}
