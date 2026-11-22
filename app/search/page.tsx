import { redirect } from "next/navigation";

interface Props {
  searchParams: Promise<{
    q?: string;
    page?: string;
    type?: string;
    sort?: string;
    rated?: string;
  }>;
}

export default async function SearchPage({ searchParams }: Props) {
  const p = await searchParams;
  const sp = new URLSearchParams();
  if (p.q) sp.set("q", p.q);
  if (p.page) sp.set("page", p.page);
  if (p.type) sp.set("type", p.type);
  if (p.sort) sp.set("order", p.sort);
  if (p.rated) sp.set("rated", p.rated);
  const qs = sp.toString();
  redirect(qs ? `/explore?${qs}` : "/explore");
}
