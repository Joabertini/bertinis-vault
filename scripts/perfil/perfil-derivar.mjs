// Dónde se va el tiempo de derivar un personaje.
//
//   node perfil-derivar.mjs build <vault>
//   node --jitless --cpu-prof --cpu-prof-dir=<vault>/perfil perfil-derivar.mjs run <vault>
//   node perfil-derivar.mjs resumen <vault>
//
// La app de escritorio corre estas reglas en un intérprete sin JIT, donde
// `resolveDraft` tarda unos 335 ms. `--jitless` deja a Node en la misma
// situación (solo intérprete), así el perfil se parece a lo que pasa allá.
import { createRequire } from "node:module";
import { mkdirSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { fileURLToPath, pathToFileURL } from "node:url";

// El checkout del Vault: el segundo argumento, o el que contiene a este script.
const raiz = process.argv[3] ? resolve(process.argv[3]) : join(dirname(fileURLToPath(import.meta.url)), "..");
const salida = join(raiz, "perfil");
const paquete = join(salida, "forge-perfil.mjs");
const modo = process.argv[2];

if (modo === "build") {
  const deWeb = createRequire(join(raiz, "apps/web/package.json"));
  const deVite = createRequire(deWeb.resolve("vite"));
  const esbuild = deVite("esbuild");
  const pkg = (nombre) => join(raiz, "packages", nombre, "src/index.ts");
  const entrada = `
    export { applyAction } from "./actions";
    export { initialState, freshDraft } from "./builder-state";
    export { buildCanonicalSnapshot } from "./builder";
    export { resolveDraft } from "./derive";
    export { settleDraft } from "./settle";
    export { sheetDataFor } from "./sheet-data";
    export { RefResolver, buildToPayload, collections, rulesVersionOfBuild } from "@bertinis-vault/vetools-index";
  `;
  mkdirSync(salida, { recursive: true });
  await esbuild.build({
    stdin: { contents: entrada, resolveDir: join(raiz, "packages/forge/src"), loader: "ts" },
    bundle: true,
    format: "esm",
    platform: "neutral",
    mainFields: ["module", "main"],
    target: "es2020",
    minify: false,
    keepNames: true,
    outfile: paquete,
    alias: {
      "@bertinis-vault/contracts": pkg("contracts"),
      "@bertinis-vault/data-engine": pkg("data-engine"),
      "@bertinis-vault/domain": pkg("domain"),
      "@bertinis-vault/vetools-index": pkg("vetools-index"),
      "@bertinis-vault/vetools-ref": pkg("vetools-ref"),
    },
  });
  console.log("paquete sin minificar en", paquete);
}

if (modo === "run") {
  const t0 = performance.now();
  const f = await import(pathToFileURL(paquete).href);
  console.log(`cargar el paquete: ${(performance.now() - t0).toFixed(0)} ms`);

  const medir = (nombre, fn, veces = 8) => {
    const tiempos = [];
    let ultimo;
    for (let i = 0; i < veces; i += 1) {
      const t = performance.now();
      ultimo = fn();
      tiempos.push(performance.now() - t);
    }
    tiempos.sort((a, b) => a - b);
    const mediana = tiempos[Math.floor(tiempos.length / 2)];
    console.log(`${nombre.padEnd(34)} primera ${tiempos.at(-1).toFixed(1).padStart(7)} ms   mediana ${mediana.toFixed(1).padStart(7)} ms`);
    return ultimo;
  };

  const borrador = f.initialState;
  const snapshot = medir("buildCanonicalSnapshot", () => f.buildCanonicalSnapshot(borrador));
  const version = f.rulesVersionOfBuild(snapshot);
  const resolver = medir("new RefResolver", () => new f.RefResolver(version, f.collections), 3);
  medir("buildToPayload", () => f.buildToPayload(snapshot, resolver));
  medir("resolveDraft", () => f.resolveDraft(borrador));
  medir("sheetDataFor", () => f.sheetDataFor(borrador, snapshot, version));
  const yunque = { draft: borrador, scratch: { pool: [], bound: [], sets: [] } };
  const paso = medir("applyAction setLevel 5", () => f.applyAction(yunque, { type: "setLevel", level: 5 }));
  medir("settleDraft", () => f.settleDraft(paso.draft, borrador));
  medir("resolveDraft nivel 5", () => f.resolveDraft(paso.draft));
}

if (modo === "resumen") {
  const archivo = readdirSync(salida).find((n) => n.endsWith(".cpuprofile"));
  if (!archivo) {
    console.error("no hay .cpuprofile en", salida);
    process.exit(1);
  }
  const perfil = JSON.parse(readFileSync(join(salida, archivo), "utf8"));
  const nodos = new Map(perfil.nodes.map((n) => [n.id, n]));
  const propio = new Map();
  for (let i = 0; i < perfil.samples.length; i += 1) {
    const id = perfil.samples[i];
    propio.set(id, (propio.get(id) ?? 0) + (perfil.timeDeltas[i] ?? 0));
  }
  const nombreDe = (n) => {
    const c = n.callFrame;
    const donde = c.url ? `${c.url.split("/").pop()}:${c.lineNumber + 1}` : "(nativo)";
    return `${c.functionName || "(anónima)"}  ${donde}`;
  };
  const total = [...propio.values()].reduce((a, b) => a + b, 0);

  // Tiempo propio por función.
  const porFuncion = new Map();
  for (const [id, micros] of propio) {
    const clave = nombreDe(nodos.get(id));
    porFuncion.set(clave, (porFuncion.get(clave) ?? 0) + micros);
  }
  console.log(`\ntotal muestreado: ${(total / 1000).toFixed(0)} ms\n\nTIEMPO PROPIO (top 45)`);
  for (const [clave, micros] of [...porFuncion].sort((a, b) => b[1] - a[1]).slice(0, 45)) {
    console.log(`${((micros / total) * 100).toFixed(1).padStart(5)} %  ${(micros / 1000).toFixed(0).padStart(6)} ms  ${clave}`);
  }

  // Tiempo incluyendo lo que cada función llama.
  const inclusivo = new Map();
  const bajar = (id, pila) => {
    const n = nodos.get(id);
    let suma = propio.get(id) ?? 0;
    const clave = nombreDe(n);
    const repetida = pila.has(clave);
    if (!repetida) pila.add(clave);
    for (const hijo of n.children ?? []) suma += bajar(hijo, pila);
    if (!repetida) {
      pila.delete(clave);
      inclusivo.set(clave, (inclusivo.get(clave) ?? 0) + suma);
    }
    return suma;
  };
  bajar(perfil.nodes[0].id, new Set());
  console.log("\nTIEMPO INCLUIDO LO QUE LLAMA (top 45)");
  for (const [clave, micros] of [...inclusivo].sort((a, b) => b[1] - a[1]).slice(0, 45)) {
    console.log(`${((micros / total) * 100).toFixed(1).padStart(5)} %  ${(micros / 1000).toFixed(0).padStart(6)} ms  ${clave}`);
  }
}
