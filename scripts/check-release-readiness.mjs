import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

const mvpStatusPath = path.join(repoRoot, "docs", "MVP-RELEASE-STATUS.md");
const manualReportPath = path.join(repoRoot, "docs", "FOUNDRY-MANUAL-VALIDATION-REPORT.md");
const [mvpStatus, manualReport] = await Promise.all([
  readFile(mvpStatusPath, "utf8"),
  readFile(manualReportPath, "utf8"),
]);

const failures = [];

if (!/\*\*PASS\*\*/.test(mvpStatus)) {
  failures.push("`docs/MVP-RELEASE-STATUS.md` does not show automated gate PASS.");
}

if (/- Status:\s*pending/i.test(manualReport)) {
  failures.push("Manual validation report status is still pending.");
}

if (/- Release recommendation:\s*pending/i.test(manualReport)) {
  failures.push("Manual validation report release recommendation is still pending.");
}

const pendingScenarioResults = [...manualReport.matchAll(/- Result:\s*pending/gi)].length;
if (pendingScenarioResults > 0) {
  failures.push(`Manual validation report still has ${pendingScenarioResults} scenario result(s) marked pending.`);
}

if (failures.length) {
  console.error("Release readiness check failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("Release readiness check passed.");
