"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  FileText,
  Link2,
  Sparkles,
  Trash2,
  UploadCloud,
} from "lucide-react";
import { createKitAction, fetchUrlAction, getSessionInfo } from "@/lib/actions";
import { extractPdfText, extractTextFile } from "@/components/pdf";
import { extractTerms } from "@/lib/text";
import {
  Badge,
  Button,
  Card,
  cn,
  Field,
  Input,
  ProgressBar,
  Spinner,
  Textarea,
  useToast,
} from "@/components/ui";

interface Source {
  name: string;
  text: string;
}

const GENERATE_STAGES = [
  "Reading your material…",
  "Extracting key terms and concepts…",
  "Writing flashcards…",
  "Generating practice questions…",
  "Building your study guide & summaries…",
  "Almost there — polishing everything…",
];

const MAX_PAGE_CHARS = 3200;

export default function NewKitPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [mode, setMode] = useState<"upload" | "link" | "paste" | null>(null);
  const [sources, setSources] = useState<Source[]>([]);
  const [pages, setPages] = useState(4);
  const [pasted, setPasted] = useState("");
  const [url, setUrl] = useState("");
  const [extracting, setExtracting] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [stageIdx, setStageIdx] = useState(0);
  const [cardCount, setCardCount] = useState(14);
  const [questionCount, setQuestionCount] = useState(12);
  const [dragOver, setDragOver] = useState(false);
  const [isGuest, setIsGuest] = useState(false);
  const [ocrFile, setOcrFile] = useState<File | null>(null);
  const [ocrBusy, setOcrBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getSessionInfo().then((info) => setIsGuest(info?.isGuest ?? false));
  }, []);

  useEffect(() => {
    if (!generating) return;
    let i = 0;
    const t = setInterval(() => {
      i = Math.min(i + 1, GENERATE_STAGES.length - 1);
      setStageIdx(i);
    }, 1400);
    return () => clearInterval(t);
  }, [generating]);

  const sliceByPages = (text: string) => text.slice(0, Math.max(1, pages) * MAX_PAGE_CHARS);

  const addSource = (name: string, text: string) => {
    setSources((s) => [...s, { name, text }]);
    if (!title) setTitle(name.replace(/\.[^.]+$/, "").slice(0, 60));
    toast(`“${name}” added to your kit`);
  };

  const handleFile = async (file: File) => {
    if (isGuest) {
      toast("Guests can't upload files — sign up free to create study kits.", "error");
      router.push("/signin");
      return;
    }
    setExtracting(true);
    setOcrFile(null);
    try {
      const lower = file.name.toLowerCase();
      const isImage = /\.(png|jpe?g|webp|bmp|tiff?)$/.test(lower);
      let text = "";
      if (lower.endsWith(".pdf")) text = await extractPdfText(file);
      else if (isImage) {
        // Auto-send images to OCR immediately
        setOcrBusy(true);
        const form = new FormData();
        form.append("file", file);
        const res = await fetch("/api/ocr", { method: "POST", body: form });
        const data = await res.json();
        setOcrBusy(false);
        if (data.ok && data.text?.length > 80) {
          addSource(file.name + " (OCR)", data.text);
          toast("Image text extracted successfully");
          setExtracting(false);
          return;
        }
        // If OCR failed or too short, still add the image as a source
        setOcrFile(file);
        toast("Could not extract text from this image. Try a clearer image.", "error");
        setExtracting(false);
        return;
      } else text = await extractTextFile(file);
      if (text.trim().length < 80) {
        // Probably a scanned PDF — offer server-side OCR.
        setOcrFile(file);
        toast("This looks like a scanned file. Scanning with OCR...", "error");
        // Auto-trigger OCR for scanned PDFs too
        setOcrBusy(true);
        const form = new FormData();
        form.append("file", file);
        const res = await fetch("/api/ocr", { method: "POST", body: form });
        const data = await res.json();
        setOcrBusy(false);
        if (data.ok && data.text?.length > 80) {
          addSource(file.name + " (OCR)", data.text);
          toast("Scanned text extracted successfully");
          setOcrFile(null);
        }
        setExtracting(false);
        return;
      }
      addSource(file.name, text);
    } catch {
      toast("Could not read this file. Try a different format or paste the text.", "error");
    } finally {
      setExtracting(false);
    }
  };

  const scanWithOcr = async () => {
    if (!ocrFile) return;
    if (isGuest) {
      toast("Guests can't upload files — sign up free to use OCR.", "error");
      router.push("/signin");
      return;
    }
    setOcrBusy(true);
    try {
      const form = new FormData();
      form.append("file", ocrFile);
      const res = await fetch("/api/ocr", { method: "POST", body: form });
      const data = await res.json();
      if (!data.ok) {
        toast(data.error ?? "OCR failed.", "error");
        return;
      }
      addSource(`${ocrFile.name} (OCR)`, data.text as string);
      setOcrFile(null);
    } catch {
      toast("OCR request failed. Check your connection and try again.", "error");
    } finally {
      setOcrBusy(false);
    }
  };

  const fetchLink = async () => {
    if (!url.trim()) return;
    setExtracting(true);
    const res = await fetchUrlAction(url.trim());
    setExtracting(false);
    if (!res.ok) {
      toast(res.error ?? "Could not fetch this link", "error");
      return;
    }
    addSource(res.title ?? "Web content", res.text ?? "");
    setUrl("");
  };

  const totalChars = sources.reduce((a, s) => a + s.text.length, 0);
  const detectedTerms = useMemo(() => {
    if (!sources.length) return 0;
    try {
      return extractTerms(sources.map((s) => s.text).join("\n\n").slice(0, 60000)).length;
    } catch {
      return 0;
    }
  }, [sources]);

  const autoCounts = () => {
    if (!detectedTerms) {
      toast("No clear term→definition pairs detected yet — add more material.", "error");
      return;
    }
    setCardCount(Math.min(30, Math.max(6, detectedTerms)));
    setQuestionCount(Math.min(20, Math.max(6, detectedTerms)));
    toast(`Counts set from ${detectedTerms} detected terms ✨`);
  };

  const generate = async () => {
    if (!sources.length) {
      toast("Add some material first — upload, paste or drop a link.", "error");
      return;
    }
    setGenerating(true);
    setStageIdx(0);
    const content = sources.map((s) => sliceByPages(s.text)).join("\n\n");
    const res = await createKitAction({
      title: title.trim() || sources[0].name,
      content,
      sourceName: sources.map((s) => s.name).join(", "),
      cardCount,
      questionCount,
    });
    if (!res.ok) {
      setGenerating(false);
      toast(res.error ?? "Could not generate the kit", "error");
      return;
    }
    router.push(`/kits/${res.id}`);
  };

  if (generating) {
    return (
      <div className="mx-auto flex max-w-lg flex-col items-center py-24 text-center">
        <div className="relative">
          <span className="grid h-20 w-20 animate-pulse place-items-center rounded-3xl bg-brand-500 text-ink">
            <Sparkles size={34} />
          </span>
          <span className="absolute -right-1 -top-1 h-4 w-4 animate-ping rounded-full bg-brand-400" />
        </div>
        <h1 className="font-display mt-6 text-2xl font-bold text-ink dark:text-cream">Tawi is building your study kit</h1>
        <p className="mt-2 min-h-[1.5rem] text-sm font-semibold text-brand-700 dark:text-brand-400">
          {GENERATE_STAGES[stageIdx]}
        </p>
        <ProgressBar value={stageIdx + 1} max={GENERATE_STAGES.length} className="mt-5 w-full max-w-xs" />
        <p className="mt-6 text-xs text-ink/45 dark:text-cream/45">
          Flashcards → questions → study guide. Takes a few seconds.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <button
        onClick={() => router.back()}
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-ink/55 hover:text-ink dark:text-cream/55 dark:hover:text-cream"
      >
        <ArrowLeft size={15} /> Back
      </button>
      {isGuest && (
        <Card className="mb-5 border-amber-400/50 bg-amber-50 dark:bg-amber-500/10">
          <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">
            👀 Guest preview only —{" "}
            <button onClick={() => router.push("/signin")} className="font-bold underline underline-offset-2">
              create a free account
            </button>{" "}
            to upload files, run OCR and generate study kits.
          </p>
        </Card>
      )}
      <div className="mb-6">
        <h1 className="font-display text-3xl font-bold tracking-tight text-ink dark:text-cream">Create a study kit</h1>
        <p className="mt-1 text-[15px] text-ink/60 dark:text-cream/60">
          Add your learning material — Tawi generates flashcards, Smart Study questions, a study guide and games.
        </p>
      </div>

      {/* Title */}
      <Card className="mb-5">
        <Field label="Study kit title" hint="Shown on your dashboard — e.g. “Photosynthesis — Chapter 6”">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Biology — Photosynthesis" />
        </Field>
      </Card>

      {/* Source mode */}
      <div className="mb-5 grid grid-cols-3 gap-3">
        {(
          [
            ["upload", "Upload my file", UploadCloud],
            ["link", "YouTube / web link", Link2],
            ["paste", "Paste notes", FileText],
          ] as const
        ).map(([m, label, Icon]) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={cn(
              "rounded-2xl border-2 p-4 text-center transition",
              mode === m
                ? "border-brand-500 bg-brand-50 dark:bg-brand-500/10"
                : "border-ink/10 bg-surface hover:border-ink/25 dark:border-cream/15 dark:bg-surface-dark dark:hover:border-cream/40"
            )}
          >
            <Icon size={20} className={cn("mx-auto mb-1.5", mode === m ? "text-ink dark:text-brand-300" : "text-ink/50 dark:text-cream/50")} />
            <span className="text-[13px] font-bold text-ink dark:text-cream">{label}</span>
          </button>
        ))}
      </div>

      {mode === "upload" && (
        <Card>
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.txt,.md,.csv,.json,.png,.jpg,.jpeg,.webp"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          />
          <div
            onClick={() => !extracting && fileRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              const f = e.dataTransfer.files?.[0];
              if (f && !extracting) handleFile(f);
            }}
            className={cn(
              "cursor-pointer rounded-2xl border-2 border-dashed p-10 text-center transition",
              dragOver ? "border-brand-500 bg-brand-50 dark:bg-brand-500/10" : "border-ink/15 hover:border-brand-500 dark:border-cream/20"
            )}
          >
            {extracting ? (
              <>
                <Spinner className="mx-auto h-6 w-6" />
                <p className="mt-3 text-sm font-semibold text-ink/60 dark:text-cream/60">Reading your file…</p>
              </>
            ) : (
              <>
                <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-brand-500 text-ink">
                  <UploadCloud size={26} />
                </span>
                <p className="mt-4 text-[15px] font-bold text-ink dark:text-cream">Click the cloud or drop your file</p>
                <p className="mt-1 text-[13px] text-ink/50 dark:text-cream/50">PDF, images, TXT, MD, CSV · up to 80 pages · scanned PDFs use OCR</p>
              </>
            )}
          </div>

          {ocrFile && !extracting && (
            <div className="mt-4 rounded-2xl border border-brand-500/50 bg-brand-50 p-4 dark:bg-brand-500/10">
              <p className="text-sm font-bold text-ink dark:text-cream">
                📷 “{ocrFile.name}” looks scanned — no selectable text found.
              </p>
              <p className="mt-1 text-[13px] text-ink/60 dark:text-cream/60">
                Run OCR to extract the exact text, then generate your kit from it.
              </p>
              <div className="mt-3 flex gap-2">
                <Button onClick={scanWithOcr} disabled={ocrBusy}>
                  {ocrBusy ? <Spinner className="border-ink/30 border-t-ink" /> : <Sparkles size={15} />}
                  {ocrBusy ? "Scanning…" : "Scan with OCR"}
                </Button>
                <Button variant="ghost" onClick={() => setOcrFile(null)} disabled={ocrBusy}>
                  Dismiss
                </Button>
              </div>
            </div>
          )}

          {mode === "upload" && (
            <div className="mt-5">
              <div className="mb-1.5 flex items-center justify-between">
                <Label2>How many pages of material?</Label2>
                <span className="text-sm font-bold text-brand-700 dark:text-brand-400">{pages} page{pages > 1 ? "s" : ""}</span>
              </div>
              <input
                type="range"
                min={1}
                max={10}
                value={pages}
                onChange={(e) => setPages(Number(e.target.value))}
                className="w-full accent-[#96C51F]"
              />
              <p className="mt-1 text-xs text-ink/45 dark:text-cream/45">
                Roughly {pages * 3200} characters of material will be used to generate your kit.
              </p>
            </div>
          )}
        </Card>
      )}

      {mode === "link" && (
        <Card>
          <Field label="YouTube or web link" hint="YouTube: we'll grab the title. For best results paste the transcript too — or add any article/blog page.">
            <div className="flex gap-2">
              <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://youtube.com/watch?v=… or any article URL" onKeyDown={(e) => e.key === "Enter" && fetchLink()} />
              <Button onClick={fetchLink} disabled={extracting || !url.trim()}>
                {extracting ? <Spinner className="border-ink/30 border-t-ink" /> : "Fetch"}
              </Button>
            </div>
          </Field>
        </Card>
      )}

      {mode === "paste" && (
        <Card>
          <Field label="Paste your notes or terms" hint="Anything works: lecture notes, textbook pages, glossaries…">
            <Textarea
              rows={8}
              value={pasted}
              onChange={(e) => setPasted(e.target.value)}
              placeholder="Paste your learning material here…"
            />
          </Field>
          <Button
            variant="dark"
            className="mt-3"
            disabled={!pasted.trim()}
            onClick={() => {
              if (pasted.trim().length < 120) {
                toast("Please paste a bit more text (at least a few sentences).", "error");
                return;
              }
              addSource("Pasted notes", pasted.trim());
              setPasted("");
            }}
          >
            <Check size={15} /> Add to kit
          </Button>
        </Card>
      )}

      {/* Sources list */}
      {sources.length > 0 && (
        <Card className="mt-5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-bold text-ink dark:text-cream">
              Learning material <Badge tone="brand" className="ml-1">{sources.length}</Badge>
            </h3>
            <span className="text-xs font-semibold text-ink/50 dark:text-cream/50">{totalChars.toLocaleString()} characters</span>
          </div>
          <div className="space-y-2.5">
            {sources.map((s, i) => (
              <div key={i} className="flex items-center gap-3 rounded-2xl bg-ink/4 p-3.5 dark:bg-cream/5">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-surface text-ink shadow-sm dark:bg-surface-dark dark:text-cream">
                  <FileText size={16} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-ink dark:text-cream">{s.name}</p>
                  <p className="text-xs text-ink/50 dark:text-cream/50">{s.text.slice(0, 140)}…</p>
                </div>
                <button
                  onClick={() => setSources((arr) => arr.filter((_, j) => j !== i))}
                  className="rounded-full p-2 text-ink/40 transition hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-500/10"
                  aria-label="Remove source"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
          {sources.length > 1 && (
            <p className="mt-3 text-xs text-ink/45 dark:text-cream/45">
              Note: the page limit applies to each source individually.
            </p>
          )}
        </Card>
      )}

      {/* Settings */}
      {sources.length > 0 && (
        <Card className="mt-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-bold text-ink dark:text-cream">Generation settings</h3>
            <Button variant="outline" size="sm" onClick={autoCounts} disabled={!detectedTerms}>
              <Sparkles size={14} /> Auto from {detectedTerms} terms
            </Button>
          </div>
          <p className="mb-4 text-xs text-ink/55 dark:text-cream/55">
            Card & question volume follows the term→definition pairs in your material
            {detectedTerms ? ` (detected ~${detectedTerms})` : " — add material to detect terms"}.
          </p>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label={`Flashcards: ${cardCount}`}>
              <input
                type="range"
                min={6}
                max={30}
                value={cardCount}
                onChange={(e) => setCardCount(Number(e.target.value))}
                className="w-full accent-[#96C51F]"
              />
            </Field>
            <Field label={`Practice questions: ${questionCount}`}>
              <input
                type="range"
                min={6}
                max={20}
                value={questionCount}
                onChange={(e) => setQuestionCount(Number(e.target.value))}
                className="w-full accent-[#96C51F]"
              />
            </Field>
          </div>
        </Card>
      )}

      {/* Generate CTA */}
      <div className="sticky bottom-4 mt-6">
        <Button size="lg" className="w-full shadow-xl" onClick={generate} disabled={!sources.length}>
          <Sparkles size={17} /> Generate study kit
          <ArrowRight size={16} />
        </Button>
      </div>
    </div>
  );
}

function Label2({ children }: { children: React.ReactNode }) {
  return <span className="text-[13px] font-semibold text-ink/80 dark:text-cream/80">{children}</span>;
}
