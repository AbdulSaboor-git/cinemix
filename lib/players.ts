// lib/players.ts
import { getSession, CustomPlayerServer } from "@/lib/session";

export interface PlayerProvider {
  id: string;
  name: string;
  label: string;
  quality: string;
  description: string;
  baseUrl: string;
  /** Whether the iframe requires negative top offset to hide provider's own top bar */
  cropTopHeader?: boolean;
  isCustom?: boolean;
  buildUrl: (filmId: number) => string;
}

const DEFAULT_FLCKSBR_BASE =
  process.env.NEXT_PUBLIC_PLAYER_BASE_URL || "https://flcksbr.top/film";

export const DEFAULT_PLAYER_PROVIDERS: PlayerProvider[] = [
  {
    id: "flcksbr",
    name: "Flcksbr",
    label: "Server 1 · Flcksbr",
    quality: "1080p HD",
    description:
      "Primary multi-audio streaming server with adaptive bitrate and episode selector.",
    baseUrl: DEFAULT_FLCKSBR_BASE,
    cropTopHeader: true,
    isCustom: false,
    buildUrl: (filmId: number) =>
      `${DEFAULT_FLCKSBR_BASE.replace(/\/$/, "")}/${filmId}/`,
  },
];

function mapCustomServerToProvider(
  server: CustomPlayerServer,
  idx: number,
): PlayerProvider {
  const cleanBase = server.baseUrl.trim();
  return {
    id: server.id || `custom-${idx + 1}`,
    name: server.name || `Custom ${idx + 1}`,
    label: server.label || `Server ${idx + 2} · ${server.name || "Custom"}`,
    quality: server.quality || "HD",
    description: "Custom user-configured streaming server.",
    baseUrl: cleanBase,
    cropTopHeader: Boolean(server.cropTopHeader),
    isCustom: true,
    buildUrl: (filmId: number) => {
      if (cleanBase.includes("{id}")) {
        return cleanBase.replace(/\{id\}/g, String(filmId));
      }
      return `${cleanBase.replace(/\/$/, "")}/${filmId}/`;
    },
  };
}

export function getAllPlayers(): PlayerProvider[] {
  if (typeof window === "undefined") return DEFAULT_PLAYER_PROVIDERS;
  try {
    const custom = getSession().preferences.customPlayers ?? [];
    return [
      ...DEFAULT_PLAYER_PROVIDERS,
      ...custom
        .filter((c) => c && c.baseUrl && c.baseUrl.trim())
        .map(mapCustomServerToProvider),
    ];
  } catch {
    return DEFAULT_PLAYER_PROVIDERS;
  }
}

export function getPlayerById(id?: string | null): PlayerProvider {
  const all = getAllPlayers();
  return all.find((p) => p.id === id) ?? all[0];
}
