/* ------------------------------------------------------------------ */
/*  Shared quiz helpers — labels, parsing and grading for every        */
/*  question format, used by both the assignment player (auto-graded)  */
/*  and the kit Smart Study player (self-graded). Keeping the grader    */
/*  here means every format scores the same way everywhere.            */
/* ------------------------------------------------------------------ */

export type AnyQuestionType =
  | "mcq"
  | "true_false"
  | "modified_true_false"
  | "identification"
  | "short"
  | "essay"
  | "enumeration"
  | "ordering"
  | "multiple_response"
  | "fill_blank"
  | "matching"
  | string;

/** The canonical set of generated formats, in a stable order. */
export const QUESTION_TYPE_IDS = [
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

export type QuestionTypeId = (typeof QUESTION_TYPE_IDS)[number];

export const QUESTION_TYPE_LABELS: Record<string, string> = {
  mcq: "Multiple choice",
  true_false: "True / False",
  modified_true_false: "Modified True / False",
  identification: "Identification",
  short: "Short answer",
  essay: "Essay",
  enumeration: "Enumeration",
  ordering: "Ordering / Sequence",
  multiple_response: "Multiple response",
  fill_blank: "Fill in the blank",
  matching: "Matching",
};

/** One-line description shown on the type picker cards. */
export const QUESTION_TYPE_DESC: Record<string, string> = {
  mcq: "Four options, exactly one correct",
  true_false: "Judge whether a statement is true",
  modified_true_false: "Spot the false statement and correct it",
  identification: "Name the exact term from its meaning",
  short: "Answer in one or two sentences",
  essay: "Explain in depth — graded on key points",
  enumeration: "List every item of a set",
  ordering: "Arrange the steps / items in order",
  multiple_response: "Select every correct option (checkboxes)",
  fill_blank: "Complete the sentence with the missing term",
  matching: "Pair each term with its meaning",
};

/** The minimal shape the grader needs — both AssignmentQuestionRow and
 *  KitQuestionRow satisfy it. */
export interface GradableQuestion {
  type: AnyQuestionType;
  options: string[] | null;
  answer: string;
}

/** Short, human-friendly label for the type badge. */
export function questionTypeLabel(type: AnyQuestionType): string {
  return QUESTION_TYPE_LABELS[type] ?? "Question";
}

/** Normalise text for comparison: case-fold, strip punctuation, collapse space. */
export function normAnswer(s: string): string {
  return (s ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Very common words carry no meaning when judging a written answer. */
const ANSWER_STOPWORDS = new Set(
  "a an and are as at be been but by for from had has have in is it its of on or that the this to was were will with which you your not no do does did can could would should may might must into than then there their also when where who how why what".split(
    " "
  )
);

function keyTokens(s: string): string[] {
  return normAnswer(s)
    .split(" ")
    .filter((w) => w.length >= 4 && !ANSWER_STOPWORDS.has(w));
}

/** Tolerant short-answer check: exact match, substring either way, or a strong
 *  overlap of the correct answer's keywords. This stops a student who clearly
 *  knows the concept from being marked wrong over wording. */
function shortAnswerCorrect(correct: string, user: string): boolean {
  const a = normAnswer(correct);
  const u = normAnswer(user);
  if (!a || !u) return false;
  if (u === a) return true;
  if (u.length >= 4 && a.includes(u)) return true;
  if (a.length >= 4 && u.includes(a)) return true;
  const keys = keyTokens(correct);
  if (keys.length === 0) return false;
  const have = new Set(keyTokens(user));
  const hits = keys.filter((k) => have.has(k)).length;
  // Short answers (1–3 keywords) need them all; longer ones allow one miss.
  const need = keys.length <= 3 ? keys.length : Math.ceil(keys.length * 0.7);
  return hits >= need;
}

/** Parse "Term :: meaning" pairs (matching questions) from an options array or
 *  a "pair; pair" answer string. */
export function parseMatchPairs(
  source: string[] | string | null | undefined
): { term: string; meaning: string }[] {
  const parts = Array.isArray(source) ? source : (source ?? "").split(/;|\n/);
  return parts
    .map((raw) => {
      const o = String(raw);
      const i = o.indexOf("::");
      if (i === -1) return null;
      const term = o.slice(0, i).trim();
      const meaning = o.slice(i + 2).trim();
      return term && meaning ? { term, meaning } : null;
    })
    .filter((p): p is { term: string; meaning: string } => p !== null);
}

/* ------------------- multiple response & ordering -------------------- */

/** Split a "A | B | C" encoded list into its items (order preserved). */
export function splitList(s: string | null | undefined): string[] {
  return (s ?? "")
    .split(/\s*\|\s*|\s*;\s*/)
    .map((x) => x.trim())
    .filter(Boolean);
}

/** Encode a list of items as the stored "A | B | C" string. */
export function encodeList(items: string[]): string {
  return items.map((x) => x.trim()).filter(Boolean).join(" | ");
}

/** Correct choices of a multiple-response question (the `answer` string). */
export function multiResponseCorrect(q: GradableQuestion): string[] {
  return splitList(q.answer);
}

/** Grade a multiple-response answer: the chosen set must equal the correct set
 *  exactly (no missing, no extra). */
export function multiResponseScore(q: GradableQuestion, userAnswer: string): number {
  const correct = multiResponseCorrect(q).map(normAnswer);
  if (!correct.length) return 0;
  const chosen = splitList(userAnswer).map(normAnswer);
  const hit = correct.filter((c) => chosen.includes(c)).length;
  const extra = chosen.filter((c) => !correct.includes(c)).length;
  if (extra > 0) return 0;
  return hit / correct.length;
}

/** The correct sequence of an ordering question — from `options`, or the
 *  encoded answer as a fallback. */
export function orderingItems(q: GradableQuestion): string[] {
  if (q.options && q.options.length) return q.options.filter(Boolean);
  return splitList(q.answer);
}

/** Grade an ordering answer: every position must match the correct sequence. */
export function orderingScore(q: GradableQuestion, userAnswer: string): number {
  const correct = orderingItems(q);
  if (!correct.length) return 0;
  const chosen = splitList(userAnswer);
  if (chosen.length !== correct.length) return 0;
  const hit = correct.filter((c, i) => normAnswer(chosen[i]) === normAnswer(c)).length;
  return hit / correct.length;
}

/** The correct items of an enumeration — from `options`, or split out of the
 *  answer string as a fallback. */
export function enumerationItems(q: GradableQuestion): string[] {
  if (q.options && q.options.length) return q.options.filter(Boolean);
  return q.answer
    .split(/[,;\n]|\band\b/i)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** How many of the correct enumeration items the student named (0–1). Extra
 *  items are ignored; order does not matter. */
export function enumerationScore(q: GradableQuestion, userAnswer: string): number {
  const items = enumerationItems(q);
  if (!items.length) return 0;
  const got = normAnswer(userAnswer);
  const hit = items.filter((it) => {
    const n = normAnswer(it);
    return n.length > 0 && got.includes(n);
  }).length;
  return hit / items.length;
}

/** Essay: fraction of the model answer's key points the student covered. */
export function essayScore(q: GradableQuestion, userAnswer: string): number {
  const keys = keyTokens(q.answer);
  if (!keys.length) return normAnswer(userAnswer).length > 0 ? 1 : 0;
  const have = new Set(keyTokens(userAnswer));
  const hit = keys.filter((k) => have.has(k)).length;
  return hit / keys.length;
}

/** Grade any answer. Returns true/false for the auto-graded formats. */
export function gradeAnswer(q: GradableQuestion, userAnswer: string): boolean {
  const u = (userAnswer ?? "").trim();
  if (!u) return false;

  switch (q.type) {
    case "enumeration":
      return enumerationScore(q, u) >= 0.999;
    case "ordering":
      return orderingScore(q, u) >= 0.999;
    case "multiple_response":
      return multiResponseScore(q, u) >= 0.999;
    case "essay":
      // Partial credit: at least 40% of the model answer's key points.
      return essayScore(q, u) >= 0.4;
    case "matching": {
      const correct = parseMatchPairs(q.options);
      if (!correct.length) return false;
      const chosen = new Map(
        parseMatchPairs(u).map((p) => [normAnswer(p.term), normAnswer(p.meaning)])
      );
      return correct.every((p) => chosen.get(normAnswer(p.term)) === normAnswer(p.meaning));
    }
    case "fill_blank": {
      const a = normAnswer(q.answer);
      const nu = normAnswer(u);
      return !!a && (nu === a || nu.includes(a) || a.includes(nu));
    }
    case "identification":
    case "short":
      return shortAnswerCorrect(q.answer, u);
    default:
      // mcq, true_false, modified_true_false
      return normAnswer(u) === normAnswer(q.answer);
  }
}

/** Encode a matching selection (term → chosen meaning) into the stored answer
 *  string the grader expects. */
export function encodeMatchAnswer(pairs: { term: string; meaning: string }[]): string {
  return pairs
    .filter((p) => p.meaning)
    .map((p) => `${p.term} :: ${p.meaning}`)
    .join("; ");
}
