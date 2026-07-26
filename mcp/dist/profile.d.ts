export interface ProfileFilters {
    keywords: string[];
    minus: string[];
    min_budget?: number;
    focus?: string;
}
export declare function loadProfile(): string;
export declare function profilePathUsed(): string;
/** Parse YAML-like filter block from profile markdown. */
export declare function parseProfileFilters(text?: string): ProfileFilters;
