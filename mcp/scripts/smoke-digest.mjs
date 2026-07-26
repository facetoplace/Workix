import { runDigest } from "../dist/tools/digest.js";

const r = await runDigest({
  hours: 48,
  limit: 5,
  keywords: ["сайт", "бот", "разработ"],
});
console.log(JSON.stringify(r, null, 2).slice(0, 4000));
