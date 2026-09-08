"use client";

import { useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, BookOpen, CheckCircle2, ClipboardList, XCircle } from "lucide-react";
import { submitAttemptAction } from "@/lib/actions";
import { findRelatedSentences } from "@/lib/text";
import {
  Badge,
  Button,
  cn,
  Field,
  formatDue,
  Input,
  ProgressBar,
  RichText,
  ScoreRing,
  useToast,
} from "@/components/ui";
import type { AssignmentQuestionRow } from "@/db/schema";

interface TakeData {
  assignment: {
    id: string;
    title: string;
    teacherName: string;
    className: string;
    dueDate: string;
  };
  questions: AssignmentQuestionRow[];
  contentExcerpt: string;
}

function QuestionInput({
  q,
  value,
  setValue,
  reveal,
}: {
  q: AssignmentQuestionRow;
  value: string;
  setValue: (v: string) => void;
  reveal: boolean;
}) {
  if (q.type === "mcq" && q.options?.length) {
    return (
      <div className="grid gap-2.5">
        {q.options.map((opt) => {
          const selected = value === opt;
          const correct = reveal && opt === q.answer;
          const wrongPick = reveal && selected && opt !== q.answer;
          return (
            <button
              key={opt}
              onClick={() => !reveal && setValue(opt)}
              className={cn(
                "flex items-center justify-between rounded-2xl border px-4 py-3 text-left text-sm font-semibold transition",
                correct
                  ? "border-green-500 bg-green-100 text-green-800 dark:bg-green-500/20 dark:text-green-300"
                  : wrongPick
                    ? "border-red-400 bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300"
                    : selected
                      ? "border-brand-500 bg-brand-100 text-ink dark:bg-brand-500/15 dark:text-brand-300"
                      : "border-ink/12 bg-surface hover:border-ink/30 dark:border-cream/15 dark:bg-surface-dark dark:hover:border-cream/40"
              )}
            >
              {opt}
              {correct && <CheckCircle2 size={16} />}
              {wrongPick && <XCircle size={16} />}
            </button>
          );
        })}
      </div>
    );
  }
  if (q.type === "true_false") {
    return (
      <div className="grid grid-cols-2 gap-3">
        {["True", "False"].map((opt) => {
          const selected = value === opt;
          const correct = reveal && opt === q.answer;
          const wrongPick = reveal && selected && opt !== q.answer;
          return (
            <button
              key={opt}
              onClick={() => !reveal && setValue(opt)}
              className={cn(
                "rounded-2xl border-2 py-4 text-base font-bold transition",
                correct
                  ? "border-green-500 bg-green-100 text-green-800 dark:bg-green-500/20 dark:text-green-300"
                  : wrongPick
                    ? "border-red-400 bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300"
                    : selected
                      ? "border-brand-500 bg-brand-100 text-ink dark:bg-brand-500/15 dark:text-brand-300"
                      : "border-ink/12 bg-surface hover:border-brand-400 dark:border-cream/15 dark:bg-surface-dark"
              )}
            >
              {opt === "True" ? "✅ True" : "❌ False"}
            </button>
          );
        })}
      </div>
    );
  }
  return (
    <textarea
      value={value}
      onChange={(e) => setValue(e.target.value)}
      disabled={reveal}
      placeholder="Type your answer…"
      rows={3}
      className={cn(
        "w-full rounded-2xl border-2 px-4 py-3 text-sm font-medium outline-none transition",
        reveal
          ? value.trim().toLowerCase() === q.answer.trim().toLowerCase()
            ? "border-green-500 bg-green-100 text-green-800 dark:bg-green-500/20 dark:text-green-300"
            : "border-red-400 bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300"
          : "border-ink/15 bg-surface text-ink focus:border-brand-500 dark:border-cream/15 dark:bg-surface-dark dark:text-cream"
      )}
    />
  );
}

export function TakeQuiz({ data }: { data: TakeData }) {
  const { toast } = useToast();
  const [stage, setStage] = useState<"start" | "quiz" | "done">("start");
  const [name, setName] = useState("");
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<string[]>([]);
  const [submitted, setSubmitted] = useState(false);

  const { assignment, questions, contentExcerpt } = data;
  const total = questions.length;
  const score = useMemo(() => {
    return questions.reduce(
      (acc, q, i) =>
        acc +
        ((answers[i] ?? "").trim().toLowerCase() === (q.answer ?? "").trim().toLowerCase() ? 1 : 0),
      0
    );
  }, [questions, answers]);

  const start = () => {
    if (!name.trim()) {
      toast("Please enter your name to start.", "error");
      return;
    }
    setAnswers(Array(questions.length).fill(""));
    setIdx(0);
    setStage("quiz");
  };

  const finish = async () => {
    setStage("done");
    setSubmitted(true);
    await submitAttemptAction({ assignmentId: assignment.id, name, score, total });
  };

  /* ------------------------------ start ------------------------------ */
  if (stage === "start") {
    return (
      <div className="mx-auto max-w-xl py-8">
        <div className="rounded-3xl border border-ink/8 bg-surface p-8 text-center shadow-sm dark:border-cream/10 dark:bg-surface-dark">
          <div className="mx-auto mb-5 grid h-16 w-16 place-items-center rounded-3xl bg-brand-500 text-ink">
            <ClipboardList size={28} />
          </div>
          <Badge tone="violet" className="mb-3">
            {assignment.teacherName} · {assignment.className}
          </Badge>
          <h1 className="text-2xl font-bold text-ink dark:text-cream">{assignment.title}</h1>
          <p className="mt-2 text-sm text-ink/60 dark:text-cream/60">
            {total} questions · Due {formatDue(assignment.dueDate)}
          </p>
          <div className="mt-7 text-left">
            <Field label="Your name">
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Aisyah Rahman"
                onKeyDown={(e) => e.key === "Enter" && start()}
              />
            </Field>
          </div>
          <Button size="lg" className="mt-6 w-full" onClick={start}>
            Start assignment <ArrowRight size={17} />
          </Button>
          <p className="mt-4 text-xs text-ink/50 dark:text-cream/50">
            Answer everything, then submit. Wrong answers show the correct answer with an explanation.
          </p>
        </div>
      </div>
    );
  }

  /* ------------------------------- quiz ------------------------------- */
  if (stage === "quiz") {
    const q = questions[idx];
    if (!q) return null;
    return (
      <div className="mx-auto max-w-2xl py-6">
        <div className="mb-5 flex items-center justify-between">
          <p className="text-sm font-bold text-ink dark:text-cream">
            Question {idx + 1} <span className="font-medium text-ink/50 dark:text-cream/50">of {total}</span>
          </p>
          <Badge tone="brand">{q.type === "mcq" ? "Multiple choice" : q.type === "true_false" ? "True / False" : "Short answer"}</Badge>
        </div>
        <ProgressBar value={idx} max={total} className="mb-7" />
        <div className="rounded-3xl border border-ink/8 bg-surface p-6 shadow-sm dark:border-cream/10 dark:bg-surface-dark sm:p-8">
          <h2 className="mb-6 text-lg font-bold leading-relaxed text-ink dark:text-cream">{q.question}</h2>
          <QuestionInput q={q} value={answers[idx] ?? ""} setValue={(v) => setAnswers((a) => a.map((x, i) => (i === idx ? v : x)))} reveal={false} />
          <div className="mt-8 flex items-center justify-between">
            <Button variant="ghost" disabled={idx === 0} onClick={() => setIdx((i) => i - 1)}>
              <ArrowLeft size={16} /> Back
            </Button>
            {idx < total - 1 ? (
              <Button onClick={() => setIdx((i) => i + 1)} disabled={!answers[idx]?.trim()}>
                Next <ArrowRight size={16} />
              </Button>
            ) : (
              <Button onClick={finish} disabled={!answers[idx]?.trim()}>
                Submit answers <CheckCircle2 size={16} />
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  /* ------------------------------- done ------------------------------- */
  const pct = total ? (score / total) * 100 : 0;
  return (
    <div className="mx-auto max-w-2xl py-6">
      <div className="mb-6 rounded-3xl border border-ink/8 bg-surface p-8 text-center shadow-sm dark:border-cream/10 dark:bg-surface-dark">
        <p className="text-sm font-bold uppercase tracking-widest text-ink/50 dark:text-cream/50">
          {submitted ? "Assignment submitted" : "Reviewing answers"}
        </p>
        <div className="my-5 flex justify-center">
          <ScoreRing pct={pct} size={140} label="score" />
        </div>
        <h1 className="text-xl font-bold text-ink dark:text-cream">
          {pct >= 80 ? "Outstanding, " + name + "! 🎉" : pct >= 50 ? "Good effort, " + name + "!" : "Keep going, " + name + "!"}
        </h1>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-ink/60 dark:text-cream/60">
          You got <strong>{score}</strong> out of <strong>{total}</strong> correct. Don&apos;t worry about the
          ones you missed — read the explanations below and you&apos;ll know them next time.
        </p>
      </div>

      <h2 className="mb-4 text-lg font-bold text-ink dark:text-cream">Review & lecture notes</h2>
      <div className="space-y-4">
        {questions.map((q, i) => {
          const userAnswer = answers[i] ?? "";
          const correct = userAnswer.trim().toLowerCase() === q.answer.trim().toLowerCase();
          const notes = findRelatedSentences(contentExcerpt, `${q.question} ${q.answer}`, 3);
          return (
            <div
              key={q.id}
              className={cn(
                "rounded-3xl border bg-surface p-6 dark:bg-surface-dark",
                correct ? "border-green-300/60 dark:border-green-500/30" : "border-red-200 dark:border-red-500/30"
              )}
            >
              <div className="mb-3 flex items-start justify-between gap-3">
                <p className="font-bold leading-relaxed text-ink dark:text-cream">
                  {i + 1}. {q.question}
                </p>
                <span className={cn("shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-bold", correct ? "bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-300" : "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300")}>
                  {correct ? "Correct" : "Review this"}
                </span>
              </div>
              {!correct && userAnswer.trim() && (
                <p className="mb-2 text-sm text-red-500">
                  Your answer: <span className="font-semibold">{userAnswer}</span>
                </p>
              )}
              <div className="mb-3 rounded-2xl bg-green-50 p-4 text-sm font-medium leading-relaxed text-green-900 dark:bg-green-500/10 dark:text-green-300">
                <span className="font-bold">✓ Correct answer: </span>
                {q.answer}
              </div>
              {q.explanation && (
                <div className="mb-3">
                  <p className="mb-1 text-xs font-bold uppercase tracking-wide text-ink/50 dark:text-cream/50">
                    Explanation
                  </p>
                  <div className="text-sm leading-relaxed text-ink/75 dark:text-cream/75">
                    <RichText text={q.explanation} />
                  </div>
                </div>
              )}
              {notes.length > 0 && (
                <div className="rounded-2xl bg-violet-50 p-4 dark:bg-violet-500/10">
                  <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-violet-600 dark:text-violet-300">
                    <BookOpen size={13} /> Lecture notes on this topic
                  </p>
                  <ul className="space-y-1.5 text-sm leading-relaxed text-ink/75 dark:text-cream/75">
                    {notes.map((n, j) => (
                      <li key={j} className="flex gap-2">
                        <span className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-violet-400" />
                        {n}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="mt-8 text-center">
        <Button variant="outline" size="lg" onClick={() => { setStage("start"); setSubmitted(false); }}>
          <ArrowLeft size={16} /> Retake assignment
        </Button>
      </div>
    </div>
  );
}
