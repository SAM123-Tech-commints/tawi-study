import { sql } from "drizzle-orm";
import { db, isDatabaseConfigured, resolveDatabaseUrl } from "@/db";
import { aiAvailable, aiEngineLabel } from "@/lib/ai";

export const dynamic = "force-dynamic";

/** Redact credentials before echoing a connection string back to a client. */
function safeHost(url: string | null): string | null {
  if (!url) return null;
  try {
    const { host, pathname } = new URL(url);
    return `${host}${pathname}`;
  } catch {
    return "unparseable";
  }
}

export async function GET() {
  if (!isDatabaseConfigured()) {
    return Response.json(
      {
        ok: false,
        database: "not_configured",
        hint: "Set DATABASE_URL in your environment. See /setup for the 3-step guide.",
        ai: { enabled: aiAvailable(), engine: aiEngineLabel() },
      },
      { status: 503 }
    );
  }

  try {
    await db.execute(sql`select 1`);
    return Response.json({
      ok: true,
      database: "connected",
      host: safeHost(resolveDatabaseUrl()),
      ai: { enabled: aiAvailable(), engine: aiEngineLabel() },
      // Presence only — never values. Use this to verify Vercel env vars.
      keys: {
        transcript: Boolean((process.env.TRANSCRIPT_API_KEY ?? "").trim()),
        ocr: Boolean((process.env.OCR_SPACE_API_KEY ?? "").trim()),
        google: Boolean(
          (process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? process.env.GOOGLE_CLIENT_ID ?? "").trim()
        ),
      },
    });
  } catch (err) {
    return Response.json(
      {
        ok: false,
        database: "unreachable",
        error: err instanceof Error ? err.message : String(err),
        ai: { enabled: aiAvailable(), engine: aiEngineLabel() },
      },
      { status: 500 }
    );
  }
}
