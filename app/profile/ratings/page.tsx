import type { Metadata } from "next";
import UserListPage from "@/components/UserListPage";
export const metadata: Metadata = { title: "My Ratings" };
export default function RatingsPage() {
  return <UserListPage type="ratings" />;
}
