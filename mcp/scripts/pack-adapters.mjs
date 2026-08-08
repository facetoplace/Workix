#!/usr/bin/env node
/**
 * Bundle downloadable MCP platform adapters → assets/mcp/adapters/*.tgz
 * and write assets/mcp/registry.json
 */
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as esbuild from "esbuild";
import { create as tarCreate } from "tar";

const HERE = dirname(fileURLToPath(import.meta.url));
const MCP_ROOT = join(HERE, "..");
const REPO_ROOT = join(MCP_ROOT, "..");
const OUT_DIR = join(REPO_ROOT, "assets", "mcp");
const ADAPTERS_OUT = join(OUT_DIR, "adapters");
const STAGING = join(MCP_ROOT, ".adapter-pack");

const MODULES = [
  "kwork",
  "freelancehunt",
  "hh",
  "remoteok",
  "remotive",
  "arbeitnow",
  "adzuna",
  "himalayas",
  "weworkremotely",
  "jobicy",
  "dreamoffer",
  "working_nomads",
  "themuse",
  "four_day_week",
  "aidevboard",
  "aquent",
  "growth_talent",
  "claw_earn",
  "seekclaw",
  "superteam_earn",
  "rentahuman",
  "openwork",
  "upwork",
  "freelancer",
  "dstore",
  "telegram",
  "jobspy",
];

const EXTERNAL = [
  "kwork-api",
  "socks-proxy-agent",
  "https-proxy-agent",
  "rss-parser",
  "dotenv",
  "zod",
  "@modelcontextprotocol/sdk",
  "tdl",
  "prebuilt-tdlib",
];

async function packOne(id) {
  const entry = join(MCP_ROOT, "src", "module-entries", `${id}.ts`);
  if (!existsSync(entry)) throw new Error(`missing entry ${entry}`);

  const stage = join(STAGING, id);
  rmSync(stage, { recursive: true, force: true });
  mkdirSync(stage, { recursive: true });

  const outfile = join(stage, "index.js");
  await esbuild.build({
    entryPoints: [entry],
    outfile,
    bundle: true,
    platform: "node",
    format: "esm",
    target: "node20",
    external: EXTERNAL,
    logLevel: "warning",
  });

  // Re-read meta from built file via dynamic import is heavy; parse version from source
  const src = readFileSync(entry, "utf8");
  const verMatch = src.match(/version:\s*["']([^"']+)["']/);
  const version = verMatch?.[1] || "1.0.0";
  const platformsMatch = src.match(/platforms:\s*\[([^\]]+)\]/);
  const platforms = platformsMatch
    ? platformsMatch[1]
        .split(",")
        .map((s) => s.replace(/["'\s]/g, ""))
        .filter(Boolean)
    : [id];
  const envMatch = src.match(/envKeys:\s*\[([^\]]*)\]/);
  const envKeys = envMatch
    ? envMatch[1]
        .split(",")
        .map((s) => s.replace(/["'\s]/g, ""))
        .filter(Boolean)
    : [];

  writeFileSync(
    join(stage, "package.json"),
    JSON.stringify(
      {
        name: `@workix/adapter-${id}`,
        version,
        type: "module",
        main: "index.js",
      },
      null,
      2,
    ),
    "utf8",
  );

  mkdirSync(ADAPTERS_OUT, { recursive: true });
  const tgzName = `${id}-${version}.tgz`;
  const tgzPath = join(ADAPTERS_OUT, tgzName);
  if (existsSync(tgzPath)) rmSync(tgzPath);

  await tarCreate(
    {
      gzip: true,
      file: tgzPath,
      cwd: stage,
      portable: true,
    },
    ["index.js", "package.json"],
  );

  const sha256 = createHash("sha256")
    .update(readFileSync(tgzPath))
    .digest("hex");

  return {
    id,
    version,
    platforms,
    sha256,
    url: `/mcp/adapters/${tgzName}`,
    envKeys,
    minCore: "0.3.0",
  };
}

async function main() {
  rmSync(STAGING, { recursive: true, force: true });
  mkdirSync(ADAPTERS_OUT, { recursive: true });

  const modules = [];
  for (const id of MODULES) {
    const m = await packOne(id);
    modules.push(m);
    console.log(`packed ${m.id}@${m.version} sha256=${m.sha256.slice(0, 12)}…`);
  }

  const registry = {
    updated: new Date().toISOString().slice(0, 10),
    baseUrl: "https://workix.co",
    modules,
  };

  writeFileSync(
    join(OUT_DIR, "registry.json"),
    JSON.stringify(registry, null, 2) + "\n",
    "utf8",
  );
  // Local MCP fallback copy
  writeFileSync(
    join(MCP_ROOT, "registry.local.json"),
    JSON.stringify(registry, null, 2) + "\n",
    "utf8",
  );

  rmSync(STAGING, { recursive: true, force: true });
  console.log(`registry → ${join(OUT_DIR, "registry.json")} (${modules.length} modules)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
