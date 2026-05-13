import Link from "next/link";

interface PaginationProps {
  page: number;
  totalPages: number;
  buildHref: (page: number) => string;
}

export default function Pagination({
  page,
  totalPages,
  buildHref,
}: PaginationProps) {
  if (totalPages <= 1) return null;

  // Wider window on desktop (delta=2), tighter on mobile (delta=1 handled via CSS hide)
  const delta = 2;
  const left = Math.max(2, page - delta);
  const right = Math.min(totalPages - 1, page + delta);

  const pages: (number | "...")[] = [];
  pages.push(1);
  if (left > 2) pages.push("...");
  for (let i = left; i <= right; i++) pages.push(i);
  if (right < totalPages - 1) pages.push("...");
  if (totalPages > 1) pages.push(totalPages);

  // On mobile, only show current page ±1 neighbours (hide the rest via data attr)
  const mobileVisible = new Set(
    [1, page - 1, page, page + 1, totalPages].filter(
      (n) => n >= 1 && n <= totalPages,
    ),
  );

  return (
    <div className="flex items-center justify-center gap-1 sm:gap-[6px] py-10 px-4 flex-wrap">
      {/* Prev */}
      <Link
        href={page > 1 ? buildHref(page - 1) : "#"}
        className="no-underline flex-shrink-0"
        aria-disabled={page <= 1}
      >
        <button
          className="page-btn min-w-[40px] min-h-[40px] sm:min-w-[36px] sm:min-h-[36px]"
          disabled={page <= 1}
          aria-label="Previous page"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
          >
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
      </Link>

      {pages.map((p, i) =>
        p === "..." ? (
          <span
            key={`ellipsis-${i}`}
            className="text-[var(--text-muted)] px-1 text-[13px] hidden sm:inline"
          >
            …
          </span>
        ) : (
          <Link
            key={p}
            href={buildHref(p as number)}
            className={`no-underline flex-shrink-0 ${!mobileVisible.has(p as number) ? "hidden sm:inline-flex" : ""}`}
          >
            <button
              className={`page-btn min-w-[40px] min-h-[40px] sm:min-w-[36px] sm:min-h-[36px] text-[13px] sm:text-[14px] ${page === p ? "active" : ""}`}
            >
              {p}
            </button>
          </Link>
        ),
      )}

      {/* Next */}
      <Link
        href={page < totalPages ? buildHref(page + 1) : "#"}
        className="no-underline flex-shrink-0"
        aria-disabled={page >= totalPages}
      >
        <button
          className="page-btn min-w-[40px] min-h-[40px] sm:min-w-[36px] sm:min-h-[36px]"
          disabled={page >= totalPages}
          aria-label="Next page"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
          >
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>
      </Link>
    </div>
  );
}
