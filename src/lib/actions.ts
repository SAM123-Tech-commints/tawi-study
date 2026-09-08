"use server";

import { revalidatePath } from "next/cache";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { db, isDatabaseConfigured } from "@/db";
import {
  assignmentQuestions,
  attempts,
  cards,
  cardProgress,
  classes,
  documents,
  events,
  kitQuestions,
  kits,
  assignments,
  tasks,
  users,
  type GenQuestion,
} from "@/db/schema";
import { isAdminUser, adminEmails } from "@/lib/admin";
import {
  aiAvailable,
  explainMore,
  generateCards,
  generateNotes,
  generateQuestions,
  generateSummary,
} from "@/lib/ai";
import {
  clearSession,
  getUser,
  hashPassword,
  setSession,
  verifyPassword,
} from "@/lib/auth";
import { initialSrs, schedule } from "@/lib/srs";
import { SAMPLE_BIO } from "@/lib/sample";
import { normalize } from "@/lib/text";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function token(): string {
  return crypto.randomUUID().replace(/-/g, "");
}

/* --------------------------- database guards --------------------------- */

const NO_DB_MESSAGE =
  "No database is connected yet. Add a DATABASE_URL environment variable " +
  "(free Postgres at neon.tech) — open /setup for the 3-step guide.";

/** Turn raw pg driver errors into something a student can act on. */
function dbErrorMessage(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  if (/ENOTFOUND|EAI_AGAIN|getaddrinfo/i.test(raw))
    return "Could not reach the database host. Double-check the DATABASE_URL hostname.";
  if (/ECONNREFUSED/i.test(raw))
    return "The database refused the connection. Confirm it is running and accepts external connections.";
  if (/password authentication failed|SASL|28P01/i.test(raw))
    return "The database rejected those credentials. Copy a fresh connection string from your provider.";
  if (/does not exist|3D000/i.test(raw))
    return "That database name does not exist. Check the path at the end of your DATABASE_URL.";
  if (/self.signed|certificate|SSL|no pg_hba/i.test(raw))
    return "The database requires SSL. Append ?sslmode=require to your DATABASE_URL.";
  if (/timeout|ETIMEDOUT/i.test(raw))
    return "The database timed out. It may be waking from sleep — try again in a moment.";
  return `Database error: ${raw}`;
}

/**
 * Message for actions that need a signed-in user. When the deployment has no
 * database at all, `getUser()` can only ever return null — so say what's
 * actually wrong instead of telling the user to sign in.
 */
function authError(): string {
  return isDatabaseConfigured() ? "Please sign in first." : NO_DB_MESSAGE;
}

/**
 * Guests are read-only: they may browse the site, open the sample content
 * and take shared assignments, but uploads and content creation require a
 * free account. Call this right after loading the user in every mutating
 * action; it returns an error message when the caller must be stopped.
 */
const GUEST_MESSAGE =
  "You're browsing as a guest — create a free account to upload files and create study kits, assignments and more.";

function memberBlocked(user: { isGuest: boolean } | null): string | null {
  if (!user) return authError();
  if (user.isGuest) return GUEST_MESSAGE;
  return null;
}

/** Read-only variant: returns null instead of throwing so pages still render. */
async function guardRead<T>(fn: () => Promise<T>): Promise<T | null> {
  if (!isDatabaseConfigured()) return null;
  try {
    return await fn();
  } catch (err) {
    console.error("[query] failed:", err);
    return null;
  }
}

/**
 * Runs a database action and converts every failure into a readable
 * `{ ok: false, error }` result instead of an unhandled server exception.
 */
async function guard<T extends { ok: boolean; error?: string }>(
  fn: () => Promise<T>,
  fallback?: Partial<T>
): Promise<T> {
  if (!isDatabaseConfigured()) {
    return { ...(fallback ?? {}), ok: false, error: NO_DB_MESSAGE } as T;
  }
  try {
    return await fn();
  } catch (err) {
    console.error("[action] failed:", err);
    return { ...(fallback ?? {}), ok: false, error: dbErrorMessage(err) } as T;
  }
}

/* ================================ AUTH ================================ */

export async function signupAction(form: FormData): Promise<{ ok: boolean; error?: string }> {
  return guard(async () => {
    const email = String(form.get("email") ?? "").trim().toLowerCase();
    const name = String(form.get("name") ?? "").trim();
    const password = String(form.get("password") ?? "");
    if (!EMAIL_RE.test(email)) return { ok: false, error: "Please enter a valid email address." };
    if (name.length < 2) return { ok: false, error: "Please enter your name." };
    if (password.length < 6) return { ok: false, error: "Password must be at least 6 characters." };
    const existing = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (existing.length) return { ok: false, error: "An account with this email already exists. Try signing in." };
    const [user] = await db
      .insert(users)
      .values({ email, name, passwordHash: await hashPassword(password) })
      .returning();
    await syncAdminFlag(user.id, email);
    await setSession(user.id);
    return { ok: true };
  });
}

export async function signinAction(form: FormData): Promise<{ ok: boolean; error?: string }> {
  return guard(async () => {
    const email = String(form.get("email") ?? "").trim().toLowerCase();
    const password = String(form.get("password") ?? "");
    if (!EMAIL_RE.test(email)) return { ok: false, error: "Please enter a valid email address." };
    const rows = await db.select().from(users).where(eq(users.email, email)).limit(1);
    const user = rows[0];
    if (!user?.passwordHash) return { ok: false, error: "No account found with this email." };
    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) return { ok: false, error: "Incorrect password. Please try again." };
    await syncAdminFlag(user.id, email);
    await setSession(user.id);
    return { ok: true };
  });
}

export async function guestSigninAction(): Promise<{ ok: boolean; error?: string }> {
  return guard(async () => {
    const stamp = Date.now().toString(36);
    const [user] = await db
      .insert(users)
      .values({
        email: `guest+${stamp}@tawi.local`,
        name: "Guest Learner",
        isGuest: true,
        role: "student",
        institution: "Not specified",
      })
      .returning();
    await setSession(user.id);
    return { ok: true };
  });
}

export async function signoutAction(): Promise<{ ok: boolean }> {
  await clearSession();
  return { ok: true };
}

export async function saveProfileAction(opts: {
  role: string;
  institution: string;
}): Promise<{ ok: boolean }> {
  return guard(async () => {
    const user = await getUser();
    if (!user) return { ok: false };
    await db
      .update(users)
      .set({ role: opts.role, institution: opts.institution })
      .where(eq(users.id, user.id));
    return { ok: true };
  });
}

/* ============================ KIT GENERATION =========================== */

async function buildKitContent(content: string, cardCount: number, questionCount: number) {
  const cardsDrafts = await generateCards(content, Math.max(6, cardCount));
  const questionsDrafts = await generateQuestions(content, {
    count: Math.max(6, questionCount),
    types: ["mcq", "true_false", "short"],
  });
  const summary = await generateSummary(content);
  const notes = await generateNotes(content);
  return { cardsDrafts, questionsDrafts, summary, notes };
}

export async function createKitAction(opts: {
  title: string;
  content: string;
  sourceName?: string;
  classId?: string | null;
  cardCount?: number;
  questionCount?: number;
}): Promise<{ ok: boolean; error?: string; id?: string }> {
  return guard(async () => {
    const user = await getUser();
    if (!user) return { ok: false, error: authError() };
    if (user.isGuest) return { ok: false, error: GUEST_MESSAGE };
    const content = normalize(opts.content);
    if (content.length < 120) {
      return { ok: false, error: "Your material is too short to build a study kit. Add a bit more content." };
    }
    const generated = await buildKitContent(
      content.slice(0, 60000),
      opts.cardCount ?? 14,
      opts.questionCount ?? 12
    );
    const [kit] = await db
      .insert(kits)
      .values({
        userId: user.id,
        title: opts.title || "Untitled study kit",
        sourceName: opts.sourceName ?? "",
        content,
        classId: opts.classId ?? null,
        summary: generated.summary,
        notes: generated.notes,
        aiEnabled: aiAvailable(),
        shareToken: token(),
      })
      .returning();

    if (generated.cardsDrafts.length) {
      await db.insert(cards).values(
        generated.cardsDrafts.map((c, i) => ({
          kitId: kit.id,
          term: c.term,
          definition: c.definition,
          order: i,
        }))
      );
    }
    if (generated.questionsDrafts.length) {
      await db.insert(kitQuestions).values(
        generated.questionsDrafts.map((q, i) => ({
          kitId: kit.id,
          type: q.type,
          question: q.question,
          options: q.options,
          answer: q.answer,
          explanation: q.explanation,
          order: i,
        }))
      );
    }
    revalidatePath("/dashboard");
    revalidatePath("/kits");
    return { ok: true, id: kit.id };
  });
}

export async function regenerateKitAction(
  kitId: string
): Promise<{ ok: boolean; error?: string }> {
  return guard(async () => {
    const user = await getUser();
    if (!user) return { ok: false, error: authError() };
    if (user.isGuest) return { ok: false, error: GUEST_MESSAGE };
    const [kit] = await db
      .select()
      .from(kits)
      .where(and(eq(kits.id, kitId), eq(kits.userId, user.id)))
      .limit(1);
    if (!kit) return { ok: false, error: "Study kit not found." };

    const generated = await buildKitContent(kit.content.slice(0, 60000), 14, 12);
    await db.delete(cards).where(eq(cards.kitId, kit.id));
    await db.delete(kitQuestions).where(eq(kitQuestions.kitId, kit.id));
    await db
      .update(kits)
      .set({
        summary: generated.summary,
        notes: generated.notes,
        aiEnabled: aiAvailable(),
        updatedAt: new Date(),
      })
      .where(eq(kits.id, kit.id));
    if (generated.cardsDrafts.length) {
      await db.insert(cards).values(
        generated.cardsDrafts.map((c, i) => ({
          kitId: kit.id,
          term: c.term,
          definition: c.definition,
          order: i,
        }))
      );
    }
    if (generated.questionsDrafts.length) {
      await db.insert(kitQuestions).values(
        generated.questionsDrafts.map((q, i) => ({
          kitId: kit.id,
          type: q.type,
          question: q.question,
          options: q.options,
          answer: q.answer,
          explanation: q.explanation,
          order: i,
        }))
      );
    }
    revalidatePath(`/kits/${kit.id}`);
    revalidatePath("/dashboard");
    revalidatePath("/kits");
    return { ok: true };
  });
}

export async function createSampleKitAction(): Promise<{ ok: boolean; error?: string; id?: string }> {
  return guard(async () => {
    const user = await getUser();
    if (!user) return { ok: false, error: authError() };
    if (user.isGuest) return { ok: false, error: GUEST_MESSAGE };
    const content = SAMPLE_BIO;
    const generated = await buildKitContent(content, 12, 10);
    const [kit] = await db
      .insert(kits)
      .values({
        userId: user.id,
        title: "Sample Kit: Photosynthesis",
        sourceName: "Sample biology notes",
        content,
        summary: generated.summary,
        notes: generated.notes,
        aiEnabled: aiAvailable(),
        shareToken: token(),
      })
      .returning();
    await db.insert(cards).values(
      generated.cardsDrafts.map((c, i) => ({ kitId: kit.id, term: c.term, definition: c.definition, order: i }))
    );
    await db.insert(kitQuestions).values(
      generated.questionsDrafts.map((q, i) => ({
        kitId: kit.id,
        type: q.type,
        question: q.question,
        options: q.options,
        answer: q.answer,
        explanation: q.explanation,
        order: i,
      }))
    );
    revalidatePath("/dashboard");
    revalidatePath("/kits");
    return { ok: true, id: kit.id };
  });
}

/* ============================ KIT CRUD ============================ */

export async function regenerateNotesAction(kitId: string): Promise<{ ok: boolean; error?: string }> {
  return guard(async () => {
    const user = await getUser();
    if (!user) return { ok: false, error: authError() };
    if (user.isGuest) return { ok: false, error: GUEST_MESSAGE };
    const [kit] = await db
      .select()
      .from(kits)
      .where(and(eq(kits.id, kitId), eq(kits.userId, user.id)))
      .limit(1);
    if (!kit) return { ok: false, error: "Study kit not found." };
    const notes = await generateNotes(kit.content.slice(0, 60000));
    await db.update(kits).set({ notes, updatedAt: new Date() }).where(eq(kits.id, kit.id));
    revalidatePath(`/kits/${kit.id}`);
    return { ok: true };
  });
}

export async function addCardAction(opts: {
  kitId: string;
  term: string;
  definition: string;
}): Promise<{ ok: boolean; error?: string }> {
  return guard(async () => {
    const user = await getUser();
    if (!user) return { ok: false, error: authError() };
    if (user.isGuest) return { ok: false, error: GUEST_MESSAGE };
    const [kit] = await db
      .select()
      .from(kits)
      .where(and(eq(kits.id, opts.kitId), eq(kits.userId, user.id)))
      .limit(1);
    if (!kit) return { ok: false, error: "Study kit not found." };
    const rows = await db.select().from(cards).where(eq(cards.kitId, kit.id));
    await db.insert(cards).values({
      kitId: kit.id,
      term: opts.term.trim(),
      definition: opts.definition.trim(),
      order: rows.length,
    });
    revalidatePath(`/kits/${kit.id}`);
    return { ok: true };
  });
}

export async function deleteCardAction(cardId: string): Promise<{ ok: boolean; error?: string }> {
  return guard(async () => {
    const user = await getUser();
    const blocked = memberBlocked(user);
    if (blocked) return { ok: false, error: blocked };
    await db.delete(cards).where(eq(cards.id, cardId));
    return { ok: true };
  });
}

export async function deleteKitQuestionAction(questionId: string): Promise<{ ok: boolean; error?: string }> {
  return guard(async () => {
    const user = await getUser();
    const blocked = memberBlocked(user);
    if (blocked) return { ok: false, error: blocked };
    await db.delete(kitQuestions).where(eq(kitQuestions.id, questionId));
    return { ok: true };
  });
}

export async function rateCardAction(opts: {
  cardId: string;
  rating: "again" | "unsure" | "got";
}): Promise<{ ok: boolean; dueInMinutes: number }> {
  return guard(async () => {
    const user = await getUser();
    if (!user) return { ok: false, dueInMinutes: 0 };
    if (user.isGuest) return { ok: false, error: GUEST_MESSAGE, dueInMinutes: 0 };
    const rows = await db
      .select()
      .from(cardProgress)
      .where(and(eq(cardProgress.cardId, opts.cardId), eq(cardProgress.userId, user.id)))
      .limit(1);
    const prev = rows[0]
      ? { ease: rows[0].ease, interval: rows[0].interval, reps: rows[0].reps, lapses: rows[0].lapses }
      : initialSrs;
    const next = schedule(opts.rating, prev);
    const dueAt = new Date(Date.now() + next.interval * 60 * 1000);
    if (rows[0]) {
      await db
        .update(cardProgress)
        .set({ ...next, dueAt, updatedAt: new Date() })
        .where(eq(cardProgress.id, rows[0].id));
    } else {
      await db.insert(cardProgress).values({
        userId: user.id,
        cardId: opts.cardId,
        ...next,
        dueAt,
      });
    }
    return { ok: true, dueInMinutes: next.interval };
  }, { dueInMinutes: 0 });
}

export async function resetProgressAction(kitId: string): Promise<{ ok: boolean }> {
  return guard(async () => {
    const user = await getUser();
    if (!user) return { ok: false };
    if (user.isGuest) return { ok: false, error: GUEST_MESSAGE };
    const kitCards = await db.select({ id: cards.id }).from(cards).where(eq(cards.kitId, kitId));
    if (kitCards.length) {
      await db.delete(cardProgress).where(
        and(
          eq(cardProgress.userId, user.id),
          inArray(cardProgress.cardId, kitCards.map((c) => c.id))
        )
      );
    }
    return { ok: true };
  });
}

export async function learnMoreAction(opts: {
  kitId: string;
  questionId: string;
}): Promise<string | null> {
  return guardRead(async () => {
    const [q] = await db
      .select()
      .from(kitQuestions)
      .where(and(eq(kitQuestions.id, opts.questionId), eq(kitQuestions.kitId, opts.kitId)))
      .limit(1);
    if (!q) return null;
    const [kit] = await db.select().from(kits).where(eq(kits.id, opts.kitId)).limit(1);
    if (!kit) return null;
    return explainMore(q.question, q.answer, kit.content.slice(0, 14000));
  });
}

export async function copyKitAction(kitId: string): Promise<{ ok: boolean; error?: string; id?: string }> {
  return guard(async () => {
    const user = await getUser();
    if (!user) return { ok: false, error: authError() };
    if (user.isGuest) return { ok: false, error: GUEST_MESSAGE };
    const [kit] = await db
      .select()
      .from(kits)
      .where(and(eq(kits.id, kitId), eq(kits.userId, user.id)))
      .limit(1);
    if (!kit) return { ok: false, error: "Study kit not found." };
    const kitCards = await db.select().from(cards).where(eq(cards.kitId, kit.id)).orderBy(asc(cards.order));
    const questions = await db
      .select()
      .from(kitQuestions)
      .where(eq(kitQuestions.kitId, kit.id))
      .orderBy(asc(kitQuestions.order));
    const [copy] = await db
      .insert(kits)
      .values({
        userId: user.id,
        classId: kit.classId,
        title: `${kit.title} (copy)`,
        sourceName: kit.sourceName,
        content: kit.content,
        summary: kit.summary,
        notes: kit.notes,
        aiEnabled: kit.aiEnabled,
        shareToken: token(),
      })
      .returning();
    await db.insert(cards).values(
      kitCards.map((c) => ({
        kitId: copy.id,
        term: c.term,
        definition: c.definition,
        order: c.order,
      }))
    );
    await db.insert(kitQuestions).values(
      questions.map((q) => ({
        kitId: copy.id,
        type: q.type,
        question: q.question,
        options: q.options,
        answer: q.answer,
        explanation: q.explanation,
        order: q.order,
      }))
    );
    revalidatePath("/dashboard");
    revalidatePath("/kits");
    return { ok: true, id: copy.id };
  });
}

export async function deleteKitAction(kitId: string): Promise<{ ok: boolean }> {
  return guard(async () => {
    const user = await getUser();
    if (!user) return { ok: false };
    if (user.isGuest) return { ok: false, error: GUEST_MESSAGE };
    await db.delete(kits).where(and(eq(kits.id, kitId), eq(kits.userId, user.id)));
    revalidatePath("/dashboard");
    revalidatePath("/kits");
    return { ok: true };
  });
}

export async function updateKitTitleAction(opts: {
  kitId: string;
  title: string;
}): Promise<{ ok: boolean }> {
  return guard(async () => {
    const user = await getUser();
    if (!user) return { ok: false };
    if (user.isGuest) return { ok: false, error: GUEST_MESSAGE };
    await db
      .update(kits)
      .set({ title: opts.title.trim() || "Untitled study kit" })
      .where(and(eq(kits.id, opts.kitId), eq(kits.userId, user.id)));
    revalidatePath(`/kits/${opts.kitId}`);
    return { ok: true };
  });
}

export async function moveKitAction(opts: {
  kitId: string;
  classId: string | null;
}): Promise<{ ok: boolean }> {
  return guard(async () => {
    const user = await getUser();
    if (!user) return { ok: false };
    if (user.isGuest) return { ok: false, error: GUEST_MESSAGE };
    await db
      .update(kits)
      .set({ classId: opts.classId })
      .where(and(eq(kits.id, opts.kitId), eq(kits.userId, user.id)));
    revalidatePath("/dashboard");
    revalidatePath("/kits");
    revalidatePath(`/kits/${opts.kitId}`);
    return { ok: true };
  });
}

/* ============================= CLASSES ============================= */

export async function createClassAction(opts: {
  name: string;
  color: string;
}): Promise<{ ok: boolean; error?: string }> {
  return guard(async () => {
    const user = await getUser();
    if (!user) return { ok: false, error: authError() };
    if (user.isGuest) return { ok: false, error: GUEST_MESSAGE };
    const name = opts.name.trim();
    if (!name) return { ok: false, error: "Enter a class name." };
    await db.insert(classes).values({ userId: user.id, name, color: opts.color });
    revalidatePath("/dashboard");
    return { ok: true };
  });
}

export async function deleteClassAction(classId: string): Promise<{ ok: boolean }> {
  return guard(async () => {
    const user = await getUser();
    if (!user) return { ok: false };
    if (user.isGuest) return { ok: false, error: GUEST_MESSAGE };
    await db.delete(classes).where(and(eq(classes.id, classId), eq(classes.userId, user.id)));
    await db.update(kits).set({ classId: null }).where(and(eq(kits.userId, user.id), eq(kits.classId, classId)));
    await db
      .update(assignments)
      .set({ classId: null })
      .where(and(eq(assignments.userId, user.id), eq(assignments.classId, classId)));
    revalidatePath("/dashboard");
    revalidatePath("/kits");
    revalidatePath("/assignments");
    return { ok: true };
  });
}

/* ========================== ASSIGNMENTS ========================== */

export async function createAssignmentAction(opts: {
  title: string;
  teacherName: string;
  className: string;
  dueDate: string;
  classId?: string | null;
}): Promise<{ ok: boolean; error?: string; id?: string }> {
  return guard(async () => {
    const user = await getUser();
    if (!user) return { ok: false, error: authError() };
    if (user.isGuest) return { ok: false, error: GUEST_MESSAGE };
    if (!opts.title.trim() || !opts.teacherName.trim() || !opts.className.trim()) {
      return { ok: false, error: "Fill in your name, class name and assignment title." };
    }
    const [a] = await db
      .insert(assignments)
      .values({
        userId: user.id,
        title: opts.title.trim(),
        teacherName: opts.teacherName.trim(),
        className: opts.className.trim(),
        dueDate: opts.dueDate,
        classId: opts.classId ?? null,
        shareToken: token(),
      })
      .returning();
    revalidatePath("/assignments");
    return { ok: true, id: a.id };
  });
}

export async function addAssignmentContentAction(opts: {
  assignmentId: string;
  content: string;
  sourceName: string;
}): Promise<{ ok: boolean; error?: string }> {
  return guard(async () => {
    const user = await getUser();
    if (!user) return { ok: false, error: authError() };
    if (user.isGuest) return { ok: false, error: GUEST_MESSAGE };
    const content = normalize(opts.content);
    if (content.length < 120) return { ok: false, error: "The material is too short to generate questions from." };
    await db
      .update(assignments)
      .set({ content, sourceName: opts.sourceName })
      .where(and(eq(assignments.id, opts.assignmentId), eq(assignments.userId, user.id)));
    return { ok: true };
  });
}

export async function generateAssignmentQuestionsAction(opts: {
  assignmentId: string;
  count: number;
  types: string[];
  instructions?: string;
  append?: boolean;
}): Promise<{ ok: boolean; error?: string; created: number }> {
  return guard(async () => {
    const user = await getUser();
    if (!user) return { ok: false, error: authError(), created: 0 };
    if (user.isGuest) return { ok: false, error: GUEST_MESSAGE, created: 0 };
    const [a] = await db
      .select()
      .from(assignments)
      .where(and(eq(assignments.id, opts.assignmentId), eq(assignments.userId, user.id)))
      .limit(1);
    if (!a) return { ok: false, error: "Assignment not found.", created: 0 };
    if (a.content.length < 120)
      return { ok: false, error: "Add some learning material first, then generate questions.", created: 0 };

    const drafts = await generateQuestions(a.content.slice(0, 60000), {
      count: Math.min(30, Math.max(2, opts.count)),
      types: opts.types,
      instructions: opts.instructions,
    });
    if (!drafts.length) return { ok: false, error: "Could not generate questions. Try adding more material.", created: 0 };

    if (!opts.append) {
      await db.delete(assignmentQuestions).where(eq(assignmentQuestions.assignmentId, a.id));
    }
    const existing = opts.append
      ? await db.select().from(assignmentQuestions).where(eq(assignmentQuestions.assignmentId, a.id))
      : [];
    const base = existing.length;
    await db.insert(assignmentQuestions).values(
      drafts.map((q, i) => ({
        assignmentId: a.id,
        type: q.type,
        question: q.question,
        options: q.options,
        answer: q.answer,
        explanation: q.explanation,
        order: base + i,
      }))
    );
    revalidatePath(`/assignments/${a.id}`);
    revalidatePath("/assignments");
    return { ok: true, created: drafts.length };
  }, { created: 0 });
}

export async function deleteAssignmentQuestionAction(questionId: string): Promise<{ ok: boolean }> {
  return guard(async () => {
    await db.delete(assignmentQuestions).where(eq(assignmentQuestions.id, questionId));
    return { ok: true };
  });
}

export async function deleteAssignmentAction(assignmentId: string): Promise<{ ok: boolean }> {
  return guard(async () => {
    const user = await getUser();
    if (!user) return { ok: false };
    if (user.isGuest) return { ok: false, error: GUEST_MESSAGE };
    await db
      .delete(assignments)
      .where(and(eq(assignments.id, assignmentId), eq(assignments.userId, user.id)));
    revalidatePath("/assignments");
    revalidatePath("/dashboard");
    return { ok: true };
  });
}

export async function moveAssignmentAction(opts: {
  assignmentId: string;
  classId: string | null;
}): Promise<{ ok: boolean }> {
  return guard(async () => {
    const user = await getUser();
    if (!user) return { ok: false };
    if (user.isGuest) return { ok: false, error: GUEST_MESSAGE };
    await db
      .update(assignments)
      .set({ classId: opts.classId })
      .where(and(eq(assignments.id, opts.assignmentId), eq(assignments.userId, user.id)));
    revalidatePath("/dashboard");
    revalidatePath("/assignments");
    return { ok: true };
  });
}

export async function submitAttemptAction(opts: {
  assignmentId: string;
  name: string;
  score: number;
  total: number;
}): Promise<{ ok: boolean }> {
  return guard(async () => {
    const user = await getUser();
    await db.insert(attempts).values({
      assignmentId: opts.assignmentId,
      userId: user?.id ?? null,
      name: opts.name || "Anonymous student",
      score: opts.score,
      total: opts.total,
    });
    revalidatePath(`/assignments/${opts.assignmentId}`);
    return { ok: true };
  });
}

/* ========================== DATA FETCHERS ========================== */

export async function getDashboardData() {
  return guardRead(async () => {
  const user = await getUser();
  if (!user) return null;
  const [classRows, kitRows, assignmentRows, cardRows, qRows, aqRows, progressRows, attemptRows] =
    await Promise.all([
      db.select().from(classes).where(eq(classes.userId, user.id)).orderBy(desc(classes.createdAt)),
      db.select().from(kits).where(eq(kits.userId, user.id)).orderBy(desc(kits.updatedAt)),
      db.select().from(assignments).where(eq(assignments.userId, user.id)).orderBy(desc(assignments.createdAt)),
      db.select().from(cards).where(inArray(cards.kitId, db.select({ id: kits.id }).from(kits).where(eq(kits.userId, user.id)))),
      db
        .select()
        .from(kitQuestions)
        .where(inArray(kitQuestions.kitId, db.select({ id: kits.id }).from(kits).where(eq(kits.userId, user.id)))),
      db
        .select()
        .from(assignmentQuestions)
        .where(
          inArray(
            assignmentQuestions.assignmentId,
            db.select({ id: assignments.id }).from(assignments).where(eq(assignments.userId, user.id))
          )
        ),
      db.select().from(cardProgress).where(eq(cardProgress.userId, user.id)),
      db
        .select()
        .from(attempts)
        .where(
          inArray(
            attempts.assignmentId,
            db.select({ id: assignments.id }).from(assignments).where(eq(assignments.userId, user.id))
          )
        )
        .orderBy(desc(attempts.createdAt)),
    ]);
  const cardCountByKit = new Map<string, number>();
  for (const c of cardRows) cardCountByKit.set(c.kitId, (cardCountByKit.get(c.kitId) ?? 0) + 1);
  const questionCountByKit = new Map<string, number>();
  for (const q of qRows) questionCountByKit.set(q.kitId, (questionCountByKit.get(q.kitId) ?? 0) + 1);
  const questionCountByAssignment = new Map<string, number>();
  for (const q of aqRows)
    questionCountByAssignment.set(q.assignmentId, (questionCountByAssignment.get(q.assignmentId) ?? 0) + 1);
  const avgScore = attemptRows.length
    ? Math.round(
        (attemptRows.reduce((acc, a) => acc + (a.total ? a.score / a.total : 0), 0) /
          attemptRows.length) *
          100
      )
    : null;
  return {
    user: { name: user.name, email: user.email, role: user.role, isGuest: user.isGuest },
    classes: classRows,
    kits: kitRows.map((k) => ({
      ...k,
      cardCount: cardCountByKit.get(k.id) ?? 0,
      questionCount: questionCountByKit.get(k.id) ?? 0,
    })),
    assignments: assignmentRows.map((a) => ({
      ...a,
      questionCount: questionCountByAssignment.get(a.id) ?? 0,
    })),
    progressCount: progressRows.length,
    avgScore,
    aiEnabled: aiAvailable(),
  };
});
}

export async function getAssignmentQuestionCounts(ids: string[]) {
return guardRead(async () => {
  if (!ids.length) return new Map<string, number>();
  const rows = await db.select().from(assignmentQuestions).where(inArray(assignmentQuestions.assignmentId, ids));
  const m = new Map<string, number>();
  for (const r of rows) m.set(r.assignmentId, (m.get(r.assignmentId) ?? 0) + 1);
  return m;
});
}

export async function getKitsData() {
return guardRead(async () => {
  const user = await getUser();
  if (!user) return null;
  const [classRows, kitRows] = await Promise.all([
    db.select().from(classes).where(eq(classes.userId, user.id)).orderBy(asc(classes.name)),
    db.select().from(kits).where(eq(kits.userId, user.id)).orderBy(desc(kits.updatedAt)),
  ]);
  const kitIds = kitRows.map((k) => k.id);
  const [cardRows, qRows] = kitIds.length
    ? await Promise.all([
        db.select().from(cards).where(inArray(cards.kitId, kitIds)),
        db.select().from(kitQuestions).where(inArray(kitQuestions.kitId, kitIds)),
      ])
    : [[], []];
  const cardCount = new Map<string, number>();
  for (const c of cardRows) cardCount.set(c.kitId, (cardCount.get(c.kitId) ?? 0) + 1);
  const qCount = new Map<string, number>();
  for (const q of qRows) qCount.set(q.kitId, (qCount.get(q.kitId) ?? 0) + 1);
  return {
    classes: classRows,
    kits: kitRows.map((k) => ({
      ...k,
      cardCount: cardCount.get(k.id) ?? 0,
      questionCount: qCount.get(k.id) ?? 0,
    })),
    aiEnabled: aiAvailable(),
  };
});
}

export async function getKitData(kitId: string) {
return guardRead(async () => {
  const user = await getUser();
  if (!user) return null;
  const [kit] = await db
    .select()
    .from(kits)
    .where(and(eq(kits.id, kitId), eq(kits.userId, user.id)))
    .limit(1);
  if (!kit) return null;
  const [kitCards, questions, progressRows] = await Promise.all([
    db.select().from(cards).where(eq(cards.kitId, kit.id)).orderBy(asc(cards.order)),
    db.select().from(kitQuestions).where(eq(kitQuestions.kitId, kit.id)).orderBy(asc(kitQuestions.order)),
    db.select().from(cardProgress).where(eq(cardProgress.userId, user.id)),
  ]);
  const cardIds = new Set(kitCards.map((c) => c.id));
  const progress = new Map<string, { reps: number; interval: number; dueAt: string }>();
  let dueCount = 0;
  for (const p of progressRows) {
    if (!cardIds.has(p.cardId)) continue;
    const due = new Date(p.dueAt).getTime() <= Date.now();
    if (due) dueCount++;
    progress.set(p.cardId, {
      reps: p.reps,
      interval: p.interval,
      dueAt: p.dueAt.toISOString(),
    });
  }
  return {
    kit,
    cards: kitCards,
    questions,
    progress: Object.fromEntries(progress),
    dueCount,
    shareUrl: `/share/kit/${kit.shareToken}`,
    aiEnabled: aiAvailable(),
  };
});
}

export async function getAssignmentData(assignmentId: string) {
return guardRead(async () => {
  const user = await getUser();
  if (!user) return null;
  const [a] = await db
    .select()
    .from(assignments)
    .where(and(eq(assignments.id, assignmentId), eq(assignments.userId, user.id)))
    .limit(1);
  if (!a) return null;
  const [questions, attemptRows] = await Promise.all([
    db
      .select()
      .from(assignmentQuestions)
      .where(eq(assignmentQuestions.assignmentId, a.id))
      .orderBy(asc(assignmentQuestions.order)),
    db.select().from(attempts).where(eq(attempts.assignmentId, a.id)).orderBy(desc(attempts.createdAt)),
  ]);
  return {
    assignment: a,
    questions,
    attempts: attemptRows,
    shareUrl: `/take/${a.shareToken}`,
    aiEnabled: aiAvailable(),
  };
});
}

export async function getAssignmentsData() {
return guardRead(async () => {
  const user = await getUser();
  if (!user) return null;
  const [classRows, rows] = await Promise.all([
    db.select().from(classes).where(eq(classes.userId, user.id)).orderBy(asc(classes.name)),
    db.select().from(assignments).where(eq(assignments.userId, user.id)).orderBy(desc(assignments.createdAt)),
  ]);
  const counts = (await getAssignmentQuestionCounts(rows.map((r) => r.id))) ?? new Map<string, number>();
  return {
    classes: classRows,
    assignments: rows.map((a) => ({
      ...a,
      questionCount: counts.get(a.id) ?? 0,
    })),
    aiEnabled: aiAvailable(),
  };
});
}

/* =========================== PUBLIC SHARE =========================== */

export async function getPublicKit(tokenId: string) {
return guardRead(async () => {
  const [kit] = await db.select().from(kits).where(eq(kits.shareToken, tokenId)).limit(1);
  if (!kit) return null;
  const [kitCards, questions] = await Promise.all([
    db.select().from(cards).where(eq(cards.kitId, kit.id)).orderBy(asc(cards.order)),
    db.select().from(kitQuestions).where(eq(kitQuestions.kitId, kit.id)).orderBy(asc(kitQuestions.order)),
  ]);
  return {
    kit,
    cards: kitCards,
    questions,
    aiEnabled: aiAvailable(),
  };
});
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function getTakeAssignment(idOrToken: string) {
return guardRead(async () => {
  const rows = UUID_RE.test(idOrToken)
    ? await db
        .select()
        .from(assignments)
        .where(eq(assignments.id, idOrToken))
        .limit(1)
    : [];
  const byToken = rows.length
    ? rows
    : await db.select().from(assignments).where(eq(assignments.shareToken, idOrToken)).limit(1);
  const a = byToken[0];
  if (!a) return null;
  const questions = await db
    .select()
    .from(assignmentQuestions)
    .where(eq(assignmentQuestions.assignmentId, a.id))
    .orderBy(asc(assignmentQuestions.order));
  return { assignment: a, questions, contentExcerpt: a.content.slice(0, 14000) };
});
}

/* ============================ URL FETCH ============================ */

export async function fetchUrlAction(url: string): Promise<{
  ok: boolean;
  error?: string;
  title?: string;
  text?: string;
}> {
  try {
  const u = new URL(url);
  const host = u.hostname.replace("www.", "");
  if (host === "youtu.be" || host === "youtube.com" || host === "m.youtube.com") {
    const videoId =
      u.hostname === "youtu.be" ? u.pathname.slice(1).split("/")[0] : u.searchParams.get("v");
    if (videoId) {
      const ores = await fetch(
        `https://www.youtube.com/oembed?url=${encodeURIComponent(
          `https://www.youtube.com/watch?v=${videoId}`
        )}&format=json`,
        { signal: AbortSignal.timeout(10000) }
      );
      if (ores.ok) {
        const d = await ores.json();
        return {
          ok: true,
          title: d.title ?? "YouTube video",
          text: `YouTube video: ${d.title ?? ""}\n${d.author_name ? `Channel: ${d.author_name}\n` : ""}\n\nTip: for the best questions and flashcards, paste the transcript or your own notes from this video instead.`,
        };
      }
    }
    return {
      ok: false,
      error: "Could not read this YouTube video automatically. Paste the transcript or your own notes instead.",
    };
  }
  const res = await fetch(url, {
    headers: { "user-agent": "Mozilla/5.0 (compatible; TawiStudyBot/1.0)" },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) return { ok: false, error: `Could not fetch the page (HTTP ${res.status}).` };
  const html = await res.text();
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, "\n")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/[ \t]+/g, " ")
    .replace(/\n{2,}/g, "\n")
    .trim();
  if (text.length < 200)
    return { ok: false, error: "Could not extract readable text from this page. Try pasting the content instead." };
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return {
    ok: true,
    title: titleMatch?.[1]?.trim() || new URL(url).hostname,
    text: text.slice(0, 50000),
  };
  } catch {
    return { ok: false, error: "Invalid or unreachable URL." };
  }
}

/* ============================ SESSION INFO =========================== */

export async function getSessionInfo(): Promise<{
  isGuest: boolean;
  role: string | null;
  isAdmin: boolean;
  name: string;
} | null> {
  return guardRead(async () => {
    const user = await getUser();
    if (!user) return null;
    return {
      isGuest: user.isGuest,
      role: user.role,
      isAdmin: isAdminUser(user),
      name: user.name,
    };
  });
}

/* ================================ ADMIN ============================== */

/** Promote matching users on sign-in/sign-up so ADMIN_EMAILS works retroactively. */
async function syncAdminFlag(userId: string, email: string) {
  if (!adminEmails().includes(email.toLowerCase())) return;
  await db.update(users).set({ isAdmin: true }).where(eq(users.id, userId));
}

export async function claimAdminAction(code: string): Promise<{ ok: boolean; error?: string }> {
  return guard(async () => {
    const user = await getUser();
    if (!user) return { ok: false, error: authError() };
    const expected = (process.env.ADMIN_CODE ?? "").trim();
    if (!expected) {
      return { ok: false, error: "No admin code is configured. Ask the site owner to set ADMIN_CODE." };
    }
    if (code.trim() !== expected) return { ok: false, error: "Incorrect admin code." };
    await db.update(users).set({ isAdmin: true }).where(eq(users.id, user.id));
    return { ok: true };
  });
}

export async function getAdminData() {
  return guardRead(async () => {
    const user = await getUser();
    if (!user || !isAdminUser(user)) return null;
    const [userRows, kitRows, cardRows, qRows, assignRows, aqRows, attemptRows, eventRows, taskRows, docRows] =
      await Promise.all([
        db.select().from(users).orderBy(desc(users.createdAt)),
        db.select().from(kits),
        db.select().from(cards),
        db.select().from(kitQuestions),
        db.select().from(assignments),
        db.select().from(assignmentQuestions),
        db.select().from(attempts).orderBy(desc(attempts.createdAt)),
        db.select().from(events),
        db.select().from(tasks),
        db.select().from(documents),
      ]);
    const kitsByUser = new Map<string, number>();
    for (const k of kitRows) kitsByUser.set(k.userId, (kitsByUser.get(k.userId) ?? 0) + 1);
    return {
      totals: {
        users: userRows.length,
        guests: userRows.filter((u) => u.isGuest).length,
        admins: userRows.filter((u) => isAdminUser(u)).length,
        kits: kitRows.length,
        cards: cardRows.length,
        kitQuestions: qRows.length,
        assignments: assignRows.length,
        assignmentQuestions: aqRows.length,
        attempts: attemptRows.length,
        events: eventRows.length,
        tasks: taskRows.length,
        documents: docRows.length,
      },
      users: userRows.slice(0, 100).map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        institution: u.institution,
        isGuest: u.isGuest,
        isAdmin: isAdminUser(u),
        kits: kitsByUser.get(u.id) ?? 0,
        createdAt: u.createdAt.toISOString(),
      })),
      recentAttempts: attemptRows.slice(0, 20).map((a) => ({
        name: a.name,
        score: a.score,
        total: a.total,
        createdAt: a.createdAt.toISOString(),
      })),
      aiEnabled: aiAvailable(),
    };
  });
}

/* ============================== CALENDAR ============================= */

export async function getEventsAction() {
  return guardRead(async () => {
    const user = await getUser();
    if (!user) return null;
    return db.select().from(events).where(eq(events.userId, user.id)).orderBy(asc(events.date));
  });
}

export async function createEventAction(opts: {
  title: string;
  date: string;
  description?: string;
  color?: string;
}): Promise<{ ok: boolean; error?: string; id?: string }> {
  return guard(async () => {
    const user = await getUser();
    const blocked = memberBlocked(user);
    if (blocked) return { ok: false, error: blocked };
    if (!opts.title.trim()) return { ok: false, error: "Give your event a title." };
    if (!/^\d{4}-\d{2}-\d{2}$/.test(opts.date)) return { ok: false, error: "Pick a valid date." };
    const [row] = await db
      .insert(events)
      .values({
        userId: user!.id,
        title: opts.title.trim(),
        date: opts.date,
        description: (opts.description ?? "").trim(),
        color: opts.color ?? "#B7E938",
      })
      .returning();
    return { ok: true, id: row.id };
  });
}

export async function updateEventAction(opts: {
  id: string;
  title: string;
  date: string;
  description?: string;
  color?: string;
}): Promise<{ ok: boolean; error?: string }> {
  return guard(async () => {
    const user = await getUser();
    const blocked = memberBlocked(user);
    if (blocked) return { ok: false, error: blocked };
    if (!opts.title.trim()) return { ok: false, error: "Give your event a title." };
    await db
      .update(events)
      .set({
        title: opts.title.trim(),
        date: opts.date,
        description: (opts.description ?? "").trim(),
        color: opts.color ?? "#B7E938",
      })
      .where(and(eq(events.id, opts.id), eq(events.userId, user!.id)));
    return { ok: true };
  });
}

export async function deleteEventAction(id: string): Promise<{ ok: boolean; error?: string }> {
  return guard(async () => {
    const user = await getUser();
    const blocked = memberBlocked(user);
    if (blocked) return { ok: false, error: blocked };
    await db.delete(events).where(and(eq(events.id, id), eq(events.userId, user!.id)));
    return { ok: true };
  });
}

/* ============================== WORKSPACE ============================ */

export async function getWorkspaceData() {
  return guardRead(async () => {
    const user = await getUser();
    if (!user) return null;
    const [taskRows, docRows] = await Promise.all([
      db.select().from(tasks).where(eq(tasks.userId, user.id)).orderBy(desc(tasks.createdAt)),
      db.select().from(documents).where(eq(documents.userId, user.id)).orderBy(desc(documents.updatedAt)),
    ]);
    return { tasks: taskRows, docs: docRows };
  });
}

export async function createTaskAction(opts: { title: string; due?: string }): Promise<{ ok: boolean; error?: string }> {
  return guard(async () => {
    const user = await getUser();
    const blocked = memberBlocked(user);
    if (blocked) return { ok: false, error: blocked };
    if (!opts.title.trim()) return { ok: false, error: "Enter a task." };
    await db.insert(tasks).values({ userId: user!.id, title: opts.title.trim(), due: opts.due ?? "" });
    return { ok: true };
  });
}

export async function toggleTaskAction(id: string): Promise<{ ok: boolean; error?: string }> {
  return guard(async () => {
    const user = await getUser();
    const blocked = memberBlocked(user);
    if (blocked) return { ok: false, error: blocked };
    const [t] = await db
      .select()
      .from(tasks)
      .where(and(eq(tasks.id, id), eq(tasks.userId, user!.id)))
      .limit(1);
    if (!t) return { ok: false, error: "Task not found." };
    await db.update(tasks).set({ done: !t.done }).where(eq(tasks.id, id));
    return { ok: true };
  });
}

export async function deleteTaskAction(id: string): Promise<{ ok: boolean; error?: string }> {
  return guard(async () => {
    const user = await getUser();
    const blocked = memberBlocked(user);
    if (blocked) return { ok: false, error: blocked };
    await db.delete(tasks).where(and(eq(tasks.id, id), eq(tasks.userId, user!.id)));
    return { ok: true };
  });
}

export async function saveDocAction(opts: {
  id?: string | null;
  kind: string;
  title: string;
  content: string;
}): Promise<{ ok: boolean; error?: string; id?: string }> {
  return guard(async () => {
    const user = await getUser();
    const blocked = memberBlocked(user);
    if (blocked) return { ok: false, error: blocked };
    const kind = opts.kind === "doc" ? "doc" : "note";
    if (opts.id) {
      await db
        .update(documents)
        .set({ kind, title: opts.title.trim() || "Untitled", content: opts.content, updatedAt: new Date() })
        .where(and(eq(documents.id, opts.id), eq(documents.userId, user!.id)));
      return { ok: true, id: opts.id };
    }
    const [row] = await db
      .insert(documents)
      .values({ userId: user!.id, kind, title: opts.title.trim() || "Untitled", content: opts.content })
      .returning();
    return { ok: true, id: row.id };
  });
}

export async function deleteDocAction(id: string): Promise<{ ok: boolean; error?: string }> {
  return guard(async () => {
    const user = await getUser();
    const blocked = memberBlocked(user);
    if (blocked) return { ok: false, error: blocked };
    await db.delete(documents).where(and(eq(documents.id, id), eq(documents.userId, user!.id)));
    return { ok: true };
  });
}

/* ========================== SAMPLE CONTENT ========================== */
