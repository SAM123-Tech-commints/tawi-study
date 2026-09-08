"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  FileText,
  GraduationCap,
  Link2,
  Sparkles,
  Trash2,
  UploadCloud,
} from "lucide-react";
import {
  addAssignmentContentAction,
  createAssignmentAction,
  fetchUrlAction,
  generateAssignmentQuestionsAction,
} from "@/lib/actions";
import { extractPdfText, extractTextFile } from "@/components/pdf";
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

const STAGES = [
  "Reading your material…",
  "Picking the most important concepts…",
  "Writing questions…",
  "Checking answers and explanations…",
  "Formatting your worksheet…",
];

export default function NewAssignmentPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [assignmentId, setAssignmentId] = useState<string | null>(null);

  // step 1: details
  const [teacherName, setTeacherName] = useState("");
  const [className, setClassName] = useState("");
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");

  // step 2: content
  const [mode, setMode] = useState<"upload" | "link" | "paste" | null>(null);
  const [content, setContent] = useState("");
  const [sourceName, setSourceName] = useState("");
  const [pages, setPages] = useState(4);
  const [extracting, setExtracting] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [url, setUrl] = useState("");
  const [pasted, setPasted] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  // step 3: settings
  const [count, setCount] = useState(10);
  const [types, setTypes] = useState<string[]>(["mcq", "true_false"]);
  const [instructions, setInstructions] = useState("");

  // step 4: generating / results
  const [generating, setGenerating] = useState(false);
  const [stageIdx, setStageIdx] = useState(0);
  const [questionCount, setQuestionCount] = useState(0);

  useEffect(() => {
    if (!generating) return;
    let i = 0;
    const t = setInterval(() => {
      i = Math.min(i + 1, STAGES.length - 1);
      setStageIdx(i);
    }, 1400);
    return () => clearInterval(t);
  }, [generating]);

  const next = async () => {
    if (step === 1) {
      if (!teacherName.trim() || !className.trim() || !title.trim()) {
        toast("Fill in your name, class name and assignment title.", "error");
        return;
      }
      const res = await createAssignmentAction({
        title,
        teacherName,
        className,
        dueDate,
      });
      if (!res.ok || !res.id) {
        toast(res.error ?? "Could not create assignment", "error");
        return;
      }
      setAssignmentId(res.id);
      setStep(2);
    } else if (step === 2) {
      if (!content.trim()) {
        toast("Add your learning material first.", "error");
        return;
      }
      setStep(3);
    }
  };

  const addContent = async (text: string, name: string) => {
    if (!assignmentId) return;
    const res = await addAssignmentContentAction({
      assignmentId,
      content: text.slice(0, Math.max(1, pages) * 3200),
      sourceName: name,
    });
    if (!res.ok) {
      toast(res.error ?? "Could not add content", "error");
      return;
    }
    setContent(res ? text.slice(0, Math.max(1, pages) * 3200) : "");
    setSourceName(name);
    toast(`“${name}” added — ${Math.min(text.length, pages * 3200).toLocaleString()} characters`);
  };

  const handleFile = async (file: File) => {
    setExtracting(true);
    try {
      let text = "";
      if (file.name.toLowerCase().endsWith(".pdf")) text = await extractPdfText(file);
      else text = await extractTextFile(file);
      if (text.trim().length < 80) {
        toast("Could not read much text from this file. Try pasting instead.", "error");
        return;
      }
      await addContent(text, file.name);
    } catch {
      toast("Could not read this file. Try a different format.", "error");
    } finally {
      setExtracting(false);
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
    await addContent(res.text ?? "", res.title ?? "Web content");
    setUrl("");
  };

  const generate = async () => {
    if (!assignmentId) return;
    if (!types.length) {
      toast("Pick at least one question type.", "error");
      return;
    }
    setGenerating(true);
    setStageIdx(0);
    const res = await generateAssignmentQuestionsAction({
      assignmentId,
      count,
      types,
      instructions,
    });
    setGenerating(false);
    if (!res.ok) {
      toast(res.error ?? "Could not generate questions", "error");
      return;
    }
    setQuestionCount(res.created);
    setStep(4);
  };

  if (generating) {
    return (
      <div className="mx-auto flex max-w-lg flex-col items-center py-24 text-center">
        <span className="grid h-20 w-20 animate-pulse place-items-center rounded-3xl bg-violet-500 text-white">
          <Sparkles size={34} />
        </span>
        <h1 className="font-display mt-6 text-2xl font-bold text-ink dark:text-cream">Generating your worksheet</h1>
        <p className="mt-2 min-h-[1.5rem] text-sm font-semibold text-violet-600 dark:text-violet-300">
          {STAGES[stageIdx]}
        </p>
        <ProgressBar value={stageIdx + 1} max={STAGES.length} className="mt-5 w-full max-w-xs" tone="violet" />
      </div>
    );
  }

  const TYPE_OPTIONS = [
    ["mcq", "Multiple choice", "4 options, one correct"],
    ["true_false", "True / False", "Spot the false statement"],
    ["short", "Short answer", "Answer in 1–2 sentences"],
  ] as const;

  return (
    <div className="mx-auto max-w-3xl">
      <button
        onClick={() => (step === 1 ? router.back() : setStep((s) => s - 1))}
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-ink/55 hover:text-ink dark:text-cream/55 dark:hover:text-cream"
      >
        <ArrowLeft size={15} /> {step === 1 ? "Back" : "Previous step"}
      </button>

      {/* Stepper */}
      <div className="mb-7 flex items-center gap-2">
        {["Details", "Add content", "Question settings", "Review & share"].map((label, i) => (
          <div key={label} className="flex flex-1 flex-col gap-1.5">
            <div
              className={cn(
                "h-1.5 rounded-full transition-colors",
                step >= i + 1 ? (step > i + 1 ? "bg-brand-500" : "bg-brand-500 animate-pulse") : "bg-ink/10 dark:bg-cream/15"
              )}
            />
            <span className={cn("text-[11px] font-bold", step === i + 1 ? "text-ink dark:text-cream" : "text-ink/40 dark:text-cream/40")}>
              {i + 1}. {label}
            </span>
          </div>
        ))}
      </div>

      {/* STEP 1 — details */}
      {step === 1 && (
        <Card>
          <h2 className="font-display mb-1 text-xl font-bold text-ink dark:text-cream">Assignment details</h2>
          <p className="mb-5 text-sm text-ink/55 dark:text-cream/55">Your students will see these details on the worksheet.</p>
          <div className="space-y-4">
            <Field label="Your name (teacher)">
              <Input value={teacherName} onChange={(e) => setTeacherName(e.target.value)} placeholder="e.g. Mr. Rahman" />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Class name">
                <Input value={className} onChange={(e) => setClassName(e.target.value)} placeholder="e.g. Biology 4A" />
              </Field>
              <Field label="Due date">
                <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              </Field>
            </div>
            <Field label="Assignment title">
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Photosynthesis Worksheet — Chapter 6" />
            </Field>
          </div>
          <div className="mt-6 flex justify-end">
            <Button size="lg" onClick={next}>
              Create assignment <ArrowRight size={16} />
            </Button>
          </div>
        </Card>
      )}

      {/* STEP 2 — content */}
      {step === 2 && (
        <Card>
          <h2 className="font-display mb-1 text-xl font-bold text-ink dark:text-cream">Add your content</h2>
          <p className="mb-5 text-sm text-ink/55 dark:text-cream/55">Upload a file, add a YouTube/web link, or paste notes and terms.</p>

          <div className="mb-5 grid grid-cols-3 gap-3">
            {(
              [
                ["upload", "Upload my file", UploadCloud],
                ["link", "YouTube / link", Link2],
                ["paste", "Paste notes", FileText],
              ] as const
            ).map(([m, label, Icon]) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={cn(
                  "rounded-2xl border-2 p-4 text-center transition",
                  mode === m
                    ? "border-violet-500 bg-violet-50 dark:bg-violet-500/10"
                    : "border-ink/10 bg-surface hover:border-ink/25 dark:border-cream/15 dark:bg-surface-dark"
                )}
              >
                <Icon size={20} className={cn("mx-auto mb-1.5", mode === m ? "text-violet-600 dark:text-violet-300" : "text-ink/50 dark:text-cream/50")} />
                <span className="text-[13px] font-bold text-ink dark:text-cream">{label}</span>
              </button>
            ))}
          </div>

          {mode === "upload" && (
            <>
              <input
                ref={fileRef}
                type="file"
                accept=".pdf,.txt,.md,.csv,.json"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
              />
              <div
                onClick={() => !extracting && fileRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  const f = e.dataTransfer.files?.[0];
                  if (f && !extracting) handleFile(f);
                }}
                className={cn(
                  "cursor-pointer rounded-2xl border-2 border-dashed p-8 text-center transition",
                  dragOver ? "border-violet-500 bg-violet-50 dark:bg-violet-500/10" : "border-ink/15 hover:border-violet-500 dark:border-cream/20"
                )}
              >
                {extracting ? (
                  <>
                    <Spinner className="mx-auto h-6 w-6" />
                    <p className="mt-3 text-sm font-semibold text-ink/60 dark:text-cream/60">Reading your file…</p>
                  </>
                ) : (
                  <>
                    <span className="mx-auto grid h-13 w-13 place-items-center rounded-2xl bg-violet-500 p-3 text-white">
                      <UploadCloud size={26} />
                    </span>
                    <p className="mt-3 text-[15px] font-bold text-ink dark:text-cream">Click the cloud or drop your file</p>
                    <p className="mt-1 text-[13px] text-ink/50 dark:text-cream/50">PDF, TXT, MD, CSV · up to 80 pages</p>
                  </>
                )}
              </div>
              <div className="mt-4">
                <div className="mb-1.5 flex items-center justify-between text-[13px] font-semibold text-ink/80 dark:text-cream/80">
                  <span>How many pages of material?</span>
                  <span className="font-bold text-violet-600 dark:text-violet-300">{pages}</span>
                </div>
                <input type="range" min={1} max={10} value={pages} onChange={(e) => setPages(Number(e.target.value))} className="w-full accent-[#7C5CFC]" />
              </div>
            </>
          )}

          {mode === "link" && (
            <div className="flex gap-2">
              <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://youtube.com/watch?v=… or any article URL" onKeyDown={(e) => e.key === "Enter" && fetchLink()} />
              <Button variant="dark" onClick={fetchLink} disabled={extracting || !url.trim()}>
                {extracting ? <Spinner className="border-cream/30 border-t-cream" /> : "Fetch"}
              </Button>
            </div>
          )}

          {mode === "paste" && (
            <div>
              <Textarea rows={8} value={pasted} onChange={(e) => setPasted(e.target.value)} placeholder="Paste your notes, textbook pages, or terms…" />
              <Button
                variant="dark"
                className="mt-3"
                disabled={!pasted.trim()}
                onClick={() => {
                  if (pasted.trim().length < 120) {
                    toast("Please paste a bit more text.", "error");
                    return;
                  }
                  addContent(pasted.trim(), "Pasted notes");
                  setPasted("");
                }}
              >
                <Check size={15} /> Add to assignment
              </Button>
            </div>
          )}

          {content && (
            <div className="mt-5 rounded-2xl bg-ink/4 p-4 dark:bg-cream/5">
              <div className="mb-2 flex items-center justify-between">
                <p className="flex items-center gap-2 text-sm font-bold text-ink dark:text-cream">
                  <FileText size={15} /> {sourceName || "Learning material"}
                </p>
                <Badge tone="green">✓ Added</Badge>
              </div>
              <p className="line-clamp-4 text-[13px] leading-relaxed text-ink/60 dark:text-cream/60">
                {content.slice(0, 600)}…
              </p>
            </div>
          )}

          <div className="mt-6 flex justify-between">
            <Button variant="ghost" onClick={() => setStep(1)}>
              <ArrowLeft size={15} /> Back
            </Button>
            <Button size="lg" onClick={next} disabled={!content.trim()}>
              Next: question settings <ArrowRight size={16} />
            </Button>
          </div>
        </Card>
      )}

      {/* STEP 3 — settings */}
      {step === 3 && (
        <Card>
          <h2 className="font-display mb-1 text-xl font-bold text-ink dark:text-cream">Question settings</h2>
          <p className="mb-5 text-sm text-ink/55 dark:text-cream/55">Tune the worksheet before generating.</p>
          <div className="space-y-6">
            <Field label={`Number of questions: ${count}`}>
              <input type="range" min={5} max={30} value={count} onChange={(e) => setCount(Number(e.target.value))} className="w-full accent-[#96C51F]" />
            </Field>
            <div>
              <p className="mb-2 text-[13px] font-semibold text-ink/80 dark:text-cream/80">Question types</p>
              <div className="grid gap-2.5 sm:grid-cols-3">
                {TYPE_OPTIONS.map(([id, label, desc]) => {
                  const on = types.includes(id);
                  return (
                    <button
                      key={id}
                      onClick={() => setTypes((t) => (on ? t.filter((x) => x !== id) : [...t, id]))}
                      className={cn(
                        "rounded-2xl border-2 p-3.5 text-left transition",
                        on
                          ? "border-brand-500 bg-brand-50 dark:bg-brand-500/10"
                          : "border-ink/10 bg-surface hover:border-ink/25 dark:border-cream/15 dark:bg-surface-dark"
                      )}
                    >
                      <span className="flex items-center justify-between text-[13.5px] font-bold text-ink dark:text-cream">
                        {label}
                        <span className={cn("grid h-5 w-5 place-items-center rounded-full", on ? "bg-brand-500 text-ink" : "bg-ink/10 dark:bg-cream/15")}>
                          {on && <Check size={12} strokeWidth={3} />}
                        </span>
                      </span>
                      <span className="mt-0.5 block text-[11.5px] text-ink/50 dark:text-cream/50">{desc}</span>
                    </button>
                  );
                })}
              </div>
            </div>
            <Field label="Additional instructions (optional)" hint="e.g. “Make the questions exam-style, include at least 3 on the Calvin cycle.”">
              <Textarea rows={3} value={instructions} onChange={(e) => setInstructions(e.target.value)} placeholder="Any special instructions for the AI generator…" />
            </Field>
          </div>
          <div className="mt-6 flex justify-between">
            <Button variant="ghost" onClick={() => setStep(2)}>
              <ArrowLeft size={15} /> Back
            </Button>
            <Button size="lg" variant="dark" onClick={generate}>
              <Sparkles size={16} /> Generate questions
            </Button>
          </div>
        </Card>
      )}

      {/* STEP 4 — review & share */}
      {step === 4 && (
        <div className="space-y-4">
          <Card className="border-green-300/60 dark:border-green-500/30">
            <div className="flex items-start gap-4">
              <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-300">
                <GraduationCap size={24} />
              </span>
              <div>
                <h2 className="font-display text-xl font-bold text-ink dark:text-cream">Tada! 🎉 {questionCount} questions generated</h2>
                <p className="mt-1 text-sm text-ink/60 dark:text-cream/60">
                  Review them on the assignment page — you can delete any question and generate more anytime.
                </p>
              </div>
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              <Button size="lg" onClick={() => router.push(`/assignments/${assignmentId}`)}>
                Review & share <ArrowRight size={16} />
              </Button>
              <Button
                variant="outline"
                size="lg"
                onClick={async () => {
                  setGenerating(true);
                  const res = await generateAssignmentQuestionsAction({
                    assignmentId: assignmentId!,
                    count,
                    types,
                    instructions,
                    append: true,
                  });
                  setGenerating(false);
                  if (res.ok) {
                    toast(`${res.created} more questions added`);
                    setQuestionCount((q) => q + res.created);
                  }
                }}
              >
                <PlusIcon /> Generate more
              </Button>
            </div>
          </Card>
          <p className="text-center text-sm text-ink/50 dark:text-cream/50">
            Next: open the assignment, review questions, then copy the share link for your students.
          </p>
        </div>
      )}
    </div>
  );
}

function PlusIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}
