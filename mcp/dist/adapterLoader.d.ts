import { type AdapterContext, type AdapterModule, type AdapterRegistry, type RegistryModule } from "./adapterModule.js";
import type { Job } from "./types.js";
export declare function getAdapterContext(): AdapterContext;
export declare function moduleIdForPlatform(platformId: string): string | null;
export declare function registryUrl(): string;
export declare function fetchRegistry(force?: boolean): Promise<AdapterRegistry>;
export declare function listInstalled(): Array<{
    id: string;
    version: string;
    path: string;
}>;
export declare function removeAdapter(id: string): Promise<{
    ok: boolean;
    removed?: string[];
    error?: string;
}>;
export declare function installModule(entry: RegistryModule, opts?: {
    force?: boolean;
}): Promise<{
    ok: boolean;
    id: string;
    version: string;
    error?: string;
}>;
export declare function ensureAdapter(moduleId: string): Promise<{
    ok: boolean;
    module?: AdapterModule;
    error?: string;
}>;
export declare function ensurePlatforms(platformIds: string[]): Promise<{
    ensured: string[];
    errors: string[];
}>;
export declare function getAdapter(moduleId: string): Promise<AdapterModule | null>;
export declare function callFetchJobs(moduleId: string, opts?: Record<string, unknown>): Promise<{
    jobs: Job[];
    error?: string;
    totalCount?: number;
}>;
export declare function installPlatformModule(platformOrModuleId: string): Promise<{
    ok: boolean;
    id?: string;
    version?: string;
    error?: string;
}>;
