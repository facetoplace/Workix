export interface Preset {
    label: string;
    hours?: number;
    limit?: number;
    keywords?: string[];
    minus?: string[];
    include_jobs?: boolean;
    include_services?: boolean;
    watch_sources?: string[];
    platforms?: string[];
}
export declare function loadPresets(): Record<string, Preset>;
export declare function getPreset(name: string): Preset | undefined;
