import type { Metadata } from "next";
import PreferencesClient from "@/components/PreferencesClient";

export const metadata: Metadata = {
  title: "Preferences",
  description: "Configure your API keys, search behaviour, and display settings.",
};

export default function PreferencesPage() {
  return <PreferencesClient />;
}
