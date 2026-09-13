export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * POST multipart/form-data with a `file` (PDF, PNG or JPG).
 * Proxies to OCR.space and returns extracted text. Keeps the API key
 * server-side — the browser never sees it.
 *
 * Hardened:
 *  - Tries OCREngine 2 (best for documents) then falls back to engine 1.
 *  - Retries the alternate endpoint region on failure.
 *  - Requests a higher-resolution scan and de-hyphenates split words.
 */

interface OcrResult {
  ok: boolean;
  text?: string;
  error?: string;
}

function extractParsed(data: unknown): string {
  const d = data as { ParsedResults?: { ParsedText?: string }[] };
  return (Array.isArray(d?.ParsedResults) ? d.ParsedResults : [])
    .map((r) => r?.ParsedText ?? "")
    .join("\n")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/-\n(?=[a-z])/g, "") // join hyphenated line breaks
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function runOcr(
  key: string,
  file: File,
  engine: string,
  endpoint = "https://api.ocr.space/parse/image"
): Promise<OcrResult> {
  const out = new FormData();
  out.append("apikey", key);
  out.append("file", file, file.name || "scan");
  out.append("language", "eng");
  out.append("isOverlayRequired", "false");
  out.append("scale", "true");
  out.append("isTable", "true");
  out.append("detectOrientation", "true"); // straighten tilted phone photos
  out.append("OCREngine", engine);
  try {
    const res = await fetch(endpoint, { method: "POST", body: out, signal: AbortSignal.timeout(55_000) });
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    const data = await res.json();
    if (data?.IsErroredOnProcessing) {
      const msg = Array.isArray(data?.ErrorMessage) ? data.ErrorMessage.join(" ") : String(data?.ErrorMessage ?? "OCR failed.");
      return { ok: false, error: msg.slice(0, 200) };
    }
    const text = extractParsed(data);
    if (text.length < 60) return { ok: false, error: "too little text" };
    return { ok: true, text };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "OCR request failed" };
  }
}

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

  // Engine 2 first (best), then engine 1 (more permissive). Each may hit a
  // different region endpoint so a single outage doesn't sink the request.
  const attempts: { engine: string; endpoint?: string }[] = [
    { engine: "2" },
    { engine: "1" },
    { engine: "2", endpoint: "https://api.ocr.space/parse/image" },
  ];
  let lastError = "OCR failed.";
  for (const a of attempts) {
    const r = await runOcr(key, file, a.engine, a.endpoint);
    if (r.ok && r.text) {
      return Response.json({ ok: true, text: r.text.slice(0, 60000) });
    }
    if (r.error) lastError = r.error;
  }

  return Response.json(
    { ok: false, error: `OCR found almost no text (${lastError}). Try a clearer scan or paste the text instead.`.slice(0, 300) },
    { status: 422 }
  );
}
