/** Generic role/tech words that are NOT a company/product name. */
export const APPLIED_STOP = new Set([
    "flutter", "react", "native", "mobile", "android", "swift", "kotlin", "dart",
    "node", "nodejs", "python", "backend", "frontend", "fullstack", "developer",
    "engineer", "senior", "middle", "junior", "lead", "techlead", "remote",
    "vacancy", "vacancies", "startup", "fulltime", "parttime", "part", "time",
    "unity", "golang", "typescript", "javascript", "reactnative", "rust", "solidity",
    "blockchain", "devops", "sre", "kubernetes", "docker", "aqa", "hiring", "job",
    "jobs", "work", "team", "bank", "crypto", "web3", "llm", "aiengineer", "fintech",
    "founding", "staff", "platform", "software", "programmer", "middleplus",
]);
export const applyNorm = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9а-яё]+/gi, " ").replace(/\s+/g, " ").trim();
/** Candidate self-adverts (résumés / "for hire"), not vacancies. */
export const RESUME_RE = /#резюме|#resume|#ищу\b|ищу работу|ищу проект|рассмотрю предложени|открыт к предложени|обо мне[:\s]|мои навыки|мой стек|готов присоединиться к стартапу|\[\s*for\s*hire\s*\]|\bfor hire\b|\bopen to work\b|available for (hire|work|new projects|freelance)|seeking (a\s+)?(new\s+)?(remote\s+)?(role|position|opportunit|job)/i;
/**
 * Company/advertiser a posting is attributed to, from the title ("Senior X @
 * Company" / "Company: …"). Used to cap any single advertiser (talent-pool
 * marketplaces like Lemon.io cross-post dozens of near-identical ads).
 */
export function advertiserKey(title) {
    const t = String(title || "");
    let m = t.match(/@\s*([\p{L}0-9][\p{L}0-9 .&'\-]{1,28})\s*$/u);
    if (m)
        return applyNorm(m[1]);
    m = t.match(/^([\p{L}0-9][\p{L}0-9 .&'\-]{1,28})\s*[:–—]/u);
    if (m)
        return applyNorm(m[1]);
    return null;
}
function handleKeys(raw) {
    const out = [];
    for (const m of String(raw || "").matchAll(/@([a-z0-9_]{4,})/gi))
        out.push(m[1].toLowerCase());
    return out;
}
function wordKeys(raw) {
    const out = [];
    for (const tok of String(raw || "").split(/[^A-Za-zА-Яа-яЁё0-9]+/)) {
        if (/^[A-Z0-9]{3,}$/.test(tok))
            out.push(tok.toLowerCase());
        const lw = tok.toLowerCase();
        if (/^[a-z][a-z0-9]{3,}$/.test(lw) && !APPLIED_STOP.has(lw))
            out.push(lw);
    }
    return out;
}
/** Urls (always) + name anchors that are RARE in the corpus (⇒ a real name, not
 * a generic role word). @handles are always trusted. */
export function buildAppliedIndex(outreach, corpus) {
    const urls = new Set();
    const handles = new Set();
    const wordCandidates = new Set();
    for (const r of outreach) {
        if (r.url)
            urls.add(r.url.trim());
        for (const h of [...handleKeys(r.contact || ""), ...handleKeys(r.project || "")])
            handles.add(h);
        for (const w of [...wordKeys(r.contact || ""), ...wordKeys(r.project || "")])
            wordCandidates.add(w);
    }
    const DF_MAX = 6;
    const haystacks = corpus.map((j) => " " + applyNorm(`${j.title} ${(j.description || "").slice(0, 160)}`) + " ");
    const keys = new Set(handles);
    for (const w of wordCandidates) {
        let df = 0;
        for (const h of haystacks)
            if (h.includes(` ${w} `)) {
                if (++df > DF_MAX)
                    break;
            }
        if (df <= DF_MAX)
            keys.add(w);
    }
    return { urls, keys: [...keys] };
}
export function matchApplied(job, idx) {
    if (idx.urls.has(job.link))
        return "url";
    const hay = " " + applyNorm(`${job.title} ${(job.description || "").slice(0, 160)}`) + " ";
    for (const k of idx.keys)
        if (hay.includes(` ${k} `) || hay.includes(` ${k}`))
            return "name";
    return null;
}
/** Split "a OR b, c" into terms. */
export function parseTerms(query) {
    return String(query || "")
        .split(/\s+OR\s+|,|\n/gi)
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean);
}
/**
 * Rank a corpus locally. Word terms match on token boundary (so "ton" ≠
 * "button"); multi-word / special terms ("high load", "node.js") match as
 * substrings. Cross-posts (same title+body across channels) collapse to the
 * best-ranked copy.
 */
export function searchCorpus(corpus, outreach, opts) {
    const nowMs = Date.now();
    const terms = parseTerms(opts.query || "").slice(0, 64);
    const isWordTerm = (t) => /^[0-9a-zа-яё]+$/i.test(t);
    const wordTerms = terms.filter(isWordTerm);
    const phraseTerms = terms.filter((t) => !isWordTerm(t));
    const dropResumes = opts.drop_resumes !== false;
    const outLimit = Math.min(Math.max(Number(opts.limit) || 40, 1), 100);
    const applied = buildAppliedIndex(outreach, corpus);
    const ranked = corpus
        .map((j) => {
        const text = `${j.title}\n${j.description || ""}`.toLowerCase();
        const isResume = RESUME_RE.test(text);
        const tokens = new Set(text.split(/[^0-9a-zа-яё]+/i).filter(Boolean));
        const matched = [
            ...wordTerms.filter((t) => tokens.has(t)),
            ...phraseTerms.filter((t) => text.includes(t)),
        ];
        const ageDays = (nowMs - new Date(j.date).getTime()) / 86_400_000;
        const recency = ageDays <= 3 ? 3 : ageDays <= 7 ? 2 : ageDays <= 14 ? 1 : 0;
        const appliedVia = matchApplied(j, applied);
        return { j, isResume, matched, score: matched.length * 3 + recency, ageDays, appliedVia };
    })
        .filter((x) => (dropResumes ? !x.isResume : true))
        .filter((x) => (terms.length ? x.matched.length > 0 : true))
        .filter((x) => (opts.hide_applied ? !x.appliedVia : true))
        .sort((a, b) => b.score - a.score || a.ageDays - b.ageDays);
    const dupKey = (j) => applyNorm(`${j.title} ${(j.description || "").slice(0, 200)}`).slice(0, 180);
    const byKey = new Map();
    const deduped = [];
    let collapsed = 0;
    for (const x of ranked) {
        const key = dupKey(x.j);
        const seen = byKey.get(key);
        if (seen) {
            collapsed++;
            seen.also.push(x.j.link);
            continue;
        }
        const entry = { also: [] };
        byKey.set(key, entry);
        deduped.push(Object.assign(x, { also: entry.also }));
    }
    // Cap any single advertiser so a talent-pool marketplace (Lemon.io &c.) that
    // cross-posts dozens of near-identical ads can't crowd out everyone else —
    // extras slide below the diverse set rather than being dropped outright.
    const maxAdv = opts.max_per_advertiser ?? 3;
    let ordered = deduped;
    if (maxAdv > 0) {
        const counts = new Map();
        const primary = [];
        const overflow = [];
        for (const x of deduped) {
            const k = advertiserKey(x.j.title);
            if (!k) {
                primary.push(x);
                continue;
            }
            const n = (counts.get(k) || 0) + 1;
            counts.set(k, n);
            (n <= maxAdv ? primary : overflow).push(x);
        }
        ordered = [...primary, ...overflow];
    }
    const top = ordered.slice(0, outLimit);
    const appliedCount = top.filter((x) => x.appliedVia).length;
    return {
        total: top.length,
        duplicates_collapsed: collapsed,
        applied_count: appliedCount,
        open_count: top.length - appliedCount,
        results: top.map((x) => ({
            score: x.score,
            age_days: Math.round(x.ageDays),
            matched_terms: x.matched,
            applied: Boolean(x.appliedVia),
            ...(x.appliedVia ? { applied_via: x.appliedVia } : {}),
            ...(x.also.length ? { cross_posts: x.also.length, also_in: x.also.slice(0, 6) } : {}),
            platform: x.j.platform,
            title: x.j.title,
            link: x.j.link,
            date: x.j.date,
            snippet: (x.j.description || "").slice(0, 280),
        })),
    };
}
