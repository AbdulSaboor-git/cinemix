"use client";
// components/TrailerModal.tsx
import { useState, useEffect } from "react";
import { Film, Play } from "lucide-react";
import { getFilm, getFilmVideos } from "@/lib/kinopoisk";
import { useTranslate } from "@/hooks/useTranslate";
import ModalShell from "@/components/ui/ModalShell";
import TabBar from "@/components/ui/TabBar";
import TabPill from "@/components/ui/TabPill";
import EmptyState from "@/components/ui/EmptyState";

interface EmbedTrailer {
  videoId: string;
  name: string;
}

function extractYouTubeId(url?: string | null): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  const patterns = [
    /(?:youtube(?:-nocookie)?\.com\/(?:watch\?(?:.*&)?v=|embed\/|v\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/i,
    /^([A-Za-z0-9_-]{11})$/,
  ];
  for (const re of patterns) {
    const m = trimmed.match(re);
    if (m && m[1]) return m[1];
  }
  return null;
}

function VideoTabLabel({ name, index }: { name?: string; index: number }) {
  const translated = useTranslate(name || `Trailer ${index + 1}`);
  return <>{translated || name || `Trailer ${index + 1}`}</>;
}

interface TrailerModalProps {
  open: boolean;
  filmId: number;
  filmTitle: string;
  onClose: () => void;
}

export default function TrailerModal({
  open,
  filmId,
  filmTitle,
  onClose,
}: TrailerModalProps) {
  const [trailers, setTrailers] = useState<EmbedTrailer[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (!open || !filmId) return;
    let mounted = true;
    setLoading(true);
    setActiveIndex(0);

    (async () => {
      try {
        const [filmData, kpVideos] = await Promise.all([
          getFilm(filmId).catch(() => null),
          getFilmVideos(filmId).catch(() => ({ items: [], total: 0 })),
        ]);

        // Extract only genuine YouTube video IDs from Kinopoisk API (discarding widgets.kinopoisk.ru)
        const kpYoutubeItems: EmbedTrailer[] = [];
        const seenKp = new Set<string>();
        for (const v of kpVideos.items ?? []) {
          const ytId = extractYouTubeId(v.url);
          if (ytId && !seenKp.has(ytId)) {
            seenKp.add(ytId);
            kpYoutubeItems.push({
              videoId: ytId,
              name: v.name || "Official Trailer",
            });
          }
        }

        const params = new URLSearchParams({
          title: filmData?.nameEn || filmTitle || "",
          original: filmData?.nameOriginal || "",
          ru: filmData?.nameRu || "",
          year: String(filmData?.year ?? filmData?.startYear ?? ""),
          type: filmData?.type || "",
          ids: kpYoutubeItems.map((k) => k.videoId).join(","),
        });

        const apiRes = await fetch(`/api/trailers?${params.toString()}`).catch(
          () => null,
        );

        let finalItems: EmbedTrailer[] = [];
        if (apiRes && apiRes.ok) {
          const data = (await apiRes.json()) as { items?: EmbedTrailer[] };
          if (Array.isArray(data.items) && data.items.length > 0) {
            finalItems = data.items;
          }
        }

        // Fallback to any direct YouTube items from Kinopoisk if the server route wasn't reached
        if (finalItems.length === 0 && kpYoutubeItems.length > 0) {
          finalItems = kpYoutubeItems;
        }

        if (mounted) {
          setTrailers(finalItems);
          setActiveIndex(0);
        }
      } catch {
        if (mounted) setTrailers([]);
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [open, filmId, filmTitle]);

  const currentTrailer = trailers[activeIndex];

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title="OFFICIAL TRAILERS & VIDEOS"
      subtitle={filmTitle}
      icon={<Film size={16} />}
      maxWidthClass="sm:max-w-[860px]"
    >
      {loading ? (
        <div className="w-full aspect-video rounded-[var(--radius-lg)] skeleton" />
      ) : trailers.length === 0 ? (
        <EmptyState
          icon={<Film size={32} />}
          title="No Embeddable Trailers Found"
          description="No official YouTube trailers were found for this title."
          className="py-12"
        />
      ) : (
        <div className="flex flex-col gap-4">
          {trailers.length > 1 && (
            <TabBar>
              {trailers.slice(0, 8).map((v, i) => (
                <TabPill
                  key={`${v.videoId}-${i}`}
                  active={activeIndex === i}
                  onClick={() => setActiveIndex(i)}
                >
                  <Play size={11} />
                  <VideoTabLabel name={v.name} index={i} />
                </TabPill>
              ))}
            </TabBar>
          )}

          {currentTrailer && (
            <div className="w-full aspect-video bg-black rounded-[var(--radius-lg)] overflow-hidden border border-[var(--border)] relative">
              <iframe
                key={currentTrailer.videoId}
                src={`https://www.youtube-nocookie.com/embed/${currentTrailer.videoId}?autoplay=1&rel=0&modestbranding=1`}
                title={currentTrailer.name || filmTitle}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                allowFullScreen
                className="w-full h-full border-none block bg-black"
              />
            </div>
          )}
        </div>
      )}
    </ModalShell>
  );
}
