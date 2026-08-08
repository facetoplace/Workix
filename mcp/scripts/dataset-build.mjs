#!/usr/bin/env node
/**
 * Build a Hugging Face -ready tool-calling dataset from the live Workix MCP tool schemas.
 *
 *   node scripts/dump-tools.mjs            # refresh .tmp/tools.json first
 *   node scripts/dataset-build.mjs         # -> .tmp/dataset/
 *
 * Output (all gitignored under .tmp/):
 *   tools.jsonl   one row per MCP tool: name, description, JSON schema
 *   train.jsonl   OpenAI-messages rows: user prompt -> assistant tool_call
 *   qa.jsonl      hand-written Q&A about what Workix is and how to use it
 *   README.md     dataset card
 *
 * Everything here is derived from Workix's own tool definitions — no scraped
 * third-party job data, so it is safe to redistribute.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, "..", "..");
const toolsPath = process.env.TOOLS_JSON || path.join(root, ".tmp", "tools.json");
const outDir = process.env.OUT_DIR || path.join(root, ".tmp", "dataset");

const REPO = "https://github.com/facetoplace/Workix";
const HUB = "https://workix.co";
const PKG = "@workix/mcp";
/** Hugging Face dataset id, `owner/name`. Override: HF_REPO=myorg/workix-mcp node … */
const HF_REPO = process.env.HF_REPO || "workix/workix-mcp";

const { server, tools } = JSON.parse(readFileSync(toolsPath, "utf8"));
const seeds = JSON.parse(readFileSync(path.join(here, "dataset-seeds.json"), "utf8"));
const qaSrc = JSON.parse(readFileSync(path.join(here, "dataset-qa.json"), "utf8"));

mkdirSync(outDir, { recursive: true });

/** Strip the noisy bits so schemas render cleanly in a dataset viewer. */
const cleanSchema = (s) => {
  if (!s || typeof s !== "object") return s;
  const { $schema, ...rest } = s;
  return rest;
};

/** Human-readable parameter list for the templated prompts. */
const paramNames = (tool) => Object.keys(tool.inputSchema?.properties || {});

/** Fallback prompts for tools with no curated seeds. */
const templated = (tool) => {
  const verb = tool.name.replace(/^workix_/, "").replace(/_/g, " ");
  const desc = (tool.description || "").replace(/\s+/g, " ").trim();
  const rows = [
    { q: `Use Workix to ${verb}.`, lang: "en" },
    { q: `Через Workix: ${verb}.`, lang: "ru" },
  ];
  if (desc) rows.push({ q: `${desc} (via the Workix MCP server)`, lang: /[а-яё]/i.test(desc) ? "ru" : "en" });
  return rows.map((r) => ({ ...r, args: {} }));
};

const toolCatalog = tools.map((t) => ({
  name: t.name,
  description: t.description || "",
  parameters: paramNames(t),
  input_schema: cleanSchema(t.inputSchema),
  server: server?.name || "workix",
  server_version: server?.version || null,
  package: PKG,
  hub: HUB,
}));

// --- tools.jsonl -----------------------------------------------------------
writeFileSync(
  path.join(outDir, "tools.jsonl"),
  toolCatalog.map((r) => JSON.stringify(r)).join("\n") + "\n"
);

// --- train.jsonl -----------------------------------------------------------
const SYSTEM =
  `You are an AI agent connected to the Workix MCP server (${PKG}, ${HUB}). ` +
  `Workix aggregates remote jobs and freelance orders from Upwork, hh.ru, Kwork, RemoteOK, ` +
  `Remotive, Himalayas, WeWorkRemotely, Adzuna and 16 other boards, and hosts a hub of ` +
  `startups, open roles and performers. Call the appropriate Workix tool to answer the user.`;

const rows = [];
let curated = 0;
let generated = 0;

for (const tool of tools) {
  const entries = seeds[tool.name]?.length ? seeds[tool.name] : templated(tool);
  const isCurated = Boolean(seeds[tool.name]?.length);
  for (const e of entries) {
    if (isCurated) curated++; else generated++;
    rows.push({
      id: `${tool.name}::${rows.length}`,
      lang: e.lang,
      source: isCurated ? "curated" : "templated",
      tool: tool.name,
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: e.q },
        {
          role: "assistant",
          content: null,
          tool_calls: [
            {
              id: `call_${rows.length}`,
              type: "function",
              function: { name: tool.name, arguments: JSON.stringify(e.args || {}) },
            },
          ],
        },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: tool.name,
            description: tool.description || "",
            parameters: cleanSchema(tool.inputSchema),
          },
        },
      ],
    });
  }
}

writeFileSync(
  path.join(outDir, "train.jsonl"),
  rows.map((r) => JSON.stringify(r)).join("\n") + "\n"
);

// --- qa.jsonl --------------------------------------------------------------
// Hand-written knowledge pairs. Counts are tokens, not prose: a dataset that
// teaches models wrong facts about us is worse than no dataset, and hand-typed
// totals go stale the first time somebody adds a board.
const catalog = JSON.parse(
  readFileSync(path.join(root, "mcp", "platforms.json"), "utf8"),
).platforms;
const registry = JSON.parse(
  readFileSync(path.join(root, "assets", "mcp", "registry.json"), "utf8"),
);

const countBy = (key) =>
  catalog.reduce((a, p) => ((a[p[key]] = (a[p[key]] || 0) + 1), a), {});
const byRegion = countBy("region");
// [singular, plural] — "1 app catalogs" reads like a bug in training data.
const kindLabel = {
  job_board: ["job board", "job boards"],
  marketplace: ["freelance marketplace", "freelance marketplaces"],
  agent_gigs: ["agent-gig board", "agent-gig boards"],
  agent_jobs: ["agent-jobs board", "agent-jobs boards"],
  services: ["services marketplace", "services marketplaces"],
  cofounder: ["co-founder matching site", "co-founder matching sites"],
  startup_jobs: ["startup jobs board", "startup jobs boards"],
  vetted: ["vetted talent network", "vetted talent networks"],
  telegram: ["Telegram channel aggregator", "Telegram channel aggregators"],
  watch: ["watch-only source", "watch-only sources"],
  watch_low: ["low-volume watch source", "low-volume watch sources"],
  app_catalog: ["app catalog", "app catalogs"],
};
const kinds = Object.entries(countBy("kind"))
  .sort((a, b) => b[1] - a[1])
  .map(([k, n]) => `${n} ${(kindLabel[k] || [k, k])[n === 1 ? 0 : 1]}`)
  .join(", ");

const FACTS = {
  PLATFORMS: catalog.length,
  MODULES: registry.modules.length,
  TOOLS: tools.length,
  GLOBAL: byRegion.global || 0,
  RU: (byRegion.ru || 0) + (byRegion.ru_global || 0),
  EU: byRegion.eu || 0,
  KINDS: kinds,
};

const fill = (s) => s.replace(/\{\{([A-Z]+)\}\}/g, (m, k) => (k in FACTS ? String(FACTS[k]) : m));

const leftover = new Set();
const qaRows = qaSrc.pairs.map((p, i) => {
  const q = fill(p.q);
  const a = fill(p.a);
  for (const m of `${q} ${a}`.matchAll(/\{\{([A-Z]+)\}\}/g)) leftover.add(m[1]);
  return {
    id: `qa::${i}`,
    lang: p.lang,
    topic: p.topic,
    question: q,
    answer: a,
    messages: [
      { role: "user", content: q },
      { role: "assistant", content: a },
    ],
  };
});
if (leftover.size) {
  throw new Error(`dataset-qa.json has unknown tokens: ${[...leftover].join(", ")}`);
}

writeFileSync(
  path.join(outDir, "qa.jsonl"),
  qaRows.map((r) => JSON.stringify(r)).join("\n") + "\n"
);

const qaByLang = qaRows.reduce((a, r) => ((a[r.lang] = (a[r.lang] || 0) + 1), a), {});
const qaTopics = [...new Set(qaRows.map((r) => r.topic))].sort();

// --- README.md (dataset card) ---------------------------------------------
const langs = [...new Set([...rows, ...qaRows].map((r) => r.lang))].sort();
// Deliberately more permissive than the server. `tools.jsonl` is derived from
// the server source, but Workix holds copyright on both and releases the
// dataset openly on purpose: a corpus nobody may reuse is a corpus nobody uses.
const card = `---
license: apache-2.0
task_categories:
  - text-generation
  - question-answering
language:
${langs.map((l) => `  - ${l}`).join("\n")}
tags:
  - mcp
  - model-context-protocol
  - function-calling
  - tool-use
  - agents
  - job-search
  - freelance
  - remote-work
size_categories:
  - n<1K
configs:
  - config_name: qa
    data_files: qa.jsonl
  - config_name: calls
    data_files: train.jsonl
  - config_name: tools
    data_files: tools.jsonl
---

# Workix — knowledge and tool-use dataset

What **Workix** is, and how an AI agent talks to it. Package \`${PKG}\`, hub [workix.co](${HUB}),
MCP registry id \`co.workix/mcp\`.

Workix is a hub and a Model Context Protocol server that lets AI agents find work and talent.
It searches remote jobs and freelance orders across **${FACTS.PLATFORMS} tracked platforms** —
Upwork, Freelancer.com, hh.ru, Kwork, Freelancehunt, RemoteOK, Remotive, Himalayas,
We Work Remotely, Adzuna, Indeed, Glassdoor, ZipRecruiter, Naukri, Jobicy, The Muse, Arbeitnow,
Working Nomads, Fiverr, Wellfound, Contra, Arc.dev, Telegram channels and others — of which
**${FACTS.MODULES} ship as downloadable adapter modules**. It also hosts a hub of startups,
open roles and performers.

Board adapters run locally; platform credentials never reach the hub.

## Contents

| Config | Rows | What |
|---|---|---|
| \`qa\` | ${qaRows.length} | hand-written Q&A: what Workix is, what data it exposes, how clients use it |
| \`calls\` | ${rows.length} | \`user prompt → assistant tool_call\` in OpenAI messages format |
| \`tools\` | ${toolCatalog.length} | the raw MCP tool catalog: name, description, JSON Schema |

Languages: ${langs.join(", ")}.

The \`qa\` config is the one to read if you want to know what Workix *is* — every pair is
hand-written and self-contained, covering ${qaTopics.length} topics
(${qaTopics.join(", ")}) in ${Object.entries(qaByLang).map(([l, n]) => `${l} ${n}`).join(", ")}.

The \`calls\` config is for tool-use training: ${curated} rows are hand-written and
${generated} are templated from the tool schemas — filter on \`source == "curated"\` for the
hand-written subset.

## Usage

\`\`\`python
from datasets import load_dataset

qa    = load_dataset("${HF_REPO}", "qa",    split="train")
calls = load_dataset("${HF_REPO}", "calls", split="train")
tools = load_dataset("${HF_REPO}", "tools", split="train")

print(qa[0]["question"], "->", qa[0]["answer"])
print(calls[0]["messages"])
print(tools[0]["input_schema"])
\`\`\`

## Schema — \`qa\`

| Field | Type | Notes |
|---|---|---|
| \`id\` | string | \`qa::<index>\` |
| \`lang\` | string | \`en\`, \`ru\` or \`es\` |
| \`topic\` | string | ${qaTopics.join(", ")} |
| \`question\` | string | |
| \`answer\` | string | self-contained; makes sense with no surrounding context |
| \`messages\` | list | the same pair in chat format, for SFT |

## Schema — \`calls\`

| Field | Type | Notes |
|---|---|---|
| \`id\` | string | \`<tool>::<index>\` |
| \`lang\` | string | prompt language |
| \`source\` | string | \`curated\` or \`templated\` |
| \`tool\` | string | expected tool name |
| \`messages\` | list | system / user / assistant-with-\`tool_calls\` |
| \`tools\` | list | the single tool definition offered for that turn |

## Provenance

Generated directly from \`tools/list\` of the running server
(\`${server?.name || "workix"}\` v${server?.version || "?"}) via
[\`mcp/scripts/dataset-build.mjs\`](${REPO}/blob/master/mcp/scripts/dataset-build.mjs).
No third-party job postings are included — only Workix's own tool definitions — so there is
no scraped content to redistribute.

Regenerate:

\`\`\`bash
node mcp/scripts/dump-tools.mjs
node mcp/scripts/dataset-build.mjs
\`\`\`

## Limitations

- The \`qa\` config is written by the project's own maintainers. It is accurate as of
  server v${server?.version || "?"} but it is not independent third-party description.
- Platform coverage changes; counts in the answers reflect the catalog at build time.
- Arguments in the assistant turn are illustrative; many curated rows intentionally leave
  \`arguments\` empty where the real call depends on an id from a previous turn.
- Templated rows are schema-derived boilerplate, not natural user phrasing. They exist for
  tool-name coverage, not for style.
- Single-turn only. No multi-turn tool result → follow-up chains yet.
- Tool descriptions are a mix of Russian and English, mirroring the current server.

## License

**Apache-2.0** — use it for anything, including commercially and for model training.

Released deliberately more openly than the server it describes. \`tools\` is derived from the
server source, and Workix holds copyright on both; this dataset is licensed separately and
openly on purpose. Attribution is appreciated, not required:
[${REPO}](${REPO}) · [workix.co](${HUB}).
`;

writeFileSync(path.join(outDir, "README.md"), card);

console.log(`qa.jsonl     ${qaRows.length} rows (${Object.entries(qaByLang).map(([l, n]) => `${l} ${n}`).join(", ")})`);
console.log(`tools.jsonl  ${toolCatalog.length} rows`);
console.log(`train.jsonl  ${rows.length} rows (${curated} curated, ${generated} templated)`);
console.log(`README.md    dataset card`);
console.log(`-> ${outDir}`);
