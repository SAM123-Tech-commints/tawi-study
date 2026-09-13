/* Shared HTML → structured-text extraction.
 *
 * Turns a raw web page into clean study text that keeps the SOURCE structure —
 * headings become markdown headings, list items become bullets, bold/italic are
 * preserved, and paragraphs keep their breaks — so a scraped article renders in
 * the exact-text / notes view the same way an uploaded PDF does. This is the web
 * counterpart to the PDF extractor: strong, faithful, reliable.
 */

/** Full HTML-entity decode: named + decimal + hex, so nothing is dropped. */
const NAMED: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
  ndash: "–", mdash: "—", lsquo: "‘", rsquo: "’", ldquo: "“", rdquo: "”",
  hellip: "…", bull: "•", middot: "·", trade: "™", copy: "©", reg: "®",
  deg: "°", plusmn: "±", times: "×", divide: "÷", frac12: "½", frac14: "¼",
  eacute: "é", egrave: "è", agrave: "à", uuml: "ü", ouml: "ö", auml: "ä",
  ntilde: "ñ", ccedil: "ç", euro: "€", pound: "£", cent: "¢", yen: "¥",
};

export function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_m, h) => safeCp(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_m, d) => safeCp(Number(d)))
    .replace(/&([a-z][a-z0-9]*);/gi, (m, name: string) => NAMED[name] ?? NAMED[name.toLowerCase()] ?? m);
}

function safeCp(code: number): string {
  try {
    if (!Number.isFinite(code) || code <= 0) return "";
    return String.fromCodePoint(code);
  } catch {
    return "";
  }
}

/** Pull the human title out of a page (og:title beats <title>). */
export function extractTitle(html: string, fallback: string): string {
  const og = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i);
  const t = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return decodeHtmlEntities(og?.[1]?.trim() ?? t?.[1]?.trim() ?? fallback).trim();
}

/** og:description, used to prime the extracted text with a one-line summary. */
export function extractDescription(html: string): string {
  const og =
    html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']*)["']/i) ??
    html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["']/i);
  return decodeHtmlEntities(og?.[1]?.trim() ?? "").trim();
}

/**
 * Convert a page's HTML to structured markdown-ish text.
 * Keeps headings (#/##/###), list bullets (- ), numbered items, and **bold** /
 * *italic* so the result mirrors the source layout instead of a flat wall.
 */
export function htmlToStructuredText(rawHtml: string): string {
  // 1. Prefer the real article body over the whole document (nav/ads/etc.).
  let html = rawHtml;
  const article = rawHtml.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
  const main = rawHtml.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
  const role = rawHtml.match(/<[^>]+role=["']main["'][^>]*>([\s\S]*?)<\/[^>]+>/i);
  if (article && article[1].length > 400) html = article[1];
  else if (main && main[1].length > 400) html = main[1];
  else if (role && role[1].length > 400) html = role[1];

  html = html
    // 2. Drop non-content regions entirely.
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<template[\s\S]*?<\/template>/gi, " ")
    .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
    .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
    .replace(/<footer[\s\S]*?<\/footer>/gi, " ")
    .replace(/<header[\s\S]*?<\/header>/gi, " ")
    .replace(/<aside[\s\S]*?<\/aside>/gi, " ")
    .replace(/<form[\s\S]*?<\/form>/gi, " ")
    .replace(/<figure[\s\S]*?<\/figure>/gi, " ")
    // 3. HTML comments.
    .replace(/<!--[\s\S]*?-->/g, " ");

  // 4. Map structural tags to markdown BEFORE stripping the rest.
  html = html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|section|tr|table|blockquote)>/gi, "\n\n")
    .replace(/<(strong|b)\b[^>]*>([\s\S]*?)<\/\1>/gi, (_m, _t, inner: string) => `**${collapse(inner)}**`)
    .replace(/<(em|i)\b[^>]*>([\s\S]*?)<\/\1>/gi, (_m, _t, inner: string) => `*${collapse(inner)}*`)
    .replace(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi, (_m, i: string) => `\n\n# ${collapse(i)}\n`)
    .replace(/<h2\b[^>]*>([\s\S]*?)<\/h2>/gi, (_m, i: string) => `\n\n## ${collapse(i)}\n`)
    .replace(/<h3\b[^>]*>([\s\S]*?)<\/h3>/gi, (_m, i: string) => `\n\n### ${collapse(i)}\n`)
    .replace(/<h[4-6]\b[^>]*>([\s\S]*?)<\/h[4-6]>/gi, (_m, i: string) => `\n\n### ${collapse(i)}\n`)
    .replace(/<li\b[^>]*>([\s\S]*?)<\/li>/gi, (_m, i: string) => `\n- ${collapse(i)}`)
    .replace(/<\/(ul|ol)>/gi, "\n");

  // 5. Remove every remaining tag, decode entities, tidy whitespace.
  const text = decodeHtmlEntities(html.replace(/<[^>]+>/g, " "))
    .replace(/\r\n/g, "\n")
    .replace(/[ \t ]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    // Bold/italic markers that ended up wrapping nothing.
    .replace(/\*\*\s*\*\*/g, "")
    .replace(/(^|\n)[-•]\s*(?=\n|$)/g, "$1") // empty bullets
    .trim();

  return text;
}

/** Collapse inline whitespace inside a captured tag body. */
function collapse(s: string): string {
  return decodeHtmlEntities(s.replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}
