export declare function browserProfileDir(name: string): string;
/** Open `url` in the profile, run `extract` in the page after `waitMs`, return its result. */
export declare function withProfilePage<T>(profile: string, url: string, extract: (...a: unknown[]) => unknown, opts?: {
    waitMs?: number;
    timeoutMs?: number;
    scrolls?: number;
    headful?: boolean;
}): Promise<{
    data?: T;
    error?: string;
}>;
