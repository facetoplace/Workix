import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const REPO = join(ROOT, "..");
config({ path: join(REPO, ".env"), quiet: true });
config({ path: join(ROOT, ".env"), override: true, quiet: true });

const require = createRequire(import.meta.url);

const login = process.env.KWORK_LOGIN;
const password = process.env.KWORK_PASSWORD;
const phone4 = process.env.KWORK_PHONE4;

console.log("configured:", Boolean(login && password && phone4));
console.log("login:", login);

function maskProxy(u) {
  return String(u).replace(/\/\/([^:/@]+):([^@]+)@/, "//$1:***@");
}

async function loadSocksPool() {
  if (process.env.KWORK_PROXY) return [process.env.KWORK_PROXY.trim()];
  const raw = process.env.PROXY_1 || "";
  if (!raw) return [];
  if (/^socks/i.test(raw) && !/[\n,;|]/.test(raw)) return [raw.trim()];
  if (!(raw.startsWith("http") && raw.includes("/sub"))) return [];
  console.log("fetching proxy subscription…");
  const res = await fetch(raw, { signal: AbortSignal.timeout(20000) });
  const text = await res.text();
  let body = text;
  const compact = text.replace(/\s/g, "");
  if (/^[A-Za-z0-9+/=]+$/.test(compact) && compact.length > 80) {
    body = Buffer.from(compact, "base64").toString("utf8");
  }
  const socks = body
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => /^socks5?:\/\//i.test(l));
  console.log("socks in pool:", socks.length);
  return socks;
}

async function tryOnce(label, proxy) {
  console.log("\n===", label, proxy ? maskProxy(proxy) : "(direct)", "===");
  const Kwork = require("kwork-api");
  let kw;
  try {
    kw = proxy
      ? new Kwork(login, password, phone4, proxy)
      : new Kwork(login, password, phone4);
  } catch (e) {
    console.error("construct FAIL:", e?.message || e);
    return false;
  }

  try {
    const me = await Promise.race([
      kw.getMe(),
      new Promise((_, rej) =>
        setTimeout(() => rej(new Error("timeout 45s")), 45000),
      ),
    ]);
    const r = me?.response || me || {};
    console.log(
      "getMe:",
      JSON.stringify({
        id: r.id,
        username: r.username || r.login || r.name,
        success: me?.success,
        error: me?.error || me?.message,
      }),
    );
    if (me?.success === false || me?.error) return false;
  } catch (e) {
    console.error("getMe FAIL:", e?.message || e);
    return false;
  }

  try {
    const resp = await Promise.race([
      kw.getProjects(),
      new Promise((_, rej) =>
        setTimeout(() => rej(new Error("timeout 45s")), 45000),
      ),
    ]);
    const list = resp?.response || resp || [];
    const arr = Array.isArray(list) ? list : [];
    console.log("projects:", arr.length);
    for (const p of arr.slice(0, 8)) {
      const title = p.name || p.title || "?";
      const price = p.price_limit ?? p.possible_price_limit ?? "-";
      console.log(`- ${price} | ${String(title).slice(0, 90)}`);
    }
    return arr.length >= 0;
  } catch (e) {
    console.error("getProjects FAIL:", e?.message || e);
    return false;
  }
}

const pool = await loadSocksPool();
// shuffle a few candidates
const candidates = [...pool].sort(() => Math.random() - 0.5).slice(0, 4);

let ok = await tryOnce("direct", undefined);
if (!ok) {
  for (let i = 0; i < candidates.length; i++) {
    ok = await tryOnce(`socks-${i + 1}`, candidates[i]);
    if (ok) break;
  }
}
console.log("\nresult:", ok ? "OK" : "FAILED");
process.exit(ok ? 0 : 1);
