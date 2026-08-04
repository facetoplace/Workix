import { loadEnv } from "../dist/env.js";
import { runDigest } from "../dist/tools/digest.js";
import { runSourcesStatus } from "../dist/tools/sources_status.js";

// kwork-api can emit late unhandledRejection after failed signIn (expired proxy TLS).
process.on("unhandledRejection", (err) => {
  console.error(
    "[smoke] unhandledRejection:",
    err instanceof Error ? err.message : err,
  );
});

loadEnv();

const preset = process.argv[2] || "mobile_dev";

console.log("=== sources_status ===");
console.log(JSON.stringify(await runSourcesStatus(), null, 2));

console.log(`\n=== digest preset=${preset} ===`);
// Full board sweep needs working Kwork/proxy TLS. Default smoke sticks to FL RSS
// unless WORKIX_SMOKE_FULL=1.
const full = process.env.WORKIX_SMOKE_FULL === "1";
const r = await runDigest({
  preset,
  only_new: false,
  ...(full ? {} : { platforms: ["fl_ru"] }),
});
console.log(typeof r === "object" && r && "summary" in r ? r.summary : r);
if (r?.errors?.length) console.log("\nerrors:", r.errors);
console.log("\ncount:", r?.count, "matched:", r?.total_matched);
console.log(`[smoke-preset] OK${full ? " (full)" : " (fl_ru only)"}`);
