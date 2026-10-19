// app/api/trailers/route.ts
import { NextRequest, NextResponse } from "next/server";

export interface YoutubeTrailerItem {
  videoId: string;
  name: string;
  author?: string;
}

const YT_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  "Accept-Language": "en-US,en;q=0.9",
};

function parseDurationSeconds(lengthText?: string): number | null {
  if (!lengthText) return null;
  const parts = lengthText.split(":").map((p) => parseInt(p.trim(), 10));
  if (parts.some((n) => isNaN(n))) return null;
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return null;
}

function extractCandidatesFromYtHtml(html: string): YoutubeTrailerItem[] {
  const results: YoutubeTrailerItem[] = [];
  const seen = new Set<string>();

  // 1. Try parsing ytInitialData JSON
  const match =
    html.match(/var ytInitialData\s*=\s*(\{[\s\S]+?\});\s*<\/script>/) ||
    html.match(/ytInitialData\s*=\s*(\{[\s\S]+?\});/);

  if (match && match[1]) {
    try {
      const data = JSON.parse(match[1]);
      const stack: unknown[] = [data];

      while (stack.length > 0 && results.length < 10) {
        const curr = stack.pop();
        if (!curr || typeof curr !== "object") continue;

        if ("videoRenderer" in curr) {
          const vr = (curr as { videoRenderer: Record<string, unknown> })
            .videoRenderer;
          const videoId =
            typeof vr?.videoId === "string" ? vr.videoId : undefined;
          const isUnplayable = Boolean(vr?.unplayableText);
          const isUpcoming = Boolean(vr?.upcomingEventData);

          if (
            videoId &&
            /^[A-Za-z0-9_-]{11}$/.test(videoId) &&
            !seen.has(videoId) &&
            !isUnplayable &&
            !isUpcoming
          ) {
            const titleObj = vr?.title as
              | { runs?: { text?: string }[]; simpleText?: string }
              | undefined;
            const title =
              titleObj?.runs?.[0]?.text ||
              titleObj?.simpleText ||
              "Official Trailer";

            const lengthObj = vr?.lengthText as
              | { simpleText?: string }
              | undefined;
            const durationSec = parseDurationSeconds(lengthObj?.simpleText);

            // Keep trailer-length videos (between 20s and 12 minutes)
            if (
              durationSec === null ||
              (durationSec >= 20 && durationSec <= 720)
            ) {
              const ownerObj = vr?.ownerText as
                | { runs?: { text?: string }[] }
                | undefined;
              const author = ownerObj?.runs?.[0]?.text;
              seen.add(videoId);
              results.push({ videoId, name: title, author });
            }
          }
          continue;
        }

        if (Array.isArray(curr)) {
          for (let i = curr.length - 1; i >= 0; i--) {
            stack.push(curr[i]);
          }
        } else {
          const values = Object.values(curr);
          for (let i = values.length - 1; i >= 0; i--) {
            stack.push(values[i]);
          }
        }
      }
    } catch {
      // Fallback to regex extraction below
    }
  }

  // 2. Regex fallback if JSON walk found nothing
  if (results.length === 0) {
    const regex =
      /"videoRenderer":\{"videoId":"([A-Za-z0-9_-]{11})"[\s\S]*?"title":\{"runs":\[\{"text":"([^"]+)"/g;
    let m: RegExpExecArray | null;
    while ((m = regex.exec(html)) !== null && results.length < 8) {
      const videoId = m[1];
      const name = m[2]?.replace(/\\u0026/g, "&") || "Official Trailer";
      if (!seen.has(videoId)) {
        seen.add(videoId);
        results.push({ videoId, name });
      }
    }
  }

  return results;
}

async function searchYouTubeHtml(query: string): Promise<YoutubeTrailerItem[]> {
  try {
    // sp=EgIQAQ%3D%3D filters strictly to YouTube Videos (excluding channels/playlists)
    const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(
      query,
    )}&sp=EgIQAQ%253D%253D&hl=en&gl=US`;
    const res = await fetch(url, {
      headers: YT_HEADERS,
      next: { revalidate: 3600 },
    });
    if (!res.ok) return [];
    const html = await res.text();
    return extractCandidatesFromYtHtml(html);
  } catch {
    return [];
  }
}

async function verifyEmbeddable(
  item: YoutubeTrailerItem,
): Promise<YoutubeTrailerItem | null> {
  try {
    const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(
      `https://www.youtube.com/watch?v=${item.videoId}`,
    )}&format=json`;
    const res = await fetch(oembedUrl, {
      headers: YT_HEADERS,
      next: { revalidate: 86400 },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { title?: string; author_name?: string };
    return {
      videoId: item.videoId,
      name: item.name || data.title || "Official Trailer",
      author: item.author || data.author_name,
    };
  } catch {
    return item;
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const title = (searchParams.get("title") || "").trim();
  const original = (searchParams.get("original") || "").trim();
  const ru = (searchParams.get("ru") || "").trim();
  const year = (searchParams.get("year") || "").trim();
  const type = (searchParams.get("type") || "").trim();
  const extraIds = (searchParams.get("ids") || "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => /^[A-Za-z0-9_-]{11}$/.test(s));

  const mediaWord =
    type === "TV_SERIES" || type === "MINI_SERIES" ? "Series" : "";

  const queries: string[] = [];
  const primaryTitle = title && title !== "Unknown" ? title : original;
  if (primaryTitle) {
    queries.push(
      `${primaryTitle} ${year} ${mediaWord} Official Trailer`.replace(
        /\s+/g,
        " ",
      ).trim(),
    );
  }
  if (original && original !== primaryTitle) {
    queries.push(`${original} ${year} Official Trailer`.replace(/\s+/g, " ").trim());
  }
  if (queries.length === 0 && ru) {
    queries.push(`${ru} ${year} официальный трейлер`.replace(/\s+/g, " ").trim());
  }

  let candidates: YoutubeTrailerItem[] = [];
  for (const q of queries) {
    const found = await searchYouTubeHtml(q);
    candidates.push(...found);
    if (candidates.length >= 5) break;
  }

  // Append any valid YouTube IDs supplied from Kinopoisk API
  for (const id of extraIds) {
    if (!candidates.some((c) => c.videoId === id)) {
      candidates.push({ videoId: id, name: "" });
    }
  }

  // Deduplicate by videoId
  const unique: YoutubeTrailerItem[] = [];
  const seen = new Set<string>();
  for (const c of candidates) {
    if (!seen.has(c.videoId)) {
      seen.add(c.videoId);
      unique.push(c);
    }
  }

  // Verify top 6 candidates via YouTube oEmbed to ensure they are public & embeddable
  const verifiedRaw = await Promise.all(
    unique.slice(0, 6).map((item) => verifyEmbeddable(item)),
  );
  const items = verifiedRaw.filter(
    (v): v is YoutubeTrailerItem => v !== null,
  );

  return NextResponse.json({ items });
}