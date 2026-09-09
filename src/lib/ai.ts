import type { GenQuestion } from "@/db/schema";
import {
  findRelatedSentences,
  makeCardsLocal,
  makeNotesLocal,
  makeQuestionsLocal,
  makeSummaryLocal,
  normalize,
  type LocalQuestion,
  type TermDef,
} from "./text";

/* ------------------------------------------------------------------ *
 *  Generation engine — two tiers, both fully functional.
 *
 *  ONLINE  If any free AI key is configured (Gemini, Groq, OpenRouter,
 *          or OpenAI), flashcards, questions, summaries, study notes
 *          and "Learn more" explanations are rewritten and properly
 *          formatted by an LLM — not copy-pasted source text.
 *
 *  OFFLINE With no key at all, a built-in NLP engine (glossary
 *          detection, keyword scoring, sentence ranking, distractor
 *          synthesis) produces every one of those artifacts locally.
 *          Nothing in the app is disabled.
 *
 *  Every online call falls back to the offline engine on error, bad
 *  JSON, rate-limit or timeout, so a dead free tier never breaks a page.
 * ------------------------------------------------------------------ */

type ProviderId = "gemini" | "groq" | "openrouter" | "openai";

interface Provider {
  id: ProviderId;
  label: string;
  keyEnv: string;
  modelEnv: string;
  defaultModel: string;
  free: boolean;
}

const PROVIDERS: Provider[] = [
  {
    id: "gemini",
    label: "Google Gemini",
    keyEnv: "GEMINI_API_KEY",
    modelEnv: "GEMINI_MODEL",
    defaultModel: "gemini-2.0-flash",
    free: true,
  },
  {
    id: "groq",
    label: "Groq",
    keyEnv: "GROQ_API_KEY",
    modelEnv: "GROQ_MODEL",
    defaultModel: "llama-3.3-70b-versatile",
    free: true,
  },
  {
    id: "openrouter",
    label: "OpenRouter",
    keyEnv: "OPENROUTER_API_KEY",
    modelEnv: "OPENROUTER_MODEL",
    defaultModel: "meta-llama/llama-3.3-70b-instruct:free",
    free: true,
  },
  {
    id: "openai",
    label: "OpenAI",
    keyEnv: "OPENAI_API_KEY",
    modelEnv: "OPENAI_MODEL",
    defaultModel: "gpt-4o-mini",
    free: false,
  },
];

function activeProvider(): { provider: Provider; key: string; model: string } | null {
  for (const provider of PROVIDERS) {
    const key = process.env[provider.keyEnv]?.trim();
    if (key) {
      return {
        provider,
        key,
        model: process.env[provider.modelEnv]?.trim() || provider.defaultModel,
      };
    }
  }
  return null;
}

export function aiAvailable(): boolean {
  return activeProvider() !== null;
}

/** Human-readable engine name for the UI badge. */
export function aiEngineLabel(): string {
  const active = activeProvider();
  return active ? `${active.provider.label} · ${active.model}` : "Built-in offline engine";
}

export type CardDraft = TermDef;
export interface SummaryDraft {
  overview: string;
  bullets: string[];
  keyTerms: { term: string; meaning: string }[];
}
export interface NotesDraft {
  sections: { heading: string; content: string }[];
}

const MAX_PROMPT_CHARS = 26000;
const TIMEOUT_MS = 90_000;

function clip(text: string): string {
  return normalize(text).slice(0, MAX_PROMPT_CHARS);
}

/* --------------------------- provider calls --------------------------- */

async function callGemini(
  key: string,
  model: string,
  system: string,
  user: string,
  json: boolean
): Promise<string> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      model
    )}:generateContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: "user", parts: [{ text: user }] }],
        generationConfig: {
          temperature: 0.4,
          maxOutputTokens: 4096,
          ...(json ? { responseMimeType: "application/json" } : {}),
        },
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    }
  );
  if (!res.ok) throw new Error(`Gemini error ${res.status}`);
  const data = await res.json();
  const text: string =
    data?.candidates?.[0]?.content?.parts
      ?.map((p: { text?: string }) => p?.text ?? "")
      .join("") ?? "";
  if (!text.trim()) throw new Error("Empty Gemini response");
  return text;
}

/** Groq, OpenRouter and OpenAI all speak the OpenAI chat-completions dialect. */
async function callOpenAICompatible(
  endpoint: string,
  key: string,
  model: string,
  system: string,
  user: string,
  json: boolean,
  extraHeaders: Record<string, string> = {}
): Promise<string> {
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
      ...extraHeaders,
    },
    body: JSON.stringify({
      model,
      temperature: 0.4,
      max_tokens: 4000,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      ...(json ? { response_format: { type: "json_object" } } : {}),
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`AI error ${res.status}`);
  const data = await res.json();
  const content: string = data?.choices?.[0]?.message?.content ?? "";
  if (!content.trim()) throw new Error("Empty AI response");
  return content;
}

async function callAI(system: string, user: string, json: boolean): Promise<string> {
  const active = activeProvider();
  if (!active) throw new Error("No AI provider configured");
  const { provider, key, model } = active;

  switch (provider.id) {
    case "gemini":
      return callGemini(key, model, system, user, json);
    case "groq":
      return callOpenAICompatible(
        "https://api.groq.com/openai/v1/chat/completions",
        key,
        model,
        system,
        user,
        json
      );
    case "openrouter":
      return callOpenAICompatible(
        "https://openrouter.ai/api/v1/chat/completions",
        key,
        model,
        system,
        user,
        json,
        {
          "HTTP-Referer": process.env.APP_URL ?? "https://localhost:3000",
          "X-Title": "Tawi Study",
        }
      );
    case "openai":
    default:
      return callOpenAICompatible(
        "https://api.openai.com/v1/chat/completions",
        key,
        model,
        system,
        user,
        json
      );
  }
}

function parseJson(content: string): unknown {
  const cleaned = content.replace(/```json/gi, "").replace(/```/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("No JSON object found");
  return JSON.parse(cleaned.slice(start, end + 1));
}

function warn(step: string, err: unknown): void {
  console.warn(
    `[ai] ${step} fell back to offline engine:`,
    err instanceof Error ? err.message : err
  );
}

/* ------------------------------ cards ----------------------------- */

const CARDS_SYSTEM = `You are Tawi, an award-winning AI study tutor turning raw material into an exam reviewer.
Rules:
- Read the material as the exact text first: preserve every important fact, number, name and step exactly as given.
- Each flashcard has a short "term" (1–6 words, a real exam keyword — never vague words like "Topic", "Reviewer", "Advantages", "Types" alone) and a "definition" that is one complete sentence (capitalized, ends with a period, at least 6 words).
- Cover step-by-step procedures, bullet lists (types, advantages, parts) — each step/bullet that names something gets its own card.
- Never invent facts. Base every card strictly on the provided material.
- Respond ONLY with a JSON object of the shape {"cards":[{"term":"...","definition":"..."}]}.`;

export async function generateCards(
  content: string,
  count: number
): Promise<CardDraft[]> {
  if (aiAvailable()) {
    try {
      const raw = await callAI(
        CARDS_SYSTEM,
        `Create exactly ${count} flashcards from this study material:\n\n${clip(content)}`,
        true
      );
      const parsed = parseJson(raw) as { cards?: { term?: string; definition?: string }[] };
      const cards = (parsed.cards ?? [])
        .map((c) => ({
          term: String(c.term ?? "").trim(),
          definition: String(c.definition ?? "").trim(),
        }))
        .filter((c) => c.term.length > 1 && c.definition.length > 5);
      if (cards.length >= Math.min(4, count)) return cards.slice(0, count);
      throw new Error(`only ${cards.length} usable cards returned`);
    } catch (err) {
      warn("generateCards", err);
    }
  }
  return makeCardsLocal(content, count);
}

/* ---------------------------- questions --------------------------- */

const QUESTIONS_SYSTEM = `You are Tawi, an expert study-tool generator for teachers and students. Create reviewer-style practice questions from the study material.
Rules:
- Read the exact text first, then test the keywords: every question must target a real term, step, number or distinction from the material (including step-by-step procedures and advantage/disadvantage bullets).
- Question types allowed: "mcq" (4 options, exactly one correct), "true_false" (answer "True" or "False"), "short" (answer is one complete sentence quoting or paraphrasing the material).
- Every question must include a clear "explanation" that teaches the concept in one or more complete sentences.
- Make questions feel natural — vary phrasing, never repeat the same question twice.
- If the teacher adds instructions, follow them exactly.
- Respond ONLY with a JSON object of the shape {"questions":[{"type":"...","question":"...","options":["..."],"answer":"...","explanation":"..."}]}.`;

export async function generateQuestions(
  content: string,
  opts: { count: number; types: string[]; instructions?: string }
): Promise<GenQuestion[]> {
  const { count, types, instructions } = opts;
  if (aiAvailable()) {
    try {
      const raw = await callAI(
        QUESTIONS_SYSTEM,
        `Create exactly ${count} questions.
Allowed types: ${types.length ? types.join(", ") : "mcq, true_false, short"}.
Teacher's additional instructions: ${instructions?.trim() || "none"}.
Study material:\n\n${clip(content)}`,
        true
      );
      const parsed = parseJson(raw) as { questions?: Partial<LocalQuestion>[] };
      const qs = (parsed.questions ?? [])
        .map((q) => ({
          type: (["mcq", "true_false", "short"].includes(String(q.type))
            ? q.type
            : "mcq") as GenQuestion["type"],
          question: String(q.question ?? "").trim(),
          options: Array.isArray(q.options) ? q.options.map(String) : [],
          answer: String(q.answer ?? "").trim(),
          explanation: String(q.explanation ?? "").trim(),
        }))
        .filter(
          (q) =>
            q.question.length > 8 &&
            q.answer.length > 0 &&
            (q.type !== "mcq" || q.options.length === 4)
        );
      if (qs.length >= Math.min(3, count)) return qs.slice(0, count);
      throw new Error(`only ${qs.length} usable questions returned`);
    } catch (err) {
      warn("generateQuestions", err);
    }
  }
  return makeQuestionsLocal(content, count, types, instructions ?? "");
}

/* ----------------------------- summary ---------------------------- */

const SUMMARY_SYSTEM = `You are Tawi, an AI study assistant making an exam reviewer. Read the exact text first, then pick keywords, then summarize.
Respond ONLY with JSON: {"overview":"3–5 sentence plain-text overview of the whole material","bullets":["8–12 concise revision bullets, each a complete thought, including steps and advantages where present"],"keyTerms":[{"term":"a real exam keyword (1–6 words, never vague words like Topic/Reviewer/Types alone)","meaning":"one complete sentence defining it"}]}.`;

export async function generateSummary(content: string): Promise<SummaryDraft> {
  if (aiAvailable()) {
    try {
      const raw = await callAI(
        SUMMARY_SYSTEM,
        `Summarize this study material:\n\n${clip(content)}`,
        true
      );
      const parsed = parseJson(raw) as Partial<SummaryDraft>;
      if (
        typeof parsed.overview === "string" &&
        parsed.overview.length > 20 &&
        Array.isArray(parsed.bullets)
      ) {
        return {
          overview: parsed.overview,
          bullets: parsed.bullets.map(String).filter(Boolean).slice(0, 12),
          keyTerms: (Array.isArray(parsed.keyTerms) ? parsed.keyTerms : [])
            .map((k) => ({
              term: String(k?.term ?? ""),
              meaning: String(k?.meaning ?? ""),
            }))
            .filter((k) => k.term && k.meaning)
            .slice(0, 10),
        };
      }
      throw new Error("summary JSON missing overview/bullets");
    } catch (err) {
      warn("generateSummary", err);
    }
  }
  return makeSummaryLocal(content);
}

/* ------------------------------ notes ----------------------------- */

const NOTES_SYSTEM = `You are Tawi, a study-note formatter turning material into an exam reviewer. Read the exact text first and keep it faithful.
Rules:
- Use markdown inside "content": "##" for sub-headings, "- " bullet lists and **bold** for key terms.
- Preserve EVERY important fact, definition, number, name and step exactly as given, including step-by-step procedures and advantage/disadvantage lists as bullets. Do not add outside information.
- Skip cover pages and page furniture; start from the real content.
- Group related ideas into logical sections (aim for 3–8 sections).
Respond ONLY with JSON: {"sections":[{"heading":"...","content":"markdown text"}]}.`;

export async function generateNotes(content: string): Promise<NotesDraft> {
  if (aiAvailable()) {
    try {
      const raw = await callAI(
        NOTES_SYSTEM,
        `Reformat this study material into clean study notes:\n\n${clip(content)}`,
        true
      );
      const parsed = parseJson(raw) as {
        sections?: { heading?: string; content?: string }[];
      };
      const sections = (parsed.sections ?? [])
        .map((s) => ({
          heading: String(s.heading ?? "").trim(),
          content: String(s.content ?? "").trim(),
        }))
        .filter((s) => s.content.length > 20);
      if (sections.length >= 2) return { sections: sections.slice(0, 10) };
      throw new Error(`only ${sections.length} usable sections returned`);
    } catch (err) {
      warn("generateNotes", err);
    }
  }
  return { sections: makeNotesLocal(content) };
}

/* ------------------------- exact-text cleanup ------------------------- */

const CLEANUP_SYSTEM = `You are Tawi, a precise document formatter. Clean up study material formatting for an "exact text" reviewer view.
ABSOLUTE RULES:
- Output EVERYTHING from the input. Never drop, shorten, summarize or skip any sentence, bullet, number or name. Completeness beats beauty.
- Fix broken spacing (words glued together or split by stray spaces/line breaks), collapse runs of blank lines to at most one, and put each bullet/step/numbered point on its own line starting with "- " or "1. " etc.
- Keep **bold** markers exactly where they are; if a "Term — definition" or "Term: definition" pair is recognizable, make sure it reads as "Term — definition" on one line.
- Plain text with markdown only (## headings, - bullets, **bold**). No commentary, no extra sections, no outside information.
Respond with the cleaned text ONLY — no JSON, no quotes, no preamble.`;

export async function cleanupExactText(content: string): Promise<{ text: string; ai: boolean }> {
  if (aiAvailable()) {
    try {
      const out = await callAI(
        CLEANUP_SYSTEM,
        `Clean this study material's formatting (keep every word):\n\n${clip(content)}`,
        false
      );
      const cleaned = out.replace(/```(text|markdown)?/gi, "").replace(/```/g, "").trim();
      // Safety: an AI that drops more than 30% of the characters is hallucinating brevity.
      if (cleaned.length > 20 && cleaned.length >= normalize(content).length * 0.7) {
        return { text: cleaned, ai: true };
      }
      throw new Error("AI cleanup dropped too much content");
    } catch (err) {
      warn("cleanupExactText", err);
    }
  }
  return { text: cleanupExactTextLocal(content), ai: false };
}

/** Conservative local pass: spacing and blank-line repair only, zero words lost. */
export function cleanupExactTextLocal(content: string): string {
  return normalize(content)
    .split("\n")
    .map((l) => l.replace(/[ \t]+/g, " ").trim())
    .join("\n")
    .replace(/([.!?:;])\s*\n(?=[a-z])/g, "$1 ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const EXPLAIN_SYSTEM = `You are Tawi, a patient, friendly study tutor. A student got this practice question. Explain the answer in depth, step by step, so the student genuinely understands the concept.
- Use markdown: a short heading, 2–4 short paragraphs or bullet lists, **bold** key terms.
- Tie the explanation back to the study material. Do not invent new facts.
- Keep it under 220 words and encouraging in tone.`;

export async function explainMore(
  question: string,
  answer: string,
  content: string
): Promise<string> {
  if (aiAvailable()) {
    try {
      return await callAI(
        EXPLAIN_SYSTEM,
        `Question: ${question}\nCorrect answer: ${answer}\n\nStudy material excerpt:\n${clip(
          content
        ).slice(0, 14000)}`,
        false
      );
    } catch (err) {
      warn("explainMore", err);
    }
  }
  const related = findRelatedSentences(content, `${question} ${answer}`, 3);
  return [
    `**Question:** ${question}`,
    `**Answer:** ${answer}`,
    "",
    "**Deeper explanation (from your material):**",
    ...related,
  ].join("\n");
}
