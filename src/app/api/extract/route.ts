import { NextRequest, NextResponse } from "next/server";

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
      const videoId = extractVideoId(url);
      if (!videoId) return NextResponse.json({ ok: false, error: "Invalid YouTube URL" });

      // Try every transcript source and keep the longest result.
      let transcript = "";
      let title = "YouTube video";
      let author = "";
      try {
        const { extractYouTubeTranscript } = await import("@/lib/youtube");
        const r = await extractYouTubeTranscript(videoId);
        transcript = r.text;
        title = r.title;
        author = r.author;
      } catch {}

      if (transcript.length > 200) {
        return NextResponse.json({
          ok: true,
          title,
          author,
          transcript: true,
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
        transcript: description.length > 200,
        text: `YouTube video: ${title}\nChannel: ${author}\n\n${description ? `⚠️ No transcript was available, so this is only the video description — questions will be weaker. Paste the transcript for full-quality kits.\n\n${description}` : "⚠️ WARNING: no transcript or description could be extracted. Paste the transcript or your own notes for best results."}`,
        collaborator,
      });
    }

    if (type === "webpage" && url) {
      // Scrape web page
      const res = await fetch(url, {
        headers: {
          "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "accept-language": "en-US,en;q=0.9",
        },
        signal: AbortSignal.timeout(15000),
        redirect: "follow",
      });
      if (!res.ok) return NextResponse.json({ ok: false, error: `HTTP ${res.status}` });
      const html = await res.text();

      // Structure-preserving extraction (headings, bullets, bold) shared with
      // the server action so scraped pages render like the source.
      const { htmlToStructuredText, extractTitle, extractDescription } = await import("@/lib/html");
      const pageTitle = extractTitle(html, new URL(url).hostname);
      const ogDescription = extractDescription(html);
      const body = htmlToStructuredText(html);

      if (body.length < 100)
        return NextResponse.json({ ok: false, error: "Could not extract readable text." });

      const text =
        ogDescription && !body.slice(0, 600).includes(ogDescription.slice(0, 60))
          ? `${ogDescription}\n\n${body}`.slice(0, 50000)
          : body.slice(0, 50000);

      return NextResponse.json({ ok: true, title: pageTitle, text, collaborator });
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
