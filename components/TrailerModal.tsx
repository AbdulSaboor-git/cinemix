"use client";
import { useState, useEffect } from "react";
import { Film, ExternalLink, Play } from "lucide-react";
import { getFilmVideos } from "@/lib/kinopoisk";
import { VideoItem } from "@/types/kinopoisk";
import { useTranslate } from "@/hooks/useTranslate";
import ModalShell from "@/components/ui/ModalShell";
import TabBar from "@/components/ui/TabBar";
import TabPill from "@/components/ui/TabPill";
import EmptyState from "@/components/ui/EmptyState";

function extractYouTubeId(url: string): string | null {
  if (!url) return null;
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)([A-Za-z0-9_-]{11})/,
    /^([A-Za-z0-9_-]{11})$/,
  ];
  for (const re of patterns) {
    const m = url.match(re);
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
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (!open || !filmId) return;
    let mounted = true;
    setLoading(true);
    getFilmVideos(filmId)
      .then((res) => {
        if (!mounted) return;
        const items = res.items ?? [];
        const sorted = [...items].sort((a, b) => {
          const aYt = extractYouTubeId(a.url) || a.site?.toUpperCase() === "YOUTUBE" ? 1 : 0;
          const bYt = extractYouTubeId(b.url) || b.site?.toUpperCase() === "YOUTUBE" ? 1 : 0;
          return bYt - aYt;
        });
        setVideos(sorted);
        setActiveIndex(0);
      })
      .catch(() => {
        if (mounted) setVideos([]);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [open, filmId]);

  const currentVideo = videos[activeIndex];
  const ytId = currentVideo ? extractYouTubeId(currentVideo.url) : null;

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
      ) : videos.length === 0 ? (
        <EmptyState
          icon={<Film size={32} />}
          title="No Trailers Available"
          description="No official trailers or video clips were found for this title."
          className="py-12"
        />
      ) : (
        <div className="flex flex-col gap-4">
          {videos.length > 1 && (
            <TabBar>
              {videos.slice(0, 12).map((v, i) => (
                <TabPill
                  key={`${v.url}-${i}`}
                  active={activeIndex === i}
                  onClick={() => setActiveIndex(i)}
                >
                  <Play size={11} />
                  <VideoTabLabel name={v.name} index={i} />
                </TabPill>
              ))}
            </TabBar>
          )}

          {ytId ? (
            <div className="w-full aspect-video bg-black rounded-[var(--radius-lg)] overflow-hidden border border-[var(--border)] relative">
              <iframe
                key={ytId}
                src={`https://www.youtube-nocookie.com/embed/${ytId}?autoplay=1&rel=0`}
                title={currentVideo?.name || filmTitle}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                allowFullScreen
                className="w-full h-full border-none block"
              />
            </div>
          ) : currentVideo ? (
            <div className="w-full aspect-video bg-[var(--bg-elevated)] rounded-[var(--radius-lg)] border border-[var(--border)] flex flex-col items-center justify-center p-6 text-center gap-4">
              <Film size={40} stroke="var(--accent)" />
              <div>
                <p className="text-[15px] font-semibold text-[var(--text)] mb-1">
                  {currentVideo.name || "External Video"}
                </p>
                <p className="text-[12px] text-[var(--text-muted)]">
                  Hosted on {currentVideo.site || "External Provider"}
                </p>
              </div>
              <a
                href={currentVideo.url}
                target="_blank"
                rel="noreferrer"
                className="btn btn-primary no-underline text-[13px]"
              >
                <ExternalLink size={14} />
                Open Video in New Tab
              </a>
            </div>
          ) : null}
        </div>
      )}
    </ModalShell>
  );
}
