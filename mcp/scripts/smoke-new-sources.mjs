#!/usr/bin/env node
/**
 * Live check for the sources added 2026-08-09.
 * Hits every new adapter directly (no registry download) and prints what came
 * back, so a broken parser or a moved endpoint shows up as 0 items here rather
 * than as a quietly thin digest.
 *
 *   node scripts/smoke-new-sources.mjs
 */
import { fetchAtsJobs } from "../dist/adapters/ats.js";
import { fetchCareerjetJobs } from "../dist/adapters/careerjet.js";
import { fetchGetOnBrdJobs } from "../dist/adapters/getonbrd.js";
import { fetchHabrCareerJobs } from "../dist/adapters/habr_career.js";
import { fetchJobsPipeJobs } from "../dist/adapters/jobspipe.js";
import { fetchJoobleJobs } from "../dist/adapters/jooble.js";
import { fetchLandingJobs } from "../dist/adapters/landing_jobs.js";
import { fetchNoFluffJobs } from "../dist/adapters/nofluff.js";
import { fetchRssJobs } from "../dist/adapters/rss.js";
import { fetchSuperJobJobs } from "../dist/adapters/superjob.js";
import { fetchTrudvsemJobs } from "../dist/adapters/trudvsem.js";
import { fetchUsaJobs } from "../dist/adapters/usajobs.js";

const CASES = [
  ["trudvsem", () => fetchTrudvsemJobs({ text: "разработчик", limit: 20 })],
  ["ats", () => fetchAtsJobs()],
  ["habr_career", () => fetchHabrCareerJobs({ pages: 1 })],
  ["nofluff", () => fetchNoFluffJobs({ limit: 20 })],
  ["landing_jobs", () => fetchLandingJobs()],
  ["getonbrd", () => fetchGetOnBrdJobs({ perPage: 20 })],
  ["djinni+jobspresso+reddit (rss)", async () => {
    const r = await fetchRssJobs(["djinni", "jobspresso", "reddit"]);
    return { jobs: r.jobs, error: r.errors.map((e) => `${e.platform}: ${e.error}`).join("; ") };
  }],
  // Key-gated: these report "missing (optional)" until the key is in .env.
  ["jobspipe", () => fetchJobsPipeJobs({ limit: 5 })],
  ["usajobs", () => fetchUsaJobs({ keyword: "software" })],
  ["superjob", () => fetchSuperJobJobs({ keyword: "flutter" })],
  ["careerjet", () => fetchCareerjetJobs({ keywords: "developer" })],
  ["jooble", () => fetchJoobleJobs({ keywords: "developer" })],
];

const rows = [];
for (const [name, run] of CASES) {
  const started = Date.now();
  try {
    const r = await run();
    rows.push({
      source: name,
      items: r.jobs.length,
      total: r.totalCount ?? "",
      ms: Date.now() - started,
      sample: r.jobs[0]?.title?.slice(0, 60) || "",
      error: r.error || "",
    });
  } catch (e) {
    rows.push({
      source: name,
      items: 0,
      total: "",
      ms: Date.now() - started,
      sample: "",
      error: e instanceof Error ? e.message : String(e),
    });
  }
}

console.table(rows);
const live = rows.filter((r) => r.items > 0).length;
console.log(`${live}/${rows.length} sources returned jobs`);
