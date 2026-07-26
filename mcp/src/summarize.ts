import type { Job } from "./types.js";

export function matchesKeywords(job: Job, keywords?: string[]): boolean {
  if (!keywords?.length) return true;
  const hay = `${job.title}\n${job.description}`.toLowerCase();
  return keywords.some((k) => hay.includes(k.toLowerCase()));
}

export function hitsMinus(job: Job, minus?: string[]): boolean {
  if (!minus?.length) return false;
  const hay = `${job.title}\n${job.description}`.toLowerCase();
  return minus.some((k) => hay.includes(k.toLowerCase()));
}

export function whyMatch(job: Job, keywords?: string[]): string {
  if (!keywords?.length) return "в окне времени";
  const hay = `${job.title}\n${job.description}`.toLowerCase();
  const hit = keywords.filter((k) => hay.includes(k.toLowerCase()));
  return hit.length ? `keywords: ${hit.join(", ")}` : "в окне времени";
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
    list = list.filter((j) => matchesKeywords(j, opts.keywords));
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
