"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ArrowRight,
  Brain,
  Check,
  Flame,
  Gamepad2,
  Layers,
  LayoutDashboard,
  MessageCircleQuestion,
  NotebookPen,
  Play,
  Star,
  Target,
  Trophy,
  Upload,
  Zap,
} from "lucide-react";
import { Badge, Button, cn } from "@/components/ui";
import { OwlLogo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme";

/* ------------------------------ Nav ------------------------------ */

function Nav() {
  return (
    <header className="sticky top-0 z-40 border-b border-ink/6 bg-paper/80 backdrop-blur-md dark:border-cream/10 dark:bg-paper-dark/80">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2">
          <OwlLogo size={32} />
          <span className="text-lg font-bold tracking-tight text-ink dark:text-cream">
            tawi<span className="font-medium text-ink/50 dark:text-cream/50">.study</span>
          </span>
        </Link>
        <nav className="hidden items-center gap-6 text-sm font-semibold text-ink/70 md:flex dark:text-cream/70">
          <a href="#tools" className="hover:text-ink dark:hover:text-cream">Study tools</a>
          <a href="#how" className="hover:text-ink dark:hover:text-cream">How it works</a>
          <a href="#why" className="hover:text-ink dark:hover:text-cream">Why Tawi</a>
          <a href="#pricing" className="hover:text-ink dark:hover:text-cream">Pricing</a>
        </nav>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Link href="/signin" className="hidden rounded-full px-4 py-2 text-sm font-semibold text-ink/70 transition hover:bg-ink/5 active:scale-95 sm:block dark:text-cream/70 dark:hover:bg-cream/10">
            Sign in
          </Link>
          <Link
            href="/signin"
            className="rounded-full bg-brand-500 px-4 py-2 text-sm font-semibold text-ink transition hover:bg-brand-400"
          >
            Get started free
          </Link>
        </div>
      </div>
    </header>
  );
}

/* ------------------------------ Hero ------------------------------ */

function HeroVisual() {
  // Your image 2 PNG: save it as public/hero.png and it appears here
  // automatically. Until then (or if it fails to load) the built-in
  // animated visual shows instead — nothing ever looks broken.
  const [imgOk, setImgOk] = useState(true);
  if (imgOk) {
    return (
      <div className="relative mx-auto max-w-lg animate-in-scale">
        <img
          src="/hero.png"
          alt="Studying with Tawi — flashcards, Smart Study and streaks"
          className="w-full rounded-[2rem] border border-ink/8 object-cover shadow-2xl dark:border-cream/10"
          onError={() => setImgOk(false)}
        />
        {/* Floating text cards stay as real text: crisp in both light and dark mode */}
        <div className="absolute -left-3 top-6 animate-float rounded-2xl border border-ink/10 bg-surface/95 p-3.5 shadow-xl backdrop-blur dark:border-cream/15 dark:bg-surface-dark/95 sm:-left-8">
          <p className="text-[11px] font-bold uppercase tracking-wide text-ink/50 dark:text-cream/50">Flashcard</p>
          <p className="mt-0.5 text-sm font-bold text-ink dark:text-cream">Chlorophyll?</p>
          <p className="mt-1 max-w-[160px] text-[11px] leading-snug text-ink/60 dark:text-cream/60">
            The green pigment that absorbs light energy…
          </p>
        </div>
        <div className="absolute -right-2 top-1/3 animate-float-slow rounded-2xl border border-ink/10 bg-surface/95 p-3.5 shadow-xl backdrop-blur dark:border-cream/15 dark:bg-surface-dark/95 sm:-right-6">
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-full bg-brand-500 text-ink">
              <Brain size={15} />
            </span>
            <div>
              <p className="text-[13px] font-bold text-ink dark:text-cream">Smart Study</p>
              <p className="text-[11px] text-ink/50 dark:text-cream/50">9/12 answered</p>
            </div>
          </div>
          <div className="mt-2 h-1.5 w-36 overflow-hidden rounded-full bg-ink/10 dark:bg-cream/15 sm:w-40">
            <div className="h-full w-3/4 rounded-full bg-brand-500" />
          </div>
        </div>
        <div className="absolute -bottom-5 left-6 animate-float rounded-2xl border border-ink/10 bg-surface/95 px-4 py-3 shadow-xl backdrop-blur dark:border-cream/15 dark:bg-surface-dark/95">
          <p className="flex items-center gap-1.5 text-sm font-bold text-ink dark:text-cream">
            <Flame size={15} className="text-amber-500" /> 7-day streak
          </p>
          <p className="text-[11px] font-medium text-ink/50 dark:text-cream/50">Spaced repetition is working ✨</p>
        </div>
      </div>
    );
  }
  return <HeroVisualFallback />;
}

function HeroVisualFallback() {
  return (
    <div className="relative mx-auto max-w-lg">
      {/* Hero visual (CSS-only fallback — shows when public/hero.png is missing) */}
      <div className="w-full rounded-[2rem] border border-ink/8 bg-gradient-to-br from-brand-100 via-surface to-violet-100 p-8 shadow-2xl dark:border-cream/10 dark:from-brand-500/20 dark:via-surface-dark dark:to-violet-500/20">
        <div className="mx-auto grid h-28 w-28 animate-float place-items-center rounded-3xl bg-brand-500 text-5xl shadow-lg">
          🎓
        </div>
        <p className="mt-5 text-center font-display text-xl font-bold text-ink dark:text-cream">
          Turn notes into study tools
        </p>
        <p className="mx-auto mt-2 max-w-xs text-center text-sm leading-relaxed text-ink/60 dark:text-cream/60">
          Flashcards · Smart Study · Study guides · Practice tests
        </p>
        <div className="mx-auto mt-5 flex max-w-xs flex-wrap justify-center gap-2">
          {["📄 PDF", "🎞️ YouTube", "📝 Notes"].map((t) => (
            <span key={t} className="rounded-full border border-ink/10 bg-surface px-3 py-1 text-xs font-bold text-ink/70 transition-transform hover:scale-105 active:scale-95 dark:border-cream/15 dark:bg-surface-dark dark:text-cream/70">
              {t}
            </span>
          ))}
        </div>
      </div>
      <div className="absolute -left-4 top-8 animate-float rounded-2xl border border-ink/10 bg-surface p-3.5 shadow-xl dark:border-cream/15 dark:bg-surface-dark sm:-left-10">
        <p className="text-[11px] font-bold uppercase tracking-wide text-ink/50 dark:text-cream/50">Flashcard</p>
        <p className="mt-0.5 text-sm font-bold text-ink dark:text-cream">Chlorophyll?</p>
        <p className="mt-1 max-w-[160px] text-[11px] leading-snug text-ink/60 dark:text-cream/60">
          The green pigment that absorbs light energy…
        </p>
      </div>
      <div className="absolute -right-3 top-1/3 animate-float-slow rounded-2xl border border-ink/10 bg-surface p-3.5 shadow-xl dark:border-cream/15 dark:bg-surface-dark sm:-right-8">
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-full bg-brand-500 text-ink">
            <Brain size={15} />
          </span>
          <div>
            <p className="text-[13px] font-bold text-ink dark:text-cream">Smart Study</p>
            <p className="text-[11px] text-ink/50 dark:text-cream/50">9/12 answered</p>
          </div>
        </div>
        <div className="mt-2 h-1.5 w-40 overflow-hidden rounded-full bg-ink/10 dark:bg-cream/15">
          <div className="h-full w-3/4 rounded-full bg-brand-500" />
        </div>
      </div>
      <div className="absolute -bottom-5 left-6 animate-float rounded-2xl border border-ink/10 bg-surface px-4 py-3 shadow-xl dark:border-cream/15 dark:bg-surface-dark">
        <p className="flex items-center gap-1.5 text-sm font-bold text-ink dark:text-cream">
          <Flame size={15} className="text-amber-500" /> 7-day streak
        </p>
        <p className="text-[11px] font-medium text-ink/50 dark:text-cream/50">Spaced repetition is working ✨</p>
      </div>
    </div>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="pointer-events-none absolute -top-32 left-1/2 h-96 w-[52rem] -translate-x-1/2 rounded-full bg-brand-200/40 blur-3xl dark:bg-brand-500/10" />
      <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:py-24">
        <div className="animate-in-left">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-ink/10 bg-surface px-3.5 py-1.5 text-[13px] font-semibold text-ink/80 shadow-sm dark:border-cream/10 dark:bg-surface-dark dark:text-cream/80">
            <Trophy size={14} className="text-brand-600 dark:text-brand-400" />
            #3 best AI tool of 2026 · Trusted by millions of students
          </div>
          <h1 className="font-display text-[2.6rem] font-bold leading-[1.05] tracking-tight text-ink sm:text-6xl dark:text-cream">
            The fastest way to{" "}
            <span className="font-serif-accent italic font-normal text-brand-700 dark:text-brand-400">
              earn better grades.
            </span>
          </h1>
          <p className="mt-5 max-w-lg text-lg leading-relaxed text-ink/65 dark:text-cream/65">
            Upload your notes, textbook chapters or lecture videos — Tawi instantly turns them into
            flashcards, practice tests, study guides and smart study sessions.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              href="/signin"
              className="inline-flex h-12 items-center gap-2 rounded-full bg-brand-500 px-6 text-[15px] font-bold text-ink shadow-[0_4px_20px_rgba(183,233,56,0.4)] transition hover:bg-brand-400"
            >
              Start studying free <ArrowRight size={17} />
            </Link>
            <Link
              href="/signin"
              className="inline-flex h-12 items-center gap-2 rounded-full border border-ink/15 px-6 text-[15px] font-semibold text-ink transition hover:bg-ink/5 dark:border-cream/20 dark:text-cream dark:hover:bg-cream/10"
            >
              I&apos;m a teacher or professor →
            </Link>
          </div>
          <p className="mt-4 text-[13px] font-medium text-ink/50 dark:text-cream/50">
            No credit card required · Available in 80+ languages
          </p>
        </div>

        <div className="relative">
          <HeroVisual />
        </div>
      </div>

      {/* stats */}
      <div className="relative border-y border-ink/8 bg-surface/60 dark:border-cream/10 dark:bg-surface-dark/40">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-6 px-4 py-7 sm:px-6 md:grid-cols-4">
          {[
            ["4.9★", "App rating"],
            ["1B+", "Questions answered"],
            ["90+", "File types supported"],
            [">90%", "Learners never pay"],
          ].map(([v, l]) => (
            <div key={l} className="text-center">
              <p className="font-display text-2xl font-bold text-ink dark:text-cream">{v}</p>
              <p className="mt-0.5 text-[13px] font-medium text-ink/55 dark:text-cream/55">{l}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* --------------------------- Testimonials -------------------------- */

function Testimonials() {
  const items = [
    {
      name: "Sarah M.",
      role: "Pre-med student",
      text: "I stopped writing flashcards by hand. Tawi reads my lecture slides and I'm studying within minutes. My bio grade went from C to A- in one semester.",
    },
    {
      name: "Mr. Rahman",
      role: "High school teacher",
      text: "I build a worksheet for each class in under five minutes and share one link. The explanations help my students learn from their mistakes instead of just guessing.",
    },
    {
      name: "Jayden T.",
      role: "IB student",
      text: "Smart Study actually makes me think. It asks, I answer, it explains. I remember things way better than just re-reading my notes over and over.",
    },
  ];
  return (
    <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-24">
      <div className="mb-10 text-center">
        <Badge tone="brand" className="mb-3">Testimonials</Badge>
        <h2 className="font-display text-3xl font-bold tracking-tight text-ink sm:text-4xl dark:text-cream">
          Trusted by millions of students
          <br className="hidden sm:block" /> around the world.
        </h2>
      </div>
      <div className="grid gap-5 md:grid-cols-3">
        {items.map((t) => (
          <div key={t.name} className="rounded-3xl border border-ink/8 bg-surface p-6 shadow-sm dark:border-cream/10 dark:bg-surface-dark">
            <div className="mb-3 flex gap-0.5 text-brand-600 dark:text-brand-400">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} size={15} fill="currentColor" />
              ))}
            </div>
            <p className="text-[15px] leading-relaxed text-ink/75 dark:text-cream/75">“{t.text}”</p>
            <div className="mt-5 flex items-center gap-3">
              <span className="grid h-9 w-9 place-items-center rounded-full bg-ink text-sm font-bold text-brand-400">
                {t.name[0]}
              </span>
              <div>
                <p className="text-sm font-bold text-ink dark:text-cream">{t.name}</p>
                <p className="text-xs text-ink/50 dark:text-cream/50">{t.role}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* -------------------------- Feature picker ------------------------- */

const FEATURES = [
  {
    id: "smart",
    icon: Brain,
    num: "01",
    name: "Smart Study",
    desc: "Tawi asks you questions based on your course material instead of handing you the answer — the thinking, and the learning, is done by you.",
  },
  {
    id: "flashcards",
    icon: Layers,
    num: "02",
    name: "Flashcards & Games",
    desc: "Key terms and definitions pulled from your notes automatically, plus 5 memory games and spaced repetition built in.",
  },
  {
    id: "guide",
    icon: NotebookPen,
    num: "03",
    name: "Study Guides & Summaries",
    desc: "Clean, structured study notes, exact-text mode for reviewers and AI summaries that compress a whole chapter into an overview.",
  },
  {
    id: "tests",
    icon: Target,
    num: "04",
    name: "Practice Tests",
    desc: "Unlimited multiple-choice, true/false and short-answer questions. Wrong answers come with explanations and lecture notes.",
  },
  {
    id: "assign",
    icon: LayoutDashboard,
    num: "05",
    name: "Assignments",
    desc: "Educators build worksheets from their material, set a due date, share one link and watch every student's results roll in.",
  },
];

function SmartPanel() {
  return (
    <div className="rounded-2xl border border-ink/10 bg-paper p-5 dark:border-cream/10 dark:bg-paper-dark">
      <div className="mb-3 flex items-center justify-between">
        <Badge tone="violet">Smart Study</Badge>
        <span className="text-xs font-bold text-ink/50 dark:text-cream/50">3 / 12</span>
      </div>
      <p className="mb-4 text-[15px] font-bold text-ink dark:text-cream">
        Photosynthesis takes place in which organelle?
      </p>
      <div className="space-y-2">
        {["Mitochondria", "Chloroplast", "Ribosome", "Nucleus"].map((o, i) => (
          <div
            key={o}
            className={cn(
              "flex items-center justify-between rounded-xl border px-4 py-2.5 text-sm font-semibold",
              i === 1
                ? "border-green-500 bg-green-100 text-green-800 dark:bg-green-500/15 dark:text-green-300"
                : "border-ink/10 bg-surface text-ink/70 dark:border-cream/10 dark:bg-surface-dark dark:text-cream/70"
            )}
          >
            {o}
            {i === 1 && <Check size={15} />}
          </div>
        ))}
      </div>
      <div className="mt-4 rounded-xl bg-brand-100 p-3 text-[13px] font-medium leading-relaxed text-ink/80 dark:bg-brand-500/10 dark:text-brand-200">
        <strong>✓ Chloroplasts</strong> — the thylakoid membranes inside them capture light energy and
        run the light-dependent reactions.
      </div>
    </div>
  );
}

function FlashPanel() {
  return (
    <div className="rounded-2xl border border-ink/10 bg-paper p-5 dark:border-cream/10 dark:bg-paper-dark">
      <div className="mb-3 flex items-center justify-between">
        <Badge tone="brand">Flashcards</Badge>
        <span className="text-xs font-bold text-ink/50 dark:text-cream/50">Deck · 24 cards</span>
      </div>
      <div className="rounded-2xl bg-surface p-5 shadow-sm dark:bg-surface-dark">
        <p className="text-center text-lg font-bold text-ink dark:text-cream">The Calvin cycle</p>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2">
        {[
          ["😬", "Again", "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300"],
          ["🤔", "Unsure", "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300"],
          ["😎", "Got it", "bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-300"],
        ].map(([e, l, c]) => (
          <div key={l} className={cn("rounded-xl p-3 text-center text-sm font-bold", c)}>
            {e} {l}
          </div>
        ))}
      </div>
    </div>
  );
}

function GuidePanel() {
  return (
    <div className="rounded-2xl border border-ink/10 bg-paper p-5 dark:border-cream/10 dark:bg-paper-dark">
      <div className="mb-3 flex items-center justify-between">
        <Badge tone="green">Study guide</Badge>
        <div className="rounded-full bg-ink/5 px-2 py-0.5 text-[11px] font-bold text-ink/60 dark:bg-cream/10 dark:text-cream/60">
          Exact text · AI summary
        </div>
      </div>
      <h3 className="font-display mb-2 text-lg font-bold text-ink dark:text-cream"># Photosynthesis</h3>
      <div className="space-y-2">
        {[
          ["**Overview** — plants convert light energy into chemical energy stored in glucose.", 92],
          ["• Light-dependent reactions produce ATP and NADPH.", 78],
          ["• The Calvin cycle fixes CO₂ into glucose in the stroma.", 64],
          ["• Limiting factors: light intensity, CO₂ and temperature.", 50],
        ].map(([t, w]) => (
          <div key={t as string} className="rounded-xl bg-surface p-3 dark:bg-surface-dark">
            <p className="text-[13px] font-medium leading-relaxed text-ink/75 dark:text-cream/75">{t}</p>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-ink/8 dark:bg-cream/10">
              <div className="h-full rounded-full bg-brand-500" style={{ width: `${w}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TestsPanel() {
  return (
    <div className="rounded-2xl border border-ink/10 bg-paper p-5 dark:border-cream/10 dark:bg-paper-dark">
      <div className="mb-3 flex items-center justify-between">
        <Badge tone="amber">Practice test</Badge>
        <span className="text-xs font-bold text-ink/50 dark:text-cream/50">7 / 10 correct</span>
      </div>
      <p className="mb-3 text-[15px] font-bold text-ink dark:text-cream">
        True or False: Xylem transports sugars produced during photosynthesis.
      </p>
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl border border-ink/10 bg-surface p-3 text-center text-sm font-bold text-ink/50 dark:border-cream/10 dark:bg-surface-dark dark:text-cream/50">
          ✅ True
        </div>
        <div className="rounded-xl border border-red-400 bg-red-100 p-3 text-center text-sm font-bold text-red-700 dark:bg-red-500/15 dark:text-red-300">
          ❌ False — phloem carries sugars!
        </div>
      </div>
      <div className="mt-4 rounded-xl bg-violet-100 p-3 text-[13px] font-medium text-violet-800 dark:bg-violet-500/10 dark:text-violet-300">
        📚 Lecture notes: “Phloem is the vascular tissue that transports sugars produced during
        photosynthesis from the leaves to other parts of the plant.”
      </div>
    </div>
  );
}

function AssignPanel() {
  return (
    <div className="rounded-2xl border border-ink/10 bg-paper p-5 dark:border-cream/10 dark:bg-paper-dark">
      <div className="mb-3 flex items-center justify-between">
        <Badge tone="violet">Assignment</Badge>
        <span className="text-xs font-bold text-ink/50 dark:text-cream/50">28 students</span>
      </div>
      <div className="mb-3 flex items-center justify-between rounded-xl bg-surface p-3 dark:bg-surface-dark">
        <div>
          <p className="text-sm font-bold text-ink dark:text-cream">Biology · Chapter 6 Worksheet</p>
          <p className="text-[11px] text-ink/50 dark:text-cream/50">Due Friday · 12 questions</p>
        </div>
        <span className="rounded-full bg-brand-500 px-3 py-1 text-xs font-bold text-ink">Share link</span>
      </div>
      {[
        ["Nurul A.", 92],
        ["Daniel K.", 83],
        ["Lily P.", 67],
      ].map(([n, s]) => (
        <div key={n as string} className="mb-2 flex items-center gap-3">
          <span className="w-16 truncate text-[13px] font-semibold text-ink/70 dark:text-cream/70">{n}</span>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-ink/8 dark:bg-cream/10">
            <div
              className={cn("h-full rounded-full", (s as number) >= 80 ? "bg-green-500" : "bg-amber-400")}
              style={{ width: `${s}%` }}
            />
          </div>
          <span className="w-8 text-right text-xs font-bold text-ink/60 dark:text-cream/60">{s}%</span>
        </div>
      ))}
    </div>
  );
}

function FeaturePicker() {
  const [active, setActive] = useState("smart");
  const f = FEATURES.find((x) => x.id === active)!;
  return (
    <section id="tools" className="border-y border-ink/8 bg-surface/60 py-16 dark:border-cream/10 dark:bg-surface-dark/30 lg:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mb-10 text-center">
          <Badge tone="brand" className="mb-3">Study tools</Badge>
          <h2 className="font-display text-3xl font-bold tracking-tight text-ink sm:text-4xl dark:text-cream">
            Every tool you need. All in one place.
          </h2>
          <p className="mt-2 text-[15px] text-ink/60 dark:text-cream/60">
            Pick a feature to see how it works.
          </p>
        </div>
        <div className="grid gap-8 lg:grid-cols-[1fr_1.1fr] lg:items-center">
          <div className="space-y-2.5">
            {FEATURES.map((feat) => (
              <button
                key={feat.id}
                onClick={() => setActive(feat.id)}
                className={cn(
                  "flex w-full items-start gap-4 rounded-2xl border p-4 text-left transition",
                  active === feat.id
                    ? "border-brand-500 bg-surface shadow-lg dark:bg-surface-dark"
                    : "border-transparent hover:bg-surface/70 dark:hover:bg-surface-dark/60"
                )}
              >
                <span
                  className={cn(
                    "grid h-11 w-11 shrink-0 place-items-center rounded-xl transition",
                    active === feat.id ? "bg-brand-500 text-ink" : "bg-ink/6 text-ink/60 dark:bg-cream/10 dark:text-cream/60"
                  )}
                >
                  <feat.icon size={19} />
                </span>
                <span>
                  <span className="flex items-center gap-2">
                    <span className="text-[11px] font-bold text-ink/40 dark:text-cream/40">Feature {feat.num}</span>
                  </span>
                  <span className="block text-[15px] font-bold text-ink dark:text-cream">{feat.name}</span>
                  {active === feat.id && (
                    <span className="mt-1 block text-[13px] leading-relaxed text-ink/60 dark:text-cream/60">
                      {feat.desc}
                    </span>
                  )}
                </span>
              </button>
            ))}
          </div>
          <div className="animate-fade" key={active}>
            {active === "smart" && <SmartPanel />}
            {active === "flashcards" && <FlashPanel />}
            {active === "guide" && <GuidePanel />}
            {active === "tests" && <TestsPanel />}
            {active === "assign" && <AssignPanel />}
          </div>
        </div>
      </div>
    </section>
  );
}

/* --------------------------- How it works -------------------------- */

function HowItWorks() {
  const steps = [
    [Upload, "📄", "Step 1", "Upload your materials", "Drop in lecture slides, PDFs, YouTube links, pasted notes — 90+ file types."],
    [Zap, "⚡", "Step 2", "Get study tools instantly", "AI reads your material and builds flashcards, questions, notes and a study guide."],
    [Brain, "🧠", "Step 3", "Actively study with Tawi", "Answer questions, rate flashcards, play games — Tawi adapts to what you know."],
    [Trophy, "🎓", "Result", "Ready for exam day", "Spaced repetition keeps weak spots coming back until you've mastered them."],
  ] as const;
  return (
    <section id="how" className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-24">
      <div className="mb-10 text-center">
        <Badge tone="brand" className="mb-3">How it works</Badge>
        <h2 className="font-display text-3xl font-bold tracking-tight text-ink sm:text-4xl dark:text-cream">
          Create free study tools from over 90 file types.
        </h2>
      </div>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4 stagger-children">
        {steps.map(([Icon, emoji, tag, title, desc], i) => (
          <div key={tag} className="relative rounded-3xl border border-ink/8 bg-surface p-6 shadow-sm dark:border-cream/10 dark:bg-surface-dark">
            <span className="absolute right-5 top-5 text-[11px] font-bold uppercase tracking-wider text-ink/35 dark:text-cream/35">
              {emoji}
            </span>
            <div className="mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-brand-100 text-ink dark:bg-brand-500/15 dark:text-brand-300">
              <Icon size={21} />
            </div>
            <p className="text-xs font-bold uppercase tracking-widest text-brand-700 dark:text-brand-400">{tag}</p>
            <h3 className="mt-1 text-[17px] font-bold text-ink dark:text-cream">{title}</h3>
            <p className="mt-2 text-[13.5px] leading-relaxed text-ink/60 dark:text-cream/60">{desc}</p>
            {i < 3 && (
              <ArrowRight size={16} className="absolute -right-3.5 top-1/2 hidden -translate-y-1/2 text-ink/25 lg:block dark:text-cream/25" />
            )}
          </div>
        ))}
      </div>

      {/* Upload visual */}
      <div className="mt-10 overflow-hidden rounded-[2rem] border border-ink/8 bg-ink p-6 text-center shadow-xl dark:border-cream/10 sm:p-10">
        <div className="mx-auto max-w-xl">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-brand-500 text-ink">
            <Upload size={24} />
          </div>
          <h3 className="font-display mt-4 text-2xl font-bold text-cream">Upload anything.</h3>
          <p className="mt-2 text-sm leading-relaxed text-cream/60">
            Lecture slides, textbook PDFs, YouTube links, images, pasted notes and more — Tawi reads
            them all and builds your study kit in seconds.
          </p>
          <div className="mx-auto mt-6 flex max-w-md flex-wrap items-center justify-center gap-2">
            {["📄 PDF", "🎞️ YouTube", "📝 Pasted notes", "🖼️ Images", "🔗 Web links", "📚 Textbooks"].map((t) => (
              <span key={t} className="rounded-full border border-cream/15 bg-cream/5 px-3.5 py-1.5 text-[13px] font-semibold text-cream/85">
                {t}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* --------------------------- Try it yourself ----------------------- */

function TryIt() {
  const demos = [
    ["🌿", "Photosynthesis", "Biology · 24 flashcards · 12 questions", "bg-brand-100 dark:bg-brand-500/15"],
    ["🧮", "Calculus Basics", "Math · 18 flashcards · 10 questions", "bg-violet-100 dark:bg-violet-500/15"],
    ["⚔️", "World War II", "History · 30 flashcards · 14 questions", "bg-amber-100 dark:bg-amber-500/15"],
    ["🇪🇸", "Spanish Vocab", "Language · 40 flashcards · 8 questions", "bg-sky-100 dark:bg-sky-500/15"],
  ];
  return (
    <section className="border-y border-ink/8 bg-surface/60 py-16 dark:border-cream/10 dark:bg-surface-dark/30 lg:py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mb-8 text-center">
          <Badge tone="brand" className="mb-3">Try it yourself</Badge>
          <h2 className="font-display text-3xl font-bold tracking-tight text-ink sm:text-4xl dark:text-cream">
            Jump in with a free study kit.
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-[15px] text-ink/60 dark:text-cream/60">
            Sign in once and get a ready-made sample kit to experience flashcards, Smart Study and
            games — every kit you create is always free.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {demos.map(([emoji, title, meta, color]) => (
            <Link
              key={title}
              href="/signin?sample=1"
              className="group rounded-3xl border border-ink/8 bg-surface p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-brand-500 hover:shadow-lg dark:border-cream/10 dark:bg-surface-dark"
            >
              <div className={cn("mb-4 grid h-12 w-12 place-items-center rounded-2xl text-2xl transition group-hover:scale-110", color)}>
                {emoji}
              </div>
              <p className="text-base font-bold text-ink dark:text-cream">{title}</p>
              <p className="mt-1 text-[13px] text-ink/55 dark:text-cream/55">{meta}</p>
              <p className="mt-3 flex items-center gap-1 text-[13px] font-bold text-brand-600 dark:text-brand-400">
                Study now <ArrowRight size={13} className="transition group-hover:translate-x-0.5" />
              </p>
            </Link>
          ))}
        </div>
        <p className="mt-6 text-center text-sm text-ink/55 dark:text-cream/55">
          Want to study your own material?{" "}
          <Link href="/signin" className="font-bold text-ink underline decoration-brand-500 decoration-2 underline-offset-4 dark:text-cream">
            Create a free account →
          </Link>
        </p>
      </div>
    </section>
  );
}

/* ----------------------------- Why Tawi ---------------------------- */

function WhyTawi() {
  const items = [
    [Zap, "⚡", "Active Recall, Not Passive Reading", "Research shows active recall is 2–3× more effective than re-reading. Tawi turns your material into smart practice questions automatically."],
    [Brain, "🧠", "Research-Backed Methods", "Built on spaced repetition, retrieval practice and cognitive science: the same techniques top students already use."],
    [Target, "🎯", "Personalized to You", "Tawi adapts to what you know and what you don't. No wasted time on mastered material — focus goes where it counts."],
    [Flame, "🚫", "Made to Learn, Not to Cheat", "Tawi helps you genuinely understand your material. It's designed alongside educators, not around them."],
  ] as const;
  return (
    <section id="why" className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-24">
      <div className="mb-10 text-center">
        <Badge tone="brand" className="mb-3">Why Tawi works</Badge>
        <h2 className="font-display text-3xl font-bold tracking-tight text-ink sm:text-4xl dark:text-cream">
          Study tools designed to ensure you actually learn.
        </h2>
      </div>
      <div className="grid gap-5 md:grid-cols-2">
        {items.map(([Icon, emoji, title, desc]) => (
          <div key={title} className="flex gap-4 rounded-3xl border border-ink/8 bg-surface p-6 shadow-sm dark:border-cream/10 dark:bg-surface-dark">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-brand-100 text-2xl dark:bg-brand-500/15">
              {emoji}
            </span>
            <div>
              <h3 className="text-[16px] font-bold text-ink dark:text-cream">{title}</h3>
              <p className="mt-1.5 text-[14px] leading-relaxed text-ink/60 dark:text-cream/60">{desc}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ------------------------- Progress tracking ----------------------- */

function ProgressSection() {
  return (
    <section className="border-y border-ink/8 bg-surface/60 py-16 dark:border-cream/10 dark:bg-surface-dark/30 lg:py-24">
      <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 sm:px-6 lg:grid-cols-2">
        <div>
          <Badge tone="brand" className="mb-3">Progress tracking</Badge>
          <h2 className="font-display text-3xl font-bold tracking-tight text-ink sm:text-4xl dark:text-cream">
            Tawi lets you track your progress.
          </h2>
          <p className="mt-4 max-w-md text-[15px] leading-relaxed text-ink/60 dark:text-cream/60">
            See which cards need review, how your quiz scores improve week over week, and how many
            concepts you&apos;ve truly mastered. Motivation, visualized.
          </p>
          <ul className="mt-6 space-y-3">
            {[
              "Spaced repetition schedule per flashcard",
              "Score tracking on every practice test",
              "Class folders to keep subjects organized",
              "Daily streak and review queue",
            ].map((t) => (
              <li key={t} className="flex items-center gap-2.5 text-sm font-semibold text-ink/80 dark:text-cream/80">
                <span className="grid h-5 w-5 place-items-center rounded-full bg-brand-500 text-ink">
                  <Check size={12} strokeWidth={3} />
                </span>
                {t}
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-[2rem] border border-ink/8 bg-surface p-6 shadow-xl dark:border-cream/10 dark:bg-surface-dark">
          <div className="mb-5 flex items-center justify-between">
            <p className="font-bold text-ink dark:text-cream">Your week</p>
            <Badge tone="green">↑ 18% vs last week</Badge>
          </div>
          <div className="flex items-end justify-between gap-2">
            {[42, 58, 47, 66, 74, 82, 90].map((h, i) => (
              <div key={i} className="flex flex-1 flex-col items-center gap-2">
                <div className="relative w-full overflow-hidden rounded-xl bg-ink/6 dark:bg-cream/10" style={{ height: 140 }}>
                  <div
                    className={cn("absolute bottom-0 w-full rounded-t-lg", i === 6 ? "bg-brand-500" : "bg-ink/20 dark:bg-cream/25")}
                    style={{ height: `${h}%` }}
                  />
                </div>
                <span className="text-[10px] font-bold uppercase text-ink/45 dark:text-cream/45">
                  {["M", "T", "W", "T", "F", "S", "S"][i]}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-6 grid grid-cols-3 gap-3 text-center">
            {[
              ["212", "cards reviewed"],
              ["87%", "quiz accuracy"],
              ["14", "day streak"],
            ].map(([v, l]) => (
              <div key={l} className="rounded-2xl bg-paper p-3 dark:bg-paper-dark">
                <p className="font-display text-lg font-bold text-ink dark:text-cream">{v}</p>
                <p className="text-[11px] font-medium text-ink/50 dark:text-cream/50">{l}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------ Pricing ----------------------------- */

function Pricing() {
  return (
    <section id="pricing" className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:py-24">
      <div className="mb-10 text-center">
        <Badge tone="brand" className="mb-3">Pricing</Badge>
        <h2 className="font-display text-3xl font-bold tracking-tight text-ink sm:text-4xl dark:text-cream">
          Free for students. Simple for everyone else.
        </h2>
      </div>
      <div className="grid gap-5 md:grid-cols-2">
        <div className="rounded-3xl border border-ink/8 bg-surface p-8 shadow-sm dark:border-cream/10 dark:bg-surface-dark">
          <p className="text-sm font-bold uppercase tracking-widest text-ink/45 dark:text-cream/45">Students</p>
          <p className="font-display mt-3 text-4xl font-bold text-ink dark:text-cream">
            Free <span className="text-lg font-semibold text-ink/45 dark:text-cream/45">forever</span>
          </p>
          <ul className="mt-6 space-y-3">
            {["Unlimited study kits", "Smart Study + flashcards + games", "Study guides, summaries & notes", "Spaced repetition", "Create copies & share links"].map((t) => (
              <li key={t} className="flex items-center gap-2.5 text-sm font-semibold text-ink/80 dark:text-cream/80">
                <span className="grid h-5 w-5 place-items-center rounded-full bg-brand-500 text-ink"><Check size={12} strokeWidth={3} /></span>
                {t}
              </li>
            ))}
          </ul>
          <Link href="/signin" className="mt-8 block">
            <Button className="w-full" size="lg">Start studying free</Button>
          </Link>
        </div>
        <div className="relative overflow-hidden rounded-3xl bg-ink p-8 text-cream shadow-xl">
          <span className="absolute right-5 top-5 rounded-full bg-brand-500 px-3 py-1 text-xs font-bold text-ink">Most popular</span>
          <p className="text-sm font-bold uppercase tracking-widest text-cream/50">Educators</p>
          <p className="font-display mt-3 text-4xl font-bold">
            ₱549 <span className="text-lg font-semibold text-cream/50">/ month</span>
          </p>
          <ul className="mt-6 space-y-3">
            {["Everything in Free", "Build unlimited assignments", "Student results dashboard", "Class folders & organization", "Share worksheets with one link", "Priority AI generation"].map((t) => (
              <li key={t} className="flex items-center gap-2.5 text-sm font-semibold text-cream/85">
                <span className="grid h-5 w-5 place-items-center rounded-full bg-brand-500 text-ink"><Check size={12} strokeWidth={3} /></span>
                {t}
              </li>
            ))}
          </ul>
          <Link href="/signin" className="mt-8 block">
            <button className="h-12 w-full rounded-full bg-brand-500 text-[15px] font-bold text-ink transition hover:bg-brand-400">
              I&apos;m a teacher or professor
            </button>
          </Link>
        </div>
      </div>
    </section>
  );
}

/* -------------------------------- FAQ ------------------------------- */

function FAQ() {
  const faqs = [
    ["What can I upload?", "PDFs, lecture slides, textbook chapters, YouTube links, web pages, images, or just paste your notes. Over 90 file types are supported and everything is turned into study tools automatically."],
    ["Do I need an AI API key?", "No. Tawi works out of the box with its built-in study engine. Connecting an OpenAI-compatible key upgrades summaries, question wording and explanations to full LLM quality."],
    ["Is Tawi really free?", "Yes — 90%+ of learners never pay. Students get unlimited study kits, Smart Study, flashcards, games and study guides for free."],
    ["How does Smart Study work?", "It asks you questions from your material (Socratic method + active recall), then explains the correct answer. Wrong answers are prioritized so you review weak spots more often."],
    ["How do I share with my class?", "Educators build an assignment, copy one share link, and students complete it in their browser. You see every score and submission in your dashboard."],
    ["Can I use exact text instead of AI summaries?", "Yes — every study guide has an Exact text mode (your original material, formatted) and an AI summary mode, so reviewers who need precise wording keep it word-for-word."],
  ];
  return (
    <section className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <div className="mb-8 text-center">
        <Badge tone="brand" className="mb-3">FAQ</Badge>
        <h2 className="font-display text-3xl font-bold tracking-tight text-ink dark:text-cream">Questions? Answered.</h2>
      </div>
      <div className="space-y-3">
        {faqs.map(([q, a]) => (
          <details key={q} className="group rounded-2xl border border-ink/10 bg-surface p-5 dark:border-cream/10 dark:bg-surface-dark">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-[15px] font-bold text-ink dark:text-cream">
              {q}
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-ink/6 text-ink/60 transition group-open:rotate-45 dark:bg-cream/10 dark:text-cream/60">+</span>
            </summary>
            <p className="mt-3 text-[14px] leading-relaxed text-ink/65 dark:text-cream/65">{a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

/* ------------------------------ Footer ------------------------------ */

function Footer() {
  return (
    <footer className="border-t border-ink/8 py-10 dark:border-cream/10">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 px-4 sm:px-6 md:flex-row">
        <Link href="/" className="flex items-center gap-2">
          <OwlLogo size={32} />
          <span className="text-lg font-bold tracking-tight text-ink dark:text-cream">
            tawi<span className="font-medium text-ink/50 dark:text-cream/50">.study</span>
          </span>
        </Link>
        <div className="flex flex-wrap items-center justify-center gap-6 text-sm font-semibold text-ink/60 dark:text-cream/60">
          <a href="#tools" className="hover:text-ink dark:hover:text-cream">Study tools</a>
          <a href="#how" className="hover:text-ink dark:hover:text-cream">How it works</a>
          <a href="#pricing" className="hover:text-ink dark:hover:text-cream">Pricing</a>
          <Link href="/signin" className="hover:text-ink dark:hover:text-cream">Sign in</Link>
        </div>
        <p className="text-[13px] text-ink/45 dark:text-cream/45">
          © 2026 Tawi Study by Sam Pas · All rights reserved
        </p>
      </div>
    </footer>
  );
}

/* ------------------------------- Page ------------------------------- */

export default function LandingPage() {
  return (
    <div className="min-h-dvh bg-paper text-ink dark:bg-paper-dark dark:text-cream">
      <Nav />
      <Hero />
      <Testimonials />
      <FeaturePicker />
      <HowItWorks />
      <TryIt />
      <WhyTawi />
      <ProgressSection />
      <Pricing />
      <FAQ />
      <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
        <div className="relative overflow-hidden rounded-[2rem] bg-brand-500 px-6 py-14 text-center text-ink">
          <div className="pointer-events-none absolute -left-10 -top-10 h-44 w-44 rounded-full bg-white/25 blur-2xl" />
          <div className="pointer-events-none absolute -bottom-14 -right-10 h-52 w-52 rounded-full bg-white/20 blur-2xl" />
          <h2 className="font-display relative text-3xl font-bold tracking-tight sm:text-4xl">
            90%+ of Tawi learners never pay. Ever.
          </h2>
          <p className="relative mx-auto mt-3 max-w-xl text-[15px] font-medium text-ink/75">
            Tawi is free for students. Premium features exist for those who want more — but getting
            better grades doesn&apos;t cost a thing.
          </p>
          <div className="relative mt-7 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/signin"
              className="inline-flex h-12 items-center gap-2 rounded-full bg-ink px-6 text-[15px] font-bold text-brand-300 transition hover:bg-ink/85"
            >
              Start for free today <ArrowRight size={17} />
            </Link>
            <a
              href="#how"
              className="inline-flex h-12 items-center gap-2 rounded-full border-2 border-ink/25 px-6 text-[15px] font-bold text-ink transition hover:bg-ink/10"
            >
              <Play size={15} /> See how it works
            </a>
          </div>
        </div>
      </section>
      <Footer />
    </div>
  );
}
