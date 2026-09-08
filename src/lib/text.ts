/* ------------------------------------------------------------------ */
/*  Local NLP engine — powers card / question / summary generation    */
/*  when no LLM API key is configured. Used on server AND client.     */
/* ------------------------------------------------------------------ */

export function normalize(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/* Cover pages, running heads and page furniture carry no meaning — "Page 1
 * DSA Reviewer", "1/1", a lone "2025". Strip them before anything else so the
 * AI reviews the material, not the margins. */
const BOILERPLATE_LINE =
  /^(page\s+\d+(\s+of\s+\d+)?|p\.\s*\d+|\d+\s*\/\s*\d+|\d{4}([–-]\d{4})?|figure\s+\d+(\.\d+)*|fig\.\s*\d+|table\s+\d+(\.\d+)*|slide\s+\d+(\s+of\s+\d+)?)\s*([.·•\-–—:].*)?$/i;

export function stripBoilerplate(text: string): string {
  const lines = normalize(text).split("\n");
  const kept = lines.filter((line) => {
    const t = line.trim().replace(/^[#\-•*▪‣\d+.)\s]+/, "").trim();
    if (!t) return false;
    if (BOILERPLATE_LINE.test(t)) return false;
    // A lone fragment under 3 words with no verb is furniture, not content.
    if (t.split(/\s+/).length < 3 && !/[.!?:;]$/.test(t) && t.length < 40) {
      if (/^(lesson|chapter|unit|module|week|day|part|section|topic|page)\b/i.test(t)) return false;
    }
    return true;
  });
  return kept.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

export function splitSentences(text: string): string[] {
  const pre = normalize(text)
    // Step-by-step lines glued together ("…memory. 2. Array Index — …") split apart.
    .replace(/(\S)\s+(\d{1,3}[.)]\s+[A-Z*"'])/g, "$1\n$2")
    .replace(/[ \t]+[•▪‣·]/g, "\n• ");
  const parts = pre.split(/\n+/);
  const out: string[] = [];
  for (const line of parts) {
    const pieces = line
      .replace(/^#{1,6}\s+/, "")
      .split(/(?<=[.!?])\s+(?=[A-Z"'(])/)
      .map((s) => s.trim().replace(/^[-•*▪‣>\s]+/, "").replace(/^\d{1,3}[.)]\s+/, ""))
      .filter((s) => s.length >= 20);
    out.push(...pieces);
  }
  return out;
}

export function splitParagraphs(text: string): string[] {
  return normalize(text)
    .split(/\n+/)
    .map((p) => p.trim())
    .filter((p) => p.length >= 30);
}

export const STOPWORDS = new Set(
  "a an and are as at be been but by for from had has have in is it its of on or that the this to was were will with which you your not no i we they he she them than then there their also can could would should may might must do does did".split(
    " "
  )
);

export function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9'’\- ]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

export function contentWords(s: string): string[] {
  return tokenize(s).filter(
    (w) => w.length >= 3 && !STOPWORDS.has(w) && !/^\d+$/.test(w)
  );
}

export function wordFreq(text: string): Map<string, number> {
  const m = new Map<string, number>();
  for (const w of contentWords(text)) m.set(w, (m.get(w) ?? 0) + 1);
  return m;
}

export function sentenceScore(sentence: string, freq: Map<string, number>): number {
  const words = contentWords(sentence);
  if (!words.length) return 0;
  const score = words.reduce((acc, w) => acc + (freq.get(w) ?? 0), 0);
  const uniq = new Set(words).size;
  return score / words.length + uniq * 0.12 - Math.max(0, words.length - 26) * 0.02;
}

export function topSentences(text: string, n: number): string[] {
  const freq = wordFreq(text);
  const sents = splitSentences(text);
  const scored = sents.map((s, i) => ({
    s,
    score: sentenceScore(s, freq) + (i < 3 ? 0.6 : 0),
  }));
  scored.sort((a, b) => b.score - a.score);
  const picked = new Set(scored.slice(0, Math.min(n, scored.length)).map((x) => x.s));
  return sents.filter((s) => picked.has(s));
}

export interface TermDef {
  term: string;
  definition: string;
}

/* Words that are never a real term on their own. "There are three delivery
 * options" would otherwise yield the flashcard term "There". */
const PRONOUN_TERMS = new Set(
  "there this that these those it its they them he she we you i one ones some other others each both such most many few all any here what who how why when where thus hence so then also however but and or if because while during after before".split(
    " "
  )
);

/* Verbs that surface as high-frequency "terms" but name an action, not a
 * concept. A flashcard front of "States" or "Provides" tests nothing. */
const COMMON_VERBS = new Set(
  ("states state includes include including consists consist contains contain provides provide " +
    "describes describe means meaning refers refer allows allow uses use used using makes make " +
    "gets get gives give takes take shows show works work happens happen occurs occur becomes " +
    "become begins begin ends end sends send receives receive carries carry adds add labels label " +
    "breaks break splits split forms form applies apply exempted entrenched circulated reversed " +
    "brought driven drawn layered introduced prepares prepare copies copy grows grow divided " +
    "reassembled formatted reported designed known called defined").split(" ")
);

/* Document furniture: "Lesson 2", "Chapter 4", "Figure 1.3", "Week 5". */
const STRUCTURAL_LABEL =
  /^(lesson|chapter|unit|module|week|day|part|section|figure|fig|table|page|topic|example|note|notes|activity|exercise|exercises|assignment|reference|references|objective|objectives|outline|agenda|introduction|conclusion|summary|overview|appendix|slide)s?\b[\s.:#-]*\d*(\.\d+)*$/i;

/** Sentence openers that dangle without the sentence before them. */
function isDanglingOpener(s: string): boolean {
  return /^\s*(they|it|its|this|that|these|those|he|she|there|instead|basically|also|however|but|so|then|thus|hence|therefore|other|others|another|each|both|such|which|who|meanwhile|finally|second|secondly|third|thirdly|fourth|next|likewise|similarly|conversely|in addition|in contrast|for example|for instance|e\.g\.|i\.e\.|furthermore|moreover|on the other hand|as a result|in other words|that is)\b/i.test(
    s
  );
}

function cleanTerm(t: string): string {
  const stripped = t
    .replace(/^[\s*#\-–—:;•▪‣]+|[\s*#\-–—:;•▪‣]+$/g, "")
    .replace(/^\d{1,3}[.)]\s+/, "")
    .replace(/\s+/g, " ")
    .trim();
  // Drop a leading article so the term reads like a glossary entry:
  // "The three elements of communication" → "Three elements of communication".
  let out = stripped.replace(/^(the|a|an)\s+/i, "");
  // Adverbs the writer used to link back to the last sentence are not part of
  // the term: "Basically OSI is more detailed" → "OSI".
  out = out.replace(
    /^(basically|essentially|generally|typically|usually|simply|actually|also|however|instead|therefore|thus|hence|so|then|finally|meanwhile|likewise|similarly|conversely|overall)\s+/i,
    ""
  );
  if (out.length < 3) out = stripped;
  // Article stripping can leave a lowercase front: "three elements…" → "Three elements…".
  return out.length ? out[0].toUpperCase() + out.slice(1) : out;
}

/* Vague single words that name a topic, not a testable concept. */
const GENERIC_SINGLETONS = new Set(
  "topic topics lesson chapter unit module subject subjects review reviewer overview introduction summary notes note example examples advantages disadvantages types type kinds kind parts part steps step process processes system systems data information details item items thing things way ways uses usage use benefit benefits importance role roles concept concepts term terms word words".split(
    " "
  )
);

/** True when a candidate term is furniture, a pronoun, or has no substance. */
function isBadTerm(t: string): boolean {
  const key = t.toLowerCase().trim();
  if (!key) return true;
  // A dangling possessive is half a term: "Newton's" (…first law).
  if (/['’]s?$/.test(key)) return true;
  // A bare number or ordinal is a quantity, not a concept: "First", "Three".
  if (NUMBER_WORDS.has(key)) return true;
  // A single verb is an action, not a concept: "States", "Provides", "Include".
  if (!key.includes(" ") && COMMON_VERBS.has(key)) return true;
  // A vague topic word alone ("Topic", "Reviewer", "Advantages") tests nothing.
  if (!key.includes(" ") && GENERIC_SINGLETONS.has(key)) return true;
  if (PRONOUN_TERMS.has(key)) return true;
  if (STRUCTURAL_LABEL.test(key)) return true;
  // A term made only of stopwords/numbers carries no meaning.
  if (!contentWords(t).length) return true;
  // Any term that *opens* on a back-reference is unusable as a card front,
  // however long it is: "They describe how data", "This means the frame".
  if (PRONOUN_TERMS.has(key.split(/\s+/)[0])) return true;
  return false;
}

/* The regexes capture the definition from the middle of a sentence, so it can
 * arrive lowercase, missing its article and missing its full stop. This is the
 * back of a flashcard, so make it read as a complete sentence. */
function polishDefinition(d: string): string {
  let out = d.trim();
  // Drop a leading conjunction left over from the split.
  out = out.replace(/^(?:that|which|and|or|but|so|because)\s+/i, "");
  if (!out) return d.trim();
  out = out[0].toUpperCase() + out.slice(1);
  // Close the sentence unless it already ends in punctuation or is a fragment
  // list ending in a comma (which would look odd with a period appended).
  if (!/[.!?:;]$/.test(out)) out += ".";
  return out.replace(/,\.$/, ".");
}

export function extractTerms(text: string): TermDef[] {
  const lines = normalize(stripBoilerplate(text)).split("\n");
  const out: TermDef[] = [];
  const add = (term: string, definition: string) => {
    if (/^\s*#/.test(term)) return; // markdown headings are not terms
    const t = cleanTerm(term);
    const d = definition.trim().replace(/^[:\-–—]\s*/, "");
    // A definition must read as a real sentence, not a fragment.
    if (t.length < 3 || t.length > 80 || d.length < 20 || d.length > 400) return;
    if (d.split(/\s+/).length < 4) return;
    if (isBadTerm(t)) return;
    // The capture starts mid-sentence ("group of protocols…"), so tidy the
    // front and close the sentence — this is the visible back of a flashcard.
    const def = polishDefinition(d);
    const key = t.toLowerCase();
    const existing = out.findIndex((x) => x.term.toLowerCase() === key);
    if (existing !== -1) {
      // keep the richer definition
      if (def.length > out[existing].definition.length) out[existing] = { term: t, definition: def };
      return;
    }
    out.push({ term: t, definition: def });
  };

  // 0. Explicit emphasis first: **bold** (and *star* terms from PDFs/slides)
  // are the author's own "this will be on the test" signal.
  for (const line of lines) {
    const boldRe = /\*\*([^*]{3,60}?)\*\*/g;
    let m: RegExpExecArray | null;
    while ((m = boldRe.exec(line)) !== null) {
      const after = line.slice(m.index + m[0].length).replace(/^[:\-–—]\s*/, "").trim();
      const def = after.length >= 10 ? after.slice(0, 300) : line.replace(m[0], "").trim().slice(0, 300);
      if (def.length >= 10) add(m[1], def);
    }
  }
  if (out.length < 5) {
    for (const line of lines) {
      const starRe = /(^|[\s(])\*([^*\n]{3,50}?)\*(?=[\s).,:;\-–—]|$)/g;
      let m: RegExpExecArray | null;
      while ((m = starRe.exec(line)) !== null) {
        if (/^\d+$/.test(m[2].trim())) continue;
        const after = line.slice(m.index + m[0].length).replace(/^[:\-–—]\s*/, "").trim();
        const def = after.length >= 10 ? after.slice(0, 300) : line.replace(m[0], "").trim().slice(0, 300);
        if (def.length >= 10) add(m[2], def);
      }
    }
  }

  // 1. Glossary-style lines: "Term — definition" or "Term: definition"
  for (const line of lines) {
    const m = line.match(/^(.{1,70}?)\s*[:\-–—]\s+(.{15,300})$/);
    if (
      m &&
      !/[.!?]/.test(m[1]) &&
      !/(?:^|\s)(is|are|was|were|be|means|refers|refers to)$/i.test(m[1])
    ) {
      add(m[1], m[2]);
      continue;
    }
    // 2. "X is defined as Y" / "X refers to Y" / "X is called Y" …
    const m2 = line.match(
      /^([A-Z][A-Za-z'’\- ]{2,60}?)\s+(?:is|are|refers to|means|is defined as|is called|is known as)\s+(.{20,300})$/
    );
    if (m2) add(m2[1], m2[2]);
  }

  // 3. Quoted terms inside prose
  if (out.length < 5) {
    for (const line of lines) {
      const m = line.match(
        /[“"]([A-Z][A-Za-z'’\- ]{2,40})[”"]\s*(?:is|are|refers to|means)?\s*[:,\-–—]?\s*(.{20,300})$/
      );
      if (m) add(m[1], m[2]);
    }
  }

  // 4. Sentence-leading "X is/are …" definitions
  if (out.length < 5) {
    for (const s of splitSentences(text)) {
      if (isDanglingOpener(s)) continue; // "They are similar in the Transport layer…"
      const m = s.match(/^([A-Z][A-Za-z'’\- ]{2,50}?)\s+(?:is|are)\s+(?:a|an|the)?\s*(.{25,300})$/);
      if (m) add(m[1], m[2]);
    }
  }
  return out;
}

export function keyTerms(text: string, n: number): { term: string; meaning: string }[] {
  const terms = extractTerms(stripBoilerplate(text));
  // Exam-ready first: multi-word concepts with full-sentence definitions beat
  // lone generic words.
  const ranked = [...terms].sort((a, b) => {
    const aw = a.term.includes(" ") ? 0 : 1;
    const bw = b.term.includes(" ") ? 0 : 1;
    if (aw !== bw) return aw - bw;
    return b.definition.length - a.definition.length;
  });
  const out = ranked.slice(0, n).map((t) => ({ term: t.term, meaning: t.definition }));
  if (out.length >= n) return out;
  const freq = wordFreq(text);
  const seen = new Set(out.map((k) => k.term.toLowerCase()));
  const sents = splitSentences(text);
  const byFreq = [...freq.entries()]
    .filter(([w, f]) => w.length >= 5 && f >= 2)
    .sort((a, b) => b[1] - a[1]);
  for (const [word] of byFreq) {
    if (seen.has(word)) continue;
    const term = word[0].toUpperCase() + word.slice(1);
    if (isBadTerm(term)) continue;
    // Explain the term with a sentence that stands on its own.
    // Needs a sentence that stands alone AND actually says something about the
    // term — a title line like "Lesson 2: Network Protocols" explains nothing.
    const usable = (x: string) =>
      x.toLowerCase().includes(word) &&
      !isDanglingOpener(x) &&
      x.length >= 50 &&
      !STRUCTURAL_LABEL.test(x.split(/[:.]/, 1)[0].trim());
    const s = sents.find(usable) ?? sents.find((x) => x.toLowerCase().includes(word) && x.length >= 50);
    if (s) {
      out.push({ term, meaning: s });
      seen.add(word);
    }
    if (out.length >= n) break;
  }
  return out;
}

/* ------------------------------ cards ----------------------------- */

export function makeCardsLocal(text: string, count: number): TermDef[] {
  const terms = extractTerms(text);
  const out = terms.slice(0, count).map((t) => ({ term: t.term, definition: t.definition }));
  if (out.length >= count) return out;

  const sents = splitSentences(text).filter((s) => s.length <= 320);
  const seen = new Set(out.map((c) => c.term.toLowerCase()));
  const freq = wordFreq(text);

  /* Pick the most topical noun phrase in the sentence as the term, rather
   * than whatever word happens to come first. Prefer an explicit
   * "X is/are …" subject; otherwise take the highest-frequency content
   * words, which are the terms the material actually keeps coming back to. */
  const termFor = (s: string): string | null => {
    const m = s.match(
      /^([A-Z][A-Za-z'’\- ]{2,50}?)\s+(?:is|are|refers to|means|is defined as|is called|is known as)\b/
    );
    if (m) {
      const t = cleanTerm(m[1]);
      if (t.length >= 3 && !isBadTerm(t)) return t;
    }
    const ranked = [...new Set(contentWords(s))]
      .filter((w) => w.length >= 5)
      .sort((a, b) => (freq.get(b) ?? 0) - (freq.get(a) ?? 0));
    for (const w of ranked) {
      const t = w[0].toUpperCase() + w.slice(1);
      if (!isBadTerm(t)) return t;
    }
    return null;
  };

  for (const s of sents) {
    if (out.length >= count) break;
    // A card front that starts with "They"/"It" makes no sense out of context.
    if (isDanglingOpener(s)) continue;
    // Skip title lines — "Lesson 2: Network Protocols" is not a definition.
    if (STRUCTURAL_LABEL.test(s.split(/[:.]/, 1)[0].trim())) continue;
    const term = termFor(s);
    if (!term) continue;
    const key = term.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ term: term.slice(0, 60), definition: s });
  }
  return out;
}

/* ---------------------------- questions --------------------------- */

export interface LocalQuestion {
  type: "mcq" | "true_false" | "short";
  question: string;
  options: string[];
  answer: string;
  explanation: string;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Negate a true sentence into a grammatically-correct false one. */
function makeFalse(s: string): string | null {
  const rules: [RegExp, string][] = [
    [/\bcontains\b/i, "does not contain"],
    [/\bcontain\b/i, "do not contain"],
    [/\bproduces\b/i, "does not produce"],
    [/\bproduce\b/i, "do not produce"],
    [/\babsorbs\b/i, "does not absorb"],
    [/\babsorb\b/i, "do not absorb"],
    [/\breleases\b/i, "does not release"],
    [/\brelease\b/i, "do not release"],
    [/\bare\b/i, "are not"],
    [/\bis\b/i, "is not"],
    [/\bcan\b/i, "cannot"],
    [/\boccurs?\b/i, "does not occur"],
  ];
  for (const [re, repl] of rules) {
    if (re.test(s)) return s.replace(re, repl);
  }
  return null;
}

/* Blanking a filler word ("three", "called") tests nothing. Pick the most
 * topical word in the sentence instead — the one the material repeats — so the
 * blank lands on real subject matter. */
function blankable(sentence: string, freq?: Map<string, number>): string | null {
  const candidates = [...new Set(tokenize(sentence))].filter(
    (w) => w.length >= 5 && !STOPWORDS.has(w) && !/^\d+$/.test(w) && !NUMBER_WORDS.has(w)
  );
  if (!candidates.length) return null;
  if (!freq) return candidates[0];
  return candidates.sort((a, b) => (freq.get(b) ?? 0) - (freq.get(a) ?? 0))[0];
}

const NUMBER_WORDS = new Set(
  "one two three four five six seven eight nine ten first second third fourth fifth single".split(
    " "
  )
);

/* Distractors should be the same kind of thing as the answer — other technical
 * terms of similar length — so the question can't be solved by elimination. */
function pickDistractors(answer: string, pool: string[], freq: Map<string, number>): string[] {
  const len = answer.length;
  const ranked = pool
    .filter((w) => w !== answer && !NUMBER_WORDS.has(w) && w.length >= 4)
    .sort((a, b) => {
      // Closest in length first, then most topical.
      const d = Math.abs(a.length - len) - Math.abs(b.length - len);
      if (d !== 0) return d;
      return (freq.get(b) ?? 0) - (freq.get(a) ?? 0);
    });
  // Take from the closest matches, then shuffle so position isn't a tell.
  return shuffle(ranked.slice(0, 8)).slice(0, 3);
}

/* "What is Three elements of communication?" is bad grammar, and picking the
 * right article for an arbitrary term is guesswork ("a unicast", "a message
 * segmentation"). An imperative prompt sidesteps articles and agreement
 * entirely, so it reads correctly for singular, plural, acronym and mass-noun
 * terms alike. */
function shortPrompt(term: string): string {
  // Keep acronyms and proper nouns capitalised; lowercase a common noun phrase
  // so it sits naturally mid-sentence. A capital anywhere after the first word
  // ("Protocol Data Units", "OSI model") marks it as a proper term.
  const isProper =
    /^[A-Z]{2,}\b/.test(term) ||
    /^[A-Z][a-z]+[A-Z]/.test(term) ||
    /\s[A-Z]/.test(term);
  let subject = isProper ? term : term[0].toLowerCase() + term.slice(1);
  // A counted phrase needs its determiner back: cleanTerm stripped "The" off
  // "The three elements of communication".
  if (NUMBER_WORDS.has(subject.split(/\s+/)[0].toLowerCase())) subject = `the ${subject}`;
  return `Explain ${subject} in your own words.`;
}

export function makeQuestionsLocal(
  text: string,
  count: number,
  types: string[],
  instructions: string
): LocalQuestion[] {
  // A question built on "They describe how data is formatted" is unanswerable
  // without the previous sentence, so skip back-referencing sentences.
  const pool = splitSentences(text).filter((s) => s.length >= 60 && s.length <= 320);
  const standalone = pool.filter((s) => !isDanglingOpener(s));
  const sents = standalone.length >= 4 ? standalone : pool;
  const terms = extractTerms(text);
  const freq = wordFreq(text);
  /* Repeated words make the best distractors, but short material may not
   * repeat anything. Widen the pool until there are enough to build a
   * 4-option question, otherwise MCQ generation silently produces nothing. */
  const poolAt = (minLen: number, minFreq: number) =>
    [...freq.entries()]
      .filter(([w, f]) => w.length >= minLen && f >= minFreq)
      .map(([w]) => w);
  let distractorPool = poolAt(5, 2);
  if (distractorPool.length < 6) distractorPool = poolAt(5, 1);
  if (distractorPool.length < 6) distractorPool = poolAt(4, 1);

  /* Short-answer questions need a term with a real definition. Glossary lines
   * give the best ones; when the material has none (dense prose, bullet
   * lists), fall back to the card generator so "short" is never silently
   * dropped from a requested question mix. */
  const shortSubjects: TermDef[] = terms.length ? terms : makeCardsLocal(text, 10);

  const out: LocalQuestion[] = [];
  const used = new Set<string>();
  const allowed = types.length ? types : ["mcq", "true_false", "short"];
  let tIdx = 0;
  let sIdx = 0;
  let guard = 0;

  while (out.length < count && guard++ < count * 6) {
    const type = allowed[tIdx % allowed.length];
    tIdx++;

    if (type === "short" && shortSubjects.length > 0) {
      const t = shortSubjects[Math.floor(Math.random() * shortSubjects.length)];
      const q = shortPrompt(t.term);
      if (!used.has(q)) {
        used.add(q);
        out.push({
          type: "short",
          question: q,
          options: [],
          answer: t.definition,
          explanation: t.definition,
        });
      }
      continue;
    }

    const s = sents[sIdx % Math.max(1, sents.length)];
    sIdx++;
    if (!s) continue;
    const blank = blankable(s, freq);
    if (!blank) continue;

    if (type === "true_false") {
      const falseSentence = makeFalse(s);
      if (falseSentence && Math.random() < 0.55) {
        const q = `True or False: ${falseSentence}`;
        if (!used.has(q)) {
          used.add(q);
          out.push({
            type: "true_false",
            question: q,
            options: ["True", "False"],
            answer: "False",
            explanation: `This statement is false. The correct statement is: ${s}`,
          });
        }
      } else {
        const q = `True or False: ${s}`;
        if (used.has(q)) continue;
        used.add(q);
        out.push({
          type: "true_false",
          question: q,
          options: ["True", "False"],
          answer: "True",
          explanation: s,
        });
      }
    } else {
      const distractors = pickDistractors(blank, distractorPool, freq);
      if (distractors.length < 3) continue;
      // Fill-in-the-blank reads as a statement, so no trailing "?".
      const q = s.replace(new RegExp(`\\b${blank}\\b`, "i"), "_____");
      if (used.has(q) || !q.includes("_____")) continue;
      used.add(q);
      out.push({
        type: "mcq",
        question: q,
        options: shuffle([blank, ...distractors]),
        answer: blank,
        explanation: s,
      });
    }
  }
  return out;
}

/* ---------------------------- summaries --------------------------- */

export function makeSummaryLocal(text: string): {
  overview: string;
  bullets: string[];
  keyTerms: { term: string; meaning: string }[];
} {
  const sents = splitSentences(text);
  const n = Math.min(12, Math.max(6, Math.floor(sents.length / 3)));
  const top = topSentences(text, n);

  /* The overview is read first and standalone, so it must not open on a
   * sentence that refers back to something ("They describe how data is…").
   * Self-contained sentences go first; danglers fall through to the bullets. */
  const selfContained = top.filter((s) => s.length >= 60 && !isDanglingOpener(s));
  const overviewPicks = (selfContained.length >= 2 ? selfContained : top.filter((s) => s.length >= 60))
    .slice(0, 3);
  const overview = overviewPicks.join(" ");

  // Bullets get everything the overview didn't use, danglers included —
  // they read fine as standalone points alongside their neighbours.
  const usedInOverview = new Set(overviewPicks);
  const bullets = top.filter((s) => !usedInOverview.has(s)).slice(0, 7);

  return {
    overview: overview || top[0] || "",
    bullets: bullets.length ? bullets : top,
    keyTerms: keyTerms(text, 8),
  };
}

/** A short title-cased heading for a block of prose with no heading of its own. */
function headingFor(content: string): string {
  const first = content
    .split(/[.!?]/, 1)[0]
    .replace(/^#{1,6}\s+/, "")
    // Bullet and numbered-list markers are not part of the heading.
    .replace(/^[-•*+‣▪]\s*/, "")
    .replace(/^\d+[.)]\s*/, "")
    .replace(/\s+/g, " ")
    .trim();

  // "Message segmentation is the process of breaking large messages…"
  // → "Message segmentation". Cut at the verb, a colon or a dash.
  const verbCut = first.search(
    /\s+(?:is|are|was|were|has|have|works|work|includes|include|consists|refers|means|can|will|describes|describe|happens|occurs|comes|gets|makes|provides|handles|breaks|acts)\b/i
  );
  const punctCut = first.search(/[:\-–—,;(]/);
  const cuts = [verbCut, punctCut].filter((c) => c > 6);
  let heading = cuts.length ? first.slice(0, Math.min(...cuts)) : first;
  heading = heading
    .replace(/\s+(?:the|a|an|of|for|in|on|to|and|or)$/i, "")
    .replace(/^(?:the|a|an)\s+/i, "")
    .trim();

  // Too short to be meaningful, or the sentence had no natural break: fall
  // back to a trimmed version of the opening clause.
  if (heading.length < 8) heading = first;
  if (heading.length > 64) {
    const words = heading.slice(0, 64).split(" ");
    words.pop();
    heading = words.join(" ");
  }
  heading = heading.replace(/[\s,;:.\-–—]+$/, "");
  if (!heading) return "Overview";
  return heading[0].toUpperCase() + heading.slice(1);
}

export function makeNotesLocal(
  text: string
): { heading: string; content: string }[] {
  const lines = normalize(text).split("\n").filter((l) => l.trim());
  const sections: { heading: string; content: string }[] = [];
  let current: { heading: string; content: string } | null = null;

  for (const line of lines) {
    const t = line.trim();
    const isHeading =
      /^(#{1,3}\s|\d+[.)]\s)/.test(t) ||
      (t.length >= 3 && t.length <= 64 && !/[a-z]/.test(t) && !/[.!?]$/.test(t));
    if (isHeading) {
      if (current) sections.push(current);
      current = { heading: t.replace(/^(#{1,3}\s|\d+[.)]\s)/, "").trim(), content: "" };
    } else if (current) {
      current.content += (current.content ? "\n" : "") + t;
    } else {
      current = { heading: "", content: t };
    }
  }
  if (current) sections.push(current);
  const filled = sections.filter((s) => s.content);
  const realHeadings = filled.filter((s) => s.heading).length;

  // If the text has no clear headings, group paragraphs into readable sections.
  if (filled.length < 3 || realHeadings <= 1) {
    const paras = splitParagraphs(text);
    if (paras.length >= 3) {
      const grouped: { heading: string; content: string }[] = [];
      for (let i = 0; i < paras.length; i += 2) {
        const content = paras.slice(i, i + 2).join("\n");
        grouped.push({ heading: headingFor(content), content });
      }
      return grouped;
    }
    return filled.map((s) => ({
      heading: s.heading || headingFor(s.content),
      content: s.content,
    }));
  }
  return filled.map((s) => ({
    heading: s.heading || headingFor(s.content),
    content: s.content,
  }));
}

/* ------------------------- related sentences ---------------------- */

export function findRelatedSentences(
  content: string,
  keywords: string,
  n: number
): string[] {
  const words = new Set(contentWords(keywords).filter((w) => w.length >= 4));
  if (!words.size) return [];
  const sents = splitSentences(content);
  const scored = sents
    .map((s) => {
      const ws = contentWords(s);
      const hits = ws.filter((w) => words.has(w)).length;
      return { s, score: ws.length ? hits / Math.sqrt(ws.length) : 0 };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, n)
    .map((x) => x.s);
  return scored;
}
