import Link from "next/link";
import { redirect } from "next/navigation";
import { Sparkles } from "lucide-react";
import { getPublicKit } from "@/lib/actions";
import { PublicKitView } from "@/components/public-kit";
import { OwlLogo } from "@/components/logo";

export default async function SharePage({
  params,
}: {
  params: Promise<{ type: string; token: string }>;
}) {
  const { type, token } = await params;
  if (type === "assignment") redirect(`/take/${token}`);
  if (type !== "kit") redirect("/");

  const data = await getPublicKit(token);
  if (!data) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-paper px-4 text-center dark:bg-paper-dark">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink dark:text-cream">Kit not found</h1>
          <p className="mt-2 text-sm text-ink/55 dark:text-cream/55">This study kit may have been deleted.</p>
          <Link
            href="/"
            className="mt-5 inline-flex h-10 items-center gap-2 rounded-full bg-brand-500 px-5 text-sm font-bold text-ink"
          >
            <Sparkles size={15} /> Create your own free kit
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-paper text-ink dark:bg-paper-dark dark:text-cream">
      <header className="border-b border-ink/8 py-3 dark:border-cream/10">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2">
            <OwlLogo size={32} />
            <span className="text-lg font-bold tracking-tight">
              tawi<span className="font-medium text-ink/50 dark:text-cream/50">.study</span>
            </span>
          </Link>
          <Link
            href="/signin"
            className="rounded-full bg-brand-500 px-4 py-1.5 text-sm font-bold text-ink transition hover:bg-brand-400"
          >
            Make your own — free
          </Link>
        </div>
      </header>
      <PublicKitView data={data} />
    </div>
  );
}
