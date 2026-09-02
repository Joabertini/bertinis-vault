import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const summaryPath = path.join(repoRoot, "docs", "foundry-validation-fixtures", "summary.json");
const outputPath = path.join(repoRoot, "docs", "MVP-RELEASE-STATUS.md");

const summary = JSON.parse(await readFile(summaryPath, "utf8"));
const fixtures = Array.isArray(summary.fixtures) ? summary.fixtures : [];

const cleanFixtures = fixtures.filter((fixture) => fixture.ok && fixture.warnings === 0);
const warningFixtures = fixtures.filter((fixture) => fixture.ok && fixture.warnings > 0);
const blockedFixtures = fixtures.filter((fixture) => !fixture.ok);

const automatedGatePassed =
  cleanFixtures.length >= 5 &&
  warningFixtures.some((fixture) => fixture.id === "warning-only") &&
  blockedFixtures.some((fixture) => fixture.id === "blocked-invalid-class");

const lines = [
  "# MVP Release Status",
  "",
  `Generated at: \`${summary.generatedAt ?? new Date().toISOString()}\``,
  "",
  "## Automated Gate",
  "",
  `- Status: **${automatedGatePassed ? "PASS" : "CHECK REQUIRED"}**`,
  "- Command: `corepack pnpm mvp:verify`",
  `- Clean fixtures: ${cleanFixtures.length}`,
  `- Warning-only fixtures: ${warningFixtures.length}`,
  `- Blocked fixtures: ${blockedFixtures.length}`,
  "",
  "## Automated Expectations",
  "",
  "These fixtures come from `packages/foundry-exporter`, which is legacy: they",
  "are fabricated actors, not `ImportPayload`, and the module cannot consume",
  "them. They still catch exporter regressions, but they do not exercise the",
  "import path. The live pass in `docs/FOUNDRY-MANUAL-VALIDATION.md` does.",
  "",
  "| Fixture | Expected live result | Auto issues |",
  "| --- | --- | --- |",
  ...fixtures.map((fixture) =>
    `| \`${fixture.id}\` | ${fixture.expectedLiveResult ?? (fixture.ok ? "create actor cleanly" : "block actor creation")} | ${
      fixture.issueCodes?.length ? fixture.issueCodes.map((code) => `\`${code}\``).join(", ") : "-"
    } |`,
  ),
  "",
  "## Manual Release Blockers Still Open",
  "",
  "- [ ] Confirm the installed module matches `HEAD` **by hash**, not by version.",
  "- [ ] Publish a build with `apps/web/probes/rehearsal.ts` and import it by code in a live world.",
  "- [ ] Confirm the actor holds real compendium documents: `system.identifier` populated, spells with `activities`, weapons with `damage.base`.",
  "- [ ] Compare the imported actor against Rathma, the hand-levelled reference, and explain every difference.",
  "- [ ] Fill out `docs/FOUNDRY-MANUAL-VALIDATION-REPORT.md` with actual results and screenshot paths.",
  "",
  "## Current Recommendation",
  "",
  automatedGatePassed
    ? "Automated verification is strong enough to move directly into the live Foundry pass. Do not spend more time on broad refactors before that human validation."
    : "Automated verification still needs attention before a confident live Foundry pass. Fix the failing automated gate first.",
  "",
];

await writeFile(outputPath, `${lines.join("\n")}\n`, "utf8");

console.log(`Wrote MVP release status to ${outputPath}`);
