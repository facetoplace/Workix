import assert from "node:assert/strict";
import {
  buildOpenRadarUrl,
  normaliseOpenRadarPayload,
} from "../dist/adapters/openradar.js";

const url = new URL(buildOpenRadarUrl({
  keywords: ["frontend", "remote"],
  type: "job",
  language: "en",
  remote: true,
  workplace: "remote",
  it: true,
  limit: 20,
  page: 2,
}));
assert.equal(url.origin, "https://openradar.fun");
assert.equal(url.pathname, "/api/leads");
assert.equal(url.searchParams.get("q"), "frontend remote");
assert.equal(url.searchParams.get("type"), "job");
assert.equal(url.searchParams.get("remote"), "1");
assert.equal(url.searchParams.get("limit"), "20");
assert.equal(url.searchParams.get("page"), "2");

const rows = normaliseOpenRadarPayload({
  items: [
    {
      id: "lead-1",
      type: "gig",
      title: "Landing page",
      text: "Build a landing page",
      url: "https://example.test/lead-1",
      contacts: [{ type: "telegram", value: "@hidden" }],
    },
    { title: "No link" },
  ],
});
assert.equal(rows.length, 2);
assert.equal(rows[0].id, "lead-1");
assert.equal(normaliseOpenRadarPayload([]).length, 0);
assert.equal(normaliseOpenRadarPayload({ data: "invalid" }).length, 0);
console.log("openradar parser and URL builder: ok");
