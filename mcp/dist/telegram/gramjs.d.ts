import type { TdAuthState, TgMessageHit } from "./types.js";
type AnyClient = any;
export declare function gramjsSessionPath(): string;
export declare function hasGramjsSession(): boolean;
export declare function probeGramjs(): Promise<{
    ok: boolean;
    error?: string;
    install: string;
}>;
export declare function getGramjsClient(): Promise<AnyClient>;
export declare function saveGramjsSession(c: AnyClient): void;
export declare function gramjsAuthState(): Promise<{
    state: TdAuthState;
    raw?: string;
    hint?: string;
}>;
export declare function gramjsSearchChat(chatRef: string, query: string, limit?: number): Promise<TgMessageHit[]>;
export declare function closeGramjs(): Promise<void>;
export {};
