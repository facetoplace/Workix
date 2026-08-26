export type ScanKind = "tg_search" | "tg_dump" | "digest";
/** Record a finished scan and return its per-unit cost. */
export declare function recordScan(input: {
    kind: ScanKind;
    units: number;
    ms: number;
    at?: string;
}): void;
export declare function msToHuman(ms: number): string;
/**
 * Predict how long a scan of `units` (chats × terms) will take, from the
 * average per-unit cost of recent runs of the same kind.
 */
export declare function estimateScan(input: {
    kind: ScanKind;
    units: number;
}): {
    estimated_ms: number;
    estimated_human: string;
    ms_per_unit: number;
    samples: number;
    from_history: boolean;
};
