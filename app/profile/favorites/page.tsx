import type { Metadata } from "next";
import UserListPage from "@/components/UserListPage";
export const metadata: Metadata = { title: "Favorites" };
export default function FavoritesPage() { return <UserListPage type="favorites" />; }
