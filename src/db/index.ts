import { drizzle } from "drizzle-orm/node-postgres";
import { Pool, type PoolClient, type QueryResult } from "pg";

/* ------------------------------------------------------------------ *
 *  Database connection.
 *
 *  Design goals:
 *   1. NEVER throw at import time. Next.js imports this module while
 *      building pages, and Vercel builds run without a database
 *      attached. Throwing here breaks `next build` entirely.
 *   2. Accept the env var names used by every free Postgres host
 *      (Neon, Supabase, Vercel Postgres, Railway, Render) so the app
 *      works with whatever the provider injects.
 *   3. Enable SSL automatically for hosted databases — Neon/Supabase
 *      reject plaintext connections.
 *   4. Create its own tables on first query, so a brand-new free
 *      database works with zero migration commands after deploy.
 * ------------------------------------------------------------------ */

export const DB_URL_ENV_KEYS = [
  "DATABASE_URL",
  "POSTGRES_URL",
  "POSTGRES_URL_NON_POOLING",
  "POSTGRES_PRISMA_URL",
  "NEON_DATABASE_URL",
  "SUPABASE_DB_URL",
] as const;

export function resolveDatabaseUrl(): string | null {
  for (const key of DB_URL_ENV_KEYS) {
    const value = process.env[key]?.trim();
    if (value) return value;
  }
  return null;
}

export function isDatabaseConfigured(): boolean {
  return resolveDatabaseUrl() !== null;
}

/** Thrown when a page/action needs the DB but no URL is configured. */
export class DatabaseNotConfiguredError extends Error {
  constructor() {
    super(
      "No database connection string found. Set DATABASE_URL in your .env file (local) " +
        "or in Project Settings → Environment Variables (Vercel). " +
        "Create a free Postgres database at https://neon.tech and paste its connection string."
    );
    this.name = "DatabaseNotConfiguredError";
  }
}

function needsSsl(url: string): boolean {
  // Local databases don't use SSL; every hosted provider requires it.
  if (/sslmode=disable/i.test(url)) return false;
  return !/@(localhost|127\.0\.0\.1|\[::1\])[:/]/i.test(url);
}

/* --------------------------- schema bootstrap --------------------------- */
/*  Idempotent DDL. Runs once per process, before the first real query, so
 *  a fresh free-tier database needs no `drizzle-kit push` step.
 *  NOTE: each statement runs individually — Node's pg driver does NOT
 *  support multi-statement strings, so we loop through the array.       */

const BOOTSTRAP_STATEMENTS = [
  `CREATE EXTENSION IF NOT EXISTS pgcrypto`,

  `CREATE TABLE IF NOT EXISTS users (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email text UNIQUE NOT NULL,
    name text NOT NULL,
    password_hash text,
    role text,
    institution text,
    is_guest boolean NOT NULL DEFAULT false,
    is_admin boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin boolean NOT NULL DEFAULT false`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar text`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS settings jsonb`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS api_key text`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS bio text`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS course text`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS year_level text`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS banner text`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS appear_offline boolean NOT NULL DEFAULT false`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS last_seen timestamptz`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS muted boolean NOT NULL DEFAULT false`,
  `ALTER TABLE kits ADD COLUMN IF NOT EXISTS pinned boolean NOT NULL DEFAULT false`,

  `CREATE TABLE IF NOT EXISTS classes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,
    name text NOT NULL,
    color text NOT NULL DEFAULT '#B7E938',
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS kits (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,
    class_id uuid,
    title text NOT NULL,
    source_name text NOT NULL DEFAULT '',
    content text NOT NULL DEFAULT '',
    summary jsonb,
    notes jsonb,
    ai_enabled boolean NOT NULL DEFAULT false,
    pinned boolean NOT NULL DEFAULT false,
    share_token text NOT NULL UNIQUE,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS cards (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    kit_id uuid NOT NULL,
    term text NOT NULL,
    definition text NOT NULL,
    "order" integer NOT NULL DEFAULT 0
  )`,
  `CREATE TABLE IF NOT EXISTS kit_questions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    kit_id uuid NOT NULL,
    type text NOT NULL,
    question text NOT NULL,
    options jsonb,
    answer text NOT NULL,
    explanation text NOT NULL DEFAULT '',
    "order" integer NOT NULL DEFAULT 0
  )`,
  `CREATE TABLE IF NOT EXISTS assignments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,
    class_id uuid,
    title text NOT NULL,
    teacher_name text NOT NULL DEFAULT '',
    class_name text NOT NULL DEFAULT '',
    due_date text NOT NULL DEFAULT '',
    content text NOT NULL DEFAULT '',
    source_name text NOT NULL DEFAULT '',
    share_token text NOT NULL UNIQUE,
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS assignment_questions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    assignment_id uuid NOT NULL,
    type text NOT NULL,
    question text NOT NULL,
    options jsonb,
    answer text NOT NULL,
    explanation text NOT NULL DEFAULT '',
    "order" integer NOT NULL DEFAULT 0
  )`,
  `CREATE TABLE IF NOT EXISTS card_progress (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,
    card_id uuid NOT NULL,
    ease real NOT NULL DEFAULT 2.5,
    interval integer NOT NULL DEFAULT 0,
    reps integer NOT NULL DEFAULT 0,
    lapses integer NOT NULL DEFAULT 0,
    due_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS attempts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    assignment_id uuid NOT NULL,
    user_id uuid,
    name text NOT NULL DEFAULT '',
    score integer NOT NULL DEFAULT 0,
    total integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,
    title text NOT NULL,
    description text NOT NULL DEFAULT '',
    date text NOT NULL,
    color text NOT NULL DEFAULT '#B7E938',
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS tasks (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,
    title text NOT NULL,
    done boolean NOT NULL DEFAULT false,
    due text NOT NULL DEFAULT '',
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS documents (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,
    kind text NOT NULL DEFAULT 'note',
    title text NOT NULL DEFAULT 'Untitled',
    content text NOT NULL DEFAULT '',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS community_posts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,
    content text NOT NULL,
    pinned boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS community_reactions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id uuid NOT NULL,
    user_id uuid NOT NULL,
    emoji text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS community_reactions_post_user_idx ON community_reactions (post_id, user_id)`,
  `CREATE TABLE IF NOT EXISTS community_comments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id uuid NOT NULL,
    user_id uuid NOT NULL,
    content text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS friendships (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    requester_id uuid NOT NULL,
    addressee_id uuid NOT NULL,
    status text NOT NULL DEFAULT 'pending',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS friendships_pair_idx ON friendships (requester_id, addressee_id)`,
  `CREATE TABLE IF NOT EXISTS community_messages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id uuid NOT NULL,
    receiver_id uuid NOT NULL,
    content text NOT NULL,
    read boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS community_messages_pair_idx ON community_messages (sender_id, receiver_id)`,
  `CREATE INDEX IF NOT EXISTS kits_user_idx ON kits (user_id)`,
  `CREATE INDEX IF NOT EXISTS cards_kit_idx ON cards (kit_id)`,
  `CREATE INDEX IF NOT EXISTS kit_questions_kit_idx ON kit_questions (kit_id)`,
  `CREATE INDEX IF NOT EXISTS assignments_user_idx ON assignments (user_id)`,
  `CREATE INDEX IF NOT EXISTS assignment_questions_assignment_idx ON assignment_questions (assignment_id)`,
  `CREATE INDEX IF NOT EXISTS card_progress_user_card_idx ON card_progress (user_id, card_id)`,
  `CREATE INDEX IF NOT EXISTS attempts_assignment_idx ON attempts (assignment_id)`,
  `CREATE INDEX IF NOT EXISTS events_user_idx ON events (user_id)`,
  `CREATE INDEX IF NOT EXISTS tasks_user_idx ON tasks (user_id)`,
  `CREATE INDEX IF NOT EXISTS documents_user_idx ON documents (user_id)`,
  `CREATE INDEX IF NOT EXISTS community_posts_created_idx ON community_posts (created_at)`,
  `CREATE INDEX IF NOT EXISTS community_reactions_post_idx ON community_reactions (post_id)`,
  `CREATE INDEX IF NOT EXISTS community_comments_post_idx ON community_comments (post_id)`,
  `CREATE INDEX IF NOT EXISTS friendships_requester_idx ON friendships (requester_id)`,
  `CREATE INDEX IF NOT EXISTS friendships_addressee_idx ON friendships (addressee_id)`,
];

/* ----------------------------- lazy pool ----------------------------- */

type RawQuery = PoolClient["query"];

interface DbGlobal {
  __tiaPool?: Pool;
  __tiaReady?: Promise<void>;
}
const g = globalThis as typeof globalThis & DbGlobal;

function createPool(): Pool {
  const url = resolveDatabaseUrl();
  if (!url) throw new DatabaseNotConfiguredError();

  const pool = new Pool({
    connectionString: url,
    ssl: needsSsl(url) ? { rejectUnauthorized: false } : undefined,
    max: Number(process.env.DB_POOL_MAX ?? 5),
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 15_000,
    application_name: "tawi-study",
  });

  // Never let an idle-client error crash the server process.
  pool.on("error", (err) => {
    console.error("[db] idle client error:", err.message);
  });

  // Patch `query` so the schema is guaranteed to exist before the first
  // real statement runs. drizzle(node-postgres) funnels everything here.
  const rawQuery = pool.query.bind(pool) as RawQuery;

  const ensureReady = (): Promise<void> => {
    g.__tiaReady ??= (async () => {
      try {
        for (const stmt of BOOTSTRAP_STATEMENTS) {
          await Promise.race([
            (rawQuery as (sql: string) => Promise<QueryResult>)(stmt),
            new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error("DDL timeout")), 8000)
            ),
          ]);
        }
      } catch (err) {
        console.warn(
          "[db] schema bootstrap skipped:",
          err instanceof Error ? err.message : err
        );
      }
    })();
    return g.__tiaReady;
  };

  // Run bootstrap in the background — don't block normal queries.
  // If bootstrap fails, the /api/migrate endpoint handles it.
  ensureReady().catch(() => {});

  type AnyArgs = Parameters<RawQuery>;
  pool.query = (async (...args: AnyArgs) => {
    return (rawQuery as (...a: AnyArgs) => Promise<QueryResult>)(...args);
  }) as unknown as typeof pool.query;

  return pool;
}

function getPool(): Pool {
  g.__tiaPool ??= createPool();
  return g.__tiaPool;
}

type Database = ReturnType<typeof drizzle>;

let dbInstance: Database | null = null;

export function getDb(): Database {
  if (!dbInstance) dbInstance = drizzle(getPool());
  return dbInstance;
}

/**
 * Drizzle client. A Proxy so that merely importing this module — which
 * Next.js does at build time — never touches the network or throws.
 * The connection is opened on the first actual query.
 */
export const db = new Proxy({} as Database, {
  get(_target, prop, receiver) {
    const value = Reflect.get(getDb() as object, prop, receiver);
    return typeof value === "function" ? value.bind(getDb()) : value;
  },
}) as Database;

export function poolOrNull(): Pool | null {
  return isDatabaseConfigured() ? getPool() : null;
}

export async function rawQuery(sql: string, params?: unknown[]): Promise<QueryResult> {
  const pool = getPool();
  return pool.query(sql, params);
}
