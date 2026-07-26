import { createHash } from "node:crypto";
import {
  createWriteStream,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { extract } from "tar";
import {
  type AdapterContext,
  type AdapterModule,
  type AdapterRegistry,
  type RegistryModule,
  CORE_RSS_PLATFORMS,
  PLATFORM_MODULE_MAP,
} from "./adapterModule.js";
import { loadEnv } from "./env.js";
import { loadPlatforms } from "./platforms.js";
import { dataDir } from "./store.js";
import type { Job } from "./types.js";

const MCP_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_REGISTRY = "https://workix.co/mcp/registry.json";

const loaded = new Map<string, AdapterModule>();
let registryCache: { at: number; data: AdapterRegistry } | null = null;

function adaptersRoot(): string {
  return join(dataDir(), "adapters");
}

function moduleDir(id: string, version: string): string {
  return join(adaptersRoot(), id, version);
}

function installMarker(id: string, version: string): string {
  return join(moduleDir(id, version), ".installed.json");
}

export function getAdapterContext(): AdapterContext {
  loadEnv();
  if (!process.env.WORKIX_MCP_DATA?.trim()) {
    process.env.WORKIX_MCP_DATA = join(MCP_ROOT, "data");
  }
  process.env.WORKIX_MCP_ROOT = MCP_ROOT;
  return {
    dataDir: dataDir(),
    env: process.env,
    log: (msg) => {
      if (process.env.WORKIX_MCP_DEBUG) {
        console.error(`[workix-adapter] ${msg}`);
      }
    },
  };
}

export function moduleIdForPlatform(platformId: string): string | null {
  if ((CORE_RSS_PLATFORMS as readonly string[]).includes(platformId)) {
    return null;
  }
  const fromCatalog = loadPlatforms().find((p) => p.id === platformId);
  const mod = (fromCatalog as { module?: string } | undefined)?.module;
  if (mod) return mod;
  if (PLATFORM_MODULE_MAP[platformId]) return PLATFORM_MODULE_MAP[platformId];
  // Already a module id (e.g. "freelancer")
  if (Object.values(PLATFORM_MODULE_MAP).includes(platformId)) return platformId;
  return null;
}

export function registryUrl(): string {
  loadEnv();
  return process.env.WORKIX_MCP_REGISTRY?.trim() || DEFAULT_REGISTRY;
}

function localRegistryCandidates(): string[] {
  return [
    join(MCP_ROOT, "registry.local.json"),
    join(MCP_ROOT, "..", "assets", "mcp", "registry.json"),
  ];
}

export async function fetchRegistry(force = false): Promise<AdapterRegistry> {
  const now = Date.now();
  if (!force && registryCache && now - registryCache.at < 60_000) {
    return registryCache.data;
  }

  const url = registryUrl();
  let data: AdapterRegistry | null = null;
  let lastErr = "";

  try {
    if (url.startsWith("file:")) {
      data = JSON.parse(readFileSync(fileURLToPath(url), "utf8")) as AdapterRegistry;
    } else if (existsSync(url)) {
      data = JSON.parse(readFileSync(url, "utf8")) as AdapterRegistry;
    } else {
      const res = await fetch(url, { headers: { Accept: "application/json" } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      data = (await res.json()) as AdapterRegistry;
    }
  } catch (e) {
    lastErr = e instanceof Error ? e.message : String(e);
  }

  if (!data) {
    for (const cand of localRegistryCandidates()) {
      if (!existsSync(cand)) continue;
      try {
        data = JSON.parse(readFileSync(cand, "utf8")) as AdapterRegistry;
        break;
      } catch {
        /* next */
      }
    }
  }

  if (!data) {
    throw new Error(
      `Adapter registry unavailable (${url}): ${lastErr || "no local fallback"}`,
    );
  }

  registryCache = { at: now, data };
  return data;
}

export function listInstalled(): Array<{
  id: string;
  version: string;
  path: string;
}> {
  const root = adaptersRoot();
  if (!existsSync(root)) return [];
  const out: Array<{ id: string; version: string; path: string }> = [];
  for (const id of readdirSync(root)) {
    if (id.startsWith(".")) continue;
    const idDir = join(root, id);
    let versions: string[] = [];
    try {
      versions = readdirSync(idDir);
    } catch {
      continue;
    }
    for (const version of versions) {
      if (existsSync(installMarker(id, version))) {
        out.push({ id, version, path: moduleDir(id, version) });
      }
    }
  }
  return out;
}

export async function removeAdapter(id: string): Promise<{
  ok: boolean;
  removed?: string[];
  error?: string;
}> {
  const root = join(adaptersRoot(), id);
  if (!existsSync(root)) {
    return { ok: false, error: `not installed: ${id}` };
  }
  const removed: string[] = [];
  try {
    for (const version of readdirSync(root)) {
      removed.push(`${id}@${version}`);
    }
    rmSync(root, { recursive: true, force: true });
    loaded.delete(id);
    return { ok: true, removed };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

function sha256File(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

async function downloadToFile(url: string, dest: string): Promise<void> {
  mkdirSync(dirname(dest), { recursive: true });
  if (url.startsWith("file:")) {
    writeFileSync(dest, readFileSync(fileURLToPath(url)));
    return;
  }
  if (existsSync(url) && !/^https?:/i.test(url)) {
    writeFileSync(dest, readFileSync(url));
    return;
  }
  const res = await fetch(url);
  if (!res.ok || !res.body) {
    throw new Error(`download failed ${url}: HTTP ${res.status}`);
  }
  await pipeline(
    Readable.fromWeb(res.body as import("node:stream/web").ReadableStream),
    createWriteStream(dest),
  );
}

async function extractTgz(tgzPath: string, destDir: string): Promise<void> {
  mkdirSync(destDir, { recursive: true });
  await extract({ file: tgzPath, cwd: destDir, strict: true });
}

function resolvePackageRoot(destDir: string): string {
  if (existsSync(join(destDir, "index.js"))) return destDir;
  if (existsSync(join(destDir, "package", "index.js"))) {
    return join(destDir, "package");
  }
  try {
    const kids = readdirSync(destDir).filter((n) => !n.startsWith("."));
    if (kids.length === 1 && existsSync(join(destDir, kids[0], "index.js"))) {
      return join(destDir, kids[0]);
    }
  } catch {
    /* ignore */
  }
  return destDir;
}

async function importModuleFromDir(
  id: string,
  dir: string,
): Promise<AdapterModule> {
  getAdapterContext();
  const root = resolvePackageRoot(dir);
  const entry = join(root, "index.js");
  if (!existsSync(entry)) {
    throw new Error(`adapter ${id}: missing index.js in ${root}`);
  }
  const href = `${pathToFileURL(entry).href}?t=${Date.now()}`;
  const mod = (await import(href)) as AdapterModule;
  if (!mod?.meta?.id || typeof mod.fetchJobs !== "function") {
    throw new Error(`adapter ${id}: invalid module contract (meta/fetchJobs)`);
  }
  loaded.set(id, mod);
  return mod;
}

export async function installModule(
  entry: RegistryModule,
  opts?: { force?: boolean },
): Promise<{ ok: boolean; id: string; version: string; error?: string }> {
  const dir = moduleDir(entry.id, entry.version);
  if (!opts?.force && existsSync(installMarker(entry.id, entry.version))) {
    try {
      await importModuleFromDir(entry.id, dir);
      return { ok: true, id: entry.id, version: entry.version };
    } catch {
      /* reinstall */
    }
  }

  const tmpDir = join(adaptersRoot(), ".tmp", `${entry.id}-${entry.version}`);
  const tgzPath = join(tmpDir, "module.tgz");
  try {
    rmSync(tmpDir, { recursive: true, force: true });
    mkdirSync(tmpDir, { recursive: true });

    let url = entry.url;
    if (url.startsWith("/")) {
      const reg = await fetchRegistry();
      const base = (reg.baseUrl || "https://workix.co").replace(/\/$/, "");
      url = `${base}${url}`;
    }

    const localAsset = join(
      MCP_ROOT,
      "..",
      "assets",
      "mcp",
      "adapters",
      `${entry.id}-${entry.version}.tgz`,
    );
    if (existsSync(localAsset)) url = localAsset;

    await downloadToFile(url, tgzPath);
    const digest = sha256File(tgzPath).toLowerCase();
    if (digest !== entry.sha256.toLowerCase()) {
      throw new Error(
        `sha256 mismatch for ${entry.id}@${entry.version}: got ${digest}, want ${entry.sha256}`,
      );
    }

    rmSync(dir, { recursive: true, force: true });
    mkdirSync(dir, { recursive: true });
    await extractTgz(tgzPath, dir);

    writeFileSync(
      installMarker(entry.id, entry.version),
      JSON.stringify(
        {
          id: entry.id,
          version: entry.version,
          sha256: entry.sha256,
          installedAt: new Date().toISOString(),
          url: entry.url,
        },
        null,
        2,
      ),
      "utf8",
    );

    await importModuleFromDir(entry.id, dir);
    rmSync(tmpDir, { recursive: true, force: true });
    return { ok: true, id: entry.id, version: entry.version };
  } catch (e) {
    return {
      ok: false,
      id: entry.id,
      version: entry.version,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

export async function ensureAdapter(
  moduleId: string,
): Promise<{ ok: boolean; module?: AdapterModule; error?: string }> {
  if (loaded.has(moduleId)) {
    return { ok: true, module: loaded.get(moduleId) };
  }

  try {
    const reg = await fetchRegistry();
    const entry = reg.modules.find((m) => m.id === moduleId);
    if (!entry) {
      return { ok: false, error: `module not in registry: ${moduleId}` };
    }

    const dir = moduleDir(entry.id, entry.version);
    if (existsSync(installMarker(entry.id, entry.version))) {
      try {
        const mod = await importModuleFromDir(entry.id, dir);
        return { ok: true, module: mod };
      } catch {
        /* reinstall */
      }
    }

    const installed = await installModule(entry);
    if (!installed.ok) return { ok: false, error: installed.error };
    return { ok: true, module: loaded.get(moduleId) };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

export async function ensurePlatforms(platformIds: string[]): Promise<{
  ensured: string[];
  errors: string[];
}> {
  const moduleIds = new Set<string>();
  for (const p of platformIds) {
    const mid = moduleIdForPlatform(p);
    if (mid) moduleIds.add(mid);
  }
  const ensured: string[] = [];
  const errors: string[] = [];
  for (const mid of moduleIds) {
    const r = await ensureAdapter(mid);
    if (r.ok) ensured.push(mid);
    else errors.push(`${mid}: ${r.error || "failed"}`);
  }
  return { ensured, errors };
}

export async function getAdapter(
  moduleId: string,
): Promise<AdapterModule | null> {
  const r = await ensureAdapter(moduleId);
  return r.module || null;
}

export async function callFetchJobs(
  moduleId: string,
  opts?: Record<string, unknown>,
): Promise<{ jobs: Job[]; error?: string; totalCount?: number }> {
  const r = await ensureAdapter(moduleId);
  if (!r.ok || !r.module) {
    return { jobs: [], error: r.error || `adapter ${moduleId} unavailable` };
  }
  const ctx = getAdapterContext();
  try {
    return await r.module.fetchJobs(ctx, opts);
  } catch (e) {
    return {
      jobs: [],
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

export async function installPlatformModule(platformOrModuleId: string): Promise<{
  ok: boolean;
  id?: string;
  version?: string;
  error?: string;
}> {
  const moduleId =
    moduleIdForPlatform(platformOrModuleId) || platformOrModuleId;
  const reg = await fetchRegistry(true);
  const entry = reg.modules.find((m) => m.id === moduleId);
  if (!entry) return { ok: false, error: `unknown module: ${moduleId}` };
  return installModule(entry, { force: true });
}
