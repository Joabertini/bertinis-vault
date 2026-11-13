// Runs the packed rules with nothing but the language around them.
//
//   node scripts/check-rules.mjs
//
// The context has no `window`, no `process`, no `console`, no timers: what an
// embedded interpreter offers. If the bundle reaches for any of them, this
// fails here rather than inside the app.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const here = dirname(fileURLToPath(import.meta.url));
const code = readFileSync(join(here, "../apps/forja/rules/forge.js"), "utf8");

const context = vm.createContext(Object.create(null));
const started = performance.now();
vm.runInContext(code, context, { filename: "forge.js" });
const loaded = performance.now();

const invoke = (name, ...args) =>
  JSON.parse(vm.runInContext("forge.invoke", context)(name, JSON.stringify(args)));

const draft = invoke("initialState");
const resolved = invoke("resolveDraft", draft);
const derived = performance.now();

if (resolved.status !== "ready") {
  console.error(`the demo draft did not resolve: ${JSON.stringify(resolved).slice(0, 300)}`);
  process.exit(1);
}

// A choice, then the derivation again: the path a click takes.
const lowered = invoke("applyAction", { draft, scratch: { pool: [], bound: [], sets: [] } }, { type: "setLevel", level: 1 });
const again = invoke("resolveDraft", lowered.draft);
if (lowered.draft.level !== 1 || again.status !== "ready") {
  console.error("applyAction did not carry through to the derivation");
  process.exit(1);
}

// Compared with the keys sorted: reading back may reorder a draft, and must not change it.
const sorted = (value) =>
  JSON.stringify(value, (_, v) =>
    v && typeof v === "object" && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => (a < b ? -1 : 1)))
      : v,
  );
const reread = invoke("coerceBuilderState", JSON.parse(JSON.stringify(lowered.draft)));
if (sorted(reread) !== sorted(lowered.draft)) {
  console.error("the draft does not read back the same");
  process.exit(1);
}

console.log(`functions: ${vm.runInContext("forge.names", context).join(", ")}`);
console.log(`load ${(loaded - started).toFixed(0)} ms, first derivation ${(derived - loaded).toFixed(0)} ms`);
console.log(`${draft.characterName}: level ${draft.level} -> ${lowered.draft.level}, both derive`);
