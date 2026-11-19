import type { Job } from "../types.js";
export declare const JOIN_GRAPHQL_URL = "https://join.com/candidate-api/graphql";
type JoinRow = {
    idParam?: unknown;
    company?: {
        id?: unknown;
        name?: unknown;
        domain?: unknown;
    };
    companyId?: unknown;
    country?: {
        iso3166?: unknown;
        name?: unknown;
    };
    id?: unknown;
    title?: unknown;
    updatedAt?: unknown;
    createdAt?: unknown;
    category?: {
        name?: unknown;
    };
    employmentType?: {
        name?: unknown;
    };
    workplaceType?: unknown;
};
export interface JoinQuery {
    companyId: number;
    page?: number;
    pageSize?: number;
}
declare function rowToJob(row: JoinRow, fetchedAt: string): Job | undefined;
export declare function normaliseJoinPayload(payload: unknown): JoinRow[];
export declare function buildJoinRequest(opts: JoinQuery): {
    query: string;
    variables: Record<string, unknown>;
};
export declare function fetchJoinJobs(opts: JoinQuery): Promise<{
    jobs: Job[];
    error?: string;
}>;
/**
 * Resolve a public Join company domain (e.g. "dfrost") to its numeric companyId
 * by reading the company's public page. Join's GraphQL jobs query is keyed by
 * companyId, not by domain, and there is no public "search by domain" field.
 */
export declare function resolveJoinCompanyId(domain: string): Promise<number | undefined>;
export declare const _joinInternals: {
    rowToJob: typeof rowToJob;
};
export {};
