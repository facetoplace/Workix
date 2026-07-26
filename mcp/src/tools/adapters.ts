import {
  ensurePlatforms,
  fetchRegistry,
  installPlatformModule,
  listInstalled,
  moduleIdForPlatform,
  registryUrl,
  removeAdapter,
} from "../adapterLoader.js";
import { CORE_RSS_PLATFORMS } from "../adapterModule.js";
import { loadPlatforms } from "../platforms.js";
import { loadPresets } from "../presets.js";
import { listWatchSources } from "./watch.js";

export async function runListPlatforms(): Promise<unknown> {
  let registry: Awaited<ReturnType<typeof fetchRegistry>> | null = null;
  let registryError: string | undefined;
  try {
    registry = await fetchRegistry();
  } catch (e) {
    registryError = e instanceof Error ? e.message : String(e);
  }
  const installed = listInstalled();
  const installedMap = new Map(installed.map((i) => [i.id, i]));

  const platforms = loadPlatforms().map((p) => {
    const moduleId = p.module || moduleIdForPlatform(p.id);
    const isCore = (CORE_RSS_PLATFORMS as readonly string[]).includes(p.id);
    const inst = moduleId ? installedMap.get(moduleId) : undefined;
    const avail = moduleId
      ? Boolean(registry?.modules.some((m) => m.id === moduleId))
      : isCore;
    return {
      ...p,
      module: moduleId || undefined,
      core: isCore,
      installed: isCore ? true : Boolean(inst),
      installedVersion: inst?.version,
      available: isCore || avail,
      needs_env: (p as { module?: string }).module
        ? registry?.modules.find((m) => m.id === moduleId)?.envKeys || []
        : [],
    };
  });

  return {
    registry: registryUrl(),
    registryError,
    modules: registry?.modules || [],
    installed,
    platforms,
    watch: listWatchSources(),
    presets: loadPresets(),
  };
}

export async function runEnsurePlatforms(args: {
  platforms?: string[];
  modules?: string[];
}): Promise<unknown> {
  const ids = [
    ...(args.platforms || []),
    ...(args.modules || []),
  ];
  if (!ids.length) {
    return { error: "Передай platforms и/или modules" };
  }
  const r = await ensurePlatforms(ids);
  return {
    ...r,
    installed: listInstalled(),
  };
}

export async function runInstallPlatform(args: {
  platform?: string;
  module?: string;
}): Promise<unknown> {
  const id = args.module || args.platform;
  if (!id) return { error: "Нужен platform или module id" };
  const r = await installPlatformModule(id);
  return { ...r, installed: listInstalled() };
}

export async function runRemovePlatform(args: {
  platform?: string;
  module?: string;
}): Promise<unknown> {
  const raw = args.module || args.platform;
  if (!raw) return { error: "Нужен platform или module id" };
  const moduleId = moduleIdForPlatform(raw) || raw;
  return removeAdapter(moduleId);
}
