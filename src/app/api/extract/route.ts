import { NextRequest, NextResponse } from "next/server";
import { YoutubeTranscript } from "youtube-transcript";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { url, type, key } = body as { url?: string; type?: string; key?: string };

    // Optional collaboration key: collaborators pass the owner's Profile →
    // Collaboration key so shared tooling can attribute usage. The endpoint
    // stays public so existing clients keep working.
    let collaborator: string | null = null;
    if (typeof key === "string" && key.startsWith("tawi_")) {
      try {
        const { db } = await import("@/db");
        const { users } = await import("@/db/schema");
        const { eq } = await import("drizzle-orm");
        const rows = await db.select({ id: users.id }).from(users).where(eq(users.apiKey, key)).limit(1);
        if (rows.length) collaborator = rows[0].id;
      } catch {
        collaborator = null;
      }
    }

    if (type === "youtube" && url) {
      // Extract YouTube transcript
      const videoId = extractVideoId(url);
      if (!videoId) return NextResponse.json({ ok: false, error: "Invalid YouTube URL" });

      // Get metadata
      let title = "YouTube video";
      let author = "";
      try {
        const ores = await fetch(
          `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`,
          { signal: AbortSignal.timeout(8000) }
        );
        if (ores.ok) {
          const d = await ores.json();
          title = d.title ?? title;
          author = d.author_name ?? "";
        }
      } catch {}

      // Get transcript
      let transcript = "";
      try {
        const items = await YoutubeTranscript.fetchTranscript(videoId, { lang: "en" });
        transcript = items.map((i) => i.text).join(" ");
      } catch {}

      if (transcript.length > 200) {
        return NextResponse.json({
          ok: true,
          title,
          author,
          text: `YouTube video: ${title}\nChannel: ${author}\n\n${transcript}`,
          collaborator,
        });
      }

      // Fallback: scrape description
      let description = "";
      try {
        const pageRes = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
          headers: { "user-agent": "Mozilla/5.0 (compatible; TawiStudyBot/1.0)" },
          signal: AbortSignal.timeout(10000),
        });
        if (pageRes.ok) {
          const html = await pageRes.text();
          const descMatch = html.match(/"shortDescription":"((?:[^"\\]|\\.)*)"/);
          if (descMatch) description = descMatch[1].replace(/\\n/g, "\n").replace(/\\"/g, '"');
        }
      } catch {}

      return NextResponse.json({
        ok: true,
        title,
        author,
        text: `YouTube video: ${title}\nChannel: ${author}\n\n${description || "No transcript available. Paste the transcript for best results."}`,
        collaborator,
      });
    }

    if (type === "webpage" && url) {
      // Scrape web page
      const res = await fetch(url, {
        headers: {
          "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          accept: "text/html,application/xhtml+xml",
        },
        signal: AbortSignal.timeout(15000),
        redirect: "follow",
      });
      if (!res.ok) return NextResponse.json({ ok: false, error: `HTTP ${res.status}` });
      const html = await res.text();

      const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
      const ogTitle = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i);
      const pageTitle = ogTitle?.[1]?.trim() ?? titleMatch?.[1]?.trim() ?? new URL(url).hostname;

      // Extract article/main content
      let contentHtml = html;
      const articleMatch = html.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
      const mainMatch = html.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
      if (articleMatch) contentHtml = articleMatch[1];
      else if (mainMatch) contentHtml = mainMatch[1];

      const text = contentHtml
        .replace(/<script[\s\S]*?<\/script>/gi, " ")
        .replace(/<style[\s\S]*?<\/style>/gi, " ")
        .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
        .replace(/<footer[\s\S]*?<\/footer>/gi, " ")
        .replace(/<header[\s\S]*?<\/header>/gi, " ")
        .replace(/<[^>]+>/g, "\n")
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&#39;/g, "'")
        .replace(/&quot;/g, '"')
        .replace(/&#\d+;/g, "")
        .replace(/[ \t]+/g, " ")
        .replace(/\n{3,}/g, "\n\n")
        .trim();

      if (text.length < 100)
        return NextResponse.json({ ok: false, error: "Could not extract readable text." });

      return NextResponse.json({ ok: true, title: pageTitle, text: text.slice(0, 50000), collaborator });
    }

    return NextResponse.json({ ok: false, error: "Provide url and type (youtube|webpage)" });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "Extraction failed" });
  }
}

function extractVideoId(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname === "youtu.be") return u.pathname.slice(1).split("/")[0];
    if (u.hostname.includes("youtube.com")) return u.searchParams.get("v");
  } catch {}
  return null;
}
