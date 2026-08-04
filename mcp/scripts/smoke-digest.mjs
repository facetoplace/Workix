import { runDigest } from "../dist/tools/digest.js";

process.on("unhandledRejection", (err) => {
  console.error(
    "[smoke] unhandledRejection:",
    err instanceof Error ? err.message : err,
  );
});

const r = await runDigest({
  hours: 48,
  limit: 5,
  keywords: ["сайт", "бот", "разработ"],
  // Avoid kwork-api crash path when proxy TLS is broken; FL RSS is enough for smoke.
  platforms: ["fl_ru"],
});
console.log(JSON.stringify(r, null, 2).slice(0, 4000));
console.log("\n[smoke-digest] OK count=", r?.count);
