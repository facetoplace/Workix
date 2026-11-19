import assert from "node:assert/strict";
import { extractGildiaSnapshot } from "../dist/adapters/gildia.js";

const html = `
  <article>
    <a href="/ru/leads/abc-123"><h3>Landing page for a SaaS</h3><span>Budget $500</span></a>
  </article>
  <a href="https://gildia.global/ru/leads/xyz"><span>Telegram bot integration</span></a>
  <a href="/ru/not-a-lead">Ignore this link</a>
`;

const parsed = await extractGildiaSnapshot(html);
assert.equal(parsed.source, "dom");
assert.equal(parsed.items.length, 2);
assert.equal(parsed.items[0].title, "Landing page for a SaaS Budget $500");
assert.equal(parsed.items[0].link, "https://gildia.global/ru/leads/abc-123");
assert.equal(parsed.items[1].title, "Telegram bot integration");
assert.equal(parsed.items[1].link, "https://gildia.global/ru/leads/xyz");
assert.equal(parsed.items.some((item) => item.title.includes("Ignore")), false);
console.log("gildia snapshot parser: ok");
