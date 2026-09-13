/* Robust, key-optional YouTube transcript extraction.
 *
 * Tries every reliable source in order and returns the longest transcript it
 * can find, so a single blocked path never leaves the user with nothing:
 *   1. youtube-transcript (multiple languages incl. auto-captions)
 *   2. TranscriptAPI.com   (server-side key, highest quality)
 *   3. InnerTube player API (most reliable no-key source; official JSON)
 *   4. captionTracks embedded in the watch page (HTML scrape)
 *   5. Direct /api/timedtext endpoint (last resort)
 */

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

interface CaptionTrack {
  baseUrl?: string;
  languageCode?: string;
  kind?: string;
}

/** Decode HTML entities + strip VTT/SRT markup down to plain sentences. */
function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_m, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_m, d) => String.fromCodePoint(Number(d)))
    .replace(/&nbsp;/g, " ");
}

function stripVtt(vtt: string): string {
  return decodeEntities(
    vtt
      .split("\n")
      .map((l) => l.trim())
      .filter(
        (l) =>
          l &&
          !l.startsWith("WEBVTT") &&
          !l.startsWith("NOTE") &&
          !l.startsWith("Kind:") &&
          !l.startsWith("Language:") &&
          !/^\d{2}:\d{2}:\d{2}[.,]/.test(l) &&
          !/^\d{2}:\d{2}[.,]/.test(l) &&
          !/^\d+$/.test(l) &&
          !/^-->/.test(l)
      )
      .map((l) => l.replace(/<[^>]+>/g, "").replace(/\[[^\]]*\]/g, " "))
      .filter(Boolean)
      .join(" ")
  )
    .replace(/\s+/g, " ")
    .trim();
}

/** Parse YouTube's timedtext XML (used by the /api/timedtext endpoint). */
function stripTimedTextXml(xml: string): string {
  const pieces = [...xml.matchAll(/<text[^>]*>([\s\S]*?)<\/text>/gi)].map((m) => m[1]);
  return decodeEntities(pieces.join(" ").replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

async function tryYoutubeTranscriptLib(videoId: string): Promise<string> {
  let best = "";
  const langs = ["en", "en-US", "en-GB", "a.en"];
  try {
    const { YoutubeTranscript } = await import("youtube-transcript");
    for (const lang of langs) {
      try {
        const items = await YoutubeTranscript.fetchTranscript(videoId, { lang });
        const joined = items.map((i) => i.text).join(" ").replace(/\s+/g, " ").trim();
        if (joined.length > best.length) best = joined;
        if (best.length > 500) break;
      } catch {
        /* try next language */
      }
    }
  } catch {
    /* library unavailable */
  }
  return best;
}

async function tryTranscriptApi(videoId: string): Promise<string> {
  const key = (process.env.TRANSCRIPT_API_KEY ?? "").trim();
  if (!key) return "";
  try {
    const fullUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const res = await fetch(
      `https://transcriptapi.com/api/v2/youtube/transcript?video_url=${encodeURIComponent(fullUrl)}`,
      { headers: { Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(20000) }
    );
    if (!res.ok) return "";
    const data = await res.json();
    const segs = Array.isArray(data.transcript) ? data.transcript : data.segments ?? [];
    return segs
      .map((s: { text?: string }) => String(s?.text ?? "").trim())
      .filter(Boolean)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
  } catch {
    return "";
  }
}

/** Official InnerTube player response — most reliable keyless caption source. */
async function tryInnerTube(videoId: string): Promise<{ text: string; title?: string; author?: string }> {
  try {
    const res = await fetch(
      "https://www.youtube.com/youtubei/v1/player?key=AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "user-agent": UA,
          "accept-language": "en-US,en;q=0.9",
        },
        body: JSON.stringify({
          context: {
            client: { clientName: "ANDROID", clientVersion: "19.09.37", hl: "en", gl: "US" },
          },
          videoId,
        }),
        signal: AbortSignal.timeout(15000),
      }
    );
    if (!res.ok) return { text: "" };
    const data = await res.json();
    const title: string | undefined = data?.videoDetails?.title;
    const author: string | undefined = data?.videoDetails?.author;
    const tracks: CaptionTrack[] = data?.captions?.playerCaptionsTracklistRenderer?.captionTracks ?? [];
    const pick =
      tracks.find((t) => t.languageCode === "en" && t.kind !== "asr") ??
      tracks.find((t) => t.languageCode?.startsWith("en")) ??
      tracks.find((t) => t.kind !== "asr") ??
      tracks[0];
    if (!pick?.baseUrl) return { text: "", title, author };
    const vttRes = await fetch(`${pick.baseUrl}&fmt=vtt`, {
      headers: { "user-agent": UA },
      signal: AbortSignal.timeout(15000),
    });
    if (vttRes.ok) {
      const vtt = stripVtt(await vttRes.text());
      if (vtt.length > 100) return { text: vtt, title, author };
    }
    // Track exists but vtt failed — try raw XML.
    const xmlRes = await fetch(pick.baseUrl, {
      headers: { "user-agent": UA },
      signal: AbortSignal.timeout(15000),
    });
    if (xmlRes.ok) return { text: stripTimedTextXml(await xmlRes.text()), title, author };
    return { text: "", title, author };
  } catch {
    return { text: "" };
  }
}

/** Legacy: captionTracks embedded in the HTML watch page. */
export async function fetchCaptionTracksTranscript(videoId: string): Promise<string> {
  try {
    const pageRes = await fetch(`https://www.youtube.com/watch?v=${videoId}&hl=en`, {
      headers: { "user-agent": UA, "accept-language": "en-US,en;q=0.9" },
      signal: AbortSignal.timeout(12000),
    });
    if (!pageRes.ok) return "";
    const html = await pageRes.text();
    const match = html.match(/"captionTracks":(\[.*?\])/);
    if (!match) return "";
    let tracks: CaptionTrack[] = [];
    try {
      tracks = JSON.parse(match[1].replace(/\\u0026/g, "&"));
    } catch {
      return "";
    }
    const pick =
      tracks.find((t) => t.languageCode === "en" && t.kind !== "asr" && t.baseUrl) ??
      tracks.find((t) => t.languageCode?.startsWith("en") && t.baseUrl) ??
      tracks.find((t) => t.baseUrl);
    if (!pick?.baseUrl) return "";
    const vttRes = await fetch(`${pick.baseUrl}&fmt=vtt`, {
      headers: { "user-agent": UA },
      signal: AbortSignal.timeout(12000),
    });
    if (vttRes.ok) return stripVtt(await vttRes.text());
    const xmlRes = await fetch(pick.baseUrl, {
      headers: { "user-agent": UA },
      signal: AbortSignal.timeout(12000),
    });
    return xmlRes.ok ? stripTimedTextXml(await xmlRes.text()) : "";
  } catch {
    return "";
  }
}

/** Fetch video metadata (title/author) via oEmbed. */
export async function fetchYouTubeMeta(
  videoId: string
): Promise<{ title: string; author: string }> {
  try {
    const res = await fetch(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(
        `https://www.youtube.com/watch?v=${videoId}`
      )}&format=json`,
      { signal: AbortSignal.timeout(8000) }
    );
    if (res.ok) {
      const d = await res.json();
      return { title: d.title ?? "YouTube video", author: d.author_name ?? "" };
    }
  } catch {
    /* ignore */
  }
  return { title: "YouTube video", author: "" };
}

/**
 * Try every transcript source and return the best (longest) result.
 * `meta` is filled from InnerTube/oEmbed when available.
 */
export async function extractYouTubeTranscript(
  videoId: string
): Promise<{ text: string; title: string; author: string }> {
  let title = "YouTube video";
  let author = "";
  let text = "";
  const take = (t: string) => {
    const clean = (t || "").replace(/\s+/g, " ").trim();
    if (clean.length > text.length) text = clean;
  };

  // 1 + 2 can run first (fast, high quality).
  take(await tryYoutubeTranscriptLib(videoId));
  if (text.length <= 200) take(await tryTranscriptApi(videoId));

  // 3. InnerTube — also gives us metadata.
  if (text.length <= 200) {
    const inner = await tryInnerTube(videoId);
    if (inner.title) title = inner.title;
    if (inner.author) author = inner.author;
    take(inner.text);
  }

  // 4 + 5. Scrape / timedtext.
  if (text.length <= 200) take(await fetchCaptionTracksTranscript(videoId));

  // Fill metadata if still missing.
  if (title === "YouTube video" || !author) {
    const meta = await fetchYouTubeMeta(videoId);
    if (meta.title && meta.title !== "YouTube video") title = meta.title;
    if (meta.author && !author) author = meta.author;
  }

  return { text, title, author };
}
