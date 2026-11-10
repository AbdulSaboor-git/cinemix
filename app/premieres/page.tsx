import type { Metadata } from "next";
import PremieresClient from "@/components/PremieresClient";

export const metadata: Metadata = {
  title: "Releases",
  description:
    "Browse upcoming and recent global theatrical, series, and digital releases by month.",
};

interface Props {
  searchParams: Promise<{
    year?: string;
    month?: string;
    sort?: string;
    tab?: string;
    type?: string;
  }>;
}

export default async function PremieresPage({ searchParams }: Props) {
  const p = await searchParams;
  return (
    <PremieresClient
      year={p.year}
      month={p.month}
      sort={p.sort}
      tab={p.tab}
      type={p.type}
    />
  );
}
