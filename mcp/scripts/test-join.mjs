import assert from "node:assert/strict";
import {
  JOIN_GRAPHQL_URL,
  buildJoinRequest,
  normaliseJoinPayload,
  _joinInternals,
} from "../dist/adapters/join.js";

assert.equal(JOIN_GRAPHQL_URL, "https://join.com/candidate-api/graphql");

const req = buildJoinRequest({ companyId: 1000, page: 2, pageSize: 25 });
assert.ok(req.query.includes("publicJobs"));
assert.equal(req.variables.input.companyId, 1000);
assert.equal(req.variables.input.paginationPage.page, 2);
assert.equal(req.variables.input.paginationPage.pageSize, 25);

const rows = normaliseJoinPayload({
  data: {
    publicJobs: {
      items: [
        {
          idParam: "16953118-pflichtpraktikum-design",
          id: 16953118,
          companyId: 1000,
          title: "Praktikum Design (W/M/D)",
          company: { name: "DFROST Retail Identity", domain: "dfrost" },
          country: { name: "Germany", iso3166: "DE" },
          category: { name: "Design" },
          employmentType: { name: "Internship" },
          updatedAt: "2026-11-01T00:00:00Z",
        },
        { title: "Broken row without company" },
      ],
    },
  },
});
assert.equal(rows.length, 2);
assert.equal(normaliseJoinPayload([]).length, 0);
assert.equal(normaliseJoinPayload({ data: { publicJobs: { items: "invalid" } } }).length, 0);

const job = _joinInternals.rowToJob(rows[0], "2026-11-19T00:00:00Z");
assert.ok(job, "row should normalise to a job");
assert.equal(job.platform, "join");
assert.equal(job.kind, "job");
assert.equal(job.title, "Praktikum Design (W/M/D)");
assert.equal(job.link, "https://join.com/companies/dfrost/16953118-pflichtpraktikum-design");
assert.equal(job.raw.country, "Germany");
assert.equal(_joinInternals.rowToJob(rows[1], "2026-11-19T00:00:00Z"), undefined);

console.log("join parser and request builder: ok");
