import { NextResponse } from "next/server";
import { rawQuery } from "@/db";

export async function GET() {
  const results: string[] = [];
  const statements = [
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
  ];

  for (const stmt of statements) {
    try {
      await rawQuery(stmt);
      const short = stmt.substring(0, 50).replace(/\s+/g, " ").trim();
      results.push(`OK  ${short}...`);
    } catch (err) {
      const short = stmt.substring(0, 50).replace(/\s+/g, " ").trim();
      results.push(`ERR ${short} — ${err instanceof Error ? err.message : err}`);
    }
  }

  return NextResponse.json({ ok: true, results });
}
