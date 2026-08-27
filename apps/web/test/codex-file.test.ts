import { describe, expect, test } from "vitest";

import { initialState } from "../src/lib/builder-state";
import {
  CODEX_FORMAT,
  CODEX_VERSION,
  exportCodex,
  mergeCodex,
  readCodexFile,
} from "../src/lib/codex-file";
import type { SealedCharacter } from "../src/lib/vault-store";

const character = (id: string, sealedAt: string, name = id): SealedCharacter => ({
  id,
  sealedAt,
  state: { ...initialState, characterName: name },
});

describe("el archivo", () => {
  test("ida y vuelta sin perder nada", () => {
    const codex = [character("a", "2026-08-01T00:00:00.000Z"), character("b", "2026-08-02T00:00:00.000Z")];
    const read = readCodexFile(exportCodex(codex));

    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(read.characters.map((entry) => entry.id)).toEqual(["a", "b"]);
    expect(read.characters[0]?.state.characterName).toBe("a");
  });

  test("se declara para que un archivo ajeno se rechace", () => {
    const file = JSON.parse(exportCodex([]));
    expect(file.format).toBe(CODEX_FORMAT);
    expect(file.version).toBe(CODEX_VERSION);
  });

  test("lo que no es un archivo del Codice se rechaza entero", () => {
    expect(readCodexFile("no soy json").ok).toBe(false);
    expect(readCodexFile("[]").ok).toBe(false);
    expect(readCodexFile(JSON.stringify({ characters: [] })).ok).toBe(false);
  });

  /*
   * Un archivo de una version mas nueva puede traer campos que esta build
   * tiraria en el proximo export. Rechazarlo pierde menos que abrirlo.
   */
  test("un archivo de una version mas nueva se rechaza en vez de adivinarse", () => {
    const file = { format: CODEX_FORMAT, version: CODEX_VERSION + 1, exportedAt: "", characters: [] };
    const read = readCodexFile(JSON.stringify(file));

    expect(read.ok).toBe(false);
    if (read.ok) return;
    expect(read.reason).toMatch(/mas nueva/);
  });

  /*
   * Una entrada sin estado no es un personaje. Repararla en silencio pondria
   * un mago humano en blanco en el Codice de alguien, bajo un nombre que
   * reconoce.
   */
  test("una entrada rota se cuenta, no se repara", () => {
    const file = {
      format: CODEX_FORMAT,
      version: CODEX_VERSION,
      exportedAt: "",
      characters: [character("a", "2026-08-01T00:00:00.000Z"), { id: "b" }, null],
    };

    const read = readCodexFile(JSON.stringify(file));
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(read.characters).toHaveLength(1);
    expect(read.skipped).toBe(2);
  });

  test("un personaje guardado antes de que el estado creciera igual abre", () => {
    const file = {
      format: CODEX_FORMAT,
      version: CODEX_VERSION,
      exportedAt: "",
      characters: [{ id: "viejo", sealedAt: "2026-01-01T00:00:00.000Z", state: { classId: "rogue", level: 4 } }],
    };

    const read = readCodexFile(JSON.stringify(file));
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    // Los campos que no existian cuando se guardo llegan con su valor inicial.
    expect(read.characters[0]?.state.extraClasses).toEqual([]);
    expect(read.characters[0]?.state.level).toBe(4);
  });
});

describe("importar no puede borrar nada", () => {
  test("un personaje que el Codice no tenia se suma", () => {
    const result = mergeCodex([character("a", "2026-08-01T00:00:00.000Z")], [character("b", "2026-08-02T00:00:00.000Z")]);

    expect(result.characters).toHaveLength(2);
    expect(result.added).toBe(1);
  });

  /*
   * La regla que no puede perder una edicion: gana el sellado mas tarde.
   * Tomar siempre el archivo desharia lo hecho desde el respaldo; quedarse
   * siempre con lo local haria que importar un personaje actualizado no
   * hiciera nada.
   */
  test("si el archivo lo trae mas nuevo, el archivo gana", () => {
    const result = mergeCodex(
      [character("a", "2026-08-01T00:00:00.000Z", "viejo")],
      [character("a", "2026-08-05T00:00:00.000Z", "nuevo")],
    );

    expect(result.characters).toHaveLength(1);
    expect(result.characters[0]?.state.characterName).toBe("nuevo");
    expect(result.updated).toBe(1);
  });

  test("si el Codice lo tiene mas nuevo, se queda el del Codice", () => {
    const result = mergeCodex(
      [character("a", "2026-08-10T00:00:00.000Z", "de hoy")],
      [character("a", "2026-08-01T00:00:00.000Z", "del respaldo")],
    );

    expect(result.characters[0]?.state.characterName).toBe("de hoy");
    expect(result.kept).toBe(1);
    expect(result.updated).toBe(0);
  });

  test("importar el mismo respaldo dos veces no duplica ni cambia nada", () => {
    const codex = [character("a", "2026-08-01T00:00:00.000Z"), character("b", "2026-08-02T00:00:00.000Z")];
    const once = mergeCodex(codex, codex);
    const twice = mergeCodex(once.characters, codex);

    expect(twice.characters).toHaveLength(2);
    expect(twice.added).toBe(0);
    expect(twice.updated).toBe(0);
  });

  test("queda ordenado del mas nuevo al mas viejo, como se lee el Codice", () => {
    const result = mergeCodex(
      [character("viejo", "2026-01-01T00:00:00.000Z")],
      [character("nuevo", "2026-12-01T00:00:00.000Z")],
    );

    expect(result.characters.map((entry) => entry.id)).toEqual(["nuevo", "viejo"]);
  });
});
