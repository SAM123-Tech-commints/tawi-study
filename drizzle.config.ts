import { defineConfig } from "drizzle-kit";
import { config } from "dotenv";

// Load .env / .env.local so `npx drizzle-kit push` works from the terminal.
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });

const url =
  process.env.DATABASE_URL ??
  process.env.POSTGRES_URL ??
  process.env.POSTGRES_URL_NON_POOLING ??
  process.env.NEON_DATABASE_URL ??
  "";

if (!url) {
  throw new Error(
    "DATABASE_URL is not set. Copy .env.example to .env and paste your free Neon " +
      "connection string (https://neon.tech) before running drizzle-kit."
  );
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: { url, ssl: /localhost|127\.0\.0\.1/.test(url) ? false : "require" },
  strict: true,
  verbose: true,
});
