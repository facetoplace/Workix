import { writeFileSync } from "node:fs";
import Parser from "rss-parser";
import { callFetchJobs, ensurePlatforms } from "../src/adapterLoader.js";
import { fetchText } from "../src/http.js";

async function main() {
  await ensurePlatforms(["remoteok"]);
  const rok = await callFetchJobs("remoteok");
  const mobile = rok.jobs
    .filter((j) => {
      const t = `${j.title} ${j.description}`.toLowerCase();
      const isMob =
        /android developer|ios developer|flutter|react native|mobile engineer|mobile developer|swiftui|jetpack/.test(
          t,
        ) ||
        (/android|ios|flutter|kotlin|swift/.test(j.title.toLowerCase()) &&
          /developer|engineer|разработ/.test(t));
      const bad =
        /based in\s*\**poland|must be based in poland|devops|brand designer|analista|speculative|marketing manager|customer support/.test(
          t,
        );
      return isMob && !bad;
    })
    .slice(0, 20)
    .map((j) => ({
      title: j.title,
      link: j.link,
      date: j.date,
      poland: /poland/i.test(j.description),
      snippet: j.description.replace(/<[^>]+>/g, " ").slice(0, 180),
    }));

  const r = await fetchText("https://www.fl.ru/rss/all.xml?category=mobile", {
    headers: { Accept: "application/rss+xml" },
    retries: 2,
  });
  const feed = r.ok ? await new Parser().parseString(r.text) : { items: [] };
  const fl = (feed.items || []).slice(0, 20).map((i) => ({
    title: i.title,
    link: i.link,
    date: i.isoDate || i.pubDate,
    snippet: String(i.contentSnippet || "").slice(0, 180),
  }));

  const out = { rok_error: rok.error, rok_mobile: mobile, fl_mobile_rss: fl };
  writeFileSync("data/probe-mobile-lists.json", JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
