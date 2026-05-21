import type { Metadata } from "next";
import PremieresClient from "@/components/PremieresClient";

export const metadata: Metadata = {
  title: "Premieres",
  description: "Browse upcoming and recent film premieres by month.",
};

interface Props {
  searchParams: Promise<{ year?: string; month?: string }>;
}

export default async function PremieresPage({ searchParams }: Props) {
  const p = await searchParams;
  return <PremieresClient year={p.year} month={p.month} />;
}
