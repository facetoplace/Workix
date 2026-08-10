declare const DatabaseSync: typeof import("node:sqlite").DatabaseSync;
type Db = InstanceType<typeof DatabaseSync>;
export declare function resolveDataDir(): string;
export declare function db(): Db;
export declare function metaGet(key: string): string | undefined;
export declare function metaSet(key: string, value: string): void;
/** SQLite takes null, not undefined, and has no boolean type. */
export declare function nullable(v: unknown): string | null;
export {};
