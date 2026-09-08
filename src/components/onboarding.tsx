"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, ArrowRight, GraduationCap, Pencil, School } from "lucide-react";
import { saveProfileAction } from "@/lib/actions";
import { Button, cn } from "@/components/ui";

const ROLES = [
  { id: "student", icon: Pencil, title: "I'm a student", desc: "Create study kits, flashcards and practice tests from your own notes." },
  { id: "educator", icon: GraduationCap, title: "I'm an educator", desc: "Build assignments and worksheets to share with your students." },
];

const INSTITUTIONS = [
  { id: "primary", label: "Primary" },
  { id: "secondary", label: "Secondary" },
  { id: "higher", label: "Higher education" },
  { id: "university", label: "University" },
  { id: "other", label: "Other" },
];

export default function OnboardingForm() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [role, setRole] = useState<string>("");
  const [institution, setInstitution] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const finish = async (inst: string) => {
    setLoading(true);
    await saveProfileAction({ role: role || "student", institution: inst || "Not specified" });
    router.push("/dashboard");
    router.refresh();
  };

  return (
    <div className="mx-auto flex min-h-[80vh] max-w-2xl flex-col justify-center px-4 py-10">
      <div className="mb-8 text-center">
        <p className="text-xs font-bold uppercase tracking-widest text-brand-700 dark:text-brand-400">
          Step {step} of 2
        </p>
        <h1 className="font-display mt-2 text-3xl font-bold text-ink dark:text-cream">
          {step === 1 ? "How will you use Tawi?" : "Which institution are you with?"}
        </h1>
        <p className="mt-2 text-sm text-ink/55 dark:text-cream/55">
          {step === 1
            ? "Choose the role that fits you best — you can change it anytime."
            : "This helps us tailor your study tools and worksheet features."}
        </p>
      </div>

      {step === 1 ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {ROLES.map((r) => (
            <button
              key={r.id}
              onClick={() => setRole(r.id)}
              className={cn(
                "rounded-3xl border-2 p-6 text-left transition",
                role === r.id
                  ? "border-brand-500 bg-brand-50 shadow-lg dark:bg-brand-500/10"
                  : "border-ink/10 bg-surface hover:border-ink/25 dark:border-cream/15 dark:bg-surface-dark dark:hover:border-cream/40"
              )}
            >
              <span
                className={cn(
                  "mb-4 grid h-12 w-12 place-items-center rounded-2xl",
                  role === r.id ? "bg-brand-500 text-ink" : "bg-ink/6 text-ink/60 dark:bg-cream/10 dark:text-cream/60"
                )}
              >
                <r.icon size={21} />
              </span>
              <p className="text-lg font-bold text-ink dark:text-cream">{r.title}</p>
              <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink/60 dark:text-cream/60">{r.desc}</p>
            </button>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {INSTITUTIONS.map((i) => (
            <button
              key={i.id}
              onClick={() => setInstitution(i.id)}
              className={cn(
                "rounded-2xl border-2 py-4 text-center text-[15px] font-bold transition",
                institution === i.id
                  ? "border-brand-500 bg-brand-50 text-ink dark:bg-brand-500/10 dark:text-brand-300"
                  : "border-ink/10 bg-surface text-ink/70 hover:border-ink/25 dark:border-cream/15 dark:bg-surface-dark dark:text-cream/70"
              )}
            >
              <School size={18} className="mx-auto mb-1.5 opacity-60" />
              {i.label}
            </button>
          ))}
        </div>
      )}

      <div className="mt-8 flex items-center justify-between">
        <Button
          variant="ghost"
          onClick={() => (step === 1 ? router.push("/dashboard") : setStep(1))}
        >
          <ArrowLeft size={16} /> {step === 1 ? "Skip for now" : "Back"}
        </Button>
        <Button
          size="lg"
          disabled={loading || (step === 1 ? !role : !institution)}
          onClick={() => {
            if (step === 1) setStep(2);
            else finish(INSTITUTIONS.find((i) => i.id === institution)?.label ?? "");
          }}
        >
          {step === 1 ? "Next" : "Finish setup"} <ArrowRight size={16} />
        </Button>
      </div>
    </div>
  );
}
