import type { Job } from "../types.js";
export declare function startupJobsMcpEnabled(): boolean;
export declare function callStartupJobsMcp(tool: string, args?: Record<string, unknown>): Promise<import("../mcpClient.js").McpToolResult>;
export declare function fetchStartupJobsMcp(opts?: {
    keywords?: string[];
    limit?: number;
    remote?: boolean;
}): Promise<{
    jobs: Job[];
    error?: string;
}>;
