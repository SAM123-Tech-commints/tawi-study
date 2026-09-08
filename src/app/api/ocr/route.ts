export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * POST multipart/form-data with a `file` (PDF, PNG or JPG).
 * Proxies to OCR.space and returns extracted text. Keeps the API key
 * server-side — the browser never sees it.
 */
export async function POST(req: Request) {
  const key = (process.env.OCR_SPACE_API_KEY ?? "").trim();
  if (!key) {
    return Response.json(
      { ok: false, error: "OCR is not configured. Ask the site owner to set OCR_SPACE_API_KEY." },
      { status: 503 }
    );
  }

  let file: File | null = null;
  try {
    const form = await req.formData();
    const f = form.get("file");
    if (f instanceof File) file = f;
  } catch {
    return Response.json({ ok: false, error: "Could not read the uploaded file." }, { status: 400 });
  }
  if (!file || file.size === 0) {
    return Response.json({ ok: false, error: "No file was uploaded." }, { status: 400 });
  }
  if (file.size > 8 * 1024 * 1024) {
    return Response.json(
      { ok: false, error: "File is too large for OCR (max 8 MB). Try a smaller file or fewer pages." },
      { status: 400 }
    );
  }

  const out = new FormData();
  out.append("apikey", key);
  out.append("file", file, file.name || "scan");
  out.append("language", "eng");
  out.append("isOverlayRequired", "false");
  out.append("scale", "true");
  out.append("OCREngine", "2");

  try {
    const res = await fetch("https://api.ocr.space/parse/image", {
      method: "POST",
      body: out,
      signal: AbortSignal.timeout(55_000),
    });
    if (!res.ok) {
      return Response.json(
        { ok: false, error: `OCR service returned HTTP ${res.status}. Try again in a moment.` },
        { status: 502 }
      );
    }
    const data = await res.json();
    if (data?.IsErroredOnProcessing) {
      const msg = Array.isArray(data?.ErrorMessage)
        ? data.ErrorMessage.join(" ")
        : String(data?.ErrorMessage ?? "OCR failed.");
      return Response.json({ ok: false, error: msg.slice(0, 300) }, { status: 502 });
    }
    const text: string = (Array.isArray(data?.ParsedResults) ? data.ParsedResults : [])
      .map((r: { ParsedText?: string }) => r?.ParsedText ?? "")
      .join("\n")
      .replace(/[ \t]+/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
    if (text.length < 80) {
      return Response.json(
        { ok: false, error: "OCR found almost no text. Try a clearer scan or paste the text instead." },
        { status: 422 }
      );
    }
    return Response.json({ ok: true, text: text.slice(0, 60000) });
  } catch {
    return Response.json(
      { ok: false, error: "OCR request timed out. Try a smaller file." },
      { status: 504 }
    );
  }
}
