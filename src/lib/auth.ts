import { createHmac } from "crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { db, isDatabaseConfigured } from "@/db";
import { users, type User } from "@/db/schema";
import { eq } from "drizzle-orm";

const SECRET = process.env.SESSION_SECRET ?? "tawi-study-dev-secret";
const COOKIE = "tawi_session";

function sign(userId: string): string {
  return createHmac("sha256", SECRET).update(userId).digest("base64url");
}

export async function setSession(userId: string) {
  const store = await cookies();
  store.set(COOKIE, `${userId}.${sign(userId)}`, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function clearSession() {
  const store = await cookies();
  store.delete(COOKIE);
}

export async function getUser(): Promise<User | null> {
  if (!isDatabaseConfigured()) return null;
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (!token) return null;
  const [userId, sig] = token.split(".");
  if (!userId || !sig || sig !== sign(userId)) return null;
  try {
    const rows = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    return rows[0] ?? null;
  } catch (err) {
    // A transient database hiccup must not hard-crash every page — treat it
    // as "signed out" and let the UI surface the connection error instead.
    console.error(
      "[auth] session lookup failed:",
      err instanceof Error ? err.message : err
    );
    return null;
  }
}

export async function requireUser(): Promise<User> {
  // Send people to the setup guide rather than a stack trace when the
  // deployment has no database attached yet.
  if (!isDatabaseConfigured()) redirect("/setup");
  const user = await getUser();
  if (!user) redirect("/signin");
  return user;
}

export function hashPassword(pw: string): Promise<string> {
  return bcrypt.hash(pw, 10);
}

export function verifyPassword(pw: string, hash: string): Promise<boolean> {
  return bcrypt.compare(pw, hash);
}
