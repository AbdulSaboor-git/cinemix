"use client";
import React, { useState, useEffect, useMemo } from "react";
import {
  Star,
  Sparkles,
  SlidersHorizontal,
  Trash2,
  Check,
  Minus,
  Plus,
  MessageSquareText,
} from "lucide-react";
import ModalShell from "@/components/ui/ModalShell";
import PosterImage from "@/components/ui/PosterImage";
import {
  TASTE_DIMENSIONS,
  TASTE_TAGS,
  TasteBreakdown,
  RatedFilmEntry,
  getRatingVerdict,
  getUserRating,
  setUserRating,
  removeUserRating,
} from "@/lib/userLists";
import { useToast } from "@/lib/toast";

export interface RateFilmTarget {
  film_id: number;
  film_name: string;
  poster_url: string | null;
  year: number | null;
  rating: number | null;
}

interface RateFilmModalProps {
  open: boolean;
  onClose: () => void;
  film: RateFilmTarget | null;
  onSaved?: (entry: RatedFilmEntry | null) => void;
}

const MAX_NOTE_LENGTH = 280;
const MAX_TAGS = 4;

export default function RateFilmModal({
  open,
  onClose,
  film,
  onSaved,
}: RateFilmModalProps) {
  const { toast } = useToast();

  const [existing, setExisting] = useState<RatedFilmEntry | null>(null);
  const [score, setScore] = useState<number>(8.0);
  const [hoverStar, setHoverStar] = useState<number | null>(null);
  const [showBreakdown, setShowBreakdown] = useState<boolean>(false);
  const [autoAvg, setAutoAvg] = useState<boolean>(false);
  const [breakdown, setBreakdown] = useState<TasteBreakdown>({
    story: 8.0,
    acting: 8.0,
    visuals: 8.0,
    soundtrack: 8.0,
  });
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [note, setNote] = useState<string>("");

  useEffect(() => {
    if (!open || !film) return;
    const current = getUserRating(film.film_id);
    setExisting(current);
    if (current) {
      setScore(current.user_rating);
      const hasBreakdown =
        current.taste_breakdown &&
        Object.keys(current.taste_breakdown).length > 0;
      setShowBreakdown(Boolean(hasBreakdown));
      setAutoAvg(false);
      setBreakdown({
        story: current.taste_breakdown?.story ?? current.user_rating,
        acting: current.taste_breakdown?.acting ?? current.user_rating,
        visuals: current.taste_breakdown?.visuals ?? current.user_rating,
        soundtrack: current.taste_breakdown?.soundtrack ?? current.user_rating,
      });
      setSelectedTags(current.taste_tags ?? []);
      setNote(current.review_note ?? "");
    } else {
      const seed =
        typeof film.rating === "number" && film.rating >= 1 && film.rating <= 10
          ? Math.round(film.rating * 2) / 2
          : 8.0;
      setScore(seed);
      setShowBreakdown(false);
      setAutoAvg(false);
      setBreakdown({
        story: seed,
        acting: seed,
        visuals: seed,
        soundtrack: seed,
      });
      setSelectedTags([]);
      setNote("");
    }
    setHoverStar(null);
  }, [open, film]);

  const activeScore = hoverStar ?? score;
  const verdict = useMemo(() => getRatingVerdict(activeScore), [activeScore]);

  const globalDiff = useMemo(() => {
    if (!film?.rating || film.rating <= 0) return null;
    const diff = Math.round((activeScore - film.rating) * 10) / 10;
    return diff;
  }, [activeScore, film]);

  const adjustScore = (delta: number) => {
    setAutoAvg(false);
    setScore((prev) => {
      const next = Math.min(
        10,
        Math.max(1, Math.round((prev + delta) * 2) / 2),
      );
      return next;
    });
  };

  const handleDimensionChange = (key: keyof TasteBreakdown, val: number) => {
    const clamped = Math.min(10, Math.max(1, Math.round(val * 2) / 2));
    setBreakdown((prev) => {
      const next = { ...prev, [key]: clamped };
      if (autoAvg) {
        const vals = TASTE_DIMENSIONS.map((d) => next[d.key] ?? 8);
        const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
        setScore(Math.round(avg * 2) / 2);
      }
      return next;
    });
  };

  const handleToggleAutoAvg = () => {
    setAutoAvg((prev) => {
      const next = !prev;
      if (next) {
        const vals = TASTE_DIMENSIONS.map((d) => breakdown[d.key] ?? score);
        const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
        setScore(Math.round(avg * 2) / 2);
      }
      return next;
    });
  };

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) => {
      if (prev.includes(tag)) {
        return prev.filter((t) => t !== tag);
      }
      if (prev.length >= MAX_TAGS) {
        return [...prev.slice(1), tag];
      }
      return [...prev, tag];
    });
  };

  const handleSave = () => {
    if (!film) return;
    const previous = existing ? { ...existing } : null;
    const { entry, isUpdate } = setUserRating({
      film_id: film.film_id,
      film_name: film.film_name,
      poster_url: film.poster_url,
      year: film.year,
      rating: film.rating,
      user_rating: score,
      taste_breakdown: showBreakdown ? breakdown : undefined,
      taste_tags: selectedTags.length > 0 ? selectedTags : undefined,
      review_note: note.trim() ? note.trim() : undefined,
    });

    toast.success(
      isUpdate
        ? `Updated rating to ★ ${entry.user_rating.toFixed(1)}/10`
        : `Rated ★ ${entry.user_rating.toFixed(1)}/10`,
      {
        description: film.film_name,
        posterUrl: film.poster_url,
        icon: "star",
        dedupeKey: `rate-${film.film_id}`,
        action: {
          label: "Undo",
          onClick: () => {
            if (previous) {
              setUserRating(previous);
            } else {
              removeUserRating(film.film_id);
            }
          },
        },
      },
    );

    onSaved?.(entry);
    onClose();
  };

  const handleRemove = () => {
    if (!film || !existing) return;
    const snapshot = { ...existing };
    removeUserRating(film.film_id);
    toast.info("Removed your rating", {
      description: film.film_name,
      posterUrl: film.poster_url,
      icon: "trash",
      dedupeKey: `rate-remove-${film.film_id}`,
      action: {
        label: "Undo",
        onClick: () => {
          setUserRating(snapshot);
        },
      },
    });
    onSaved?.(null);
    onClose();
  };

  if (!film) return null;

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title={
        existing ? "EDIT YOUR TASTE RATING" : "RATE ACCORDING TO YOUR TASTE"
      }
      subtitle={film.film_name}
      icon={<Star size={17} fill="var(--user-rating)" stroke="var(--user-rating)" />}
      maxWidthClass="sm:max-w-[540px]"
      footer={
        <div className="flex items-center justify-between gap-2.5">
          {existing ? (
            <button
              type="button"
              onClick={handleRemove}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-[var(--radius)] text-[12px] font-semibold bg-[rgba(229,9,20,0.1)] border border-[rgba(229,9,20,0.3)] text-[#ff4d57] hover:bg-[rgba(229,9,20,0.18)] cursor-pointer transition-colors"
            >
              <Trash2 size={13} />
              <span>Remove</span>
            </button>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-[var(--radius)] text-[12px] sm:text-[13px] font-semibold bg-[var(--bg-elevated)] border border-[var(--border)] text-[var(--text-dim)] hover:text-white hover:border-[var(--border-hover)] cursor-pointer transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-[var(--radius)] text-[12px] sm:text-[13px] font-bold bg-[var(--user-rating)] text-[#080808] border-none shadow-[0_4px_20px_var(--user-rating-glow)] hover:brightness-110 cursor-pointer transition-all"
            >
              <Check size={14} strokeWidth={2.6} />
              <span>{existing ? "Update Rating" : "Save Rating"}</span>
            </button>
          </div>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        {/* ── Film Mini Header + Score Display ── */}
        <div className="flex items-center gap-3.5 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-[12px] p-3 sm:p-3.5">
          <div className="w-12 h-[68px] rounded-[8px] overflow-hidden bg-[var(--surface)] flex-shrink-0 relative border border-white/10">
            <PosterImage
              src={film.poster_url}
              alt={film.film_name}
              title={film.film_name}
              filmId={film.film_id}
              year={film.year}
              size="sm"
              fallbackType="mini"
            />
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-[13px] sm:text-[14px] font-bold text-white truncate m-0">
              {film.film_name}
            </p>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {film.year && (
                <span className="text-[11px] text-[var(--text-muted)]">
                  {film.year}
                </span>
              )}
              {film.rating && film.rating > 0 && (
                <span className="text-[11px] text-[var(--text-dim)] inline-flex items-center gap-1">
                  <span>Global:</span>
                  <strong className="text-white font-semibold">
                    {film.rating.toFixed(1)}
                  </strong>
                </span>
              )}
              {globalDiff !== null && (
                <span
                  className={`text-[10px] font-semibold px-1.5 py-[1px] rounded-[4px] ${
                    globalDiff > 0
                      ? "bg-[rgba(34,197,94,0.14)] text-[#4ade80]"
                      : globalDiff < 0
                        ? "bg-[rgba(251,146,60,0.14)] text-[#fb923c]"
                        : "bg-white/10 text-[var(--text-dim)]"
                  }`}
                >
                  {globalDiff > 0
                    ? `+${globalDiff.toFixed(1)} vs Global`
                    : globalDiff < 0
                      ? `${globalDiff.toFixed(1)} vs Global`
                      : "Matches Global"}
                </span>
              )}
            </div>
          </div>

          {/* Big Score Badge */}
          <div className="flex flex-col items-end flex-shrink-0">
            <div className="flex items-baseline gap-1">
              <span
                className="font-display text-[32px] sm:text-[36px] leading-none"
                style={{ color: "var(--user-rating)" }}
              >
                {activeScore.toFixed(1)}
              </span>
              <span className="text-[11px] text-[var(--text-muted)] font-semibold">
                /10
              </span>
            </div>
            <span
              className="text-[10px] font-bold uppercase tracking-[0.5px] px-2 py-[2px] rounded-full mt-1"
              style={{
                color: verdict.color,
                backgroundColor: verdict.bg,
                border: `1px solid ${verdict.border}`,
              }}
            >
              {verdict.label}
            </span>
          </div>
        </div>

        {/* ── Interactive 10-Star Selector + 0.5 Step Controls ── */}
        <div className="bg-[var(--bg-elevated)] border border-[var(--border)] rounded-[12px] p-3.5 sm:p-4">
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-[11px] font-semibold uppercase tracking-[0.7px] text-[var(--text-dim)]">
              Your Overall Score
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => adjustScore(-0.5)}
                disabled={score <= 1}
                aria-label="Decrease score by 0.5"
                className="w-7 h-7 rounded-[6px] bg-[var(--bg-card)] border border-[var(--border)] text-[var(--text-dim)] hover:text-white hover:border-[var(--border-hover)] disabled:opacity-35 cursor-pointer flex items-center justify-center"
              >
                <Minus size={12} />
              </button>
              <span className="text-[11px] font-mono text-[var(--text-dim)] px-1">
                0.5 step
              </span>
              <button
                type="button"
                onClick={() => adjustScore(0.5)}
                disabled={score >= 10}
                aria-label="Increase score by 0.5"
                className="w-7 h-7 rounded-[6px] bg-[var(--bg-card)] border border-[var(--border)] text-[var(--text-dim)] hover:text-white hover:border-[var(--border-hover)] disabled:opacity-35 cursor-pointer flex items-center justify-center"
              >
                <Plus size={12} />
              </button>
            </div>
          </div>

          {/* 10 Interactive Stars */}
          <div
            className="grid grid-cols-10 gap-1 sm:gap-1.5 py-1"
            onMouseLeave={() => setHoverStar(null)}
          >
            {Array.from({ length: 10 }, (_, idx) => {
              const starVal = idx + 1;
              const filled = activeScore >= starVal;
              const halfFilled = !filled && activeScore >= starVal - 0.5;
              return (
                <button
                  key={starVal}
                  type="button"
                  onMouseEnter={() => setHoverStar(starVal)}
                  onClick={() => {
                    setAutoAvg(false);
                    // Clicking the already selected whole star toggles .5
                    if (score === starVal && starVal > 1) {
                      setScore(starVal - 0.5);
                    } else {
                      setScore(starVal);
                    }
                  }}
                  aria-label={`Rate ${starVal} out of 10`}
                  className={`flex flex-col items-center justify-center py-2 rounded-[8px] border transition-all cursor-pointer ${
                    filled || halfFilled
                      ? "bg-[var(--user-rating-bg)] border-[var(--user-rating-border)] text-[var(--user-rating)]"
                      : "bg-[var(--bg-card)] border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--border-hover)]"
                  }`}
                >
                  <Star
                    size={16}
                    fill={
                      filled
                        ? "var(--user-rating)"
                        : halfFilled
                          ? "color-mix(in srgb, var(--user-rating) 45%, transparent)"
                          : "none"
                    }
                    stroke={filled || halfFilled ? "var(--user-rating)" : "currentColor"}
                    strokeWidth={2}
                  />
                  <span className="text-[10px] font-bold mt-1 leading-none">
                    {starVal}
                  </span>
                </button>
              );
            })}
          </div>

          <input
            type="range"
            min={1}
            max={10}
            step={0.5}
            value={score}
            onChange={(e) => {
              setAutoAvg(false);
              setScore(parseFloat(e.target.value));
            }}
            aria-label="Fine tune rating slider"
            className="w-full mt-2.5 cursor-pointer accent-[var(--user-rating)]"
          />
        </div>

        {/* ── Taste Breakdown (4 Dimensions) ── */}
        <div className="bg-[var(--bg-elevated)] border border-[var(--border)] rounded-[12px] overflow-hidden">
          <button
            type="button"
            onClick={() => setShowBreakdown((v) => !v)}
            className="w-full flex items-center justify-between px-3.5 sm:px-4 py-3 bg-transparent border-none text-left cursor-pointer hover:bg-white/[0.02] transition-colors"
          >
            <div className="flex items-center gap-2">
              <SlidersHorizontal size={14} className="text-[var(--user-rating)]" />
              <span className="text-[11px] font-semibold uppercase tracking-[0.7px] text-[var(--text-dim)]">
                Taste Breakdown (Story, Acting, Visuals, Sound)
              </span>
            </div>
            <span className="text-[11px] font-semibold text-[var(--user-rating)]">
              {showBreakdown ? "Hide" : "Customize"}
            </span>
          </button>

          {showBreakdown && (
            <div className="px-3.5 sm:px-4 pb-3.5 pt-1 border-t border-[var(--border)] flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-[var(--text-muted)]">
                  Score each aspect of the film based on your personal taste:
                </span>
                <button
                  type="button"
                  onClick={handleToggleAutoAvg}
                  className={`text-[10px] font-semibold px-2.5 py-1 rounded-full border cursor-pointer transition-colors ${
                    autoAvg
                      ? "bg-[var(--user-rating-bg)] border-[var(--user-rating-border)] text-[var(--user-rating)]"
                      : "bg-[var(--bg-card)] border-[var(--border)] text-[var(--text-dim)] hover:text-white"
                  }`}
                >
                  {autoAvg ? "Auto-averaging ON" : "Sync to Overall"}
                </button>
              </div>

              {TASTE_DIMENSIONS.map((dim) => {
                const val = breakdown[dim.key] ?? 8.0;
                return (
                  <div key={dim.key} className="flex flex-col gap-1">
                    <div className="flex items-center justify-between text-[12px]">
                      <span className="text-[var(--text-dim)] font-medium">
                        {dim.label}
                      </span>
                      <span className="font-display text-[15px] text-[var(--user-rating)]">
                        {val.toFixed(1)}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={1}
                      max={10}
                      step={0.5}
                      value={val}
                      onChange={(e) =>
                        handleDimensionChange(
                          dim.key,
                          parseFloat(e.target.value),
                        )
                      }
                      aria-label={dim.label}
                      className="w-full cursor-pointer accent-[var(--user-rating)]"
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Taste Vibe Tags ── */}
        <div className="bg-[var(--bg-elevated)] border border-[var(--border)] rounded-[12px] p-3.5 sm:p-4">
          <div className="flex items-center justify-between mb-2.5">
            <div className="flex items-center gap-1.5">
              <Sparkles size={13} className="text-[var(--user-rating)]" />
              <span className="text-[11px] font-semibold uppercase tracking-[0.7px] text-[var(--text-dim)]">
                Taste Vibe Tags
              </span>
            </div>
            <span className="text-[10px] text-[var(--text-muted)]">
              {selectedTags.length}/{MAX_TAGS} selected
            </span>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {TASTE_TAGS.map((tag) => {
              const active = selectedTags.includes(tag);
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleTag(tag)}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-medium border cursor-pointer transition-all ${
                    active
                      ? "bg-[var(--user-rating-bg)] border-[var(--user-rating-border)] text-[var(--user-rating)] shadow-[0_0_12px_var(--user-rating-glow)]"
                      : "bg-[var(--bg-card)] border-[var(--border)] text-[var(--text-dim)] hover:text-white hover:border-[var(--border-hover)]"
                  }`}
                >
                  {tag}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Personal Taste Note ── */}
        <div className="bg-[var(--bg-elevated)] border border-[var(--border)] rounded-[12px] p-3.5 sm:p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <MessageSquareText
                size={13}
                className="text-[var(--text-muted)]"
              />
              <span className="text-[11px] font-semibold uppercase tracking-[0.7px] text-[var(--text-dim)]">
                Personal Note (Optional)
              </span>
            </div>
            <span className="text-[10px] text-[var(--text-muted)]">
              {note.length}/{MAX_NOTE_LENGTH}
            </span>
          </div>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value.slice(0, MAX_NOTE_LENGTH))}
            rows={2}
            placeholder="What stood out to your taste? Favorite scene, mood, or thoughts…"
            className="w-full bg-[var(--bg-card)] border border-[var(--border)] focus:border-[var(--user-rating-border)] rounded-[8px] p-2.5 text-[12px] sm:text-[13px] text-[var(--text)] placeholder:text-[var(--text-muted)] outline-none resize-none leading-relaxed"
          />
        </div>
      </div>
    </ModalShell>
  );
}
