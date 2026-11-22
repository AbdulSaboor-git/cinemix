import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const UPSTREAM_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  "https://kinopoiskapiunofficial.tech/api";

// Allowed Kinopoisk API version prefixes
const ALLOWED_PREFIX_RE = /^\/v(?:1|2\.1|2\.2)\//;

// Server-side in-memory LRU cache (shared across requests/devices on warm instances)
const MAX_SERVER_CACHE_ENTRIES = 1500;
const serverCache = new Map<string, { data: unknown; expiresAt: number }>();
const inflightUpstream = new Map<string, Promise<UpstreamResult>>();

interface UpstreamResult {
  status: number;
  data: unknown;
  cacheable: boolean;
  ttlSeconds: number;
}

function getTieredServerTtlSeconds(apiPath: string): number {
  // Never cache API key quota checks
  if (apiPath.startsWith("/v1/api_keys/")) return 0;

  // Immutable/slow-changing film & person detail endpoints: 7 days
  if (
    /^\/v2\.2\/films\/\d+(?:\/(?:facts|box_office|awards|distributions|seasons|similars|videos|images|reviews))?(?:\?|$)/.test(
      apiPath,
    ) ||
    /^\/v2\.1\/films\/\d+\/sequels_and_prequels(?:\?|$)/.test(apiPath) ||
    /^\/v1\/staff(?:\/\d+)?(?:\?|$)/.test(apiPath)
  ) {
    return 7 * 24 * 60 * 60;
  }

  // Filters & curated collections (Top 250, popular collections): 24 hours
  if (
    apiPath.startsWith("/v2.2/films/filters") ||
    apiPath.startsWith("/v2.2/films/collections")
  ) {
    return 24 * 60 * 60;
  }

  // Search, premieres, releases, general filtered lists: 6 hours
  return 6 * 60 * 60;
}

function getFromServerCache(cacheKey: string): unknown | undefined {
  const entry = serverCache.get(cacheKey);
  if (!entry) return undefined;
  if (Date.now() > entry.expiresAt) {
    serverCache.delete(cacheKey);
    return undefined;
  }
  // Refresh LRU order
  serverCache.delete(cacheKey);
  serverCache.set(cacheKey, entry);
  return entry.data;
}

function setInServerCache(
  cacheKey: string,
  data: unknown,
  ttlSeconds: number,
): void {
  if (ttlSeconds <= 0) return;
  if (serverCache.size >= MAX_SERVER_CACHE_ENTRIES) {
    const oldestKey = serverCache.keys().next().value;
    if (oldestKey) serverCache.delete(oldestKey);
  }
  serverCache.set(cacheKey, {
    data,
    expiresAt: Date.now() + ttlSeconds * 1000,
  });
}

function isEmptyReleasePayload(apiPath: string, data: unknown): boolean {
  if (!data || typeof data !== "object") return false;
  const rec = data as Record<string, unknown>;
  if (Array.isArray(rec.releases) && rec.releases.length === 0) return true;
  if (
    Array.isArray(rec.items) &&
    rec.items.length === 0 &&
    apiPath.includes("/premieres")
  ) {
    return true;
  }
  return false;
}

function getFallbackEnvKey(): string {
  const single = (
    process.env.KINOPOISK_API_KEY ||
    process.env.NEXT_PUBLIC_KINOPOISK_API_KEY ||
    ""
  ).trim();
  if (single) return single;
  const multi = (
    process.env.KINOPOISK_API_KEYS ||
    process.env.NEXT_PUBLIC_KINOPOISK_API_KEYS ||
    ""
  )
    .split(/[,\n]+/)
    .map((k) => k.trim())
    .filter(Boolean);
  return multi[0] || "";
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  const { path: segments } = await context.params;
  if (!Array.isArray(segments) || segments.length === 0) {
    return NextResponse.json({ error: "Missing API path" }, { status: 400 });
  }

  const pathname = "/" + segments.map((s) => encodeURIComponent(s)).join("/");
  if (!ALLOWED_PREFIX_RE.test(pathname)) {
    return NextResponse.json(
      { error: "Disallowed API path" },
      { status: 400 },
    );
  }

  // Canonicalize query params for higher cache hit rate
  const sortedParams = new URLSearchParams();
  const entries = Array.from(req.nextUrl.searchParams.entries()).sort(([a], [b]) =>
    a.localeCompare(b),
  );
  for (const [k, v] of entries) {
    sortedParams.append(k, v);
  }
  const qs = sortedParams.toString();
  const apiPath = qs ? `${pathname}?${qs}` : pathname;
  const ttlSeconds = getTieredServerTtlSeconds(apiPath);

  // 1. Check server-side cache first (key-agnostic so all devices share hits)
  if (ttlSeconds > 0) {
    const cached = getFromServerCache(apiPath);
    if (cached !== undefined) {
      return NextResponse.json(cached, {
        status: 200,
        headers: {
          "Cache-Control": `public, s-maxage=${ttlSeconds}, stale-while-revalidate=${ttlSeconds * 2}`,
          "X-CineMix-Cache": "HIT",
        },
      });
    }
  }

  // 2. Resolve API key from request header or server environment
  const apiKey = (
    req.headers.get("x-api-key") ||
    req.headers.get("X-API-KEY") ||
    getFallbackEnvKey()
  ).trim();

  if (!apiKey) {
    return NextResponse.json(
      { error: "No Kinopoisk API key provided" },
      { status: 401 },
    );
  }

  // 3. Deduplicate concurrent identical upstream requests
  const inflightKey = ttlSeconds > 0 ? apiPath : `${apiPath}:${apiKey}`;
  let pending = inflightUpstream.get(inflightKey);

  if (!pending) {
    pending = (async (): Promise<UpstreamResult> => {
      const upstreamUrl = `${UPSTREAM_BASE}${apiPath}`;
      const res = await fetch(upstreamUrl, {
        headers: {
          "X-API-KEY": apiKey,
          "Content-Type": "application/json",
        },
        signal: AbortSignal.timeout(12000),
      });

      const contentType = res.headers.get("content-type") || "";
      let data: unknown = null;
      if (contentType.includes("application/json")) {
        data = await res.json().catch(() => null);
      } else {
        const text = await res.text().catch(() => "");
        data = { message: text || `Upstream status ${res.status}` };
      }

      const cacheable =
        res.ok && ttlSeconds > 0 && !isEmptyReleasePayload(apiPath, data);

      if (cacheable) {
        setInServerCache(apiPath, data, ttlSeconds);
      }

      return {
        status: res.status,
        data,
        cacheable,
        ttlSeconds,
      };
    })();

    inflightUpstream.set(inflightKey, pending);
    pending.finally(() => {
      inflightUpstream.delete(inflightKey);
    });
  }

  try {
    const result = await pending;
    const headers: Record<string, string> = {
      "X-CineMix-Cache": "MISS",
    };
    if (result.cacheable) {
      headers["Cache-Control"] =
        `public, s-maxage=${result.ttlSeconds}, stale-while-revalidate=${result.ttlSeconds * 2}`;
    } else {
      headers["Cache-Control"] = "no-store";
    }
    return NextResponse.json(result.data, {
      status: result.status,
      headers,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Upstream Kinopoisk request failed";
    return NextResponse.json(
      { error: message },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }
}
