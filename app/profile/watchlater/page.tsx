import type { Metadata } from "next";
import UserListPage from "@/components/UserListPage";
export const metadata: Metadata = { title: "Watch Later" };
export default function WatchLaterPage() { return <UserListPage type="watchlater" />; }
