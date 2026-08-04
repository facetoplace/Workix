export declare function runTgStatus(): Promise<unknown>;
export declare function runTgAuth(args: {
    phone?: string;
    code?: string;
    password?: string;
}): Promise<unknown>;
export declare function runTgSearch(args: {
    query?: string;
    chats?: string[];
    limit?: number;
    save?: boolean;
}): Promise<unknown>;
