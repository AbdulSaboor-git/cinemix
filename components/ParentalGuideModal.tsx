"use client";
import React, { useEffect, useState, useRef } from "react";
import {
  ShieldAlert,
  Eye,
  EyeOff,
  TriangleAlert,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  HeartHandshake,
  Swords,
  MessageSquareWarning,
  Wine,
  Ghost,
  Award,
  Globe,
} from "lucide-react";
import ModalShell from "@/components/ui/ModalShell";
import { Film } from "@/types/kinopoisk";
import {
  getParentalGuide,
  ParentalCategory,
  ParentalCategoryKey,
  ParentalGuideData,
  SeverityLevel,
} from "@/lib/parentalGuide";
import { useAutoTranslate, useFilmTitle } from "@/hooks/useTranslate";

interface ParentalGuideModalProps {
  open: boolean;
  onClose: () => void;
  film: Film;
}

const SEVERITY_STYLE: Record<
  SeverityLevel,
  {
    label: string;
    textCls: string;
    bgCls: string;
    borderCls: string;
    barColor: string;
    leftBorderCls: string;
    levelPct: number;
  }
> = {
  NONE: {
    label: "None",
    textCls: "text-[#22c55e]",
    bgCls: "bg-[rgba(34,197,94,0.12)]",
    borderCls: "border-[rgba(34,197,94,0.3)]",
    barColor: "#22c55e",
    leftBorderCls: "border-l-[#22c55e]",
    levelPct: 12,
  },
  MILD: {
    label: "Mild",
    textCls: "text-[#eab308]",
    bgCls: "bg-[rgba(234,179,8,0.12)]",
    borderCls: "border-[rgba(234,179,8,0.3)]",
    barColor: "#eab308",
    leftBorderCls: "border-l-[#eab308]",
    levelPct: 38,
  },
  MODERATE: {
    label: "Moderate",
    textCls: "text-[#f97316]",
    bgCls: "bg-[rgba(249,115,22,0.12)]",
    borderCls: "border-[rgba(249,115,22,0.3)]",
    barColor: "#f97316",
    leftBorderCls: "border-l-[#f97316]",
    levelPct: 68,
  },
  SEVERE: {
    label: "Severe",
    textCls: "text-[var(--accent)]",
    bgCls: "bg-[var(--accent-dim)]",
    borderCls: "border-[rgba(229,9,20,0.35)]",
    barColor: "#e50914",
    leftBorderCls: "border-l-[var(--accent)]",
    levelPct: 100,
  },
  UNKNOWN: {
    label: "Not Rated",
    textCls: "text-[var(--text-muted)]",
    bgCls: "bg-[var(--surface)]",
    borderCls: "border-[var(--border)]",
    barColor: "rgba(240,240,240,0.2)",
    leftBorderCls: "border-l-[var(--border-hover)]",
    levelPct: 0,
  },
};

function CategoryIcon({
  categoryKey,
  size = 15,
}: {
  categoryKey: ParentalCategoryKey;
  size?: number;
}) {
  switch (categoryKey) {
    case "nudity":
      return <HeartHandshake size={size} />;
    case "violence":
      return <Swords size={size} />;
    case "profanity":
      return <MessageSquareWarning size={size} />;
    case "alcohol":
      return <Wine size={size} />;
    case "frightening":
      return <Ghost size={size} />;
  }
}

export default function ParentalGuideModal({
  open,
  onClose,
  film,
}: ParentalGuideModalProps) {
  const autoTranslate = useAutoTranslate();
  const filmTitle = useFilmTitle(film, autoTranslate);
  const year = film.year || film.startYear;
  const filmId = film.kinopoiskId ?? film.filmId ?? 0;
  const imdbId = film.imdbId ?? "";

  const filmRef = useRef(film);
  filmRef.current = film;

  const [guide, setGuide] = useState<ParentalGuideData | null>(null);
  const [loading, setLoading] = useState(false);
  const [showSpoilers, setShowSpoilers] = useState(false);
  const [activeCategory, setActiveCategory] = useState<
    ParentalCategoryKey | "ALL"
  >("ALL");
  const [certsExpanded, setCertsExpanded] = useState(false);

  // Depend on primitive filmId/imdbId rather than the film object reference so parent re-renders never loop
  useEffect(() => {
    if (!open) return;
    let mounted = true;
    setLoading(true);

    getParentalGuide(filmRef.current)
      .then((data) => {
        if (mounted) {
          setGuide(data);
          setLoading(false);
        }
      })
      .catch(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [open, filmId, imdbId]);

  const totalSpoilers =
    guide?.categories.reduce(
      (acc, c) => acc + c.items.filter((i) => i.isSpoiler).length,
      0,
    ) ?? 0;

  const visibleCategories =
    guide?.categories.filter(
      (c) => activeCategory === "ALL" || c.key === activeCategory,
    ) ?? [];

  const certificates = guide?.certificates ?? [];
  const visibleCerts = certsExpanded ? certificates : certificates.slice(0, 8);

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title="PARENTAL GUIDE"
      subtitle={`${filmTitle}${year ? ` (${year})` : ""}`}
      icon={<ShieldAlert size={18} strokeWidth={2} />}
      maxWidthClass="sm:max-w-[680px]"
      headerRight={
        totalSpoilers > 0 ? (
          <button
            type="button"
            onClick={() => setShowSpoilers((v) => !v)}
            className={`px-2.5 py-1.5 rounded-[8px] text-[11px] sm:text-[12px] font-semibold cursor-pointer bg-transparent transition-colors inline-flex items-center gap-1.5 ${
              showSpoilers
                ? "text-[var(--accent)] border border-[var(--accent)] bg-[var(--accent-dim)]"
                : "text-[var(--text-muted)] border border-[var(--border)] hover:border-[var(--border-hover)] hover:text-[var(--text)]"
            }`}
          >
            {showSpoilers ? (
              <>
                <EyeOff size={13} />
                <span>Hide Spoilers</span>
              </>
            ) : (
              <>
                <Eye size={13} />
                <span>Spoilers ({totalSpoilers})</span>
              </>
            )}
          </button>
        ) : undefined
      }
      footer={
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 text-[11px] text-[var(--text-muted)]">
            <span
              className={`w-2 h-2 rounded-full ${
                guide?.source === "imdb" ? "bg-[#f5c518]" : "bg-[var(--accent)]"
              }`}
            />
            <span>
              {guide?.source === "imdb"
                ? "IMDb Community Parental Guide"
                : "Official Rating & Genre Classification"}
            </span>
          </div>

          {film.imdbId && (
            <a
              href={`https://www.imdb.com/title/${film.imdbId}/parentalguide`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-[11px] sm:text-[12px] font-semibold text-[#f5c518] no-underline hover:underline"
            >
              <span>View on IMDb</span>
              <ExternalLink size={12} />
            </a>
          )}
        </div>
      }
    >
      {loading && !guide ? (
        <div className="flex flex-col gap-3">
          <div className="skeleton h-[84px] w-full rounded-[10px]" />
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="skeleton h-[62px] rounded-[8px]" />
            ))}
          </div>
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="skeleton h-[110px] w-full rounded-[10px]" />
          ))}
        </div>
      ) : guide ? (
        <div className="flex flex-col gap-4 sm:gap-5">
          {/* ── Official Certification Banner ── */}
          {(guide.mpaaRating ||
            guide.ageLimit ||
            guide.mpaaReason ||
            guide.ageLimitDescription) && (
            <div className="bg-[var(--bg-elevated)] border border-[var(--border)] rounded-[10px] p-3.5 sm:p-4">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2.5 flex-wrap">
                  {guide.ageLimit && (
                    <span className="inline-flex items-center px-2.5 py-1 rounded-[6px] font-display tracking-[1px] text-[15px] sm:text-[16px] bg-[var(--accent-dim)] text-[var(--accent)] border border-[rgba(229,9,20,0.3)] leading-none">
                      {guide.ageLimit}
                    </span>
                  )}
                  {guide.mpaaRating && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-[6px] font-display tracking-[1px] text-[15px] sm:text-[16px] bg-[rgba(245,197,24,0.12)] text-[#f5c518] border border-[rgba(245,197,24,0.3)] leading-none">
                      <Award size={13} />
                      Rated {guide.mpaaRating}
                    </span>
                  )}
                  {guide.mpaaDescription && (
                    <span className="text-[12px] sm:text-[13px] font-semibold text-[var(--text)]">
                      {guide.mpaaDescription}
                    </span>
                  )}
                </div>
              </div>

              {guide.mpaaReason && (
                <p className="text-[12px] sm:text-[13px] text-[var(--text-dim)] leading-[1.6] mt-2.5 mb-0">
                  {guide.mpaaReason}
                </p>
              )}

              {!guide.mpaaReason && guide.ageLimitDescription && (
                <p className="text-[12px] sm:text-[13px] text-[var(--text-dim)] leading-[1.6] mt-2 mb-0">
                  {guide.ageLimitDescription}
                </p>
              )}

              {/* Worldwide Certificates */}
              {certificates.length > 1 && (
                <div className="mt-3 pt-3 border-t border-[var(--border)]">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="inline-flex items-center gap-1.5 text-[10px] sm:text-[11px] uppercase tracking-[0.6px] text-[var(--text-muted)] font-semibold">
                      <Globe size={11} />
                      Certifications ({certificates.length})
                    </span>
                    {certificates.length > 8 && (
                      <button
                        type="button"
                        onClick={() => setCertsExpanded((v) => !v)}
                        className="text-[11px] text-[var(--accent)] bg-transparent border-none cursor-pointer p-0 hover:underline"
                      >
                        {certsExpanded
                          ? "Show less"
                          : `+${certificates.length - 8} more`}
                      </button>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {visibleCerts.map((c, idx) => (
                      <span
                        key={`${c.country}-${c.rating}-${idx}`}
                        title={c.reason || `${c.country}: ${c.rating}`}
                        className="inline-flex items-center gap-1 text-[10px] sm:text-[11px] bg-[var(--bg-card)] border border-[var(--border)] rounded-[5px] px-2 py-0.5 text-[var(--text-dim)]"
                      >
                        <span className="text-[var(--text-muted)]">
                          {c.country}:
                        </span>
                        <span className="font-semibold text-[var(--text)]">
                          {c.rating}
                        </span>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── 5-Pillar Severity Matrix / Filter Bar ── */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] uppercase tracking-[0.8px] text-[var(--text-muted)] font-semibold">
                Content Advisory Categories
              </span>
              {activeCategory !== "ALL" && (
                <button
                  type="button"
                  onClick={() => setActiveCategory("ALL")}
                  className="text-[11px] text-[var(--accent)] bg-transparent border-none cursor-pointer p-0 hover:underline font-semibold"
                >
                  Show all 5 categories
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {guide.categories.map((cat) => {
                const st = SEVERITY_STYLE[cat.severity];
                const isSelected = activeCategory === cat.key;
                const shortLabel =
                  cat.key === "nudity"
                    ? "Sex & Nudity"
                    : cat.key === "violence"
                      ? "Violence"
                      : cat.key === "profanity"
                        ? "Profanity"
                        : cat.key === "alcohol"
                          ? "Alcohol/Drugs"
                          : "Frightening";

                return (
                  <button
                    key={cat.key}
                    type="button"
                    onClick={() =>
                      setActiveCategory((prev) =>
                        prev === cat.key ? "ALL" : cat.key,
                      )
                    }
                    className={`flex flex-col justify-between text-left p-2.5 rounded-[8px] border cursor-pointer transition-all ${
                      isSelected
                        ? "bg-[var(--bg-elevated)] border-[var(--accent)] shadow-[0_0_12px_rgba(229,9,20,0.2)]"
                        : "bg-[var(--bg-elevated)] border-[var(--border)] hover:border-[var(--border-hover)]"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1 w-full mb-1.5">
                      <span className="text-[11px] font-semibold text-[var(--text)] truncate">
                        {shortLabel}
                      </span>
                      <span className="text-[var(--text-muted)] flex-shrink-0">
                        <CategoryIcon categoryKey={cat.key} size={12} />
                      </span>
                    </div>

                    <div className="w-full">
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <span
                          className={`text-[10px] font-bold uppercase tracking-[0.4px] ${st.textCls}`}
                        >
                          {st.label}
                        </span>
                        <span className="text-[10px] text-[var(--text-muted)]">
                          {cat.items.length}
                        </span>
                      </div>
                      <div className="w-full h-[3px] bg-[var(--surface)] rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${st.levelPct}%`,
                            backgroundColor: st.barColor,
                          }}
                        />
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── Detailed Category Cards ── */}
          <div className="flex flex-col gap-3">
            {visibleCategories.map((cat) => (
              <CategoryDetailCard
                key={cat.key}
                category={cat}
                globalShowSpoilers={showSpoilers}
              />
            ))}
          </div>
        </div>
      ) : null}
    </ModalShell>
  );
}

function CategoryDetailCard({
  category,
  globalShowSpoilers,
}: {
  category: ParentalCategory;
  globalShowSpoilers: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [localSpoilers, setLocalSpoilers] = useState(false);

  const st = SEVERITY_STYLE[category.severity];
  const spoilersVisible = globalShowSpoilers || localSpoilers;

  const nonSpoilerItems = category.items.filter((i) => !i.isSpoiler);
  const spoilerItems = category.items.filter((i) => i.isSpoiler);

  const activeItems = spoilersVisible ? category.items : nonSpoilerItems;
  const visibleItems = expanded ? activeItems : activeItems.slice(0, 4);

  const { votes } = category;
  const hasVoteBreakdown =
    votes.totalVotes > 0 &&
    votes.none + votes.mild + votes.moderate + votes.severe > 0;
  const sumVotes = votes.none + votes.mild + votes.moderate + votes.severe || 1;

  return (
    <div className="bg-[var(--bg-elevated)] border border-[var(--border)] rounded-[10px] p-3.5 sm:p-4">
      <div className="flex items-center justify-between gap-2 flex-wrap mb-2.5">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-[6px] bg-[var(--bg-card)] border border-[var(--border)] flex items-center justify-center text-[var(--text-dim)] flex-shrink-0">
            <CategoryIcon categoryKey={category.key} size={14} />
          </div>
          <h3 className="font-display tracking-[1px] text-[15px] sm:text-[16px] text-[var(--text)] m-0 leading-none">
            {category.title.toUpperCase()}
          </h3>
        </div>

        <div className="flex items-center gap-2">
          {votes.totalVotes > 0 && (
            <span className="text-[11px] text-[var(--text-muted)]">
              {votes.totalVotes.toLocaleString()} votes
            </span>
          )}
          <span
            className={`inline-flex items-center px-2.5 py-[3px] rounded-full text-[11px] font-bold uppercase tracking-[0.5px] border ${st.bgCls} ${st.textCls} ${st.borderCls}`}
          >
            {st.label}
          </span>
        </div>
      </div>

      {hasVoteBreakdown && (
        <div className="mb-3">
          <div className="h-[4px] w-full bg-[var(--bg-card)] rounded-full overflow-hidden flex">
            {votes.none > 0 && (
              <div
                style={{
                  width: `${(votes.none / sumVotes) * 100}%`,
                  backgroundColor: "#22c55e",
                }}
                title={`None: ${votes.none}`}
              />
            )}
            {votes.mild > 0 && (
              <div
                style={{
                  width: `${(votes.mild / sumVotes) * 100}%`,
                  backgroundColor: "#eab308",
                }}
                title={`Mild: ${votes.mild}`}
              />
            )}
            {votes.moderate > 0 && (
              <div
                style={{
                  width: `${(votes.moderate / sumVotes) * 100}%`,
                  backgroundColor: "#f97316",
                }}
                title={`Moderate: ${votes.moderate}`}
              />
            )}
            {votes.severe > 0 && (
              <div
                style={{
                  width: `${(votes.severe / sumVotes) * 100}%`,
                  backgroundColor: "#e50914",
                }}
                title={`Severe: ${votes.severe}`}
              />
            )}
          </div>
          <div className="flex items-center justify-between text-[10px] text-[var(--text-muted)] mt-1 flex-wrap gap-2">
            <span>None: {votes.none}</span>
            <span>Mild: {votes.mild}</span>
            <span>Moderate: {votes.moderate}</span>
            <span>Severe: {votes.severe}</span>
          </div>
        </div>
      )}

      {visibleItems.length > 0 ? (
        <div className="flex flex-col gap-2">
          {visibleItems.map((item) => (
            <div
              key={item.id}
              className={`bg-[var(--bg-card)] border border-[var(--border)] border-l-[3px] rounded-[6px] px-3 py-2.5 text-[12px] sm:text-[13px] leading-[1.65] text-[var(--text-dim)] ${
                item.isSpoiler ? "border-l-[var(--accent)]" : st.leftBorderCls
              }`}
            >
              {item.isSpoiler && (
                <span className="text-[10px] text-[var(--accent)] font-bold inline-flex items-center gap-1 mb-1 uppercase tracking-[0.4px]">
                  <TriangleAlert size={11} />
                  Spoiler
                </span>
              )}
              <span className="block">{item.text}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-[12px] text-[var(--text-muted)] italic m-0">
          {spoilerItems.length > 0
            ? `All ${spoilerItems.length} advisory note${spoilerItems.length > 1 ? "s" : ""} for this category contain spoilers.`
            : "No specific scene descriptions submitted for this category."}
        </p>
      )}

      {(activeItems.length > 4 ||
        (!spoilersVisible && spoilerItems.length > 0) ||
        (localSpoilers && !globalShowSpoilers && spoilerItems.length > 0)) && (
        <div className="flex items-center justify-between gap-2 flex-wrap mt-2.5 pt-2 border-t border-[var(--border)]">
          {activeItems.length > 4 ? (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="inline-flex items-center gap-1 text-[11px] sm:text-[12px] font-semibold text-[var(--text-dim)] hover:text-white bg-transparent border-none cursor-pointer p-0"
            >
              {expanded ? (
                <>
                  <ChevronUp size={13} />
                  <span>Show less</span>
                </>
              ) : (
                <>
                  <ChevronDown size={13} />
                  <span>Show all {activeItems.length} scene notes</span>
                </>
              )}
            </button>
          ) : (
            <span />
          )}

          {!globalShowSpoilers && spoilerItems.length > 0 && (
            <button
              type="button"
              onClick={() => setLocalSpoilers((v) => !v)}
              className="inline-flex items-center gap-1.5 text-[11px] sm:text-[12px] font-semibold text-[var(--accent)] hover:underline bg-transparent border-none cursor-pointer p-0"
            >
              {localSpoilers ? (
                <>
                  <EyeOff size={12} />
                  <span>Hide spoilers ({spoilerItems.length})</span>
                </>
              ) : (
                <>
                  <TriangleAlert size={12} />
                  <span>
                    Reveal {spoilerItems.length} spoiler
                    {spoilerItems.length > 1 ? "s" : ""}
                  </span>
                </>
              )}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
