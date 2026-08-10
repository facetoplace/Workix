export interface Preset {
    label: string;
    hours?: number;
    limit?: number;
    keywords?: string[];
    /** Subset of `keywords` strong enough to carry a card alone. */
    strong?: string[];
    minus?: string[];
    include_jobs?: boolean;
    include_services?: boolean;
    watch_sources?: string[];
    platforms?: string[];
}
export declare function loadPresets(): Record<string, Preset>;
export declare function getPreset(name: string): Preset | undefined;
