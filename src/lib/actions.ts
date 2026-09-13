"use server";

import { revalidatePath } from "next/cache";
import { and, asc, desc, eq, inArray, or, sql } from "drizzle-orm";
import { db, isDatabaseConfigured } from "@/db";
import {
  assignmentQuestions,
  attempts,
  cards,
  cardProgress,
  chatTyping,
  classes,
  communityComments,
  communityGroupMembers,
  communityGroupMessages,
  communityGroups,
  communityMessages,
  communityPosts,
  communityReactions,
  documents,
  events,
  friendships,
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
  cleanupExactText,
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
import { boldTerms, extractTerms, keyTerms, normalize, stripBoilerplate } from "@/lib/text";

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
    return await Promise.race([
      fn(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Read timed out")), 10000)
      ),
    ]);
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
    return await Promise.race([
      fn(),
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error("Request timed out. The database may be unreachable — please try again.")), 15000)
      ),
    ]);
  } catch (err) {
    console.error("[action] failed:", err);
    return { ...(fallback ?? {}), ok: false, error: dbErrorMessage(err) } as T;
  }
}

/* ================================ AUTH ================================ */

export async function signupAction(form: FormData): Promise<{ ok: boolean; error?: string; role?: string | null }> {
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
    // New accounts never have a role yet → client can skip the extra lookup.
    return { ok: true, role: null };
  });
}

export async function signinAction(form: FormData): Promise<{ ok: boolean; error?: string; role?: string | null }> {
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
    // Return the role so the client routes instantly with zero extra queries.
    return { ok: true, role: user.role };
  });
}

export async function guestSigninAction(): Promise<{ ok: boolean; error?: string; role?: string | null }> {
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
    return { ok: true, role: "student" };
  });
}

/* ------------------------- GOOGLE SIGN-IN ------------------------- */
/*  Free forever: Google Identity Services costs nothing and needs no card.
 *  Setup (2 min): Google Cloud Console → APIs & Services → Credentials →
 *  Create "OAuth client ID" (Web) →Authorized JavaScript origin = your site
 *  (e.g. https://tawi-study.vercel.app) → copy the Client ID into
 *  NEXT_PUBLIC_GOOGLE_CLIENT_ID. Apple Sign in is NOT free (requires the
 *  $99/yr Apple Developer Program), so email + Google cover everyone here. */

export async function googleSigninAction(idToken: string): Promise<{ ok: boolean; error?: string; role?: string | null }> {
  return guard(async () => {
    const clientId = (process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? process.env.GOOGLE_CLIENT_ID ?? "").trim();
    if (!clientId) {
      return { ok: false, error: "Google sign-in is not configured yet. Add NEXT_PUBLIC_GOOGLE_CLIENT_ID to enable it." };
    }
    if (!idToken || idToken.length < 100) return { ok: false, error: "Invalid Google credential. Try again." };
    let claims: { aud?: string; email?: string; email_verified?: string | boolean; name?: string; sub?: string };
    try {
      const res = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`, {
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) return { ok: false, error: "Could not verify with Google. Try again." };
      claims = await res.json();
    } catch {
      return { ok: false, error: "Could not reach Google. Check your connection and try again." };
    }
    if (claims.aud !== clientId) return { ok: false, error: "Google credential mismatch. Try again." };
    const email = String(claims.email ?? "").trim().toLowerCase();
    if (!EMAIL_RE.test(email)) return { ok: false, error: "Google did not return a valid email." };
    if (claims.email_verified !== true && claims.email_verified !== "true") {
      return { ok: false, error: "This Google account's email is not verified." };
    }
    const name = String(claims.name ?? "").trim().slice(0, 80) || email.split("@")[0];
    const rows = await db.select().from(users).where(eq(users.email, email)).limit(1);
    let user = rows[0];
    if (!user) {
      // Google users have no password — password sign-in correctly reports
      // "no account with this email" for them, and vice versa.
      const inserted = await db.insert(users).values({ email, name }).returning();
      user = inserted[0];
    }
    await syncAdminFlag(user.id, email);
    await setSession(user.id);
    return { ok: true, role: user.role };
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

export async function updateAvatarAction(avatarDataUrl: string): Promise<{ ok: boolean; error?: string }> {
  return guard(async () => {
    const user = await getUser();
    if (!user) return { ok: false, error: "Not signed in." };
    if (avatarDataUrl.length > 500000) return { ok: false, error: "Image too large (max 500KB)." };
    await db.update(users).set({ avatar: avatarDataUrl }).where(eq(users.id, user.id));
    return { ok: true };
  });
}

export async function removeAvatarAction(): Promise<{ ok: boolean }> {
  return guard(async () => {
    const user = await getUser();
    if (!user) return { ok: false };
    await db.update(users).set({ avatar: null }).where(eq(users.id, user.id));
    return { ok: true };
  });
}

export async function getAvatarAction(): Promise<string | null> {
  return guardRead(async () => {
    const user = await getUser();
    if (!user) return null;
    return (user as { avatar?: string | null }).avatar ?? null;
  });
}

export async function getProfileAction(): Promise<{
  name: string;
  email: string;
  role: string | null;
  institution: string | null;
  avatar: string | null;
  bio: string | null;
  course: string | null;
  yearLevel: string | null;
  banner: string | null;
  appearOffline: boolean;
  isAdmin: boolean;
  isGuest: boolean;
  createdAt: string;
} | null> {
  return guardRead(async () => {
    const user = await getUser();
    if (!user) return null;
    return {
      name: user.name,
      email: user.email,
      role: user.role,
      institution: user.institution,
      avatar: (user as { avatar?: string | null }).avatar ?? null,
      bio: user.bio ?? null,
      course: user.course ?? null,
      yearLevel: user.yearLevel ?? null,
      banner: user.banner ?? null,
      appearOffline: user.appearOffline ?? false,
      isAdmin: isAdminUser(user),
      isGuest: user.isGuest,
      createdAt: user.createdAt.toISOString(),
    };
  });
}

/** Get account stats: kit count, card count, assignment count, post count. */
export async function getAccountStatsAction(): Promise<{
  kits: number;
  cards: number;
  assignments: number;
  posts: number;
} | null> {
  return guardRead(async () => {
    const user = await getUser();
    if (!user) return null;
    const [kitRows] = await db.select({ count: sql<number>`count(*)::int` }).from(kits).where(eq(kits.userId, user.id));
    const [cardRows] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(cards)
      .innerJoin(kits, eq(cards.kitId, kits.id))
      .where(eq(kits.userId, user.id));
    const [assignRows] = await db.select({ count: sql<number>`count(*)::int` }).from(assignments).where(eq(assignments.userId, user.id));
    const [postRows] = await db.select({ count: sql<number>`count(*)::int` }).from(communityPosts).where(eq(communityPosts.userId, user.id));
    return {
      kits: kitRows?.count ?? 0,
      cards: cardRows?.count ?? 0,
      assignments: assignRows?.count ?? 0,
      posts: postRows?.count ?? 0,
    };
  });
}

/** Change the user's password (requires current password). */
export async function changePasswordAction(opts: {
  currentPassword: string;
  newPassword: string;
}): Promise<{ ok: boolean; error?: string }> {
  return guard(async () => {
    const user = await getUser();
    if (!user) return { ok: false, error: "Not signed in." };
    if (user.isGuest) return { ok: false, error: "Guests cannot change passwords." };
    if (!user.passwordHash) return { ok: false, error: "Your account uses social sign-in. No password to change." };
    const { compare } = await import("bcryptjs");
    const valid = await compare(opts.currentPassword, user.passwordHash);
    if (!valid) return { ok: false, error: "Current password is incorrect." };
    if (opts.newPassword.length < 8) return { ok: false, error: "New password must be at least 8 characters." };
    const { hash } = await import("bcryptjs");
    const newHash = await hash(opts.newPassword, 12);
    await db.update(users).set({ passwordHash: newHash }).where(eq(users.id, user.id));
    return { ok: true };
  });
}

export async function updateProfileAction(opts: {
  name?: string;
  role?: string;
  institution?: string;
  bio?: string;
  course?: string;
  yearLevel?: string;
  banner?: string;
  appearOffline?: boolean;
}): Promise<{ ok: boolean; error?: string }> {
  return guard(async () => {
    const user = await getUser();
    if (!user) return { ok: false, error: authError() };
    if (user.isGuest) return { ok: false, error: GUEST_MESSAGE };
    const patch: {
      name?: string;
      role?: string | null;
      institution?: string | null;
      bio?: string | null;
      course?: string | null;
      yearLevel?: string | null;
      banner?: string | null;
      appearOffline?: boolean;
    } = {};
    if (opts.name !== undefined) {
      const name = opts.name.trim();
      if (name.length < 2) return { ok: false, error: "Please enter your name." };
      patch.name = name.slice(0, 80);
    }
    if (opts.role !== undefined) {
      if (!["student", "educator"].includes(opts.role)) return { ok: false, error: "Pick student or educator." };
      patch.role = opts.role;
    }
    if (opts.institution !== undefined) patch.institution = opts.institution.trim().slice(0, 120) || null;
    if (opts.bio !== undefined) patch.bio = opts.bio.trim().slice(0, 300) || null;
    if (opts.course !== undefined) patch.course = opts.course.trim().slice(0, 60) || null;
    if (opts.yearLevel !== undefined) patch.yearLevel = opts.yearLevel.trim().slice(0, 40) || null;
    if (opts.banner !== undefined) {
      patch.banner = ["lime", "violet", "sky", "amber", "rose"].includes(opts.banner) ? opts.banner : null;
    }
    if (opts.appearOffline !== undefined) patch.appearOffline = !!opts.appearOffline;
    if (!Object.keys(patch).length) return { ok: true };
    await db.update(users).set(patch).where(eq(users.id, user.id));
    revalidatePath("/profile");
    revalidatePath("/workspace");
    return { ok: true };
  });
}

function newCollabKey(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return `tawi_${Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")}`;
}

export async function getApiKeyAction(): Promise<{ ok: boolean; key?: string | null; error?: string }> {
  return guard(async () => {
    const user = await getUser();
    if (!user) return { ok: false, error: authError() };
    if (user.isGuest) return { ok: false, error: GUEST_MESSAGE };
    return { ok: true, key: (user as { apiKey?: string | null }).apiKey ?? null };
  });
}

export async function regenerateApiKeyAction(): Promise<{ ok: boolean; key?: string; error?: string }> {
  return guard(async () => {
    const user = await getUser();
    if (!user) return { ok: false, error: authError() };
    if (user.isGuest) return { ok: false, error: GUEST_MESSAGE };
    const key = newCollabKey();
    await db.update(users).set({ apiKey: key }).where(eq(users.id, user.id));
    return { ok: true, key };
  });
}

export async function revokeApiKeyAction(): Promise<{ ok: boolean; error?: string }> {
  return guard(async () => {
    const user = await getUser();
    if (!user) return { ok: false, error: authError() };
    if (user.isGuest) return { ok: false, error: GUEST_MESSAGE };
    await db.update(users).set({ apiKey: null }).where(eq(users.id, user.id));
    return { ok: true };
  });
}

export async function updateSettingsAction(settings: {
  timerWork?: number;
  timerBreak?: number;
  timerLongBreak?: number;
  timerRounds?: number;
  theme?: string;
  language?: string;
  timerEnabled?: boolean;
  accent?: string;
  fontSize?: string;
  compactMode?: boolean;
  soundEnabled?: boolean;
  autoGenerate?: boolean;
}): Promise<{ ok: boolean; error?: string }> {
  return guard(async () => {
    const user = await getUser();
    if (!user) return { ok: false };
    const current = (user.settings as Record<string, unknown>) ?? {};
    const merged = { ...current, ...settings };
    await db.update(users).set({ settings: merged }).where(eq(users.id, user.id));
    return { ok: true };
  });
}

export async function getUserSettings(): Promise<{
  timerWork: number;
  timerBreak: number;
  timerLongBreak: number;
  timerRounds: number;
  theme: string;
  language: string;
  timerEnabled: boolean;
  accent: string;
  fontSize: string;
  compactMode: boolean;
  soundEnabled: boolean;
  autoGenerate: boolean;
} | null> {
  return guardRead(async () => {
    const user = await getUser();
    if (!user) return null;
    const s = (user.settings as Record<string, unknown>) ?? {};
    return {
      timerWork: (s.timerWork as number) ?? 25,
      timerBreak: (s.timerBreak as number) ?? 5,
      timerLongBreak: (s.timerLongBreak as number) ?? 15,
      timerRounds: (s.timerRounds as number) ?? 4,
      theme: (s.theme as string) ?? "system",
      language: (s.language as string) ?? "en",
      timerEnabled: (s.timerEnabled as boolean) ?? false,
      accent: (s.accent as string) ?? "lime",
      fontSize: (s.fontSize as string) ?? "medium",
      compactMode: (s.compactMode as boolean) ?? false,
      soundEnabled: (s.soundEnabled as boolean) ?? true,
      autoGenerate: (s.autoGenerate as boolean) ?? false,
    };
  });
}

/* ============================ KIT GENERATION =========================== */

async function buildKitContent(content: string, cardCount: number, questionCount: number) {
  // Question/card volume is driven by how many term→definition pairs the
  // material actually contains — a 5-term handout should not produce 30 cards.
  let terms = 0;
  try {
    terms = extractTerms(content).length;
  } catch {
    terms = 0;
  }
  const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
  const cardsN = terms > 0 ? clamp(terms, 6, 50) : clamp(cardCount, 6, 50);
  const questionsN = terms > 0 ? clamp(terms, 6, 40) : clamp(questionCount, 6, 40);
  const cardsDrafts = await generateCards(content, Math.max(6, cardsN));
  const questionsDrafts = await generateQuestions(content, {
    count: Math.max(6, questionsN),
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
    const content = stripBoilerplate(normalize(opts.content));
    if (content.length < 120) {
      return { ok: false, error: "Your material is too short to build a study kit. Add a bit more content." };
    }
    const generated = await buildKitContent(
      content.slice(0, 200000),
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

    const generated = await buildKitContent(kit.content.slice(0, 200000), 14, 12);
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
    const notes = await generateNotes(kit.content.slice(0, 200000));
    await db.update(kits).set({ notes, updatedAt: new Date() }).where(eq(kits.id, kit.id));
    revalidatePath(`/kits/${kit.id}`);
    return { ok: true };
  });
}

/* Suggest highlight terms with the AI engine (uses your API key when one is
 * configured, otherwise the built-in engine) — word AND its definition get
 * highlighted in Exact text because matches apply to the whole passage. */
export async function suggestGuideTermsAction(kitId: string): Promise<{ ok: boolean; error?: string; terms?: string[]; ai?: boolean }> {  return guard(async () => {
    const user = await getUser();
    if (!user) return { ok: false, error: authError() };
    if (user.isGuest) return { ok: false, error: GUEST_MESSAGE };
    const [kit] = await db
      .select()
      .from(kits)
      .where(and(eq(kits.id, kitId), eq(kits.userId, user.id)))
      .limit(1);
    if (!kit) return { ok: false, error: "Study kit not found." };

    // 1) Source emphasis first — the author's own bold/italic terms are the
    //    most faithful highlights and never require an API call.
    const emphasized = boldTerms(kit.content).slice(0, 12);
    if (emphasized.length >= 4) {
      return { ok: true, terms: emphasized, ai: false };
    }

    // 2) AI summary key terms (uses your key when configured).
    const summary = await generateSummary(kit.content.slice(0, 200000));
    const terms = (summary.keyTerms ?? []).map((k) => k.term).filter((t) => t && t.length > 2).slice(0, 12);
    if (terms.length) return { ok: true, terms, ai: aiAvailable() };

    // 3) Local key terms.
    const local = keyTerms(kit.content, 12).map((k) => k.term).filter(Boolean).slice(0, 12);
    if (local.length) return { ok: true, terms: local, ai: false };

    return { ok: false, error: "No clear terms found — add your own below." };
  });
}

/* AI exact-text cleanup: fix spacing/blank lines, lay out bullets and
 * Term — definition lines, keep EVERY word. Saves back to the kit. */
export async function cleanupExactTextAction(kitId: string): Promise<{ ok: boolean; error?: string; ai?: boolean }> {
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
    const { text, ai } = await cleanupExactText(kit.content.slice(0, 200000));
    if (!text.trim()) return { ok: false, error: "Could not clean this text." };
    await db.update(kits).set({ content: text, updatedAt: new Date() }).where(eq(kits.id, kit.id));
    revalidatePath(`/kits/${kit.id}`);
    return { ok: true, ai };
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

export async function deleteKitAction(kitId: string): Promise<{ ok: boolean }> {  return guard(async () => {
    const user = await getUser();
    if (!user) return { ok: false };
    if (user.isGuest) return { ok: false, error: GUEST_MESSAGE };
    await db.delete(kits).where(and(eq(kits.id, kitId), eq(kits.userId, user.id)));
    revalidatePath("/dashboard");
    revalidatePath("/kits");
    return { ok: true };
  });
}

export async function togglePinKitAction(kitId: string): Promise<{ ok: boolean; pinned?: boolean; error?: string }> {
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
    const pinned = !(kit as { pinned?: boolean }).pinned;
    await db.update(kits).set({ pinned }).where(eq(kits.id, kit.id));
    revalidatePath("/dashboard");
    revalidatePath("/kits");
    return { ok: true, pinned };
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
      db.select().from(kits).where(eq(kits.userId, user.id)).orderBy(desc(kits.pinned), desc(kits.updatedAt)),
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
    db.select().from(kits).where(eq(kits.userId, user.id)).orderBy(desc(kits.pinned), desc(kits.updatedAt)),
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
  transcript?: boolean;
}> {
  try {
  const u = new URL(url);
  const host = u.hostname.replace("www.", "");

  /* ---- YouTube ---- */
  if (host === "youtu.be" || host === "youtube.com" || host === "m.youtube.com") {
    const videoId =
      u.hostname === "youtu.be" ? u.pathname.slice(1).split("/")[0] : u.searchParams.get("v");
    if (!videoId) return { ok: false, error: "Could not parse YouTube video ID." };

    // Try every transcript source (library → TranscriptAPI → InnerTube →
    // caption-track scrape → timedtext) and keep the longest result.
    let transcript = "";
    let title = "YouTube video";
    let author = "";
    try {
      const { extractYouTubeTranscript } = await import("@/lib/youtube");
      const r = await extractYouTubeTranscript(videoId);
      transcript = r.text;
      title = r.title;
      author = r.author;
    } catch (err) {
      console.warn("[fetchUrl] transcript chain failed:", err instanceof Error ? err.message : err);
    }

    if (transcript.length > 200) {
      return {
        ok: true,
        title,
        transcript: true,
        text: `YouTube video: ${title}\nChannel: ${author}\n\n${transcript}`,
      };
    }

    // Fallback: try to scrape the page description
    let description = "";
    try {
      const pageRes = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
        headers: { "user-agent": "Mozilla/5.0 (compatible; TawiStudyBot/1.0)" },
        signal: AbortSignal.timeout(10000),
      });
      if (pageRes.ok) {
        const html = await pageRes.text();
        const descMatch = html.match(/"shortDescription":"((?:[^"\\]|\\.)*)"/);
        if (descMatch) description = descMatch[1].replace(/\\n/g, "\n").replace(/\\"/g, '"');
      }
    } catch {}

    if (description.length > 200) {
      return {
        ok: true,
        title,
        transcript: false,
        text: `YouTube video: ${title}\nChannel: ${author}\n\n⚠️ No transcript was available, so this is only the video description — questions will be weaker. Paste the transcript for full-quality kits.\n\n${description}`,
      };
    }

    return {
      ok: true,
      title,
      transcript: false,
      text: `YouTube video: ${title}\nChannel: ${author}\n\n⚠️ WARNING: no transcript or description could be extracted. Paste the transcript or your own notes for best results.`,
    };
  }

  /* ---- Regular web page ---- */
  let res: Response;
  try {
    res = await fetch(url, {
      headers: {
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "accept-language": "en-US,en;q=0.9",
      },
      signal: AbortSignal.timeout(15000),
      redirect: "follow",
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/timeout|timed out|TimeoutError|aborted/i.test(msg)) {
      return { ok: false, error: "The page took too long to respond (15s). It may block bots — paste the content instead." };
    }
    if (/ENOTFOUND|EAI_AGAIN|getaddrinfo/i.test(msg)) {
      return { ok: false, error: "Could not find that website. Check the URL for typos." };
    }
    return { ok: false, error: "Could not reach that page. It may block automated readers — paste the content instead." };
  }
  if (res.status === 403 || res.status === 401) {
    return { ok: false, error: "That page blocked the reader (paywall or bot protection). Paste the content instead." };
  }
  if (res.status === 404) return { ok: false, error: "Page not found (HTTP 404). Check the URL." };
  if (!res.ok) return { ok: false, error: `Could not fetch the page (HTTP ${res.status}).` };
  const contentType = res.headers.get("content-type") ?? "";
  if (contentType && !/html|xml|text\/plain/i.test(contentType)) {
    return { ok: false, error: "That link isn't a readable web page (it looks like a file or feed). Paste the content instead." };
  }
  const html = await res.text();

  // Structure-preserving extraction: headings, bullets and bold survive, so the
  // scraped page renders like the source — the same treatment PDFs get.
  const { htmlToStructuredText, extractTitle, extractDescription } = await import("@/lib/html");
  const pageTitle = extractTitle(html, new URL(url).hostname);
  const ogDescription = extractDescription(html);
  const text = htmlToStructuredText(html);

  if (text.length < 100)
    return { ok: false, error: "Could not extract readable text from this page. Try pasting the content instead." };

  // Lead with the summary only when the body didn't already capture it.
  const combined =
    ogDescription && !text.slice(0, 600).includes(ogDescription.slice(0, 60))
      ? `${ogDescription}\n\n${text}`.slice(0, 50000)
      : text.slice(0, 50000);
  return {
    ok: true,
    title: pageTitle,
    text: combined,
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

/* ============================== COMMUNITY =========================== */
/*  A shared social feed inside the workspace: posts, Messenger-style emoji
 *  reactions, threaded comments, a friend system with live presence, and
 *  admin moderation (pin, mute, remove, promote, delete anything).        */

const REACTIONS = ["👍", "❤️", "😂", "😮", "👏"] as const;
type ReactionEmoji = (typeof REACTIONS)[number];

/** How long after the last heartbeat a member still counts as "online". */
const ONLINE_WINDOW_MS = 2 * 60 * 1000;

type PresenceUser = { lastSeen: Date | null; appearOffline: boolean };
function isOnline(u: PresenceUser): boolean {
  if (u.appearOffline) return false;
  if (!u.lastSeen) return false;
  return Date.now() - new Date(u.lastSeen).getTime() < ONLINE_WINDOW_MS;
}

type FriendState = "self" | "friends" | "incoming" | "outgoing" | "none";

/** Lightweight presence ping — the client calls this on an interval so the
 *  member shows up as online without refetching the whole feed. */
export async function heartbeatAction(): Promise<{ ok: boolean }> {
  return guard(async () => {
    const user = await getUser();
    if (!user) return { ok: false };
    await db.update(users).set({ lastSeen: new Date() }).where(eq(users.id, user.id));
    return { ok: true };
  });
}

/** Everything the Community tab needs in one round-trip. */
export async function getCommunityData() {
  return guardRead(async () => {
    const me = await getUser();
    if (!me) return null;

    const meIsAdmin = isAdminUser(me);

    const [postRows, allUsers, myFriendships] = await Promise.all([
      db
        .select()
        .from(communityPosts)
        .orderBy(desc(communityPosts.pinned), desc(communityPosts.createdAt))
        .limit(100),
      db.select().from(users).limit(500),
      db
        .select()
        .from(friendships)
        .where(or(eq(friendships.requesterId, me.id), eq(friendships.addresseeId, me.id))),
      // Heartbeat myself in the same round-trip (result ignored).
      db.update(users).set({ lastSeen: new Date() }).where(eq(users.id, me.id)),
    ]);

    const postIds = postRows.map((p) => p.id);
    const [reactionRows, commentRows] = postIds.length
      ? await Promise.all([
          db.select().from(communityReactions).where(inArray(communityReactions.postId, postIds)),
          db
            .select()
            .from(communityComments)
            .where(inArray(communityComments.postId, postIds))
            .orderBy(asc(communityComments.createdAt)),
        ])
      : [[], []];

    const userById = new Map(allUsers.map((u) => [u.id, u]));

    const shapeAuthor = (uid: string) => {
      const u = userById.get(uid);
      if (!u) {
        return { id: uid, name: "Former member", avatar: null, role: null, isAdmin: false, online: false };
      }
      return {
        id: u.id,
        name: u.name,
        avatar: u.avatar ?? null,
        role: u.role,
        isAdmin: isAdminUser(u),
        online: u.id === me.id ? !me.appearOffline : isOnline(u),
      };
    };

    // Reactions grouped into { emoji: count } per post, plus my own choice.
    const reactionsByPost = new Map<string, Record<string, number>>();
    const myReactionByPost = new Map<string, string>();
    for (const r of reactionRows) {
      const bucket = reactionsByPost.get(r.postId) ?? {};
      bucket[r.emoji] = (bucket[r.emoji] ?? 0) + 1;
      reactionsByPost.set(r.postId, bucket);
      if (r.userId === me.id) myReactionByPost.set(r.postId, r.emoji);
    }

    // Comments grouped per post (kept in chronological order).
    const commentsByPost = new Map<string, typeof commentRows>();
    for (const c of commentRows) {
      const arr = commentsByPost.get(c.postId);
      if (arr) arr.push(c);
      else commentsByPost.set(c.postId, [c]);
    }

    const posts = postRows.map((p) => ({
      id: p.id,
      content: p.content,
      image: (p as { image?: string | null }).image ?? null,
      pinned: p.pinned,
      createdAt: p.createdAt.toISOString(),
      author: shapeAuthor(p.userId),
      reactions: reactionsByPost.get(p.id) ?? {},
      myReaction: myReactionByPost.get(p.id) ?? null,
      canDelete: p.userId === me.id || meIsAdmin,
      comments: (commentsByPost.get(p.id) ?? []).map((c) => ({
        id: c.id,
        content: c.content,
        createdAt: c.createdAt.toISOString(),
        author: shapeAuthor(c.userId),
        canDelete: c.userId === me.id || meIsAdmin,
      })),
    }));

    // Resolve my friendships into friends / incoming / outgoing + a lookup.
    const friendIds = new Set<string>();
    const incomingIds: string[] = [];
    const outgoingIds = new Set<string>();
    const stateByUser = new Map<string, FriendState>();
    for (const f of myFriendships) {
      const other = f.requesterId === me.id ? f.addresseeId : f.requesterId;
      if (f.status === "accepted") {
        friendIds.add(other);
        stateByUser.set(other, "friends");
      } else if (f.addresseeId === me.id) {
        incomingIds.push(f.requesterId);
        if (!stateByUser.has(other)) stateByUser.set(other, "incoming");
      } else {
        outgoingIds.add(other);
        if (!stateByUser.has(other)) stateByUser.set(other, "outgoing");
      }
    }

    const byPresenceThenName = (a: { online: boolean; name: string }, b: { online: boolean; name: string }) =>
      Number(b.online) - Number(a.online) || a.name.localeCompare(b.name);

    const friends = [...friendIds].map(shapeAuthor).sort(byPresenceThenName);
    const incoming = incomingIds.map(shapeAuthor);
    const people = allUsers
      .filter((u) => u.id !== me.id && !u.isGuest)
      .map((u) => ({ ...shapeAuthor(u.id), friendState: stateByUser.get(u.id) ?? ("none" as FriendState) }))
      .sort(byPresenceThenName);

    return {
      me: {
        id: me.id,
        name: me.name,
        avatar: me.avatar ?? null,
        role: me.role,
        isAdmin: meIsAdmin,
        isGuest: me.isGuest,
        muted: me.muted ?? false,
        appearOffline: me.appearOffline ?? false,
      },
      posts,
      friends,
      incoming,
      outgoingCount: outgoingIds.size,
      people,
      onlineCount: people.filter((p) => p.online).length,
      reactionEmojis: [...REACTIONS],
    };
  });
}

export async function createPostAction(
  content: string,
  image?: string | null
): Promise<{ ok: boolean; error?: string; id?: string }> {
  return guard(async () => {
    const user = await getUser();
    const blocked = memberBlocked(user);
    if (blocked) return { ok: false, error: blocked };
    if (user!.muted) return { ok: false, error: "You've been muted by an admin and can't post right now." };
    const text = content.trim();
    if (!text) return { ok: false, error: "Write something to share first." };
    if (text.length > 2000) return { ok: false, error: "Posts are limited to 2000 characters." };
    const img = checkImage(image);
    if (typeof img === "string") return { ok: false, error: img };
    const [row] = await db.insert(communityPosts).values({ userId: user!.id, content: text, image: img }).returning();
    revalidatePath("/workspace");
    return { ok: true, id: row.id };
  });
}

export async function deletePostAction(postId: string): Promise<{ ok: boolean; error?: string }> {
  return guard(async () => {
    const user = await getUser();
    if (!user) return { ok: false, error: authError() };
    const [post] = await db.select().from(communityPosts).where(eq(communityPosts.id, postId)).limit(1);
    if (!post) return { ok: false, error: "That post no longer exists." };
    if (post.userId !== user.id && !isAdminUser(user)) {
      return { ok: false, error: "You can only delete your own posts." };
    }
    await db.delete(communityReactions).where(eq(communityReactions.postId, postId));
    await db.delete(communityComments).where(eq(communityComments.postId, postId));
    await db.delete(communityPosts).where(eq(communityPosts.id, postId));
    revalidatePath("/workspace");
    return { ok: true };
  });
}

export async function togglePinPostAction(postId: string): Promise<{ ok: boolean; error?: string; pinned?: boolean }> {
  return guard(async () => {
    const user = await getUser();
    if (!user) return { ok: false, error: authError() };
    if (!isAdminUser(user)) return { ok: false, error: "Only admins can pin announcements." };
    const [post] = await db.select().from(communityPosts).where(eq(communityPosts.id, postId)).limit(1);
    if (!post) return { ok: false, error: "That post no longer exists." };
    const pinned = !post.pinned;
    await db.update(communityPosts).set({ pinned }).where(eq(communityPosts.id, postId));
    revalidatePath("/workspace");
    return { ok: true, pinned };
  });
}

export async function reactToPostAction(opts: { postId: string; emoji: string }): Promise<{ ok: boolean; error?: string }> {
  return guard(async () => {
    const user = await getUser();
    const blocked = memberBlocked(user);
    if (blocked) return { ok: false, error: blocked };
    if (user!.muted) return { ok: false, error: "You've been muted by an admin." };
    if (!REACTIONS.includes(opts.emoji as ReactionEmoji)) return { ok: false, error: "Unknown reaction." };
    const [post] = await db.select().from(communityPosts).where(eq(communityPosts.id, opts.postId)).limit(1);
    if (!post) return { ok: false, error: "That post no longer exists." };
    const [existing] = await db
      .select()
      .from(communityReactions)
      .where(and(eq(communityReactions.postId, opts.postId), eq(communityReactions.userId, user!.id)))
      .limit(1);
    if (existing) {
      if (existing.emoji === opts.emoji) {
        // Tapping the same reaction again removes it (toggle off).
        await db.delete(communityReactions).where(eq(communityReactions.id, existing.id));
      } else {
        await db.update(communityReactions).set({ emoji: opts.emoji }).where(eq(communityReactions.id, existing.id));
      }
    } else {
      await db.insert(communityReactions).values({ postId: opts.postId, userId: user!.id, emoji: opts.emoji });
    }
    revalidatePath("/workspace");
    return { ok: true };
  });
}

export async function addCommentAction(opts: { postId: string; content: string }): Promise<{ ok: boolean; error?: string }> {
  return guard(async () => {
    const user = await getUser();
    const blocked = memberBlocked(user);
    if (blocked) return { ok: false, error: blocked };
    if (user!.muted) return { ok: false, error: "You've been muted by an admin." };
    const text = opts.content.trim();
    if (!text) return { ok: false, error: "Write a comment first." };
    if (text.length > 1000) return { ok: false, error: "Comments are limited to 1000 characters." };
    const [post] = await db.select().from(communityPosts).where(eq(communityPosts.id, opts.postId)).limit(1);
    if (!post) return { ok: false, error: "That post no longer exists." };
    await db.insert(communityComments).values({ postId: opts.postId, userId: user!.id, content: text });
    revalidatePath("/workspace");
    return { ok: true };
  });
}

export async function deleteCommentAction(commentId: string): Promise<{ ok: boolean; error?: string }> {
  return guard(async () => {
    const user = await getUser();
    if (!user) return { ok: false, error: authError() };
    const [comment] = await db.select().from(communityComments).where(eq(communityComments.id, commentId)).limit(1);
    if (!comment) return { ok: false, error: "That comment no longer exists." };
    if (comment.userId !== user.id && !isAdminUser(user)) {
      return { ok: false, error: "You can only delete your own comments." };
    }
    await db.delete(communityComments).where(eq(communityComments.id, commentId));
    revalidatePath("/workspace");
    return { ok: true };
  });
}

/* ------------------------------- friends ------------------------------- */

export async function sendFriendRequestAction(targetId: string): Promise<{ ok: boolean; error?: string; status?: FriendState }> {
  return guard(async () => {
    const user = await getUser();
    const blocked = memberBlocked(user);
    if (blocked) return { ok: false, error: blocked };
    if (targetId === user!.id) return { ok: false, error: "You can't add yourself." };
    const [target] = await db.select().from(users).where(eq(users.id, targetId)).limit(1);
    if (!target || target.isGuest) return { ok: false, error: "That person isn't available to add." };
    const [existing] = await db
      .select()
      .from(friendships)
      .where(
        or(
          and(eq(friendships.requesterId, user!.id), eq(friendships.addresseeId, targetId)),
          and(eq(friendships.requesterId, targetId), eq(friendships.addresseeId, user!.id))
        )
      )
      .limit(1);
    if (existing) {
      if (existing.status === "accepted") return { ok: true, status: "friends" };
      if (existing.addresseeId === user!.id) {
        // They already asked me → sending back instantly accepts.
        await db
          .update(friendships)
          .set({ status: "accepted", updatedAt: new Date() })
          .where(eq(friendships.id, existing.id));
        revalidatePath("/workspace");
        return { ok: true, status: "friends" };
      }
      return { ok: true, status: "outgoing" };
    }
    await db.insert(friendships).values({ requesterId: user!.id, addresseeId: targetId, status: "pending" });
    revalidatePath("/workspace");
    return { ok: true, status: "outgoing" };
  });
}

export async function respondFriendRequestAction(opts: {
  requesterId: string;
  accept: boolean;
}): Promise<{ ok: boolean; error?: string }> {
  return guard(async () => {
    const user = await getUser();
    const blocked = memberBlocked(user);
    if (blocked) return { ok: false, error: blocked };
    const [req] = await db
      .select()
      .from(friendships)
      .where(
        and(
          eq(friendships.requesterId, opts.requesterId),
          eq(friendships.addresseeId, user!.id),
          eq(friendships.status, "pending")
        )
      )
      .limit(1);
    if (!req) return { ok: false, error: "This request is no longer available." };
    if (opts.accept) {
      await db.update(friendships).set({ status: "accepted", updatedAt: new Date() }).where(eq(friendships.id, req.id));
    } else {
      await db.delete(friendships).where(eq(friendships.id, req.id));
    }
    revalidatePath("/workspace");
    return { ok: true };
  });
}

export async function removeFriendAction(otherId: string): Promise<{ ok: boolean; error?: string }> {
  return guard(async () => {
    const user = await getUser();
    const blocked = memberBlocked(user);
    if (blocked) return { ok: false, error: blocked };
    await db.delete(friendships).where(
      or(
        and(eq(friendships.requesterId, user!.id), eq(friendships.addresseeId, otherId)),
        and(eq(friendships.requesterId, otherId), eq(friendships.addresseeId, user!.id))
      )
    );
    revalidatePath("/workspace");
    return { ok: true };
  });
}

/** A brief public profile card for the "see profile" preview + moderation. */
export async function getProfilePreviewAction(userId: string) {
  return guardRead(async () => {
    const me = await getUser();
    if (!me) return null;
    const [u] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!u) return null;
    const [postCountRows, friendRows, myEdge] = await Promise.all([
      db.select({ id: communityPosts.id }).from(communityPosts).where(eq(communityPosts.userId, userId)),
      db
        .select({ id: friendships.id })
        .from(friendships)
        .where(
          and(
            or(eq(friendships.requesterId, userId), eq(friendships.addresseeId, userId)),
            eq(friendships.status, "accepted")
          )
        ),
      db
        .select()
        .from(friendships)
        .where(
          or(
            and(eq(friendships.requesterId, me.id), eq(friendships.addresseeId, userId)),
            and(eq(friendships.requesterId, userId), eq(friendships.addresseeId, me.id))
          )
        )
        .limit(1),
    ]);
    let friendState: FriendState = "none";
    if (userId === me.id) friendState = "self";
    else if (myEdge[0]) {
      if (myEdge[0].status === "accepted") friendState = "friends";
      else if (myEdge[0].addresseeId === me.id) friendState = "incoming";
      else friendState = "outgoing";
    }
    return {
      id: u.id,
      name: u.name,
      avatar: u.avatar ?? null,
      role: u.role,
      isAdmin: isAdminUser(u),
      institution: u.institution,
      bio: u.bio ?? null,
      course: u.course ?? null,
      yearLevel: u.yearLevel ?? null,
      banner: u.banner ?? null,
      online: userId === me.id ? !me.appearOffline : isOnline(u),
      memberSince: u.createdAt.toISOString(),
      postCount: postCountRows.length,
      friendCount: friendRows.length,
      friendState,
      isSelf: userId === me.id,
      muted: u.muted ?? false,
      viewerIsAdmin: isAdminUser(me),
    };
  });
}

/* ---------------------------- admin moderation ---------------------------- */

export async function setUserMutedAction(opts: { userId: string; muted: boolean }): Promise<{ ok: boolean; error?: string }> {
  return guard(async () => {
    const user = await getUser();
    if (!user) return { ok: false, error: authError() };
    if (!isAdminUser(user)) return { ok: false, error: "Only admins can moderate members." };
    if (opts.userId === user.id) return { ok: false, error: "You can't mute yourself." };
    await db.update(users).set({ muted: opts.muted }).where(eq(users.id, opts.userId));
    revalidatePath("/workspace");
    return { ok: true };
  });
}

/** Remove a member from the community: wipe their posts, comments and
 *  reactions, and mute them so they can't immediately repost. */
export async function removeMemberAction(userId: string): Promise<{ ok: boolean; error?: string }> {
  return guard(async () => {
    const user = await getUser();
    if (!user) return { ok: false, error: authError() };
    if (!isAdminUser(user)) return { ok: false, error: "Only admins can remove members." };
    if (userId === user.id) return { ok: false, error: "You can't remove yourself." };
    const theirPosts = await db
      .select({ id: communityPosts.id })
      .from(communityPosts)
      .where(eq(communityPosts.userId, userId));
    const ids = theirPosts.map((p) => p.id);
    if (ids.length) {
      await db.delete(communityReactions).where(inArray(communityReactions.postId, ids));
      await db.delete(communityComments).where(inArray(communityComments.postId, ids));
      await db.delete(communityPosts).where(inArray(communityPosts.id, ids));
    }
    await db.delete(communityComments).where(eq(communityComments.userId, userId));
    await db.delete(communityReactions).where(eq(communityReactions.userId, userId));
    await db.update(users).set({ muted: true }).where(eq(users.id, userId));
    revalidatePath("/workspace");
    return { ok: true };
  });
}

export async function promoteToAdminAction(userId: string): Promise<{ ok: boolean; error?: string }> {
  return guard(async () => {
    const user = await getUser();
    if (!user) return { ok: false, error: authError() };
    if (!isAdminUser(user)) return { ok: false, error: "Only admins can promote members." };
    const [target] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!target) return { ok: false, error: "User not found." };
    if (target.isGuest) return { ok: false, error: "Guests can't be promoted." };
    if (target.isAdmin) return { ok: true };
    await db.update(users).set({ isAdmin: true }).where(eq(users.id, userId));
    revalidatePath("/workspace");
    return { ok: true };
  });
}

/* ============================ FRIEND CHATS ============================ */

/** Validate an uploaded image data URL. Returns null (none), or an error string. */
function checkImage(image?: string | null): null | string {
  if (!image) return null;
  if (typeof image !== "string" || !image.startsWith("data:image/")) return "That file is not a supported image.";
  if (image.length > 1_400_000) return "Image is too large (max ~1MB).";
  return null;
}

async function requireFriend(userId: string, otherId: string) {
  if (userId === otherId) return null;
  const rows = await db
    .select()
    .from(friendships)
    .where(
      or(
        and(eq(friendships.requesterId, userId), eq(friendships.addresseeId, otherId)),
        and(eq(friendships.requesterId, otherId), eq(friendships.addresseeId, userId))
      )
    )
    .limit(1);
  const rel = rows[0];
  if (!rel || rel.status !== "accepted") return null;
  return rel;
}

export async function getChatsData() {
  return guardRead(async () => {
    const user = await getUser();
    if (!user) return null;
    const rels = await db
      .select()
      .from(friendships)
      .where(
        and(
          or(eq(friendships.requesterId, user.id), eq(friendships.addresseeId, user.id)),
          eq(friendships.status, "accepted")
        )
      );
    if (!rels.length) return { chats: [] };
    const friendIds = rels.map((r) => (r.requesterId === user.id ? r.addresseeId : r.requesterId));
    const [friendRows, msgRows] = await Promise.all([
      db.select().from(users).where(inArray(users.id, friendIds)),
      db
        .select()
        .from(communityMessages)
        .where(
          or(
            and(eq(communityMessages.senderId, user.id), inArray(communityMessages.receiverId, friendIds)),
            and(eq(communityMessages.receiverId, user.id), inArray(communityMessages.senderId, friendIds))
          )
        )
        .orderBy(desc(communityMessages.createdAt))
        .limit(500),
    ]);
    const byId = new Map(friendRows.map((u) => [u.id, u]));
    const chats = friendIds.map((fid) => {
      const u = byId.get(fid);
      const thread = msgRows.filter((m) => m.senderId === fid || m.receiverId === fid);
      const last = thread[0] ?? null;
      const unread = thread.filter((m) => m.receiverId === user.id && !m.read).length;
      return {
        id: fid,
        name: u?.name ?? "Former member",
        avatar: u?.avatar ?? null,
        online: u ? isOnline(u) : false,
        lastMessage: last ? (last.content.trim() ? last.content.slice(0, 80) : "📷 Photo") : null,
        lastAt: last ? last.createdAt.toISOString() : null,
        lastMine: last ? last.senderId === user.id : false,
        unread,
      };
    });
    chats.sort((a, b) => (b.lastAt ?? "").localeCompare(a.lastAt ?? ""));
    return { chats };
  });
}

export async function getConversationAction(friendId: string) {
  return guard(async () => {
    const user = await getUser();
    if (!user) return { ok: false, error: authError() } as const;
    if (user.isGuest) return { ok: false, error: GUEST_MESSAGE } as const;
    const rel = await requireFriend(user.id, friendId);
    if (!rel) return { ok: false, error: "You can only chat with friends." } as const;
    const rows = await db
      .select()
      .from(communityMessages)
      .where(
        or(
          and(eq(communityMessages.senderId, user.id), eq(communityMessages.receiverId, friendId)),
          and(eq(communityMessages.senderId, friendId), eq(communityMessages.receiverId, user.id))
        )
      )
      .orderBy(asc(communityMessages.createdAt))
      .limit(200);
    // Mark their messages as read.
    await db
      .update(communityMessages)
      .set({ read: true })
      .where(and(eq(communityMessages.senderId, friendId), eq(communityMessages.receiverId, user.id)));
    return {
      ok: true,
      messages: rows.map((m) => ({
        id: m.id,
        mine: m.senderId === user.id,
        content: m.content,
        image: (m as { image?: string | null }).image ?? null,
        read: m.read,
        createdAt: m.createdAt.toISOString(),
      })),
    } as const;
  });
}

export async function sendMessageAction(opts: {
  friendId: string;
  content: string;
  image?: string | null;
}): Promise<{ ok: boolean; error?: string }> {
  return guard(async () => {
    const user = await getUser();
    if (!user) return { ok: false, error: authError() };
    const blocked = memberBlocked(user);
    if (blocked) return { ok: false, error: blocked };
    if (user.muted) return { ok: false, error: "An admin has muted you in the community." };
    const text = opts.content.trim().slice(0, 1000);
    const imgErr = checkImage(opts.image);
    if (imgErr) return { ok: false, error: imgErr };
    if (!text && !opts.image) return { ok: false, error: "Write a message or attach an image first." };
    const rel = await requireFriend(user.id, opts.friendId);
    if (!rel) return { ok: false, error: "You can only chat with friends." };
    await db.insert(communityMessages).values({ senderId: user.id, receiverId: opts.friendId, content: text, image: opts.image ?? null });
    return { ok: true };
  });
}

/** Lightly ping the conversation so the friend sees a typing indicator. */
export async function pingTypingAction(friendId: string): Promise<{ ok: boolean }> {
  return guard(async () => {
    const user = await getUser();
    if (!user) return { ok: false };
    const rel = await requireFriend(user.id, friendId);
    if (!rel) return { ok: false };
    await db
      .insert(chatTyping)
      .values({ userId: user.id, friendId, typingAt: new Date() })
      .onConflictDoUpdate({ target: [chatTyping.userId, chatTyping.friendId], set: { typingAt: new Date() } });
    return { ok: true };
  });
}

/** Check whether a friend is typing (typing_at within last 5 seconds). */
export async function getTypingAction(friendId: string): Promise<{ ok: boolean; typing: boolean }> {
  return guard(async () => {
    const user = await getUser();
    if (!user) return { ok: false, typing: false };
    const rel = await requireFriend(user.id, friendId);
    if (!rel) return { ok: false, typing: false };
    const rows = await db
      .select()
      .from(chatTyping)
      .where(and(eq(chatTyping.userId, friendId), eq(chatTyping.friendId, user.id)))
      .limit(1);
    if (!rows.length) return { ok: true, typing: false };
    const diff = Date.now() - new Date(rows[0].typingAt).getTime();
    return { ok: true, typing: diff < 5000 };
  });
}

/* ============================ GROUP CHATS ============================ */

async function requireGroupMember(userId: string, groupId: string) {
  const rows = await db
    .select()
    .from(communityGroupMembers)
    .where(and(eq(communityGroupMembers.groupId, groupId), eq(communityGroupMembers.userId, userId)))
    .limit(1);
  return rows[0] ?? null;
}

export async function getGroupsData() {
  return guardRead(async () => {
    const user = await getUser();
    if (!user) return null;
    const memberships = await db
      .select()
      .from(communityGroupMembers)
      .where(eq(communityGroupMembers.userId, user.id));
    if (!memberships.length) return { groups: [] };
    const gids = memberships.map((m) => m.groupId);
    const [groupRows, memberRows, msgRows] = await Promise.all([
      db.select().from(communityGroups).where(inArray(communityGroups.id, gids)),
      db.select().from(communityGroupMembers).where(inArray(communityGroupMembers.groupId, gids)),
      db.select().from(communityGroupMessages).where(inArray(communityGroupMessages.groupId, gids)).orderBy(desc(communityGroupMessages.createdAt)).limit(300),
    ]);
    const userIds = [...new Set(memberRows.map((m) => m.userId))];
    const usersRows = userIds.length ? await db.select().from(users).where(inArray(users.id, userIds)) : [];
    const byId = new Map(usersRows.map((u) => [u.id, u]));
    const groups = groupRows.map((g) => {
      const members = memberRows
        .filter((m) => m.groupId === g.id)
        .map((m) => {
          const u = byId.get(m.userId);
          return { id: m.userId, name: u?.name ?? "Former member", avatar: u?.avatar ?? null };
        });
      const thread = msgRows.filter((m) => m.groupId === g.id);
      const last = thread[0] ?? null;
      return {
        id: g.id,
        name: g.name,
        ownerId: g.ownerId,
        isOwner: g.ownerId === user.id,
        createdAt: g.createdAt.toISOString(),
        members,
        lastMessage: last?.content.slice(0, 80) ?? null,
        lastAt: last ? last.createdAt.toISOString() : null,
      };
    });
    groups.sort((a, b) => (b.lastAt ?? "").localeCompare(a.lastAt ?? ""));
    return { groups };
  });
}

export async function createGroupAction(opts: {
  name: string;
  memberIds: string[];
}): Promise<{ ok: boolean; error?: string; id?: string }> {
  return guard(async () => {
    const user = await getUser();
    if (!user) return { ok: false, error: authError() };
    const blocked = memberBlocked(user);
    if (blocked) return { ok: false, error: blocked };
    if (user.muted) return { ok: false, error: "An admin has muted you in the community." };
    const name = opts.name.trim().slice(0, 60);
    if (name.length < 2) return { ok: false, error: "Give your group a name." };
    // Invites only go to accepted friends.
    const rels = await db
      .select()
      .from(friendships)
      .where(
        and(
          or(eq(friendships.requesterId, user.id), eq(friendships.addresseeId, user.id)),
          eq(friendships.status, "accepted")
        )
      );
    const friendIds = new Set(rels.map((r) => (r.requesterId === user.id ? r.addresseeId : r.requesterId)));
    const invited = [...new Set(opts.memberIds)].filter((id) => id !== user.id && friendIds.has(id)).slice(0, 30);
    if (!invited.length) return { ok: false, error: "Invite at least one friend to start a group." };
    const [group] = await db.insert(communityGroups).values({ name, ownerId: user.id }).returning();
    await db.insert(communityGroupMembers).values([
      { groupId: group.id, userId: user.id },
      ...invited.map((id) => ({ groupId: group.id, userId: id })),
    ]);
    revalidatePath("/workspace");
    return { ok: true, id: group.id };
  });
}

export async function inviteToGroupAction(opts: {
  groupId: string;
  userId: string;
}): Promise<{ ok: boolean; error?: string }> {
  return guard(async () => {
    const user = await getUser();
    if (!user) return { ok: false, error: authError() };
    const blocked = memberBlocked(user);
    if (blocked) return { ok: false, error: blocked };
    const membership = await requireGroupMember(user.id, opts.groupId);
    if (!membership) return { ok: false, error: "You're not in this group." };
    if (opts.userId === user.id) return { ok: false, error: "That's you!" };
    const rel = await requireFriend(user.id, opts.userId);
    if (!rel) return { ok: false, error: "You can only invite friends." };
    const [target] = await db.select().from(users).where(eq(users.id, opts.userId)).limit(1);
    if (!target || target.isGuest) return { ok: false, error: "That member can't join groups." };
    await db
      .insert(communityGroupMembers)
      .values({ groupId: opts.groupId, userId: opts.userId })
      .onConflictDoNothing();
    return { ok: true };
  });
}

export async function leaveGroupAction(groupId: string): Promise<{ ok: boolean; error?: string }> {
  return guard(async () => {
    const user = await getUser();
    if (!user) return { ok: false, error: authError() };
    await db
      .delete(communityGroupMembers)
      .where(and(eq(communityGroupMembers.groupId, groupId), eq(communityGroupMembers.userId, user.id)));
    // Owner leaving with nobody else around deletes the group shell.
    const [group] = await db.select().from(communityGroups).where(eq(communityGroups.id, groupId)).limit(1);
    if (group && group.ownerId === user.id) {
      const rest = await db.select().from(communityGroupMembers).where(eq(communityGroupMembers.groupId, groupId));
      if (!rest.length) {
        await db.delete(communityGroupMessages).where(eq(communityGroupMessages.groupId, groupId));
        await db.delete(communityGroups).where(eq(communityGroups.id, groupId));
      }
    }
    revalidatePath("/workspace");
    return { ok: true };
  });
}

export async function deleteGroupAction(groupId: string): Promise<{ ok: boolean; error?: string }> {
  return guard(async () => {
    const user = await getUser();
    if (!user) return { ok: false, error: authError() };
    const [group] = await db.select().from(communityGroups).where(eq(communityGroups.id, groupId)).limit(1);
    if (!group) return { ok: false, error: "Group not found." };
    if (group.ownerId !== user.id && !isAdminUser(user)) {
      return { ok: false, error: "Only the group owner can delete it." };
    }
    await db.delete(communityGroupMessages).where(eq(communityGroupMessages.groupId, groupId));
    await db.delete(communityGroupMembers).where(eq(communityGroupMembers.groupId, groupId));
    await db.delete(communityGroups).where(eq(communityGroups.id, groupId));
    revalidatePath("/workspace");
    return { ok: true };
  });
}

export async function getGroupMessagesAction(groupId: string) {
  return guard(async () => {
    const user = await getUser();
    if (!user) return { ok: false, error: authError() } as const;
    if (user.isGuest) return { ok: false, error: GUEST_MESSAGE } as const;
    const membership = await requireGroupMember(user.id, groupId);
    if (!membership) return { ok: false, error: "You're not in this group." } as const;
    const rows = await db
      .select()
      .from(communityGroupMessages)
      .where(eq(communityGroupMessages.groupId, groupId))
      .orderBy(asc(communityGroupMessages.createdAt))
      .limit(200);
    const senderIds = [...new Set(rows.map((m) => m.senderId))];
    const senders = senderIds.length ? await db.select().from(users).where(inArray(users.id, senderIds)) : [];
    const byId = new Map(senders.map((u) => [u.id, u]));
    return {
      ok: true,
      messages: rows.map((m) => ({
        id: m.id,
        mine: m.senderId === user.id,
        senderName: byId.get(m.senderId)?.name ?? "Former member",
        senderAvatar: byId.get(m.senderId)?.avatar ?? null,
        content: m.content,
        image: (m as { image?: string | null }).image ?? null,
        createdAt: m.createdAt.toISOString(),
      })),
    } as const;
  });
}

export async function sendGroupMessageAction(opts: {
  groupId: string;
  content: string;
  image?: string | null;
}): Promise<{ ok: boolean; error?: string }> {
  return guard(async () => {
    const user = await getUser();
    if (!user) return { ok: false, error: authError() };
    const blocked = memberBlocked(user);
    if (blocked) return { ok: false, error: blocked };
    if (user.muted) return { ok: false, error: "An admin has muted you in the community." };
    const membership = await requireGroupMember(user.id, opts.groupId);
    if (!membership) return { ok: false, error: "You're not in this group." };
    const text = opts.content.trim().slice(0, 1000);
    const imgErr = checkImage(opts.image);
    if (imgErr) return { ok: false, error: imgErr };
    if (!text && !opts.image) return { ok: false, error: "Write a message or attach an image first." };
    await db.insert(communityGroupMessages).values({ groupId: opts.groupId, senderId: user.id, content: text, image: opts.image ?? null });
    return { ok: true };
  });
}

/* ========================== SAMPLE CONTENT ========================== */