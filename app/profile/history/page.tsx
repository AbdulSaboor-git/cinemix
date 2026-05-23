import type { Metadata } from "next";
import UserListPage from "@/components/UserListPage";
export const metadata: Metadata = { title: "Watch History" };
export default function HistoryPage() { return <UserListPage type="history" />; }
