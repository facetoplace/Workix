import { loadEnv } from "../dist/env.js";
import { runDigest } from "../dist/tools/digest.js";
import { runSourcesStatus } from "../dist/tools/sources_status.js";

loadEnv();

const preset = process.argv[2] || "mobile_dev";

console.log("=== sources_status ===");
console.log(JSON.stringify(await runSourcesStatus(), null, 2));

console.log(`\n=== digest preset=${preset} ===`);
const r = await runDigest({
  preset,
  only_new: false,
});
console.log(typeof r === "object" && r && "summary" in r ? r.summary : r);
if (r?.errors?.length) console.log("\nerrors:", r.errors);
console.log("\ncount:", r?.count, "matched:", r?.total_matched);
