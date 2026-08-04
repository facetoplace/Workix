import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { runDigest } from "../src/tools/digest.js";
import { runSearch } from "../src/tools/search.js";

const keywords = [
  "мобильн",
  "android",
  "ios",
  "flutter",
  "react native",
  "приложение",
  "mobile app",
  "swift",
  "kotlin",
];
const minus = ["отзыв на сайт", "накрутка", "реферат", "курьер", "3d костюм"];

async function main() {
  const digest = (await runDigest({
    hours: 96,
    limit: 25,
    only_new: false,
    include_jobs: true,
    keywords,
    minus,
    use_profile_filters: false,
  })) as Record<string, unknown>;

  const search = (await runSearch({
    hours: 168,
    limit: 25,
    refresh: false,
    include_jobs: true,
    keywords,
    minus,
  })) as Record<string, unknown>;

  const mapCards = (cards: unknown) =>
    (Array.isArray(cards) ? cards : []).map((c: Record<string, unknown>) => ({
      id: c.id,
      platform: c.platform,
      title: c.title,
      budget: c.budget,
      link: c.link,
      date: c.date,
      score: c.score,
      snippet: String(c.snippet || c.description || "").slice(0, 280),
    }));

  const outDir = join(process.cwd(), "data");
  mkdirSync(outDir, { recursive: true });
  const path = join(outDir, "probe-mobile-out.json");
  writeFileSync(
    path,
    JSON.stringify(
      {
        digest: {
          count: digest.count,
          total_matched: digest.total_matched,
          errors: digest.errors,
          summary: digest.summary,
          cards: mapCards(digest.cards),
        },
        search: {
          count: search.count,
          total: search.total ?? search.total_matched,
          errors: search.errors,
          cards: mapCards(search.cards || search.jobs),
        },
      },
      null,
      2,
    ),
  );
  console.log("wrote", path);
  console.log(
    "digest",
    digest.count,
    "/",
    digest.total_matched,
    "errors",
    JSON.stringify(digest.errors),
  );
  console.log("search", search.count ?? mapCards(search.cards || search.jobs).length);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
