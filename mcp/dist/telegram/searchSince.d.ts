export declare function telegramSearchSince(explicit?: string): {
    since: string;
    source: "explicit" | "checkpoint" | "fallback_30d";
};
