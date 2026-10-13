/* ------------------------------------------------------------------ */
/*  Shared quiz helpers — labels, parsing and grading for every        */
/*  question format, used by both the assignment player (auto-graded)  */
/*  and the kit Smart Study player (self-graded). Keeping the grader    */
/*  here means "matching" and "enumeration" score the same way          */
/*  everywhere.                                                          */
/* ------------------------------------------------------------------ */

export type AnyQuestionType =
  | "mcq"
  | "true_false"
  | "short"
  | "enumeration"
  | "fill_blank"
  | "matching"
  | string;

/** The minimal shape the grader needs — both AssignmentQuestionRow and
 *  KitQuestionRow satisfy it. */
export interface GradableQuestion {
  type: AnyQuestionType;
  options: string[] | null;
  answer: string;
}

/** Short, human-friendly label for the type badge. */
export function questionTypeLabel(type: AnyQuestionType): string {
  switch (type) {
    case "mcq":
      return "Multiple choice";
    case "true_false":
      return "True / False";
    case "short":
      return "Short answer";
    case "enumeration":
      return "Enumeration";
    case "fill_blank":
      return "Fill in the blank";
    case "matching":
      return "Matching";
    default:
      return "Question";
  }
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

/** Grade any answer. For enumeration, all items must be named; for matching,
 *  every pair must be correct. */
export function gradeAnswer(q: GradableQuestion, userAnswer: string): boolean {
  const u = (userAnswer ?? "").trim();
  if (!u) return false;

  switch (q.type) {
    case "enumeration":
      return enumerationScore(q, u) >= 0.999;
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
    case "short":
      return shortAnswerCorrect(q.answer, u);
    default:
      // mcq, true_false
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
