import { writeFileSync } from "node:fs";
import { callFetchJobs, ensurePlatforms } from "../src/adapterLoader.js";
import { fetchRssJobs } from "../src/adapters/rss.js";
import { fetchText } from "../src/http.js";
import Parser from "rss-parser";
import { jobId } from "../src/store.js";
import type { Job } from "../src/types.js";

const kw =
  /мобильн|android|ios|flutter|react\s*native|swift|kotlin|mobile\s*app|приложен/i;
const noise =
  /poland|польш|курьер|pto|электронн(ой|ая)\s+плат|3d\s*костюм|email\s*рассыл|презентац|devops|brand designer|analista|speculative cv|golang-разработ|qa инженер/i;
const poland =
  /based in\s*\**poland|must be based in\s*\**poland|candidates must be based in poland/i;
const strong =
  /flutter|react\s*native|ios и android|ios and android|android developer|ios developer|мобильного приложения|native android|jetpack|kotlin/i;

function score(t: string, d: string) {
  const s = `${t} ${d}`;
  let n = 0;
  for (const re of [
    /flutter/i,
    /react\s*native/i,
    /\bios\b/i,
    /android/i,
    /kotlin/i,
    /swift/i,
    /мобильн/i,
    /mobile app/i,
    /приложен/i,
  ]) {
    if (re.test(s)) n++;
  }
  return n;
}

async function fetchFlCategory(category: string): Promise<Job[]> {
  const url = `https://www.fl.ru/rss/all.xml?category=${encodeURIComponent(category)}`;
  const res = await fetchText(url, {
    headers: { Accept: "application/rss+xml, application/xml, text/xml, */*" },
    retries: 2,
  });
  if (!res.ok) return [];
  const feed = await new Parser().parseString(res.text);
  const jobs: Job[] = [];
  for (const item of feed.items || []) {
    const link = item.link?.trim();
    const title = item.title?.trim();
    if (!link || !title) continue;
    jobs.push({
      id: jobId("fl_ru", link),
      platform: "fl_ru",
      kind: "gig",
      title,
      description: (item.contentSnippet || item.content || "").slice(0, 4000),
      link,
      date: new Date(item.isoDate || item.pubDate || Date.now()).toISOString(),
      fetchedAt: new Date().toISOString(),
    });
  }
  return jobs;
}

async function main() {
  await ensurePlatforms(["remoteok"]);
  const rss = await fetchRssJobs(["fl_ru", "habr_career"]);
  const flMobile = await fetchFlCategory("mobile");
  const rok = await callFetchJobs("remoteok");
  const all = [...rss.jobs, ...flMobile, ...rok.jobs];

  const hits = all
    .filter((j) => {
      const blob = `${j.title} ${j.description}`;
      if (!kw.test(blob) || noise.test(blob) || poland.test(blob)) return false;
      return score(j.title, j.description) >= 2 || strong.test(blob);
    })
    .map((j) => ({ j, s: score(j.title, j.description) }))
    .sort(
      (a, b) =>
        b.s - a.s || +new Date(b.j.date) - +new Date(a.j.date),
    );

  // dedupe by id
  const seen = new Set<string>();
  const unique = [];
  for (const { j, s } of hits) {
    if (seen.has(j.id)) continue;
    seen.add(j.id);
    unique.push({
      id: j.id,
      platform: j.platform,
      title: j.title,
      budget: j.budget,
      link: j.link,
      date: j.date,
      score: s,
      snippet: j.description.replace(/<[^>]+>/g, " ").slice(0, 240),
    });
  }

  const out = {
    errors: [...rss.errors.map((e) => `${e.platform}: ${e.error}`), rok.error].filter(
      Boolean,
    ),
    count: unique.length,
    hits: unique.slice(0, 25),
  };
  writeFileSync("data/probe-mobile-strict.json", JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
