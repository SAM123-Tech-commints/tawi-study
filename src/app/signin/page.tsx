"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { ArrowRight } from "lucide-react";
import { googleSigninAction, guestSigninAction, signinAction, signupAction } from "@/lib/actions";
import { Button, Field, Input, Spinner, useToast } from "@/components/ui";
import { OwlLogo } from "@/components/logo";
import { ThemeToggle, useTheme } from "@/components/theme";

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (opts: {
            client_id: string;
            callback: (res: { credential?: string }) => void;
            auto_select?: boolean;
            use_fedcm_for_prompt?: boolean;
            cancel_on_tap_outside?: boolean;
          }) => void;
          prompt: () => void;
          renderButton: (parent: HTMLElement, opts: Record<string, unknown>) => void;
          disableAutoSelect: () => void;
        };
      };
    };
  }
}

const STAGE_MSGS = [
  "Contacting the server…",
  "Waking up the database (free tier sleeps)…",
  "Almost there…",
];

function SigninInner() {
  const router = useRouter();
  const params = useSearchParams();
  const sample = params.get("sample");
  const { toast } = useToast();
  const [mode, setMode] = useState<"in" | "up">("up");
  const [loading, setLoading] = useState(false);
  const [stage, setStage] = useState(0);
  const [error, setError] = useState("");
  const [googleId, setGoogleId] = useState<string | null>(null);
  const submitted = useRef(false);
  const googleBtnRef = useRef<HTMLDivElement>(null);
  const { dark } = useTheme();

  // Expose the Google client ID (public value) so the button can render.
  useEffect(() => {
    fetch("/api/auth/config")
      .then((r) => r.json())
      .then((d) => setGoogleId(d.googleClientId || null))
      .catch(() => setGoogleId(null));
  }, []);

  // Staged progress messages so a cold database never looks frozen.
  useEffect(() => {
    if (!loading) {
      setStage(0);
      return;
    }
    const t1 = setTimeout(() => setStage(1), 2500);
    const t2 = setTimeout(() => setStage(2), 8000);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [loading]);

  const goNext = (role?: string | null) => {
    // Roles come back from the action itself — zero extra round trips.
    if (sample === "1") {
      router.push("/dashboard?sample=1");
    } else {
      router.push(role ? "/dashboard" : "/onboarding");
    }
    router.refresh();
  };

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (submitted.current) return;
    submitted.current = true;
    setError("");
    setLoading(true);
    try {
      const fd = new FormData(e.currentTarget);
      const res = mode === "up" ? await signupAction(fd) : await signinAction(fd);
      if (!res.ok) {
        setError(res.error ?? "Something went wrong.");
        return;
      }
      toast(mode === "up" ? "Account created — welcome! 🎉" : "Welcome back!");
      goNext(res.role);
    } finally {
      setLoading(false);
      submitted.current = false;
    }
  };

  const skip = async () => {
    if (submitted.current) return;
    submitted.current = true;
    setError("");
    setLoading(true);
    try {
      const res = await guestSigninAction();
      if (res.ok) {
        toast("You're in as a guest. Try the sample kit!");
        router.push("/dashboard");
        router.refresh();
      } else {
        // Most common cause: no DATABASE_URL on this deployment.
        const msg = res.error ?? "Could not continue as guest.";
        setError(msg);
        toast(msg, "error");
        if (/database|DATABASE_URL|setup/i.test(msg)) {
          router.push("/setup");
        }
      }
    } finally {
      setLoading(false);
      submitted.current = false;
    }
  };

  // Render Google's official button once the client ID is known. This uses
  // Google's reliable popup/FedCM flow (works even when third-party cookies
  // are blocked) instead of the flaky One-Tap prompt, and returns the same
  // id-token the server verifies.
  useEffect(() => {
    if (!googleId) return;
    let cancelled = false;

    const handleCredential = async (resp: { credential?: string }) => {
      if (!resp.credential || submitted.current) return;
      submitted.current = true;
      setError("");
      setLoading(true);
      try {
        const res = await googleSigninAction(resp.credential);
        if (!res.ok) {
          setError(res.error ?? "Google sign-in failed. Please try again.");
          return;
        }
        toast("Signed in with Google — welcome! 🎉");
        goNext(res.role);
      } catch {
        setError("Google sign-in failed. Please try again.");
      } finally {
        setLoading(false);
        submitted.current = false;
      }
    };

    const render = () => {
      if (cancelled || !window.google?.accounts?.id || !googleBtnRef.current) return;
      window.google.accounts.id.initialize({
        client_id: googleId,
        callback: handleCredential,
        auto_select: false,
        use_fedcm_for_prompt: true,
        cancel_on_tap_outside: true,
      });
      const el = googleBtnRef.current;
      el.innerHTML = "";
      const width = Math.min(400, Math.max(240, el.offsetWidth || 360));
      window.google.accounts.id.renderButton(el, {
        type: "standard",
        theme: dark ? "filled_black" : "outline",
        size: "large",
        text: "continue_with",
        shape: "pill",
        logo_alignment: "center",
        width,
      });
    };

    if (window.google?.accounts?.id) {
      render();
      return () => {
        cancelled = true;
      };
    }
    let s = document.querySelector<HTMLScriptElement>('script[data-gsi="1"]');
    if (!s) {
      s = document.createElement("script");
      s.src = "https://accounts.google.com/gsi/client";
      s.async = true;
      s.defer = true;
      s.dataset.gsi = "1";
      document.head.appendChild(s);
    }
    s.addEventListener("load", render);
    return () => {
      cancelled = true;
      s?.removeEventListener("load", render);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [googleId, dark]);

  return (
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-paper px-4 py-10 text-ink dark:bg-paper-dark dark:text-cream">
      {/* Floating ambient blobs */}
      <div className="pointer-events-none absolute -left-24 top-16 h-72 w-72 animate-float rounded-full bg-brand-200/50 blur-3xl dark:bg-brand-500/10" />
      <div className="pointer-events-none absolute -right-24 bottom-10 h-80 w-80 animate-float-slow rounded-full bg-brand-100/70 blur-3xl dark:bg-brand-500/10" />

      {/* Light / dark toggle — same mode system as every other page */}
      <div className="absolute right-4 top-4 animate-in">
        <ThemeToggle />
      </div>

      <div className="relative w-full max-w-md animate-in-scale">
        <div className="mb-8 text-center animate-in">
          <Link href="/" className="inline-flex items-center gap-2 transition-transform hover:scale-105 active:scale-95">
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

        <div
          key={mode}
          className="animate-in rounded-3xl border border-ink/8 bg-surface p-6 shadow-sm dark:border-cream/10 dark:bg-surface-dark sm:p-7"
        >
          <div className="mb-5 grid grid-cols-2 gap-1 rounded-full bg-ink/5 p-1 dark:bg-cream/5">
            {(["up", "in"] as const).map((m) => (
              <button
                key={m}
                onClick={() => {
                  setMode(m);
                  setError("");
                }}
                className={`rounded-full py-2 text-sm font-bold transition-all duration-200 active:scale-95 ${
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
              <p className="animate-in rounded-xl bg-red-50 px-3.5 py-2.5 text-[13px] font-semibold text-red-600 dark:bg-red-500/10 dark:text-red-300">
                {error}
              </p>
            )}
            <Button type="submit" size="lg" className="w-full" disabled={loading}>
              {loading ? (
                <>
                  <Spinner className="border-ink/30 border-t-ink dark:border-cream/30 dark:border-t-cream" />
                  <span className="text-sm font-semibold">{STAGE_MSGS[stage]}</span>
                </>
              ) : (
                <>
                  {mode === "up" ? "Create account" : "Sign in"}
                  <ArrowRight size={16} />
                </>
              )}
            </Button>
          </form>

          <div className="my-5 flex items-center gap-3 text-xs font-bold uppercase tracking-widest text-ink/35 dark:text-cream/35">
            <span className="h-px flex-1 bg-ink/10 dark:bg-cream/10" /> or <span className="h-px flex-1 bg-ink/10 dark:bg-cream/10" />
          </div>

          {/* Continue with Google — Google renders its own reliable button
              here once NEXT_PUBLIC_GOOGLE_CLIENT_ID is set; otherwise we show a
              disabled placeholder with setup instructions. */}
          {googleId ? (
            <div className="flex min-h-[44px] justify-center">
              <div ref={googleBtnRef} className="w-full" />
            </div>
          ) : (
            <>
              <Button variant="outline" className="w-full" disabled>
                <svg width="17" height="17" viewBox="0 0 24 24" aria-hidden>
                  <path fill="#4285F4" d="M23.5 12.3c0-.9-.1-1.5-.3-2.3H12v4.5h6.5c-.1 1.1-.8 2.7-2.4 3.8l-.1.1 3.5 2.7.2.1c2.2-2 3.8-5 3.8-8.9z" />
                  <path fill="#34A853" d="M12 24c3.2 0 5.9-1.1 7.9-2.9l-3.8-2.9c-1 .7-2.4 1.2-4.1 1.2-3.1 0-5.8-2.1-6.8-5l-.1.1-3.6 2.8v.1C3.5 21.4 7.5 24 12 24z" />
                  <path fill="#FBBC05" d="M5.2 14.4c-.2-.7-.4-1.5-.4-2.4s.1-1.7.4-2.4l-.1-.1-3.6-2.8-.1.1C.5 8.7 0 10.3 0 12s.5 3.3 1.4 4.7l3.8-2.3z" />
                  <path fill="#EA4335" d="M12 4.7c1.8 0 3 .8 3.7 1.4l3.3-3.2C17.9 1.1 15.2 0 12 0 7.5 0 3.5 2.6 1.4 6.8l3.8 3c1-2.9 3.7-5.1 6.8-5.1z" />
                </svg>
                Continue with Google
              </Button>
              <p className="mt-2 text-center text-[11px] text-ink/40 dark:text-cream/40">
                Admins: add <code className="rounded bg-ink/5 px-1 dark:bg-cream/10">NEXT_PUBLIC_GOOGLE_CLIENT_ID</code> to enable this.
              </p>
            </>
          )}

          <div className="mt-3">
            <Button variant="ghost" className="w-full" onClick={skip} disabled={loading}>
              Skip for now — browse as guest
            </Button>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-center gap-3 animate-in">
          <span className="grid h-11 w-11 animate-float place-items-center rounded-full bg-brand-500 text-xl">🎓</span>
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
