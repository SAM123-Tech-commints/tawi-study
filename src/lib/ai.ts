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
  /** Max characters of study material to send per request. Gemini has a huge
   *  context window and a generous free tier, so it can read the whole
   *  document; the rate-limited free tiers (Groq/OpenRouter) get less to avoid
   *  tokens-per-minute errors. */
  maxInputChars: number;
}

const PROVIDERS: Provider[] = [
  {
    id: "gemini",
    label: "Google Gemini",
    keyEnv: "GEMINI_API_KEY",
    modelEnv: "GEMINI_MODEL",
    defaultModel: "gemini-2.0-flash",
    free: true,
    maxInputChars: 200_000,
  },
  {
    id: "groq",
    label: "Groq",
    keyEnv: "GROQ_API_KEY",
    modelEnv: "GROQ_MODEL",
    defaultModel: "llama-3.3-70b-versatile",
    free: true,
    maxInputChars: 24_000,
  },
  {
    id: "openrouter",
    label: "OpenRouter",
    keyEnv: "OPENROUTER_API_KEY",
    modelEnv: "OPENROUTER_MODEL",
    defaultModel: "meta-llama/llama-3.3-70b-instruct:free",
    free: true,
    maxInputChars: 24_000,
  },
  {
    id: "openai",
    label: "OpenAI",
    keyEnv: "OPENAI_API_KEY",
    modelEnv: "OPENAI_MODEL",
    defaultModel: "gpt-4o-mini",
    free: false,
    maxInputChars: 90_000,
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

const TIMEOUT_MS = 90_000;
/** Fallback input budget when no provider is active (the offline engine
 *  ignores it, but keeps clip() total safe). */
const DEFAULT_MAX_INPUT = 26_000;

/** How much study material the active provider can read per request. */
function maxInputChars(): number {
  return activeProvider()?.provider.maxInputChars ?? DEFAULT_MAX_INPUT;
}

function clip(text: string): string {
  return normalize(text).slice(0, maxInputChars());
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

/* ------------------------------ vision ------------------------------ *
 * Gemini (and OpenAI) can READ images: exact text plus a study-friendly
 * description of diagrams, charts, tables and figures. Used for uploaded
 * images and for the image/diagram/scanned pages inside a PDF that plain
 * text extraction can't see. There is no offline fallback — vision needs a
 * real multimodal model — so callers treat "" as "nothing readable". */

export interface VisionImage {
  /** Base64 WITHOUT the leading data: prefix. */
  data: string;
  /** e.g. "image/png", "image/jpeg". */
  mime: string;
}

/** Vision runs on Gemini (preferred, generous free tier) or OpenAI; the
 *  text-only free tiers (Groq, OpenRouter llama) are skipped. */
function visionProvider(): { provider: Provider; key: string; model: string } | null {
  const gKey = process.env.GEMINI_API_KEY?.trim();
  if (gKey) {
    const p = PROVIDERS.find((x) => x.id === "gemini")!;
    return { provider: p, key: gKey, model: process.env.GEMINI_MODEL?.trim() || p.defaultModel };
  }
  const oKey = process.env.OPENAI_API_KEY?.trim();
  if (oKey) {
    const p = PROVIDERS.find((x) => x.id === "openai")!;
    return { provider: p, key: oKey, model: process.env.OPENAI_MODEL?.trim() || p.defaultModel };
  }
  return null;
}

export function visionAvailable(): boolean {
  return visionProvider() !== null;
}

const VISION_SYSTEM_FULL =
  "You read study material from an image for a student. First transcribe ALL text EXACTLY as it appears, preserving headings, bullet lists and numbering. Then, for any diagram, chart, table, figure or illustration, add a clearly-labelled description on its own line starting with 'Figure: ' that explains what it shows — every label, part, axis, arrow, value and relationship — so a student can study it without seeing the image. Never invent facts that are not visible. Output plain text only.";

const VISION_SYSTEM_FIGURES =
  "You are extracting the DIAGRAMS and FIGURES from one page of a document for a student; the body paragraphs have already been captured separately. For every diagram, chart, graph, table, map, illustration, or text that appears INSIDE an image on this page, write a clearly-labelled description on its own line starting with 'Figure: ', covering every label, part, axis, arrow, value and relationship, so a student can study it without seeing the image. Do NOT re-transcribe ordinary body paragraphs of page text. If the page has no meaningful figure, diagram or embedded image, reply with exactly 'NO_FIGURE'. Never invent content. Output plain text only.";

async function callGeminiVision(
  key: string,
  model: string,
  system: string,
  images: VisionImage[]
): Promise<string> {
  const parts: unknown[] = images.map((im) => ({
    inline_data: { mime_type: im.mime, data: im.data },
  }));
  parts.push({ text: "Read this image for study exactly as instructed." });
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      model
    )}:generateContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: "user", parts }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 4096 },
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    }
  );
  if (!res.ok) throw new Error(`Gemini vision ${res.status}`);
  const data = await res.json();
  const text: string =
    data?.candidates?.[0]?.content?.parts
      ?.map((p: { text?: string }) => p?.text ?? "")
      .join("") ?? "";
  return text.trim();
}

async function callOpenAIVision(
  key: string,
  model: string,
  system: string,
  images: VisionImage[]
): Promise<string> {
  const content: unknown[] = images.map((im) => ({
    type: "image_url",
    image_url: { url: `data:${im.mime};base64,${im.data}` },
  }));
  content.push({ type: "text", text: "Read this image for study exactly as instructed." });
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      max_tokens: 4000,
      messages: [
        { role: "system", content: system },
        { role: "user", content },
      ],
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`OpenAI vision ${res.status}`);
  const data = await res.json();
  return String(data?.choices?.[0]?.message?.content ?? "").trim();
}

/** Read one or more images for study. `mode: "full"` transcribes everything;
 *  `mode: "figures"` focuses on diagrams/figures for a PDF page whose body text
 *  is already captured. Returns "" when nothing readable or no vision provider. */
export async function readImageForStudy(
  images: VisionImage[],
  opts: { mode?: "full" | "figures" } = {}
): Promise<string> {
  const active = visionProvider();
  if (!active || !images.length) return "";
  const system = opts.mode === "figures" ? VISION_SYSTEM_FIGURES : VISION_SYSTEM_FULL;
  try {
    const out =
      active.provider.id === "gemini"
        ? await callGeminiVision(active.key, active.model, system, images)
        : await callOpenAIVision(active.key, active.model, system, images);
    if (/^\s*NO_FIGURE\s*$/i.test(out)) return "";
    return out;
  } catch (err) {
    warn("vision", err);
    return "";
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

const CARDS_SYSTEM = `You are Tawi, an award-winning AI study tutor. You turn a student's own material into an accurate flashcard deck for exam recall — as reliable as Quizlet or Knowt, but grounded strictly in THIS material.
How to read the material:
- Treat the text as the source of truth. **bold** and *italic* markers flag the exact key terms the source emphasised — turn (almost) every one of them into a flashcard.
- Also mine: glossary lines ("Term — definition", "Term: definition"), "X is/are/refers to/means…" sentences, definitions in parentheses, and every named item inside a list (types, parts, kinds, advantages, disadvantages, steps, principles, laws).
How to write each card:
- "term": the exact keyword as written in the material, 1–6 words. Never a vague label on its own ("Topic", "Reviewer", "Advantages", "Types", "Introduction", "Chapter").
- "definition": faithful to the material — quote it or paraphrase as closely as possible, NEVER invent or add outside facts. One complete sentence, capitalised, ends with a period, at least 6 words, and understandable on its own (restate the term instead of writing "it" or "this").
- For an enumeration ("The 3 types of X are A, B, C"), make one card for the whole set (term "Types of X", definition listing A, B and C) AND, where each item is itself defined, one card per item.
- Keep numbers, dates, formulas and names exactly as given.
- No duplicate terms. Cover the WHOLE document, not just the opening.
- Respond ONLY with a JSON object of the shape {"cards":[{"term":"...","definition":"..."}]}.`;

export async function generateCards(
  content: string,
  count: number
): Promise<CardDraft[]> {
  if (aiAvailable()) {
    try {
      const cards = await generateCardsAI(content, count);
      if (cards.length >= Math.min(4, count)) return cards.slice(0, count);
      throw new Error(`only ${cards.length} usable cards returned`);
    } catch (err) {
      warn("generateCards", err);
    }
  }
  return makeCardsLocal(content, count);
}

/** One flashcard call — `content` is already clipped/partitioned by the caller. */
async function cardsCall(content: string, count: number): Promise<CardDraft[]> {
  const raw = await callAI(
    CARDS_SYSTEM,
    `Create up to ${count} flashcards from this study material. Prioritise the **bold**/*italic* key terms and every defined term, and keep each definition faithful to the wording below (do not invent facts):\n\n${content}`,
    true
  );
  const parsed = parseJson(raw) as { cards?: { term?: string; definition?: string }[] };
  return (parsed.cards ?? [])
    .map((c) => ({
      term: String(c.term ?? "").trim(),
      definition: String(c.definition ?? "").trim(),
    }))
    .filter((c) => c.term.length > 1 && c.definition.length > 5);
}

/** Generate many cards WITHOUT hitting the output-token cap: for large counts
 *  we partition the material into sections and draw cards from each, so the set
 *  covers the WHOLE document (not just its opening) and the JSON never truncates. */
async function generateCardsAI(content: string, count: number): Promise<CardDraft[]> {
  const clipped = clip(content);
  const PER_CALL = 22; // keeps each JSON response safely under the token cap
  const batches = Math.min(6, Math.max(1, Math.ceil(count / PER_CALL)));
  if (batches <= 1) return cardsCall(clipped, count);

  const parts = chunkText(clipped, Math.ceil(clipped.length / batches));
  const per = Math.ceil(count / parts.length);
  const all: CardDraft[] = [];
  const seen = new Set<string>();
  for (const part of parts) {
    try {
      for (const c of await cardsCall(part, per)) {
        const key = c.term.toLowerCase();
        if (!seen.has(key)) {
          seen.add(key);
          all.push(c);
        }
      }
    } catch (err) {
      warn("generateCards(batch)", err);
    }
  }
  return all;
}

/* ---------------------------- questions --------------------------- */

const QUESTION_TYPES = [
  "mcq",
  "true_false",
  "modified_true_false",
  "identification",
  "short",
  "essay",
  "enumeration",
  "ordering",
  "multiple_response",
  "fill_blank",
  "matching",
] as const;

const QUESTIONS_SYSTEM = `You are Tawi, an expert study-tool generator for teachers and students. Create reviewer-style practice questions from the study material for genuine active recall.
Read the exact text first, then test the keywords: every question must target a real term, definition, step, number, enumeration or distinction from the material. Never invent facts that are not in the material.

Question types and their EXACT JSON shape:
- "mcq": a question with 4 options, exactly one correct. "options" = the 4 choices, "answer" = the exact text of the correct option.
- "true_false": a statement to judge. "options" = [], "answer" = "True" or "False".
- "modified_true_false": a statement whose underlining/detail may be wrong. "options" = [] when the statement is TRUE, or an array with the one corrected sentence when the statement is FALSE, "answer" = "True" or "False".
- "identification": give the meaning and ask for the exact term. "question" = "Identify the exact term that matches this meaning: …", "options" = [], "answer" = the term exactly as named in the material.
- "short": a recall question. "options" = [], "answer" = one complete sentence quoting or closely paraphrasing the material.
- "essay": an open question asking the student to explain a concept in depth. "options" = [], "answer" = a model answer of 2–5 complete sentences covering the key points.
- "enumeration": asks the student to list every item of a set ("List the 4 layers of…", "Name the parts of…"). "options" = the array of correct items (one item per entry, exactly as named in the material), "answer" = those items joined with ", ".
- "ordering": ask the student to arrange a set of steps/items in the correct sequence. "options" = the items IN THE CORRECT ORDER, "answer" = those items joined with " | ".
- "multiple_response": a "select all that apply" question with 2–4 correct choices among 5–6 options. "options" = all choices (correct + distractors), "answer" = ONLY the correct choices joined with " | ".
- "fill_blank": one sentence taken from the material with a single blank written as "_____". "question" = the sentence containing "_____", "options" = [] (or 3–5 word-bank choices if it helps), "answer" = the exact word or short phrase that fills the blank.
- "matching": match terms to their meanings. "options" = an array of "Term :: meaning" pairs (2–5 pairs, ALWAYS separated by " :: "), "answer" = the same pairs joined with "; ".

Rules:
- Use ONLY the question types the request allows. When more than one type is allowed, you MUST use each of them (at least one question per allowed type whenever the count permits), spreading the questions as evenly as you can.
- For memorising terms, definitions and enumerations, favour "enumeration", "fill_blank" and "matching".
- Every question needs a clear "explanation" that teaches the concept in one or more complete sentences.
- Prefer the emphasised (**bold**/*italic*) and defined terms. Keep numbers, names, formulas and definitions faithful to the source.
- Vary phrasing; never repeat the same question twice.
- If the teacher adds instructions, follow them exactly.
- Respond ONLY with a JSON object of the shape {"questions":[{"type":"...","question":"...","options":["..."],"answer":"...","explanation":"..."}]}.`;

export async function generateQuestions(
  content: string,
  opts: { count: number; types: string[]; instructions?: string }
): Promise<GenQuestion[]> {
  const { count, types, instructions } = opts;
  if (aiAvailable()) {
    try {
      const qs = await generateQuestionsAI(content, count, types, instructions ?? "");
      if (qs.length >= Math.min(3, count)) return qs.slice(0, count);
      throw new Error(`only ${qs.length} usable questions returned`);
    } catch (err) {
      warn("generateQuestions", err);
    }
  }
  return makeQuestionsLocal(content, count, types, instructions ?? "");
}

/** Per-type shape check so a malformed question never reaches the deck. */
function validQuestion(q: GenQuestion): boolean {
  if (q.question.length < 6) return false;
  switch (q.type) {
    case "mcq":
      return q.options.length === 4 && q.answer.length > 0;
    case "true_false":
      return /^(true|false)$/i.test(q.answer);
    case "modified_true_false":
      return /^(true|false)$/i.test(q.answer);
    case "identification":
      return q.answer.length > 0;
    case "short":
      return q.answer.length > 0;
    case "essay":
      return q.answer.length > 0;
    case "enumeration":
      return q.options.length >= 2;
    case "ordering":
      return q.options.length >= 3;
    case "multiple_response":
      return q.options.length >= 3 && q.answer.includes("|");
    case "fill_blank":
      return q.answer.length > 0;
    case "matching":
      return q.options.filter((o) => o.includes("::")).length >= 2;
    default:
      return false;
  }
}

/** One question call — `content` is already clipped/partitioned by the caller. */
async function questionsCall(
  content: string,
  count: number,
  types: string[],
  instructions: string
): Promise<GenQuestion[]> {
  const raw = await callAI(
    QUESTIONS_SYSTEM,
    `Create exactly ${count} questions.
Allowed types: ${types.length ? types.join(", ") : QUESTION_TYPES.join(", ")}.
Teacher's additional instructions: ${instructions.trim() || "none"}.
Study material:\n\n${content}`,
    true
  );
  const parsed = parseJson(raw) as { questions?: Partial<LocalQuestion>[] };
  const allowed = new Set<string>(QUESTION_TYPES);
  return (parsed.questions ?? [])
    .map((q) => {
      const type = (allowed.has(String(q.type)) ? q.type : "mcq") as GenQuestion["type"];
      const options = Array.isArray(q.options)
        ? q.options.map((o) => String(o).trim()).filter(Boolean)
        : [];
      let question = String(q.question ?? "").trim();
      const answer = String(q.answer ?? "").trim();
      // Fill-in-the-blank: guarantee a visible blank even if the model forgot
      // one — hide the answer phrase inside the sentence.
      if (type === "fill_blank" && answer && !/_{2,}/.test(question)) {
        const re = new RegExp(answer.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
        question = re.test(question) ? question.replace(re, "_____") : `${question} _____`;
      }
      return {
        type,
        question,
        options,
        answer,
        explanation: String(q.explanation ?? "").trim(),
      };
    })
    .filter(validQuestion);
}

/** Generate many questions WITHOUT truncating the JSON: partition the material
 *  into sections for large counts so questions span the WHOLE document and each
 *  response stays under the output-token cap. De-dupes near-identical prompts. */
async function generateQuestionsAI(
  content: string,
  count: number,
  types: string[],
  instructions: string
): Promise<GenQuestion[]> {
  const clipped = clip(content);
  const PER_CALL = 14; // questions carry options + explanations, so batch smaller
  const batches = Math.min(6, Math.max(1, Math.ceil(count / PER_CALL)));
  if (batches <= 1) return questionsCall(clipped, count, types, instructions);

  const parts = chunkText(clipped, Math.ceil(clipped.length / batches));
  const per = Math.ceil(count / parts.length);
  const all: GenQuestion[] = [];
  const seen = new Set<string>();
  for (const part of parts) {
    try {
      for (const q of await questionsCall(part, per, types, instructions)) {
        const key = q.question.toLowerCase().replace(/\s+/g, " ").trim();
        if (!seen.has(key)) {
          seen.add(key);
          all.push(q);
        }
      }
    } catch (err) {
      warn("generateQuestions(batch)", err);
    }
  }
  return all;
}

/* ----------------------------- summary ---------------------------- */

const SUMMARY_SYSTEM = `You are Tawi, an AI study assistant that condenses a student's material into a trustworthy exam reviewer. Read the whole text, respect its emphasis (**bold**/*italic* mark the key terms), and stay strictly faithful — never add facts that are not in the material.
Produce three things:
- "overview": 3–5 plain sentences capturing what the material is about and its main takeaways, in the same order the material presents them.
- "bullets": 8–14 concise revision points, each a complete standalone thought. Cover the important definitions, every enumerated list (types/parts/advantages/steps), key numbers and distinctions. Do not merely repeat the overview.
- "keyTerms": the real exam keywords (favour the emphasised/defined ones), each 1–6 words — never a vague label like Topic/Reviewer/Types alone — paired with a one-sentence definition taken faithfully from the material.
Respond ONLY with JSON: {"overview":"...","bullets":["..."],"keyTerms":[{"term":"...","meaning":"..."}]}.`;

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

const NOTES_SYSTEM = `You are Tawi, a study-note formatter that reshapes a student's material into a clean, exam-ready study guide — faithful to the source, never inventing information.
Rules:
- Organise the material into logical sections (aim for 3–8) that follow the document's own order. Give each a short, descriptive "heading".
- In "content", use markdown: "## " sub-headings, "- " bullet lists for every enumeration (types, parts, steps, advantages/disadvantages), and **bold** on every key term the FIRST time it appears — especially terms the source emphasised.
- When the material defines a term, keep the definition next to the bolded term ("**Term** — its definition…") so the keyword and its meaning read together.
- Preserve every important fact, definition, number, name and step exactly as given. Do not add outside information or commentary.
- Skip cover pages, page numbers and other furniture; start from the real content.
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

const CLEANUP_SYSTEM = `You are Tawi, a precise document formatter. Recover the clean, faithful "exact text" of a study document from messy extracted text.
ABSOLUTE RULES:
- Preserve EVERY word, number, name, date, formula and bullet exactly. NEVER summarize, paraphrase, shorten, reorder or omit anything. If a word is garbled, keep the closest readable form rather than dropping it.
- Fix extraction damage only: glue words that were split by stray spaces ("pho tosynthesis" → "photosynthesis"), split words that were glued ("OperatingSystems" → "Operating Systems"), repair hyphenation across line breaks ("photo- synthesis" → "photosynthesis"), and collapse runs of blank lines to a single blank line.
- Rebuild structure: a heading stays its own line; every bullet/step/numbered point starts its own line with "- " or its original "1." / "a)" marker; a "Term — definition" or "Term: definition" pair stays on one line.
- Preserve and place emphasis markers where the source had them: **bold** for bold text, *italic* for italic text. If a term and its definition are recognizable, bold the term.
- Plain text with markdown only (## headings, - bullets, **bold**, *italic*). No commentary, no headings you invented, no extra sections, no outside information.
Respond with the cleaned text ONLY — no JSON, no quotes, no preamble.`;

/** Fraction of the source's word tokens that survive in the output (0–1).
 *  Case, spacing and added markdown markers are ignored, so only genuine word
 *  loss counts. This catches an AI that summarizes or paraphrases even when it
 *  keeps the character count up by adding "##", "-" and "**". */
function wordRetention(source: string, output: string): number {
  const tokenize = (s: string) => s.toLowerCase().match(/[a-z0-9]+/g) ?? [];
  const src = tokenize(source);
  if (!src.length) return 1;
  const have = new Map<string, number>();
  for (const w of tokenize(output)) have.set(w, (have.get(w) ?? 0) + 1);
  let kept = 0;
  for (const w of src) {
    const n = have.get(w) ?? 0;
    if (n > 0) {
      kept++;
      have.set(w, n - 1);
    }
  }
  return kept / src.length;
}

/** Split text into chunks no larger than `size`, preferring paragraph then
 *  line then word boundaries so we never cut a word in half. Guarantees the
 *  whole document is covered (nothing is dropped). */
function chunkText(text: string, size: number): string[] {
  if (text.length <= size) return [text];
  const paras = text.split(/\n{2,}/);
  const chunks: string[] = [];
  let cur = "";
  const push = () => {
    if (cur.trim()) chunks.push(cur.trim());
    cur = "";
  };
  for (const p of paras) {
    if (p.length > size) {
      push();
      let rest = p;
      while (rest.length > size) {
        let cut = rest.lastIndexOf("\n", size);
        if (cut < size * 0.5) cut = rest.lastIndexOf(" ", size);
        if (cut < size * 0.5) cut = size;
        chunks.push(rest.slice(0, cut).trim());
        rest = rest.slice(cut);
      }
      cur = rest;
      continue;
    }
    if (cur.length + p.length + 2 > size) push();
    cur = cur ? cur + "\n\n" + p : p;
  }
  push();
  return chunks;
}

/** Clean one chunk with the AI, falling back to the lossless local pass for
 *  that chunk if the model drops/changes too many words. */
async function cleanupChunk(chunk: string): Promise<{ text: string; ai: boolean }> {
  try {
    const out = await callAI(
      CLEANUP_SYSTEM,
      `Restore the faithful exact text of this study material (keep every single word):\n\n${chunk}`,
      false
    );
    const cleaned = out.replace(/```(text|markdown)?/gi, "").replace(/```/g, "").trim();
    if (cleaned.length > 20 && wordRetention(chunk, cleaned) >= 0.9) {
      return { text: cleaned, ai: true };
    }
  } catch (err) {
    warn("cleanupExactText(chunk)", err);
  }
  return { text: cleanupExactTextLocal(chunk), ai: false };
}

export async function cleanupExactText(content: string): Promise<{ text: string; ai: boolean }> {
  const source = normalize(content);
  if (aiAvailable()) {
    try {
      // The model's OUTPUT is capped (~4k tokens), and cleanup returns roughly
      // as much text as it's given — so chunk by output capacity (~9k chars),
      // not by the (much larger) input window. This lets us clean the WHOLE
      // document across several calls instead of only its first slice.
      const chunks = chunkText(source, 9000);
      const MAX_AI_CHUNKS = 8; // bound round-trips; overflow is cleaned locally
      const parts: string[] = [];
      let anyAi = false;
      for (let i = 0; i < chunks.length; i++) {
        if (i >= MAX_AI_CHUNKS) {
          parts.push(cleanupExactTextLocal(chunks[i]));
          continue;
        }
        const piece = await cleanupChunk(chunks[i]);
        parts.push(piece.text);
        anyAi = anyAi || piece.ai;
      }
      const joined = parts.join("\n\n").replace(/\n{3,}/g, "\n\n").trim();
      // Whole-document fidelity: every source word must survive.
      if (joined.length > 20 && wordRetention(source, joined) >= 0.9) {
        return { text: joined, ai: anyAi };
      }
      throw new Error("AI cleanup dropped or changed too many words");
    } catch (err) {
      warn("cleanupExactText", err);
    }
  }
  return { text: cleanupExactTextLocal(source), ai: false };
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
