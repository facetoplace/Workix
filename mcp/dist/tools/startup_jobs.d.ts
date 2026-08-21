export declare function runStartupJobsRead(args: {
    tool: string;
    args?: Record<string, unknown>;
}): Promise<{
    data?: unknown;
    text?: string;
    structured?: unknown;
    isError?: boolean;
    error?: string;
    read_only: boolean;
    tool: string;
}>;
