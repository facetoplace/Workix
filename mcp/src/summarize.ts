import type { Job } from "./types.js";

/**
 * Keyword matching used to be `haystack.includes(word)`, which let a single
 * substring anywhere carry a card: "мобильн" matched "мобильному дому",
 * "ии" matched arbitrary Cyrillic, "ios" matched "curiosity". Matching now
 * anchors at a word start and is scored, so one weak hit is not enough.
 */

/** Letters/digits in both alphabets — anything else is a word boundary. */
const WORD_CHAR = /[\p{L}\p{N}]/u;

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Word-start match, so stems still work ("мобильн" → "мобильные") while
 * mid-word noise does not ("ios" ✗ "curiosity"). Multi-word keywords
 * ("react native") match as a phrase.
 */
function occurrences(hay: string, needle: string): number {
  const n = needle.trim().toLowerCase();
  if (!n) return 0;

  // Short tokens are acronyms, not stems: "app" must not match "applicants"
  // and "ios" must not match "curiosity". Anything longer stays a prefix so
  // Russian stems still work ("мобильн" → "мобильные").
  const exact = n.replace(/[^\p{L}\p{N}]/gu, "").length <= 4;

  let count = 0;
  let from = 0;
  for (;;) {
    const i = hay.indexOf(n, from);
    if (i < 0) break;
    const before = i > 0 ? hay[i - 1] : "";
    const after = hay[i + n.length] || "";
    const startOk = !before || !WORD_CHAR.test(before);
    const endOk = !exact || !after || !WORD_CHAR.test(after);
    if (startOk && endOk) count++;
    from = i + n.length;
  }
  return count;
}

function fields(job: Job): { title: string; body: string } {
  return {
    title: String(job.title || "").toLowerCase(),
    body: String(job.description || "").toLowerCase(),
  };
}

export interface KeywordMatch {
  score: number;
  hits: string[];
  strongHit: boolean;
}

/**
 * Score a card. A title hit counts triple — the title is what the poster is
 * actually hiring for, the body is context.
 */
export function scoreKeywords(
  job: Job,
  keywords?: string[],
  strong?: string[],
): KeywordMatch {
  if (!keywords?.length) return { score: 1, hits: [], strongHit: true };
  const { title, body } = fields(job);
  const strongSet = new Set((strong || []).map((s) => s.toLowerCase()));

  let score = 0;
  let strongHit = false;
  const hits: string[] = [];

  for (const k of keywords) {
    const inTitle = occurrences(title, k);
    const inBody = occurrences(body, k);
    if (!inTitle && !inBody) continue;
    hits.push(k);
    score += inTitle * 3 + Math.min(inBody, 2);
    if (strongSet.has(k.toLowerCase())) strongHit = true;
  }

  return { score, hits, strongHit };
}

/**
 * A card passes when it names a strong domain term, or clears the score
 * threshold on weaker ones. With `strong` configured, weak-only cards need at
 * least two distinct hits — that is what drops "мобильному дому".
 */
export function matchesKeywords(
  job: Job,
  keywords?: string[],
  opts?: { strong?: string[]; minScore?: number },
): boolean {
  if (!keywords?.length) return true;
  const m = scoreKeywords(job, keywords, opts?.strong);
  if (!m.hits.length) return false;
  if (m.strongHit) return true;
  if (opts?.strong?.length) return m.hits.length >= 2 && m.score >= 3;
  return m.score >= (opts?.minScore ?? 3);
}

export function hitsMinus(job: Job, minus?: string[]): boolean {
  if (!minus?.length) return false;
  const { title, body } = fields(job);
  return minus.some((k) => occurrences(title, k) > 0 || occurrences(body, k) > 0);
}

export function whyMatch(job: Job, keywords?: string[], strong?: string[]): string {
  if (!keywords?.length) return "в окне времени";
  const m = scoreKeywords(job, keywords, strong);
  return m.hits.length
    ? `keywords: ${m.hits.join(", ")} (score ${m.score}${m.strongHit ? ", strong" : ""})`
    : "в окне времени";
}

function parseBudgetNumber(budget?: string): number | undefined {
  if (!budget) return undefined;
  const m = budget.replace(/\s/g, "").match(/(\d[\d.,]*)/);
  if (!m) return undefined;
  return Number(m[1].replace(",", ".").replace(/\.(?=.*\.)/g, ""));
}

export function filterJobs(
  jobs: Job[],
  opts: {
    hours?: number;
    keywords?: string[];
    minus?: string[];
    platforms?: string[];
    since?: string;
    min_budget?: number;
    kinds?: Array<"gig" | "job" | "service">;
    /** Domain terms that carry a card on their own (see matchesKeywords). */
    strong?: string[];
    minScore?: number;
  },
): Job[] {
  let list = [...jobs];

  if (opts.platforms?.length) {
    const set = new Set(opts.platforms);
    list = list.filter((j) => set.has(j.platform));
  }

  if (opts.kinds?.length) {
    const set = new Set(opts.kinds);
    list = list.filter((j) => set.has(j.kind || "gig"));
  }

  if (opts.since) {
    const t = new Date(opts.since).getTime();
    list = list.filter((j) => new Date(j.date).getTime() >= t);
  } else if (opts.hours != null) {
    const t = Date.now() - opts.hours * 3600_000;
    list = list.filter((j) => new Date(j.date).getTime() >= t);
  }

  if (opts.keywords?.length) {
    list = list.filter((j) =>
      matchesKeywords(j, opts.keywords, {
        strong: opts.strong,
        minScore: opts.minScore,
      }),
    );
  }

  if (opts.minus?.length) {
    list = list.filter((j) => !hitsMinus(j, opts.minus));
  }

  if (opts.min_budget != null) {
    list = list.filter((j) => {
      const n = parseBudgetNumber(j.budget);
      return n == null || n >= opts.min_budget!;
    });
  }

  list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  return list;
}

export function cardSummary(
  job: Job,
  keywords?: string[],
): {
  id: string;
  platform: string;
  kind?: string;
  title: string;
  budget?: string;
  link: string;
  date: string;
  snippet: string;
  why_match: string;
} {
  const snippet =
    job.description.length > 180
      ? `${job.description.slice(0, 180)}…`
      : job.description;
  return {
    id: job.id,
    platform: job.platform,
    kind: job.kind,
    title: job.title,
    budget: job.budget,
    link: job.link,
    date: job.date,
    snippet,
    why_match: whyMatch(job, keywords),
  };
}

export function digestText(
  cards: ReturnType<typeof cardSummary>[],
  meta: { hours: number; errors: string[]; preset?: string },
): string {
  const byPlatform: Record<string, number> = {};
  for (const c of cards) {
    byPlatform[c.platform] = (byPlatform[c.platform] || 0) + 1;
  }
  const lines = [
    meta.preset
      ? `Сводка [${meta.preset}] за ${meta.hours}ч: ${cards.length}`
      : `Сводка за ${meta.hours}ч: ${cards.length} заказов`,
    `По площадкам: ${
      Object.entries(byPlatform)
        .map(([k, v]) => `${k}=${v}`)
        .join(", ") || "—"
    }`,
  ];
  if (meta.errors.length) {
    lines.push(`Ошибки источников: ${meta.errors.join("; ")}`);
  }
  lines.push("");
  cards.slice(0, 15).forEach((c, i) => {
    lines.push(
      `${i + 1}. [${c.platform}${c.kind ? "/" + c.kind : ""}] ${c.title}${c.budget ? ` · ${c.budget}` : ""}`,
    );
    lines.push(`   ${c.link}`);
    lines.push(`   ${c.why_match} · ${c.snippet}`);
  });
  return lines.join("\n");
}
