"use client";
import { Film } from "lucide-react";
import PageContainer from "@/components/ui/PageContainer";
import EmptyState from "@/components/ui/EmptyState";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";

export default function NotFound() {
  useDocumentTitle("Page Not Found");

  return (
    <PageContainer className="flex items-center justify-center">
      <EmptyState
        icon={<Film size={48} stroke="var(--accent)" strokeWidth={1.5} />}
        title="Page Not Found"
        description="The scene you are looking for doesn't exist or has been moved."
        actionLabel="Back to Home"
        actionHref="/"
      />
    </PageContainer>
  );
}
