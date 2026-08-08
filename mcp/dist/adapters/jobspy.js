/**
 * Bridge to JobSpy (https://github.com/speedyapply/JobSpy, MIT) — Indeed,
 * Glassdoor, ZipRecruiter, Naukri and BDJobs.
 *
 * We shell out to the user's own `jobspy` install rather than porting its
 * scrapers. Two reasons, both deliberate:
 *
 *  - Those scrapers reach private endpoints with credentials lifted from the
 *    boards' own mobile apps. Keeping them upstream keeps that out of our
 *    published package: the operator installs jobspy themselves and the keys
 *    live in their environment.
 *  - Eight anti-bot-protected sites is a full-time maintenance job. Upstream
 *    already does it.
 *
 * Optional by design: without Python or the package, every call returns an
 * actionable error instead of throwing — same contract as the TDLib path.
 */
import { spawn } from "node:child_process";
import { jobId } from "../store.js";
/** Our platform id → JobSpy's `site_name`. */
const SITE_BY_PLATFORM = {
    indeed: "indeed",
    glassdoor: "glassdoor",
    ziprecruiter: "zip_recruiter",
    naukri: "naukri",
    bdjobs: "bdjobs",
};
export const JOBSPY_PLATFORMS = Object.keys(SITE_BY_PLATFORM);
/**
 * python-jobspy pins NUMPY==1.26.3, which has no wheels past CPython 3.12 — on
 * 3.13 pip falls back to a source build and dies in meson. Verified 2026-08-09
 * with python-jobspy 1.1.82. So the ceiling is real and belongs in the hint:
 * "Python >= 3.10" sends people straight into that wall.
 */
const INSTALL_HINT = "JobSpy is not installed. It is optional: pip install -U python-jobspy — " +
    "needs Python 3.10–3.12 (it pins numpy 1.26.3, which does not build on 3.13). " +
    "On 3.13, make a venv with an older interpreter and point PYTHON_BIN at it.";
/**
 * These boards are reached with credentials baked into the jobspy release, not
 * ones we hold. When a board rotates them every jobspy user breaks at once and
 * the fix is always the same — upgrade and pick up the new release. Raw HTTP
 * errors do not say that, so say it for them.
 */
const STALE_HINT = "This usually means the credentials baked into your jobspy release were " +
    "rotated by the board. Upgrade to pick up the new ones: " +
    "pip install -U python-jobspy";
const STALE_SIGNALS = /\b(401|403|unauthorized|forbidden|invalid[_ -]?api[_ -]?key|authentication)\b/i;
/** A Python exception from jobspy's own code — upgrading will not fix a TypeError. */
const UPSTREAM_BUG = /\b(TypeError|AttributeError|KeyError|ImportError|NameError)\b/;
const BUG_HINT = "That is an exception inside jobspy itself, not a block — upgrading or " +
    "retrying will not help. Check its issue tracker: " +
    "https://github.com/speedyapply/JobSpy/issues";
const BLOCKED_HINT = "The board refused the request. Usually an IP-level block (Cloudflare) or a " +
    "rate limit rather than anything wrong on your side — try again later, from " +
    "a different IP, or pass proxies.";
/** Pick the one piece of advice that actually applies to this failure. */
function diagnose(stderr) {
    if (UPSTREAM_BUG.test(stderr))
        return ` ${BUG_HINT}`;
    if (/\b(401|invalid[_ -]?api[_ -]?key|authentication)\b/i.test(stderr))
        return ` ${STALE_HINT}`;
    if (STALE_SIGNALS.test(stderr))
        return ` ${BLOCKED_HINT}`;
    if (/\b(timeout|timed out|ReadTimeout|Max retries exceeded)\b/i.test(stderr)) {
        return " The board did not respond — it may be unreachable or geo-blocked from here.";
    }
    return "";
}
const VERSION_PROBE = [
    "import jobspy",
    "try:",
    "    from importlib.metadata import version as _v",
    "    print('ok', _v('python-jobspy'))",
    "except Exception:",
    "    print('ok', getattr(jobspy, '__version__', 'unknown'))",
].join("\n");
function pythonCandidates(env) {
    return [env.PYTHON_BIN, "python3", "python"].filter(Boolean);
}
/** Run `bin` with `-c script`, resolving stdout. Never rejects. */
function runPython(bin, script, timeoutMs) {
    return new Promise((resolve) => {
        let child;
        try {
            child = spawn(bin, ["-c", script], { stdio: ["ignore", "pipe", "pipe"] });
        }
        catch {
            resolve({ ok: false, stdout: "", stderr: `cannot spawn ${bin}` });
            return;
        }
        let stdout = "";
        let stderr = "";
        const timer = setTimeout(() => {
            child.kill();
            resolve({ ok: false, stdout, stderr: `${bin}: timed out` });
        }, timeoutMs);
        child.stdout.on("data", (c) => (stdout += c.toString()));
        child.stderr.on("data", (c) => (stderr += c.toString()));
        child.on("error", (e) => {
            clearTimeout(timer);
            resolve({ ok: false, stdout, stderr: e.message });
        });
        child.on("close", (code) => {
            clearTimeout(timer);
            resolve({ ok: code === 0, stdout, stderr });
        });
    });
}
let cachedBin;
let cachedVersion;
/** First interpreter that can import jobspy, or null. Probed once per process. */
async function resolvePython(env) {
    if (cachedBin !== undefined)
        return cachedBin;
    for (const bin of pythonCandidates(env)) {
        const r = await runPython(bin, VERSION_PROBE, 20000);
        if (r.ok && r.stdout.startsWith("ok")) {
            cachedBin = bin;
            cachedVersion = r.stdout.trim().split(/\s+/)[1] || "unknown";
            return bin;
        }
    }
    cachedBin = null;
    return null;
}
export async function jobspyAvailable(env) {
    return (await resolvePython(env)) !== null;
}
/** Installed python-jobspy version, or null when the bridge is unavailable. */
export async function jobspyStatus(env) {
    const bin = await resolvePython(env);
    return {
        available: bin !== null,
        python: bin || undefined,
        version: bin ? cachedVersion : undefined,
        platforms: JOBSPY_PLATFORMS,
        hint: bin
            ? "Keep it current — board credentials ship inside the release: pip install -U python-jobspy"
            : INSTALL_HINT,
    };
}
function money(row) {
    const { min_amount: lo, max_amount: hi } = row;
    if (lo == null && hi == null)
        return undefined;
    const cur = row.currency || "USD";
    const per = row.interval ? `/${row.interval}` : "";
    const range = lo != null && hi != null ? `${lo}–${hi}` : String(lo ?? hi);
    return `${range} ${cur}${per}`;
}
export async function fetchJobSpyJobs(opts) {
    const site = SITE_BY_PLATFORM[opts.platform];
    if (!site)
        return { jobs: [], error: `jobspy: unknown platform ${opts.platform}` };
    const bin = await resolvePython(opts.env);
    if (!bin)
        return { jobs: [], error: INSTALL_HINT };
    // Arguments go through JSON, never string interpolation into Python source.
    const params = {
        site_name: [site],
        search_term: opts.what || "",
        results_wanted: Math.min(Math.max(opts.limit ?? 50, 1), 200),
        hours_old: opts.hours,
        location: opts.location,
        proxies: opts.proxies?.length ? opts.proxies : undefined,
    };
    const script = [
        "import json,sys",
        "from jobspy import scrape_jobs",
        `p = json.loads(sys.stdin.read() or ${JSON.stringify(JSON.stringify(params))})`,
        "p = {k: v for k, v in p.items() if v is not None}",
        "df = scrape_jobs(**p)",
        "sys.stdout.write(df.to_json(orient='records', date_format='iso') if df is not None and len(df) else '[]')",
    ].join("\n");
    const res = await runPython(bin, script, 180000);
    if (!res.ok) {
        const tail = res.stderr.trim().split("\n").slice(-3).join(" ").slice(0, 400);
        return {
            jobs: [],
            error: `jobspy ${opts.platform} (v${cachedVersion || "?"}): ${tail || "failed"}.` +
                diagnose(res.stderr),
        };
    }
    let rows;
    try {
        rows = JSON.parse(res.stdout.trim() || "[]");
    }
    catch {
        return { jobs: [], error: `jobspy ${opts.platform}: unparseable output` };
    }
    // JobSpy logs board failures and returns an empty frame rather than raising,
    // so a blocked board and a genuinely empty search look identical from here.
    // Verified 2026-08-09: Glassdoor answers 403 and still exits 0. Surface it —
    // "0 results" with no reason is the worst possible answer.
    if (!rows.length) {
        const logged = res.stderr
            .split("\n")
            .filter((l) => /ERROR/.test(l) && /JobSpy/i.test(l))
            .map((l) => l.replace(/^.*?JobSpy:?/i, "").trim())
            .filter(Boolean);
        if (logged.length) {
            return {
                jobs: [],
                error: `jobspy ${opts.platform} (v${cachedVersion || "?"}) returned nothing and ` +
                    `logged: ${logged.slice(0, 3).join(" | ").slice(0, 300)}.` +
                    diagnose(res.stderr),
            };
        }
    }
    const now = new Date().toISOString();
    const jobs = [];
    for (const row of rows) {
        const link = row.job_url;
        if (!link || !row.title)
            continue;
        let date = now;
        if (row.date_posted) {
            const t = Date.parse(row.date_posted);
            if (!Number.isNaN(t))
                date = new Date(t).toISOString();
        }
        jobs.push({
            id: jobId(opts.platform, link),
            platform: opts.platform,
            kind: "job",
            title: `${row.title}${row.company ? " @ " + row.company : ""}`,
            description: (row.description || "").replace(/<[^>]+>/g, " ").slice(0, 4000),
            link,
            date,
            budget: money(row),
            fetchedAt: now,
            raw: { location: row.location, is_remote: row.is_remote, via: "jobspy" },
        });
    }
    return { jobs };
}
