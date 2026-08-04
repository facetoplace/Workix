/** Optional peer deps — installed only when enabling Telegram module. */
declare module "tdl" {
  export function configure(options: Record<string, unknown>): void;
  export function createClient(options: Record<string, unknown>): {
    invoke: (query: Record<string, unknown>) => Promise<Record<string, unknown>>;
    close?: () => Promise<void>;
    login?: (details?: unknown) => Promise<void>;
    on?: (event: string, cb: (...args: unknown[]) => void) => void;
  };
}

declare module "prebuilt-tdlib" {
  export function getTdjson(): string;
}

declare module "telegram" {
  export class TelegramClient {
    constructor(...args: unknown[]);
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    checkAuthorization(): Promise<boolean>;
    start(params: Record<string, unknown>): Promise<void>;
    getMe(): Promise<Record<string, unknown>>;
    getEntity(ref: unknown): Promise<Record<string, unknown>>;
    iterMessages(entity: unknown, opts?: Record<string, unknown>): AsyncIterable<Record<string, unknown>>;
    session: { save(): string };
  }
}

declare module "telegram/sessions/index.js" {
  export class StringSession {
    constructor(session?: string);
  }
}
