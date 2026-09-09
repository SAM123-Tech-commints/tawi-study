/* No-key YouTube caption fallback: YouTube embeds its caption-track list in
 * the watch-page HTML ("captionTracks":[{baseUrl...}]). Fetching the track
 * as WebVTT works from most networks without any API key. */

function stripVtt(vtt: string): string {
  return vtt
    .split("\n")
    .map((l) => l.trim())
    .filter(
      (l) =>
        l &&
        !l.startsWith("WEBVTT") &&
        !l.startsWith("NOTE") &&
        !/^\d{2}:\d{2}/.test(l) &&
        !/^\d+$/.test(l) &&
        !l.startsWith("Kind:") &&
        !l.startsWith("Language:")
    )
    .map((l) => l.replace(/<[^>]+>/g, "").replace(/&\w+;/g, " ").trim())
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function fetchCaptionTracksTranscript(videoId: string): Promise<string> {
  const pageRes = await fetch(`https://www.youtube.com/watch?v=${videoId}&hl=en`, {
    headers: {
      "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "accept-language": "en-US,en;q=0.9",
    },
    signal: AbortSignal.timeout(12000),
  });
  if (!pageRes.ok) return "";
  const html = await pageRes.text();
  const match = html.match(/"captionTracks":(\[.*?\])/);
  if (!match) return "";
  let tracks: { baseUrl?: string; languageCode?: string; kind?: string }[] = [];
  try {
    tracks = JSON.parse(match[1].replace(/\\u0026/g, "&"));
  } catch {
    return "";
  }
  // Prefer manually-created English, then any English, then the first track.
  const pick =
    tracks.find((t) => t.languageCode === "en" && t.kind !== "asr" && t.baseUrl) ??
    tracks.find((t) => t.languageCode?.startsWith("en") && t.baseUrl) ??
    tracks.find((t) => t.baseUrl);
  if (!pick?.baseUrl) return "";
  const vttRes = await fetch(`${pick.baseUrl}&fmt=vtt`, {
    headers: { "user-agent": "Mozilla/5.0 (compatible; TawiStudyBot/1.0)" },
    signal: AbortSignal.timeout(12000),
  });
  if (!vttRes.ok) return "";
  return stripVtt(await vttRes.text());
}
