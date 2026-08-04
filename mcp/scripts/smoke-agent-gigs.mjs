import { fetchGrowthTalentJobs } from "../dist/adapters/growth_talent.js";
import { fetchClawEarnJobs } from "../dist/adapters/claw_earn.js";
import { fetchSeekClawJobs } from "../dist/adapters/seekclaw.js";
import { fetchRentAHumanJobs } from "../dist/adapters/rentahuman.js";
import { fetchSuperteamEarnJobs } from "../dist/adapters/superteam_earn.js";

const key = process.env.SUPERTEAM_EARN_API_KEY || "";
if (key) process.env.SUPERTEAM_EARN_BASE ||= "https://superteam.fun";

const runs = [
  ["growth_talent", () => fetchGrowthTalentJobs({ pages: 1, limit: 5, remote: true })],
  ["claw_earn", () => fetchClawEarnJobs({ limit: 5 })],
  ["seekclaw", () => fetchSeekClawJobs({ limit: 5 })],
  ["rentahuman", () => fetchRentAHumanJobs({ pages: 1, limit: 5 })],
  ["superteam_earn", () => fetchSuperteamEarnJobs({ take: 5 })],
];

for (const [name, fn] of runs) {
  try {
    const r = await fn();
    console.log(
      name,
      "jobs=",
      r.jobs.length,
      "err=",
      r.error || "-",
      "sample=",
      (r.jobs[0]?.title || "-").slice(0, 70),
    );
  } catch (e) {
    console.log(name, "THROW", e instanceof Error ? e.message : e);
  }
}
