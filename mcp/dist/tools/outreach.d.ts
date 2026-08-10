/** Log a draft / sent outreach (TG, HH, email, board). Local store only. */
export declare function runOutreachLog(args: {
    status: string;
    channel: string;
    contact: string;
    text: string;
    project?: string;
    url?: string;
    job_id?: string;
    note?: string;
    at?: string;
    id?: string;
}): Promise<unknown>;
/** List recent outreach; check before writing the same contact again. */
export declare function runOutreachList(args: {
    status?: string;
    contact?: string;
    channel?: string;
    job_id?: string;
    limit?: number;
}): Promise<unknown>;
