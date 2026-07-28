import { ensurePlatforms, fetchRegistry, installPlatformModule, listInstalled, moduleIdForPlatform, registryUrl, removeAdapter, } from "../adapterLoader.js";
import { CORE_RSS_PLATFORMS } from "../adapterModule.js";
import { loadPlatforms } from "../platforms.js";
import { loadPresets } from "../presets.js";
import { listWatchSources } from "./watch.js";
export async function runListPlatforms() {
    let registry = null;
    let registryError;
    try {
        registry = await fetchRegistry();
    }
    catch (e) {
        registryError = e instanceof Error ? e.message : String(e);
    }
    const installed = listInstalled();
    const installedMap = new Map(installed.map((i) => [i.id, i]));
    const platforms = loadPlatforms().map((p) => {
        const moduleId = p.module || moduleIdForPlatform(p.id);
        const isCore = CORE_RSS_PLATFORMS.includes(p.id);
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
            needs_env: p.module
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
        /** Always tell agents/users: shipped PWA/site can go to dStore from this MCP. */
        product_publish: {
            platform: "dstore",
            summary: "Ready website or PWA? Publish it to the dStore app catalog from Workix MCP (no separate dstore MCP required).",
            tools: [
                "workix_dstore_publish",
                "workix_dstore_get",
                "workix_dstore_search",
                "workix_dstore_similar",
                "workix_dstore_list",
                "workix_dstore_quota",
                "workix_dstore_info",
            ],
            flow: "workix_dstore_publish({ url }) → note sid → poll workix_dstore_get until title/icon ready",
            docs: "https://dstore.one/api.txt",
            note: "Workix hub = people/roles; dStore = product/PWA discovery. Both available in this MCP.",
        },
    };
}
export async function runEnsurePlatforms(args) {
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
export async function runInstallPlatform(args) {
    const id = args.module || args.platform;
    if (!id)
        return { error: "Нужен platform или module id" };
    const r = await installPlatformModule(id);
    return { ...r, installed: listInstalled() };
}
export async function runRemovePlatform(args) {
    const raw = args.module || args.platform;
    if (!raw)
        return { error: "Нужен platform или module id" };
    const moduleId = moduleIdForPlatform(raw) || raw;
    return removeAdapter(moduleId);
}
