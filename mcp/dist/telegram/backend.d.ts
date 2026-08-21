import type { TdAuthState, TgBackend, TgMessageHit } from "./types.js";
export type { TdAuthState, TgMessageHit, TgBackend };
export declare function resolveBackend(): Promise<{
    backend: TgBackend;
    reason: string;
}>;
export declare function getAuthState(): Promise<{
    state: TdAuthState;
    raw?: string;
    hint?: string;
    backend?: TgBackend;
    reason?: string;
}>;
export declare function searchChat(chatRef: string, query: string, limit?: number, since?: string): Promise<TgMessageHit[]>;
export declare function tgSetPhone(phone: string): Promise<unknown>;
export declare function tgCheckCode(code: string): Promise<unknown>;
export declare function tgCheckPassword(password: string): Promise<unknown>;
export { tgCredentialsConfigured } from "./credentials.js";
export declare function probeTelegramDeps(): Promise<{
    ok: boolean;
    backend: TgBackend;
    reason: string;
    install: string;
    tdl: boolean;
    prebuilt: boolean;
    gramjs: boolean;
    error?: string;
}>;
export declare function closeTelegram(): Promise<void>;
