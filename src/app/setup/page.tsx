import Link from "next/link";
import { redirect } from "next/navigation";
import { Database, ExternalLink, Terminal } from "lucide-react";
import { isDatabaseConfigured } from "@/db";
import { aiAvailable, aiEngineLabel } from "@/lib/ai";
import { Badge, Card } from "@/components/ui";
import { OwlLogo } from "@/components/logo";

export const dynamic = "force-dynamic";

const STEPS = [
  {
    title: "Create a free Postgres database",
    body: "Sign up at Neon — free forever, no credit card, and it never sleeps. Create a project and copy the connection string it shows you (it starts with postgresql:// and ends with ?sslmode=require).",
    href: "https://neon.tech",
    hrefLabel: "neon.tech",
  },
  {
    title: "Add it as an environment variable",
    body: "On Vercel: Project → Settings → Environment Variables → add DATABASE_URL with that connection string, then redeploy. Running locally instead: copy .env.example to .env and paste it there.",
  },
  {
    title: "That's it — tables build themselves",
    body: "On the first request the app creates every table it needs automatically. There is no migration command to run, nothing to click, and re-deploys never wipe your data.",
  },
];

export default function SetupPage() {
  // If the database is already wired up, this page has no reason to exist.
  if (isDatabaseConfigured()) redirect("/dashboard");

  return (
    <main className="min-h-dvh bg-paper px-4 py-12 text-ink dark:bg-paper-dark dark:text-cream">
      <div className="mx-auto max-w-2xl">
        <Link href="/" className="mb-8 inline-flex items-center gap-2">
          <OwlLogo size={36} />
          <span className="text-xl font-bold tracking-tight">
            tawi<span className="font-medium text-ink/50 dark:text-cream/50">.study</span>
          </span>
        </Link>

        <Badge tone="amber">
          <Database size={13} /> Database not connected
        </Badge>

        <h1 className="mt-4 font-display text-3xl font-bold tracking-tight sm:text-4xl">
          One variable away from ready
        </h1>
        <p className="mt-3 text-ink/60 dark:text-cream/60">
          Every study tool is built and working — flashcards, smart study, quizzes,
          study guides and games. They just need somewhere to save your material.
        </p>

        <ol className="mt-8 space-y-4">
          {STEPS.map((step, i) => (
            <li key={step.title}>
              <Card className="p-5">
                <div className="flex gap-4">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand-500 font-bold text-ink">
                    {i + 1}
                  </span>
                  <div className="min-w-0">
                    <h2 className="font-display text-lg font-semibold">{step.title}</h2>
                    <p className="mt-1.5 text-sm leading-relaxed text-ink/60 dark:text-cream/60">
                      {step.body}
                    </p>
                    {step.href && (
                      <a
                        href={step.href}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700 hover:underline dark:text-brand-400"
                      >
                        {step.hrefLabel} <ExternalLink size={13} />
                      </a>
                    )}
                  </div>
                </div>
              </Card>
            </li>
          ))}
        </ol>

        <Card className="mt-6 p-5">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Terminal size={15} /> Example DATABASE_URL
          </div>
          <pre className="mt-3 overflow-x-auto rounded-xl bg-ink/5 p-3.5 text-[11.5px] leading-relaxed text-ink/70 dark:bg-cream/10 dark:text-cream/70">
{`postgresql://user:password@ep-cool-name-pooler.ap-soutawist-1.aws.neon.tech/neondb?sslmode=require`}
          </pre>
        </Card>

        <p className="mt-6 text-sm text-ink/50 dark:text-cream/50">
          <strong className="font-semibold text-ink/70 dark:text-cream/70">
            AI text engine:
          </strong>{" "}
          {aiEngineLabel()}
          {aiAvailable()
            ? " — online rewriting and formatting is enabled."
            : " — fully functional offline. Add a free GEMINI_API_KEY or GROQ_API_KEY for LLM-grade rewritten text."}
        </p>

        <p className="mt-2 text-sm text-ink/50 dark:text-cream/50">
          Full walkthrough lives in <code className="font-mono">DEPLOY.md</code>.
        </p>
      </div>
    </main>
  );
}
