# Deploying Tawi Study to Vercel

Two things to set. Free tier the whole way, no credit card.

## 1. Free Postgres (required)

[Neon](https://neon.tech) is the pick: free forever, no card, doesn't sleep on the free plan.

1. Sign up, create a project.
2. On the dashboard, copy the **connection string**. It looks like:

   ```
   postgresql://user:password@ep-cool-name-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require
   ```

Alternatives that also work with zero code changes: **Supabase** (use the *Connection pooling* string, port 6543), **Vercel Postgres** (Storage tab — it injects `POSTGRES_URL` automatically, so you can skip step 2), Railway, or Render.

**No migration step.** The app runs `CREATE TABLE IF NOT EXISTS` for all 9 tables on its first request. Redeploys never touch existing data.

## 2. Deploy

```bash
cd STUDYAPP
git init && git add -A && git commit -m "Tawi Study"
gh repo create tia-study --private --source=. --push
```

Then on [vercel.com](https://vercel.com) → **Add New Project** → import the repo. Before clicking Deploy, open **Environment Variables** and add:

| Name | Value |
| --- | --- |
| `DATABASE_URL` | your Neon connection string |
| `SESSION_SECRET` | any long random string (`openssl rand -base64 32`) |
| `OCR_SPACE_API_KEY` | `K87138647588957` (free OCR for scanned PDFs/images) |
| `GEMINI_API_KEY` | your Gemini key (optional, for LLM-quality text) |
| `GROQ_API_KEY` | your Groq key (optional, fast Llama fallback) |

Deploy. Framework preset, build command and install command are all auto-detected — leave them alone.

Already deployed and forgot a variable? Add it under **Settings → Environment Variables**, then **Deployments → ⋯ → Redeploy**. Env vars are read at runtime, so a redeploy is all it takes.

## 3. AI text quality (optional)

The app is fully functional with no key. The built-in offline engine does sentence scoring, glossary detection and distractor synthesis to produce summaries, flashcards, study notes and MCQ/true-false/short questions.

Adding a free key upgrades that text from extracted-and-formatted to properly rewritten. First key found wins:

| Variable | Provider | Free tier |
| --- | --- | --- |
| `GEMINI_API_KEY` | [Google AI Studio](https://aistudio.google.com/apikey) | Generous, no card — **best pick** |
| `GROQ_API_KEY` | [Groq](https://console.groq.com/keys) | Free, very fast Llama models |
| `OPENROUTER_API_KEY` | [OpenRouter](https://openrouter.ai/keys) | Free models (`:free` suffix) |
| `OPENAI_API_KEY` | [OpenAI](https://platform.openai.com/api-keys) | Paid |

Override the model per provider with `GEMINI_MODEL`, `GROQ_MODEL`, `OPENROUTER_MODEL` or `OPENAI_MODEL`.

Every online call falls back to the offline engine on error, timeout or rate limit — a spent free tier degrades text quality, it never breaks a page.

## Running locally

```bash
cp .env.example .env      # paste your DATABASE_URL into it
npm install
npm run dev               # http://localhost:3000
```

A local Postgres works too — SSL is disabled automatically for `localhost` and `127.0.0.1`:

```
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/studyapp
```

## Checking it works

`GET /api/health` reports connection and engine status:

```json
{ "ok": true, "database": "connected", "host": "ep-....neon.tech/neondb",
  "ai": { "enabled": false, "engine": "Built-in offline engine" } }
```

Visiting the app with no `DATABASE_URL` set redirects to `/setup`, which shows the same three steps in-app rather than a stack trace.

## Troubleshooting

| Symptom | Cause and fix |
| --- | --- |
| Redirected to `/setup` | No `DATABASE_URL` in the environment. Add it, then redeploy. |
| "The database requires SSL" | Append `?sslmode=require` to the connection string. |
| "rejected those credentials" | Password rotated or truncated. Copy a fresh string from the provider. |
| "Could not reach the database host" | Typo in the hostname, or the project was deleted. |
| "timed out … waking from sleep" | Supabase free tier pausing. Retry; consider Neon instead. |

## Environment variable reference

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | Yes | Postgres connection string. `POSTGRES_URL`, `POSTGRES_URL_NON_POOLING`, `POSTGRES_PRISMA_URL`, `NEON_DATABASE_URL` and `SUPABASE_DB_URL` are accepted as fallbacks, in that order. |
| `SESSION_SECRET` | Recommended | Signs session cookies. Changing it logs everyone out. |
| `OCR_SPACE_API_KEY` | Optional | Free OCR for scanned PDFs and images (extracts text server-side). |
| `ADMIN_EMAILS` | Optional | Comma-separated emails that automatically become admin+pro. |
| `ADMIN_CODE` | Optional | Code users can enter on `/admin` to claim admin access. |
| `GEMINI_API_KEY` etc. | No | Enables online AI text. See the table above. |
| `DB_POOL_MAX` | No | Pool size, default 5. Suits serverless connection caps. |
| `APP_URL` | No | Sent as the referer on OpenRouter calls. |
