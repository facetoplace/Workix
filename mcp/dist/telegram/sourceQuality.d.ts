export interface TelegramSourceQuality {
    source: string;
    searches: number;
    hits: number;
    errors: number;
    last_at?: string;
    last_query?: string;
    score: number;
}
export declare function listTelegramSourceQuality(): TelegramSourceQuality[];
export declare function recordTelegramSourceQuality(input: {
    source: string;
    hits: number;
    errors: number;
    query: string;
    at?: string;
}): void;
