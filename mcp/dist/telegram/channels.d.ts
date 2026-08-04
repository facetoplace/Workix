export type TgChannel = {
    id: string;
    title?: string;
    url: string;
    kind?: string;
    priority?: string;
    note?: string;
};
export declare function parseTgUsername(urlOrUser: string): string;
export declare function loadTgChannels(): {
    path: string | null;
    channels: TgChannel[];
    note?: string;
};
