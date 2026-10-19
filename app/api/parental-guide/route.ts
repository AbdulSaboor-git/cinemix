import { NextRequest, NextResponse } from "next/server";
import {
  PARENTAL_CATEGORIES_ORDER,
  ParentalCategory,
  ParentalCategoryKey,
  ParentalCertificate,
  ParentalGuideData,
  ParentalGuideItem,
  SeverityBreakdown,
  SeverityLevel,
  MPAA_DESCRIPTIONS,
  normalizeMpaaRating,
} from "@/lib/parentalGuide";

// ─── Server-Side In-Memory Cache (24h TTL, 500 entries max) ──────────────────

const SERVER_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_SERVER_CACHE = 500;

const serverCache = new Map<
  string,
  { data: Partial<ParentalGuideData>; expiresAt: number }
>();

function getServerCached(imdbId: string): Partial<ParentalGuideData> | null {
  const entry = serverCache.get(imdbId);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    serverCache.delete(imdbId);
    return null;
  }
  return entry.data;
}

function setServerCached(imdbId: string, data: Partial<ParentalGuideData>) {
  if (serverCache.size >= MAX_SERVER_CACHE) {
    const oldestKey = serverCache.keys().next().value;
    if (oldestKey) serverCache.delete(oldestKey);
  }
  serverCache.set(imdbId, {
    data,
    expiresAt: Date.now() + SERVER_CACHE_TTL_MS,
  });
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const BROWSER_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  "Accept-Language": "en-US,en;q=0.9",
};

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/<[^>]+>/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;|&#x27;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&mdash;/g, "—")
    .replace(/&ndash;/g, "–")
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) =>
      String.fromCharCode(parseInt(hex, 16)),
    )
    .replace(/\s+/g, " ")
    .trim();
}

function mapCategoryKey(rawId?: string | null): ParentalCategoryKey | null {
  if (!rawId) return null;
  const u = rawId.toUpperCase();
  if (u.includes("NUDITY") || u.includes("SEX")) return "nudity";
  if (u.includes("VIOLENCE") || u.includes("GORE")) return "violence";
  if (u.includes("PROFANITY") || u.includes("LANGUAGE")) return "profanity";
  if (u.includes("ALCOHOL") || u.includes("DRUG") || u.includes("SMOK"))
    return "alcohol";
  if (u.includes("FRIGHT") || u.includes("INTENSE")) return "frightening";
  return null;
}

function mapSeverity(raw?: string | null): SeverityLevel {
  if (!raw) return "UNKNOWN";
  const u = raw.toUpperCase().trim();
  if (u === "NONE" || u === "0") return "NONE";
  if (u === "MILD" || u === "1") return "MILD";
  if (u === "MODERATE" || u === "2") return "MODERATE";
  if (u === "SEVERE" || u === "3") return "SEVERE";
  return "UNKNOWN";
}

function emptyVotes(): SeverityBreakdown {
  return { none: 0, mild: 0, moderate: 0, severe: 0, totalVotes: 0 };
}

function extractMpaaFromCertificates(certs: ParentalCertificate[]): {
  mpaaRating: string | null;
  mpaaDescription: string | null;
  mpaaReason: string | null;
} {
  const usCerts = certs.filter(
    (c) =>
      c.countryCode === "US" ||
      c.country.toLowerCase() === "united states" ||
      c.country.toLowerCase() === "usa",
  );

  const preferred =
    usCerts.find(
      (c) =>
        c.reason &&
        ["G", "PG", "PG-13", "R", "NC-17"].includes(
          normalizeMpaaRating(c.rating) ?? "",
        ),
    ) ||
    usCerts.find((c) =>
      ["G", "PG", "PG-13", "R", "NC-17"].includes(
        normalizeMpaaRating(c.rating) ?? "",
      ),
    ) ||
    usCerts[0];

  if (!preferred) {
    return { mpaaRating: null, mpaaDescription: null, mpaaReason: null };
  }

  const mpaaRating = normalizeMpaaRating(preferred.rating);
  const meta = mpaaRating ? MPAA_DESCRIPTIONS[mpaaRating] : undefined;
  const mpaaDescription = meta
    ? `${meta.label} — ${meta.summary}`
    : preferred.attributes?.join(", ") || null;
  const mpaaReason = preferred.reason || meta?.detail || null;

  return { mpaaRating, mpaaDescription, mpaaReason };
}

// ─── Tier 1A: IMDb GraphQL Endpoint ──────────────────────────────────────────

const GRAPHQL_ENDPOINTS = [
  "https://caching.graphql.imdb.com/",
  "https://api.graphql.imdb.com/",
];

const PARENTS_GUIDE_GRAPHQL_FULL = `
query TitleParentsGuide($id: ID!) {
  title(id: $id) {
    id
    certificate {
      rating
      ratingReason
      country {
        id
        text
      }
    }
    certificates(first: 35) {
      edges {
        node {
          rating
          ratingReason
          country {
            id
            text
          }
          attributes {
            text
          }
        }
      }
    }
    parentsGuide {
      categories {
        category {
          id
          text
        }
        severity {
          id
          text
          votedFor
        }
        severityBreakdown {
          id
          text
          votedFor
        }
        totalSeverityVotes
        guideItems(first: 100) {
          edges {
            node {
              id
              isSpoiler
              text {
                plainText
              }
            }
          }
        }
      }
    }
  }
}
`;

const PARENTS_GUIDE_GRAPHQL_MINIMAL = `
query TitleParentsGuideMinimal($id: ID!) {
  title(id: $id) {
    id
    certificate {
      rating
      ratingReason
      country {
        id
        text
      }
    }
    parentsGuide {
      categories {
        category {
          id
          text
        }
        severity {
          id
          text
          votedFor
        }
        guideItems(first: 100) {
          edges {
            node {
              id
              isSpoiler
              text {
                plainText
              }
            }
          }
        }
      }
    }
  }
}
`;

interface GraphqlTitleNode {
  certificate?: {
    rating?: string;
    ratingReason?: string;
    country?: { id?: string; text?: string };
  } | null;
  certificates?: {
    edges?: Array<{
      node?: {
        rating?: string;
        ratingReason?: string;
        country?: { id?: string; text?: string };
        attributes?: Array<{ text?: string }>;
      };
    }>;
  } | null;
  parentsGuide?: {
    categories?: Array<{
      category?: { id?: string; text?: string };
      severity?: { id?: string; text?: string; votedFor?: number };
      severityBreakdown?: Array<{
        id?: string;
        text?: string;
        votedFor?: number;
      }>;
      totalSeverityVotes?: number;
      guideItems?: {
        edges?: Array<{
          node?: {
            id?: string;
            isSpoiler?: boolean;
            text?: { plainText?: string; plaidHtml?: string };
          };
        }>;
      };
    }>;
  } | null;
}

function parseGraphqlTitleNode(
  imdbId: string,
  titleNode: GraphqlTitleNode | null | undefined,
): Partial<ParentalGuideData> | null {
  if (!titleNode) return null;

  const certificates: ParentalCertificate[] = [];

  if (titleNode.certificate?.rating) {
    certificates.push({
      country: titleNode.certificate.country?.text || "United States",
      countryCode: titleNode.certificate.country?.id || "US",
      rating: titleNode.certificate.rating,
      reason: titleNode.certificate.ratingReason || undefined,
    });
  }

  for (const edge of titleNode.certificates?.edges ?? []) {
    const node = edge?.node;
    if (!node?.rating) continue;
    const country = node.country?.text || node.country?.id || "International";
    const countryCode = node.country?.id || undefined;
    const attrs = (node.attributes ?? [])
      .map((a) => a.text)
      .filter((t): t is string => Boolean(t));

    const duplicate = certificates.some(
      (c) =>
        c.countryCode === countryCode &&
        c.rating === node.rating &&
        (c.reason || "") === (node.ratingReason || ""),
    );
    if (!duplicate) {
      certificates.push({
        country,
        countryCode,
        rating: node.rating,
        reason: node.ratingReason || undefined,
        attributes: attrs.length > 0 ? attrs : undefined,
      });
    }
  }

  const categoryMap = new Map<ParentalCategoryKey, ParentalCategory>();

  for (const rawCat of titleNode.parentsGuide?.categories ?? []) {
    const key = mapCategoryKey(rawCat.category?.id || rawCat.category?.text);
    if (!key) continue;

    const meta = PARENTAL_CATEGORIES_ORDER.find((c) => c.key === key)!;
    const severity = mapSeverity(rawCat.severity?.text || rawCat.severity?.id);
    const votes = emptyVotes();

    for (const sb of rawCat.severityBreakdown ?? []) {
      const sLvl = mapSeverity(sb.text || sb.id);
      const count = typeof sb.votedFor === "number" ? sb.votedFor : 0;
      if (sLvl === "NONE") votes.none = count;
      else if (sLvl === "MILD") votes.mild = count;
      else if (sLvl === "MODERATE") votes.moderate = count;
      else if (sLvl === "SEVERE") votes.severe = count;
    }

    votes.totalVotes =
      typeof rawCat.totalSeverityVotes === "number"
        ? rawCat.totalSeverityVotes
        : votes.none + votes.mild + votes.moderate + votes.severe ||
          (rawCat.severity?.votedFor ?? 0);

    const items: ParentalGuideItem[] = [];
    for (const edge of rawCat.guideItems?.edges ?? []) {
      const node = edge?.node;
      const rawText = node?.text?.plainText || node?.text?.plaidHtml || "";
      const cleaned = decodeHtmlEntities(rawText);
      if (!cleaned) continue;
      items.push({
        id: node?.id || `${key}-${items.length}`,
        text: cleaned,
        isSpoiler: Boolean(node?.isSpoiler),
      });
    }

    categoryMap.set(key, {
      key,
      title: meta.title,
      severity,
      votes,
      items,
    });
  }

  if (categoryMap.size === 0 && certificates.length === 0) {
    return null;
  }

  const categories: ParentalCategory[] = PARENTAL_CATEGORIES_ORDER.map(
    ({ key, title }) =>
      categoryMap.get(key) ?? {
        key,
        title,
        severity: "UNKNOWN",
        votes: emptyVotes(),
        items: [],
      },
  );

  const { mpaaRating, mpaaDescription, mpaaReason } =
    extractMpaaFromCertificates(certificates);

  return {
    imdbId,
    source: "imdb",
    mpaaRating,
    mpaaDescription,
    mpaaReason,
    certificates,
    categories,
    fetchedAt: new Date().toISOString(),
  };
}

async function fetchFromImdbGraphql(
  imdbId: string,
): Promise<Partial<ParentalGuideData> | null> {
  const queries = [PARENTS_GUIDE_GRAPHQL_FULL, PARENTS_GUIDE_GRAPHQL_MINIMAL];

  for (const endpoint of GRAPHQL_ENDPOINTS) {
    for (const query of queries) {
      try {
        const res = await fetch(endpoint, {
          method: "POST",
          headers: {
            ...BROWSER_HEADERS,
            "Content-Type": "application/json",
            Accept: "application/graphql+json, application/json",
            Origin: "https://www.imdb.com",
            Referer: `https://www.imdb.com/title/${imdbId}/parentalguide/`,
            "x-imdb-client-name": "imdb-web-next-localized",
            "x-imdb-user-country": "US",
            "x-imdb-user-language": "en-US",
          },
          body: JSON.stringify({
            query,
            variables: { id: imdbId },
          }),
          signal: AbortSignal.timeout(3800),
        });

        if (!res.ok) break; // Try next endpoint if HTTP status failed
        const json = (await res.json()) as {
          data?: { title?: GraphqlTitleNode };
          errors?: unknown[];
        };
        const parsed = parseGraphqlTitleNode(imdbId, json?.data?.title);
        if (
          parsed &&
          parsed.categories?.some(
            (c) => c.items.length > 0 || c.severity !== "UNKNOWN",
          )
        ) {
          return parsed;
        }
        if (!json?.errors) break; // Valid response but title had no guide items
      } catch {
        break;
      }
    }
  }
  return null;
}

// ─── Tier 1B: Direct IMDb Parental Guide HTML / __NEXT_DATA__ Scraper ────────

function findTitleNodeInNextData(obj: unknown, depth = 0): GraphqlTitleNode | null {
  if (!obj || typeof obj !== "object" || depth > 8) return null;
  const record = obj as Record<string, unknown>;

  if (
    record.parentsGuide &&
    typeof record.parentsGuide === "object" &&
    Array.isArray((record.parentsGuide as Record<string, unknown>).categories)
  ) {
    return record as unknown as GraphqlTitleNode;
  }

  for (const val of Object.values(record)) {
    if (val && typeof val === "object") {
      const found = findTitleNodeInNextData(val, depth + 1);
      if (found) return found;
    }
  }
  return null;
}

function parseClassicImdbHtml(
  imdbId: string,
  html: string,
): Partial<ParentalGuideData> | null {
  // 1. Check for __NEXT_DATA__ script block first
  const nextDataMatch = html.match(
    /<script[^>]*id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i,
  );
  if (nextDataMatch?.[1]) {
    try {
      const nextJson = JSON.parse(nextDataMatch[1]);
      const titleNode = findTitleNodeInNextData(nextJson);
      const parsed = parseGraphqlTitleNode(imdbId, titleNode);
      if (parsed) return parsed;
    } catch {
      // Continue to HTML regex parsing
    }
  }

  // 2. Classic & Modern SSR HTML section parsing
  const sectionMapping: Array<{
    key: ParentalCategoryKey;
    sectionIds: string[];
  }> = [
    { key: "nudity", sectionIds: ["advisory-nudity", "sub-section-nudity"] },
    {
      key: "violence",
      sectionIds: ["advisory-violence", "sub-section-violence"],
    },
    {
      key: "profanity",
      sectionIds: ["advisory-profanity", "sub-section-profanity"],
    },
    { key: "alcohol", sectionIds: ["advisory-alcohol", "sub-section-alcohol"] },
    {
      key: "frightening",
      sectionIds: ["advisory-frightening", "sub-section-frightening"],
    },
  ];

  const categories: ParentalCategory[] = [];
  let foundAny = false;

  for (const { key, sectionIds } of sectionMapping) {
    const meta = PARENTAL_CATEGORIES_ORDER.find((c) => c.key === key)!;
    let sectionHtml = "";

    for (const secId of sectionIds) {
      const idx = html.indexOf(secId);
      if (idx !== -1) {
        sectionHtml = html.slice(idx, idx + 40000);
        break;
      }
    }

    let severity: SeverityLevel = "UNKNOWN";
    const sevMatch =
      sectionHtml.match(
        /ipl-status-pill[^>]*>\s*(None|Mild|Moderate|Severe)\s*</i,
      ) ||
      sectionHtml.match(
        /data-testid=["']severity-level["'][^>]*>\s*(None|Mild|Moderate|Severe)\s*</i,
      );
    if (sevMatch?.[1]) {
      severity = mapSeverity(sevMatch[1]);
    }

    const items: ParentalGuideItem[] = [];

    // Classic IMDb list items
    const classicItemRegex =
      /<li[^>]*class=["'][^"']*ipl-zebra-list__item[^"']*["'][^>]*>([\s\S]*?)<\/li>/gi;
    let match: RegExpExecArray | null;
    while ((match = classicItemRegex.exec(sectionHtml)) !== null) {
      const rawBlock = match[1].replace(
        /<div[^>]*class=["'][^"']*ipl-hideable-container[^"']*["'][\s\S]*$/i,
        "",
      );
      const text = decodeHtmlEntities(rawBlock);
      if (text && text.length > 5) {
        items.push({
          id: `${key}-${items.length}`,
          text,
          isSpoiler: sectionHtml
            .slice(0, match.index)
            .includes("advisory-spoilers"),
        });
      }
    }

    // Modern IMDb IPC list items if classic was empty
    if (items.length === 0 && sectionHtml) {
      const modernItemRegex =
        /<div[^>]*data-testid=["']item-html["'][^>]*>([\s\S]*?)<\/div>/gi;
      while ((match = modernItemRegex.exec(sectionHtml)) !== null) {
        const text = decodeHtmlEntities(match[1]);
        if (text && text.length > 5) {
          items.push({
            id: `${key}-${items.length}`,
            text,
            isSpoiler: sectionHtml
              .slice(Math.max(0, match.index - 300), match.index)
              .toLowerCase()
              .includes("spoiler"),
          });
        }
      }
    }

    if (severity !== "UNKNOWN" || items.length > 0) {
      foundAny = true;
    }

    categories.push({
      key,
      title: meta.title,
      severity,
      votes: emptyVotes(),
      items,
    });
  }

  let mpaaReason: string | null = null;
  const mpaaMatch = html.match(
    /Rated\s+(G|PG-13|PG|R|NC-17)\s+for\s+([^<."']+)/i,
  );
  let mpaaRating: string | null = null;
  if (mpaaMatch) {
    mpaaRating = normalizeMpaaRating(mpaaMatch[1]);
    mpaaReason = `Rated ${mpaaMatch[1]} for ${decodeHtmlEntities(mpaaMatch[2])}.`;
  }

  if (!foundAny && !mpaaReason) return null;

  const certificates: ParentalCertificate[] = [];
  if (mpaaRating) {
    certificates.push({
      country: "United States",
      countryCode: "US",
      rating: mpaaRating,
      reason: mpaaReason || undefined,
    });
  }

  return {
    imdbId,
    source: "imdb",
    mpaaRating,
    mpaaReason,
    certificates,
    categories,
    fetchedAt: new Date().toISOString(),
  };
}

async function fetchFromImdbHtml(
  imdbId: string,
): Promise<Partial<ParentalGuideData> | null> {
  try {
    const url = `https://www.imdb.com/title/${imdbId}/parentalguide/`;
    const res = await fetch(url, {
      headers: {
        ...BROWSER_HEADERS,
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        Referer: `https://www.imdb.com/title/${imdbId}/`,
      },
      signal: AbortSignal.timeout(4500),
    });
    if (!res.ok) return null;
    const html = await res.text();
    return parseClassicImdbHtml(imdbId, html);
  } catch {
    return null;
  }
}

// ─── Route Handler ───────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const rawImdbId = searchParams.get("imdbId")?.trim() || "";

  if (!/^tt\d+$/i.test(rawImdbId)) {
    return NextResponse.json(
      { error: "Valid imdbId (e.g. tt0111161) is required." },
      { status: 400 },
    );
  }

  const imdbId = rawImdbId.toLowerCase();

  // 1. Check in-memory server cache
  const cached = getServerCached(imdbId);
  if (cached) {
    return NextResponse.json(cached, {
      headers: {
        "Cache-Control": "public, s-maxage=604800, stale-while-revalidate=86400",
        "X-Parental-Guide-Cache": "HIT",
      },
    });
  }

  // 2. Tier 1A: IMDb GraphQL API (Full + Minimal fallback)
  let data = await fetchFromImdbGraphql(imdbId);

  // 3. Tier 1B: Direct IMDb Parental Guide page (__NEXT_DATA__ + HTML parser)
  if (!data) {
    data = await fetchFromImdbHtml(imdbId);
  }

  if (data) {
    setServerCached(imdbId, data);
    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "public, s-maxage=604800, stale-while-revalidate=86400",
        "X-Parental-Guide-Cache": "MISS",
      },
    });
  }

  // 4. Return structured empty response so the client gracefully merges native certification matrix
  return NextResponse.json(
    {
      imdbId,
      source: "native",
      certificates: [],
      categories: [],
      fetchedAt: new Date().toISOString(),
    } satisfies Partial<ParentalGuideData>,
    {
      headers: {
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=1800",
      },
    },
  );
}