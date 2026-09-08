import Link from "next/link";
import { redirect } from "next/navigation";
import { getTakeAssignment } from "@/lib/actions";
import { TakeQuiz } from "@/components/take-quiz";
import { OwlLogo } from "@/components/logo";

export default async function TakePage({
  params,
}: {
  params: Promise<{ idOrToken: string }>;
}) {
  const { idOrToken } = await params;
  const data = await getTakeAssignment(idOrToken);
  if (!data) redirect("/");
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
          <span className="text-xs font-bold uppercase tracking-widest text-ink/45 dark:text-cream/45">
            Student worksheet
          </span>
        </div>
      </header>
      <TakeQuiz
        data={{
          assignment: {
            id: data.assignment.id,
            title: data.assignment.title,
            teacherName: data.assignment.teacherName,
            className: data.assignment.className,
            dueDate: data.assignment.dueDate,
          },
          questions: data.questions,
          contentExcerpt: data.contentExcerpt,
        }}
      />
    </div>
  );
}
