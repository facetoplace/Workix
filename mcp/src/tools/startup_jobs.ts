import { callStartupJobsMcp } from "../adapters/startup_jobs_mcp.js";

export async function runStartupJobsRead(args: { tool: string; args?: Record<string, unknown> }) {
  const result = await callStartupJobsMcp(args.tool, args.args || {});
  return { read_only: true, tool: args.tool, ...result };
}
