"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { ArrowRight } from "lucide-react";
import { getSessionInfo, guestSigninAction, signinAction, signupAction } from "@/lib/actions";
import { Button, Field, Input, Spinner, useToast } from "@/components/ui";
import { OwlLogo } from "@/components/logo";

function SigninInner() {
  const router = useRouter();
  const params = useSearchParams();
  const sample = params.get("sample");
  const { toast } = useToast();
  const [mode, setMode] = useState<"in" | "up">("up");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const goNext = async () => {
    // Returning users who already picked an account type skip onboarding.
    if (sample === "1") {
      router.push("/dashboard?sample=1");
    } else {
      const info = await getSessionInfo();
      router.push(info?.role ? "/dashboard" : "/onboarding");
    }
    router.refresh();
  };

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const res = mode === "up" ? await signupAction(fd) : await signinAction(fd);
    setLoading(false);
    if (!res.ok) {
      setError(res.error ?? "Something went wrong.");
      return;
    }
    toast(mode === "up" ? "Account created — welcome! 🎉" : "Welcome back!");
    goNext();
  };

  const skip = async () => {
    setError("");
    setLoading(true);
    const res = await guestSigninAction();
    setLoading(false);
    if (res.ok) {
      toast("You're in as a guest. Try the sample kit!");
      router.push("/dashboard");
      router.refresh();
    } else {
      // Most common cause: no DATABASE_URL on this deployment.
      // Send the user to /setup which explains the 3-step fix,
      // but also surface the message inline in case they stay.
      const msg = res.error ?? "Could not continue as guest.";
      setError(msg);
      toast(msg, "error");
      if (/database|DATABASE_URL|setup/i.test(msg)) {
        router.push("/setup");
      }
    }
  };

  return (
    <div className="flex min-h-dvh items-center justify-center bg-paper px-4 py-10 text-ink dark:bg-paper-dark dark:text-cream">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <Link href="/" className="inline-flex items-center gap-2">
            <OwlLogo size={36} />
            <span className="text-xl font-bold tracking-tight">
              tawi<span className="font-medium text-ink/50 dark:text-cream/50">.study</span>
            </span>
          </Link>
          <h1 className="font-display mt-5 text-2xl font-bold">
            {mode === "up" ? "Create your free account" : "Welcome back"}
          </h1>
          <p className="mt-1 text-sm text-ink/55 dark:text-cream/55">
            {mode === "up"
              ? "Start turning your notes into study tools in seconds."
              : "Sign in to keep studying with your kits."}
          </p>
        </div>

        <div className="rounded-3xl border border-ink/8 bg-surface p-6 shadow-sm dark:border-cream/10 dark:bg-surface-dark sm:p-7">
          <div className="mb-5 grid grid-cols-2 gap-1 rounded-full bg-ink/5 p-1 dark:bg-cream/5">
            {(["up", "in"] as const).map((m) => (
              <button
                key={m}
                onClick={() => {
                  setMode(m);
                  setError("");
                }}
                className={`rounded-full py-2 text-sm font-bold transition ${
                  mode === m
                    ? "bg-surface text-ink shadow-sm dark:bg-cream/15 dark:text-cream"
                    : "text-ink/55 hover:text-ink dark:text-cream/55 dark:hover:text-cream"
                }`}
              >
                {m === "up" ? "Sign up" : "Sign in"}
              </button>
            ))}
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            {mode === "up" && (
              <Field label="Full name">
                <Input name="name" placeholder="e.g. Aisyah Rahman" required autoComplete="name" />
              </Field>
            )}
            <Field label="Email">
              <Input name="email" type="email" placeholder="you@school.edu" required autoComplete="email" />
            </Field>
            <Field label="Password" hint={mode === "up" ? "At least 6 characters" : undefined}>
              <Input
                name="password"
                type="password"
                placeholder="••••••••"
                required
                minLength={6}
                autoComplete={mode === "up" ? "new-password" : "current-password"}
              />
            </Field>
            {error && (
              <p className="rounded-xl bg-red-50 px-3.5 py-2.5 text-[13px] font-semibold text-red-600 dark:bg-red-500/10 dark:text-red-300">
                {error}
              </p>
            )}
            <Button type="submit" size="lg" className="w-full" disabled={loading}>
              {loading ? <Spinner className="border-ink/30 border-t-ink dark:border-cream/30 dark:border-t-cream" /> : mode === "up" ? "Create account" : "Sign in"}
              {!loading && <ArrowRight size={16} />}
            </Button>
          </form>

          <div className="my-5 flex items-center gap-3 text-xs font-bold uppercase tracking-widest text-ink/35 dark:text-cream/35">
            <span className="h-px flex-1 bg-ink/10 dark:bg-cream/10" /> or <span className="h-px flex-1 bg-ink/10 dark:bg-cream/10" />
          </div>

          <Button variant="outline" className="w-full" onClick={skip} disabled={loading}>
            Skip for now — browse as guest
          </Button>
        </div>

        <div className="mt-6 flex items-center justify-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-full bg-brand-500 text-xl">🎓</span>
          <p className="max-w-[260px] text-xs leading-relaxed text-ink/50 dark:text-cream/50">
            “Upload once, study forever.” No credit card required · Free for students
          </p>
        </div>
      </div>
    </div>
  );
}

export default function SigninPage() {
  return (
    <Suspense fallback={null}>
      <SigninInner />
    </Suspense>
  );
}
