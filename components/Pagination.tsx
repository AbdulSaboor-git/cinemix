import Link from "next/link";

interface PaginationProps {
  page: number;
  totalPages: number;
  buildHref: (page: number) => string;
}

export default function Pagination({ page, totalPages, buildHref }: PaginationProps) {
  if (totalPages <= 1) return null;

  // Build a smart window of page numbers
  const pages: (number | "...")[] = [];
  const delta = 2;
  const left  = Math.max(2, page - delta);
  const right = Math.min(totalPages - 1, page + delta);

  pages.push(1);
  if (left > 2) pages.push("...");
  for (let i = left; i <= right; i++) pages.push(i);
  if (right < totalPages - 1) pages.push("...");
  if (totalPages > 1) pages.push(totalPages);

  return (
    <div className="pagination">
      <Link href={page > 1 ? buildHref(page - 1) : "#"} style={{ textDecoration: "none" }}>
        <button className="page-btn" disabled={page <= 1}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M15 18l-6-6 6-6"/>
          </svg>
        </button>
      </Link>

      {pages.map((p, i) =>
        p === "..." ? (
          <span key={`ellipsis-${i}`} style={{ color: "var(--text-muted)", padding: "0 4px", fontSize: "14px" }}>…</span>
        ) : (
          <Link key={p} href={buildHref(p as number)} style={{ textDecoration: "none" }}>
            <button className={`page-btn ${page === p ? "active" : ""}`}>{p}</button>
          </Link>
        )
      )}

      <Link href={page < totalPages ? buildHref(page + 1) : "#"} style={{ textDecoration: "none" }}>
        <button className="page-btn" disabled={page >= totalPages}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M9 18l6-6-6-6"/>
          </svg>
        </button>
      </Link>
    </div>
  );
}
