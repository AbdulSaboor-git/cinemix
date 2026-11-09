import { NextRequest, NextResponse } from "next/server";

// Server-side in-memory translation cache (up to 3000 entries)
const MAX_SERVER_CACHE = 3000;
const serverCache = new Map<string, string>();

function getCached(key: string): string | undefined {
  return serverCache.get(key);
}

function setCached(key: string, val: string) {
  if (serverCache.size >= MAX_SERVER_CACHE) {
    const first = serverCache.keys().next().value;
    if (first) serverCache.delete(first);
  }
  serverCache.set(key, val);
}

const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
];

async function translateViaGoogle(text: string, from: string, to: string): Promise<string | null> {
  try {
    const ua = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${encodeURIComponent(from)}&tl=${encodeURIComponent(to)}&dt=t&q=${encodeURIComponent(text)}`;
    const res = await fetch(url, {
      headers: {
        "User-Agent": ua,
        Accept: "*/*",
      },
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return null;
    const json = await res.json();
    if (Array.isArray(json) && Array.isArray(json[0])) {
      const translated = (json[0] as [string, string][])
        .map((chunk) => chunk[0])
        .join("");
      return translated ? translated.trim() : null;
    }
    return null;
  } catch {
    return null;
  }
}

async function translateViaMyMemory(text: string, from: string, to: string): Promise<string | null> {
  try {
    const langpair = `${from === "auto" ? "ru" : from}|${to}`;
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${encodeURIComponent(langpair)}`;
    const res = await fetch(url, {
      headers: {
        "User-Agent": USER_AGENTS[0],
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return null;
    const json = await res.json();
    if (json?.responseData?.translatedText) {
      const translated = String(json.responseData.translatedText).trim();
      if (!translated.toUpperCase().includes("MYMEMORY WARNING")) {
        return translated;
      }
    }
    return null;
  } catch {
    return null;
  }
}

async function handleTranslate(text: string, from: string, to: string) {
  const clean = (text || "").trim();
  if (!clean) {
    return NextResponse.json({ translatedText: "", success: true });
  }

  const cacheKey = `${from}->${to}:${clean}`;
  const hit = getCached(cacheKey);
  if (hit) {
    return NextResponse.json(
      { translatedText: hit, success: true, source: "cache" },
      {
        headers: {
          "Cache-Control": "public, s-maxage=604800, stale-while-revalidate=86400",
        },
      },
    );
  }

  // Tier 1: Google Translate gtx server-side
  let translated = await translateViaGoogle(clean, from, to);

  // Tier 2: MyMemory API fallback
  if (!translated) {
    translated = await translateViaMyMemory(clean, from, to);
  }

  if (translated) {
    setCached(cacheKey, translated);
    return NextResponse.json(
      { translatedText: translated, success: true, source: "live" },
      {
        headers: {
          "Cache-Control": "public, s-maxage=604800, stale-while-revalidate=86400",
        },
      },
    );
  }

  // Fallback safely to original text
  return NextResponse.json(
    { translatedText: clean, success: false, fallback: true },
    {
      headers: {
        "Cache-Control": "public, s-maxage=300",
      },
    },
  );
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const text = searchParams.get("text") || "";
  const from = searchParams.get("from") || "ru";
  const to = searchParams.get("to") || "en";

  return handleTranslate(text, from, to);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const text = body.text || "";
    const from = body.from || "ru";
    const to = body.to || "en";
    return handleTranslate(text, from, to);
  } catch {
    return NextResponse.json({ translatedText: "", success: false }, { status: 400 });
  }
}
