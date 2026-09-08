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
          getTextContent: () => Promise<{ items: { str?: string }[] }>;
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
  let out = "";
  for (let i = 1; i <= Math.min(doc.numPages, 80); i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    out += content.items.map((it) => it.str ?? "").join(" ") + "\n\n";
  }
  return out.trim();
}

export async function extractTextFile(file: File): Promise<string> {
  return file.text();
}
