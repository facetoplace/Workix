import { careerjetConfigured, fetchCareerjetJobs, } from "../adapters/careerjet.js";
export const meta = {
    id: "careerjet",
    version: "1.0.0",
    platforms: ["careerjet"],
    envKeys: [
        "CAREERJET_AFFID",
        "CAREERJET_LOCALE",
        "CAREERJET_KEYWORDS",
        "CAREERJET_LOCATION",
        "CAREERJET_REFERER",
    ],
};
export function configured() {
    return careerjetConfigured();
}
export async function fetchJobs(_ctx, opts) {
    const kw = Array.isArray(opts?.keywords) ? opts.keywords : [];
    return fetchCareerjetJobs({
        keywords: typeof opts?.query === "string" ? opts.query : kw.join(" ") || undefined,
    });
}
