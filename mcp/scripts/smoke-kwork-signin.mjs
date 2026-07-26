import axios from "axios";
import { SocksProxyAgent } from "socks-proxy-agent";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
config({ path: join(ROOT, "..", ".env"), quiet: true });

const login = process.env.KWORK_LOGIN;
const password = process.env.KWORK_PASSWORD;
const phone = process.env.KWORK_PHONE4;

async function socksList() {
  const raw = process.env.PROXY_1;
  const res = await fetch(raw, { signal: AbortSignal.timeout(20000) });
  const text = await res.text();
  let body = text;
  const compact = text.replace(/\s/g, "");
  if (/^[A-Za-z0-9+/=]+$/.test(compact) && compact.length > 80) {
    body = Buffer.from(compact, "base64").toString("utf8");
  }
  return body
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => /^socks5?:\/\//i.test(l))
    .sort(() => Math.random() - 0.5);
}

async function signIn(proxy) {
  const agent = proxy ? new SocksProxyAgent(proxy) : undefined;
  const session = axios.create({
    baseURL: "https://api.kwork.ru/",
    headers: { Authorization: "Basic bW9iaWxlX2FwaTpxRnZmUmw3dw==" },
    httpsAgent: agent,
    httpAgent: agent,
    timeout: 25000,
    validateStatus: () => true,
  });
  let resp = await session.post("signIn", null, {
    params: { login, password },
  });
  let data = resp.data;
  console.log(
    "signIn1",
    resp.status,
    JSON.stringify(data).slice(0, 300),
    proxy ? "via proxy" : "direct",
  );
  if (data?.error_code == "192" || data?.error_code === 192) {
    resp = await session.post("signIn", null, {
      params: { login, password, phone_last: phone },
    });
    data = resp.data;
    console.log("signIn2+phone", resp.status, JSON.stringify(data).slice(0, 300));
  }
  return data;
}

console.log("login", login, "phone4", phone);

let data = await signIn(undefined);
if (!(data?.success && data?.response?.token)) {
  const pool = await socksList();
  console.log("trying", Math.min(5, pool.length), "socks…");
  for (const p of pool.slice(0, 5)) {
    try {
      data = await signIn(p);
      if (data?.success && data?.response?.token) {
        console.log("OK token len", data.response.token.length);
        // fetch projects
        const agent = new SocksProxyAgent(p);
        const session = axios.create({
          baseURL: "https://api.kwork.ru/",
          headers: { Authorization: "Basic bW9iaWxlX2FwaTpxRnZmUmw3dw==" },
          httpsAgent: agent,
          timeout: 25000,
        });
        const proj = await session.post("projects", null, {
          params: { token: data.response.token, categories: "", page: 0 },
        });
        const list = proj.data?.response || [];
        console.log("projects", Array.isArray(list) ? list.length : proj.data);
        if (Array.isArray(list)) {
          for (const x of list.slice(0, 6)) {
            console.log(
              "-",
              x.price_limit ?? "-",
              String(x.name || x.title || "").slice(0, 80),
            );
          }
        }
        process.exit(0);
      }
    } catch (e) {
      console.log("proxy fail", e.message);
    }
  }
  console.log("FAILED all attempts");
  process.exit(1);
}

console.log("OK direct, token len", data.response.token.length);
process.exit(0);
