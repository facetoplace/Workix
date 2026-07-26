import { loadEnv } from "../env.js";
import { fetchJson } from "../http.js";
import { jobId } from "../store.js";
import type { Job } from "../types.js";

const KWORK_API = "https://api.kwork.ru/";

interface KworkResponse<T> {
  success?: boolean;
  response?: T;
  error_code?: string | number;
  message?: string;
  paging?: { pages?: number };
}

let cachedToken: string | null = null;

export function kworkConfigured(): boolean {
  loadEnv();
  return Boolean(
    process.env.KWORK_LOGIN &&
      process.env.KWORK_PASSWORD &&
      process.env.KWORK_PHONE4 &&
      process.env.KWORK_API_BASIC_AUTH,
  );
}

async function apiRequest<T>(
  apiMethod: string,
  params: Record<string, string | number>,
): Promise<KworkResponse<T>> {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    query.set(key, String(value));
  }
  const proxy = process.env.KWORK_PROXY || undefined;
  const auth = process.env.KWORK_API_BASIC_AUTH!;
  const result = await fetchJson<KworkResponse<T>>(
    `${KWORK_API}${apiMethod}?${query.toString()}`,
    {
      headers: {
        Authorization: auth.startsWith("Basic ") ? auth : `Basic ${auth}`,
      },
      method: "POST",
      proxy,
    },
  );
  if (!result.data) {
    throw new Error(
      `Kwork ${apiMethod}: ${result.error || `HTTP ${result.status}`}`,
    );
  }
  return result.data;
}

async function getToken(): Promise<string> {
  if (cachedToken) return cachedToken;
  const login = process.env.KWORK_LOGIN!;
  const password = process.env.KWORK_PASSWORD!;
  let response = await apiRequest<{ token?: string }>("signIn", {
    login,
    password,
  });
  if (String(response.error_code) === "192") {
    response = await apiRequest<{ token?: string }>("signIn", {
      login,
      password,
      phone_last: process.env.KWORK_PHONE4!,
    });
  }
  const token = response.response?.token;
  if (!response.success || !token) {
    throw new Error(
      `Kwork signIn failed: ${response.message || response.error_code || "unknown error"}`,
    );
  }
  cachedToken = token;
  return token;
}

async function client() {
  loadEnv();
  if (!kworkConfigured()) {
    throw new Error(
      "Kwork не настроен. Задайте KWORK_LOGIN, KWORK_PASSWORD, KWORK_PHONE4 и KWORK_API_BASIC_AUTH.",
    );
  }
  return {
    async getProjects() {
      const token = await getToken();
      const first = await apiRequest<Record<string, unknown>[]>("projects", {
        token,
        categories: "",
        page: 0,
      });
      const projects = [...(first.response || [])];
      const pages = Math.min(first.paging?.pages || 1, 20);
      for (let page = 2; page <= pages; page += 1) {
        const next = await apiRequest<Record<string, unknown>[]>("projects", {
          token,
          categories: "",
          page,
        });
        projects.push(...(next.response || []));
      }
      return { ...first, response: projects };
    },
    async getMe() {
      const response = await apiRequest<unknown>("actor", {
        token: await getToken(),
      });
      return response.response;
    },
  };
}

function mapProject(p: Record<string, unknown>): Job | null {
  const idNum = p.id ?? p.project_id;
  const title = String(p.name || p.title || "").trim();
  const description = String(p.description || p.want_description || "").trim();
  if (!title) return null;

  const link =
    typeof p.url === "string" && p.url.startsWith("http")
      ? p.url
      : `https://kwork.ru/projects/${idNum}`;

  const budgetParts: string[] = [];
  if (p.price_limit != null) budgetParts.push(String(p.price_limit));
  if (p.possible_price_limit != null)
    budgetParts.push(`~${p.possible_price_limit}`);

  const dateRaw = p.date_confirm || p.date_create || p.date || Date.now();
  const date =
    typeof dateRaw === "number"
      ? new Date(dateRaw * (dateRaw < 1e12 ? 1000 : 1)).toISOString()
      : new Date(String(dateRaw)).toISOString();

  return {
    id: jobId("kwork", link),
    platform: "kwork",
    kind: "gig",
    title,
    description,
    link,
    date,
    budget: budgetParts.length ? budgetParts.join(" / ") : undefined,
    fetchedAt: new Date().toISOString(),
    raw: p,
  };
}

export async function fetchKworkJobs(): Promise<{
  jobs: Job[];
  error?: string;
}> {
  if (!kworkConfigured()) {
    return {
      jobs: [],
      error: "Kwork credentials missing (optional for digest)",
    };
  }
  try {
    const kw = await client();
    const resp = await kw.getProjects();
    const list = (resp?.response || resp || []) as Record<string, unknown>[];
    const jobs = list.map(mapProject).filter(Boolean) as Job[];
    return { jobs };
  } catch (e) {
    return {
      jobs: [],
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

export async function kworkGetMe(): Promise<unknown> {
  const kw = await client();
  return kw.getMe();
}
