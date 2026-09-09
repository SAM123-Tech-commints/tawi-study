export async function extractPdfText(file: File): Promise<string> {
  const pdfjs = (await import("pdfjs-dist")) as unknown as {
    GlobalWorkerOptions: { workerSrc: string };
    getDocument: (opts: {
      data: ArrayBuffer;
      useWorkerFetch?: boolean;
      isEvalSupported?: boolean;
    }) => {
      promise: Promise<{
        numPages: number;
        getPage: (n: number) => Promise<{
          getTextContent: () => Promise<{
            items: {
              str?: string;
              fontName?: string;
              transform?: number[];
            }[];
          }>;
        }>;
      }>;
    };
  };
  if (!pdfjs.GlobalWorkerOptions.workerSrc) {
    pdfjs.GlobalWorkerOptions.workerSrc = new URL(
      "pdfjs-dist/build/pdf.worker.min.mjs",
      import.meta.url
    ).toString();
  }
  const buf = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({
    data: buf,
    useWorkerFetch: false,
    isEvalSupported: false,
  }).promise;
  const pages: string[] = [];
  for (let i = 1; i <= Math.min(doc.numPages, 80); i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    // Group glyph runs into visual lines (same baseline) so sentences keep
    // their line breaks instead of collapsing into one merged paragraph.
    const rows = new Map<number, { x: number; text: string }[]>();
    for (const it of content.items) {
      const str = (it.str ?? "").replace(/\s+/g, " ").trim();
      if (!str) continue;
      const t = it.transform ?? [0, 0, 0, 0, 0, 0];
      const y = Math.round((t[5] ?? 0) / 2) * 2;
      const x = t[4] ?? 0;
      const bold = /bold|black|heavy|bd\b/i.test(it.fontName ?? "");
      const text = bold ? `**${str}**` : str;
      const list = rows.get(y) ?? [];
      list.push({ x, text });
      rows.set(y, list);
    }
    const orderedY = [...rows.keys()].sort((a, b) => b - a);
    const lines = orderedY.map((y) =>
      rows
        .get(y)!
        .sort((a, b) => a.x - b.x)
        .map((r) => r.text)
        .join(" ")
        .replace(/\s+([.,;:!?%])/g, "$1")
        .trim()
    );
    // De-hyphenate words split across lines: "photo- \n synthesis" → "photosynthesis".
    const merged: string[] = [];
    for (const line of lines) {
      const prev = merged[merged.length - 1];
      if (prev && /-$/.test(prev) && /^[a-z]/.test(line)) {
        merged[merged.length - 1] = prev.slice(0, -1) + line;
      } else {
        merged.push(line);
      }
    }
    // Clean up multiple spaces and normalize whitespace
    const cleaned = merged
      .join("\n")
      .replace(/ {2,}/g, " ")
      .replace(/\t+/g, " ")
      .trim();
    pages.push(cleaned);
  }
  return pages.join("\n\n").trim();
}

export async function extractTextFile(file: File): Promise<string> {
  return file.text();
}

/** Page count only — cheap, no text parsing. Used to size the pages slider. */
export async function getPdfPageCount(file: File): Promise<number> {
  const pdfjs = (await import("pdfjs-dist")) as unknown as {
    GlobalWorkerOptions: { workerSrc: string };
    getDocument: (opts: { data: ArrayBuffer }) => { promise: Promise<{ numPages: number }> };
  };
  if (!pdfjs.GlobalWorkerOptions.workerSrc) {
    pdfjs.GlobalWorkerOptions.workerSrc = new URL(
      "pdfjs-dist/build/pdf.worker.min.mjs",
      import.meta.url
    ).toString();
  }
  const buf = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: buf }).promise;
  return doc.numPages;
}
