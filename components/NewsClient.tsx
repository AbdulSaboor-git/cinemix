"use client";
import { useEffect, useState } from "react";
import { getMediaPosts } from "@/lib/kinopoisk";
import { MediaPost } from "@/types/kinopoisk";
import { useTranslate } from "@/hooks/useTranslate";
import Pagination from "@/components/Pagination";
import Image from "next/image";

export default function NewsClient({ page: pg }: { page?: string }) {
  const page = Math.max(1, parseInt(pg || "1"));
  const [posts, setPosts] = useState<MediaPost[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    window.scrollTo({ top: 0 });
    getMediaPosts(page)
      .then((d) => {
        setPosts(d.items ?? []);
        setTotalPages(d.totalPages ?? 1);
        setTotal(d.total ?? 0);
      })
      .catch(() => setPosts([]))
      .finally(() => setLoading(false));
  }, [page]);

  return (
    <div className="min-h-screen pb-20">
      <div className="px-4 sm:px-[var(--page-x)] pt-8 sm:pt-10 pb-6">
        <div className="flex items-center gap-2 mb-1">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2">
            <path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 0-2 2zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2"/>
            <path d="M18 14h-8M15 18h-5M10 6h8v4h-8z"/>
          </svg>
          <p className="text-[11px] text-[var(--text-muted)] uppercase tracking-[2px]">Kinopoisk Editorial</p>
        </div>
        <h1 className="font-display tracking-[2px] text-[clamp(28px,5vw,52px)] leading-none mb-1">
          NEWS & FEATURES
        </h1>
        {!loading && total > 0 && (
          <p className="text-[13px] text-[var(--text-muted)]">{total.toLocaleString()} articles</p>
        )}
      </div>

      <div className="px-4 sm:px-[var(--page-x)]">
        {loading ? (
          <div className="grid gap-4 sm:gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 9 }).map((_, i) => (
              <div key={i} className="skeleton rounded-[var(--radius-lg)]" style={{ height: "280px" }} />
            ))}
          </div>
        ) : posts.length === 0 ? (
          <div className="flex flex-col items-center py-20 gap-4 text-center text-[var(--text-dim)]">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5">
              <path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 0-2 2z"/>
            </svg>
            <p className="text-[16px]">No news available</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {posts.map((post) => (
              <NewsCard key={post.kinopoiskId} post={post} />
            ))}
          </div>
        )}
      </div>

      <Pagination
        page={page}
        totalPages={totalPages}
        buildHref={(p) => `/news?page=${p}`}
      />
    </div>
  );
}

function NewsCard({ post }: { post: MediaPost }) {
  const title = useTranslate(post.title);
  const description = useTranslate(post.description);

  return (
    <a
      href={post.url}
      target="_blank"
      rel="noreferrer noopener"
      className="no-underline group block"
    >
      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-lg)] overflow-hidden hover:border-[rgba(229,9,20,0.3)] transition-all duration-200 h-full flex flex-col">
        {/* Image */}
        <div className="relative w-full aspect-[16/9] bg-[var(--surface)] overflow-hidden">
          {post.imageUrl ? (
            <Image
              src={post.imageUrl}
              alt={title}
              fill
              className="object-cover group-hover:scale-[1.03] transition-transform duration-500"
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5">
                <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/>
                <polyline points="21 15 16 10 5 21"/>
              </svg>
            </div>
          )}
          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-[var(--bg-card)] via-transparent to-transparent opacity-60" />
        </div>

        {/* Content */}
        <div className="p-3 sm:p-4 flex flex-col flex-1">
          <p className="font-semibold text-[var(--text)] text-[13px] sm:text-[14px] leading-[1.4] mb-2 group-hover:text-white transition-colors line-clamp-2">
            {title}
          </p>
          <p className="text-[11px] sm:text-[12px] text-[var(--text-muted)] leading-[1.6] line-clamp-3 flex-1">
            {description}
          </p>
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-[var(--border)]">
            <span className="text-[10px] sm:text-[11px] text-[var(--text-muted)]">
              {new Date(post.publishedAt).toLocaleDateString("en-US", {
                year: "numeric", month: "short", day: "numeric",
              })}
            </span>
            <span className="text-[10px] sm:text-[11px] text-[var(--accent)] flex items-center gap-1">
              Read on Kinopoisk
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
              </svg>
            </span>
          </div>
        </div>
      </div>
    </a>
  );
}
