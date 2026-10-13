import { readImageForStudy, visionAvailable } from "@/lib/ai";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * AI vision endpoint.
 *
 *  GET  → { ok, available }  so the client can decide whether to render PDF
 *         pages / route images here before doing the (heavier) work.
 *
 *  POST multipart/form-data with:
 *    - `file`  an image (PNG/JPG/WebP) — an uploaded picture, a photo of
 *              notes, or a PDF page rendered to PNG by the client.
 *    - `mode`  "full" (default) transcribes everything; "figures" focuses on
 *              diagrams/figures for a PDF page whose body text is already
 *              captured, so we don't duplicate paragraphs.
 *
 *  Uses Gemini (preferred) or OpenAI vision. The key stays server-side.
 */

export async function GET() {
  return Response.json({ ok: true, available: visionAvailable() });
}

export async function POST(req: Request) {
  if (!visionAvailable()) {
    return Response.json(
      { ok: false, error: "AI vision is not configured. Ask the site owner to set GEMINI_API_KEY." },
      { status: 503 }
    );
  }

  let file: File | null = null;
  let mode: "full" | "figures" = "full";
  try {
    const form = await req.formData();
    const f = form.get("file");
    if (f instanceof File) file = f;
    if (form.get("mode") === "figures") mode = "figures";
  } catch {
    return Response.json({ ok: false, error: "Could not read the uploaded image." }, { status: 400 });
  }

  if (!file || file.size === 0) {
    return Response.json({ ok: false, error: "No image was uploaded." }, { status: 400 });
  }
  if (file.size > 12 * 1024 * 1024) {
    return Response.json(
      { ok: false, error: "Image is too large for AI vision (max 12 MB)." },
      { status: 400 }
    );
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const mime = file.type || "image/png";
  const text = await readImageForStudy([{ data: buf.toString("base64"), mime }], { mode });

  if (!text || text.trim().length < 3) {
    return Response.json(
      { ok: false, error: "The AI could not read anything useful from this image." },
      { status: 422 }
    );
  }
  return Response.json({ ok: true, text: text.slice(0, 60000) });
}
