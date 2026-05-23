import type { Metadata } from "next";
import ProfileClient from "@/components/ProfileClient";
export const metadata: Metadata = { title: "Profile" };
export default function ProfilePage() { return <ProfileClient />; }
