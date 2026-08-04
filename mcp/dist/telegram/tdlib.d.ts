import { tgCredentialsConfigured } from "./credentials.js";
import type { TdAuthState, TgMessageHit } from "./types.js";
export type { TdAuthState, TgMessageHit };
export { tgCredentialsConfigured };
type TdClient = {
    invoke: (query: Record<string, unknown>) => Promise<Record<string, unknown>>;
    close?: () => Promise<void>;
    on?: (event: string, cb: (...args: unknown[]) => void) => void;
};
export declare function probeTdlibDeps(): Promise<{
    ok: boolean;
    tdl: boolean;
    prebuilt: boolean;
    error?: string;
    install: string;
}>;
export declare function getTdClient(): Promise<TdClient>;
export declare function getAuthState(): Promise<{
    state: TdAuthState;
    raw?: string;
    hint?: string;
    deps?: Awaited<ReturnType<typeof probeTdlibDeps>>;
}>;
export declare function tgSetPhone(phone: string): Promise<unknown>;
export declare function tgCheckCode(code: string): Promise<unknown>;
export declare function tgCheckPassword(password: string): Promise<unknown>;
export declare function resolveChatId(urlOrUser: string): Promise<{
    chatId: number;
    title: string;
    username?: string;
}>;
export declare function searchChat(chatRef: string, query: string, limit?: number): Promise<TgMessageHit[]>;
export declare function closeTdClient(): Promise<void>;
export declare function lastLoadError(): string | null;
