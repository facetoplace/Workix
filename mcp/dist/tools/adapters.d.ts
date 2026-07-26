export declare function runListPlatforms(): Promise<unknown>;
export declare function runEnsurePlatforms(args: {
    platforms?: string[];
    modules?: string[];
}): Promise<unknown>;
export declare function runInstallPlatform(args: {
    platform?: string;
    module?: string;
}): Promise<unknown>;
export declare function runRemovePlatform(args: {
    platform?: string;
    module?: string;
}): Promise<unknown>;
