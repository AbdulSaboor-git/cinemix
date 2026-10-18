"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Play, Server, Check, Sparkles, Settings } from "lucide-react";
import { getAllPlayers, PlayerProvider } from "@/lib/players";
import { getPreferences, savePreferences } from "@/lib/preferences";
import ModalShell from "@/components/ui/ModalShell";

interface PlayerSelectModalProps {
  open?: boolean;
  filmId: number;
  filmTitle: string;
  filmYear?: number | string;
  selectedPlayerId?: string;
  onClose: () => void;
  /** Optional callback if used inline on the Watch page to switch servers without full reload */
  onSelectProvider?: (provider: PlayerProvider) => void;
}

export default function PlayerSelectModal({
  open = true,
  filmId,
  filmTitle,
  filmYear,
  selectedPlayerId,
  onClose,
  onSelectProvider,
}: PlayerSelectModalProps) {
  const router = useRouter();
  const [providers, setProviders] = useState<PlayerProvider[]>([]);
  const [alwaysAsk, setAlwaysAsk] = useState(true);
  const [activeId, setActiveId] = useState(selectedPlayerId || "flcksbr");

  useEffect(() => {
    if (!open) return;
    const prefs = getPreferences();
    const list = getAllPlayers();
    setProviders(list);
    setAlwaysAsk(prefs.alwaysAskPlayer ?? true);
    setActiveId(selectedPlayerId || prefs.preferredPlayerId || list[0]?.id || "flcksbr");
  }, [open, selectedPlayerId]);

  const handleToggleAlwaysAsk = (nextVal: boolean) => {
    setAlwaysAsk(nextVal);
    const prefs = getPreferences();
    savePreferences({ ...prefs, alwaysAskPlayer: nextVal });
  };

  const handleChoose = (provider: PlayerProvider) => {
    const prefs = getPreferences();
    savePreferences({
      ...prefs,
      preferredPlayerId: provider.id,
      alwaysAskPlayer: alwaysAsk,
    });

    if (onSelectProvider) {
      onSelectProvider(provider);
      onClose();
      return;
    }
    onClose();
    router.push(`/watch/${filmId}?player=${encodeURIComponent(provider.id)}`);
  };

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title="SELECT PLAYER SERVER"
      subtitle={`${filmTitle}${filmYear ? ` (${filmYear})` : ""}`}
      icon={<Server size={16} />}
      maxWidthClass="sm:max-w-[500px]"
      footer={
        <div className="flex flex-col gap-2.5">
          <label className="flex items-center justify-between gap-3 cursor-pointer select-none">
            <span className="text-[12px] text-[var(--text-dim)]">
              Always ask before playing
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={alwaysAsk}
              onClick={() => handleToggleAlwaysAsk(!alwaysAsk)}
              className={`relative flex-shrink-0 cursor-pointer rounded-full border-none outline-none transition-[background] duration-200 ${
                alwaysAsk
                  ? "bg-[var(--accent)] shadow-[0_0_10px_var(--accent-glow)]"
                  : "bg-[var(--surface)]"
              }`}
              style={{ width: 38, height: 20 }}
            >
              <span
                className="absolute top-[2px] rounded-full bg-white transition-[left] duration-200"
                style={{ width: 16, height: 16, left: alwaysAsk ? 20 : 2 }}
              />
            </button>
          </label>
          <div className="flex items-center justify-between text-[11px] text-[var(--text-muted)] pt-1 border-t border-[var(--border)]">
            <Link
              href="/preferences"
              onClick={onClose}
              className="text-[var(--accent)] no-underline hover:underline inline-flex items-center gap-1"
            >
              <Settings size={11} />
              Manage or add custom servers in Preferences
            </Link>
            <span>{providers.length} available</span>
          </div>
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        {providers.map((provider) => {
          const isSelected = provider.id === activeId;
          return (
            <button
              key={provider.id}
              type="button"
              onClick={() => handleChoose(provider)}
              className={`w-full text-left p-4 rounded-[var(--radius-lg)] border transition-all cursor-pointer flex items-center justify-between gap-4 group ${
                isSelected
                  ? "bg-[var(--accent-dim)] border-[rgba(229,9,20,0.5)] shadow-[0_0_24px_rgba(229,9,20,0.15)]"
                  : "bg-[var(--bg-elevated)] border-[var(--border)] hover:border-[var(--border-hover)]"
              }`}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="text-[14px] font-bold text-white">
                    {provider.label}
                  </span>
                  <span className="tag tag-gold text-[10px] py-[1px] px-2 flex items-center gap-1">
                    <Sparkles size={10} />
                    {provider.quality}
                  </span>
                  {provider.isCustom && (
                    <span className="tag tag-dim text-[10px] py-[1px] px-2">
                      Custom
                    </span>
                  )}
                </div>
                <p className="text-[12px] text-[var(--text-dim)] leading-snug">
                  {provider.description}
                </p>
                <p className="text-[11px] text-[var(--text-muted)] font-mono mt-1.5 truncate">
                  {provider.baseUrl}
                </p>
              </div>

              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-105 ${
                  isSelected
                    ? "bg-[var(--accent)] text-white shadow-[0_0_16px_var(--accent-glow)]"
                    : "bg-[var(--surface)] text-[var(--text-dim)] group-hover:bg-[var(--accent)] group-hover:text-white"
                }`}
              >
                {onSelectProvider && isSelected ? (
                  <Check size={16} strokeWidth={2.5} />
                ) : (
                  <Play size={16} fill="currentColor" className="ml-0.5" />
                )}
              </div>
            </button>
          );
        })}
      </div>
    </ModalShell>
  );
}
