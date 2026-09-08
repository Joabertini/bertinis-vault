/**
 * Un personaje, un código — y la costura donde eso se rompe.
 *
 * Esto no se puede probar de un lado solo. El front decide si manda el código
 * que ya tenía, el almacén decide si lo acepta, y el fallo que importa —el
 * personaje termina con dos códigos vivos y el que el jugador anotó apunta a
 * una versión vieja— sólo aparece cuando las dos mitades corren juntas. Así que
 * el `fetch` de estos tests entra al handler real del Worker con un KV en
 * memoria: la misma validación, los mismos 403 y 404, el mismo token.
 *
 * Lo que se prueba es la promesa entera, no cada capa por su lado.
 */

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { handle } from "../../worker/dist/handler.js";
import { initialState } from "../src/lib/builder";
import { publishBuild } from "../src/lib/vault-client";

/** Un KV en memoria, con lo poco que el handler le pide. */
function memoryKv() {
  const data = new Map<string, string>();
  return {
    data,
    async get(key: string) {
      return data.has(key) ? (data.get(key) as string) : null;
    },
    async put(key: string, value: string) {
      data.set(key, value);
    },
  };
}

/** El payload mínimo que `importPayloadSchema` acepta. */
const ref = (prop: string, page: string, name: string, source: string) => ({
  page,
  source,
  hash: `${encodeURIComponent(name.toLowerCase()).toLowerCase()}_${source.toLowerCase()}`,
  prop,
});

function payload(characterName = "Kaelen Thorne") {
  return {
    version: 1,
    rulesVersion: "2014",
    exportedAt: "2026-09-07T12:00:00.000Z",
    identity: { characterName },
    race: { ref: ref("race", "races.html", "Half-Elf", "PHB") },
    classes: [{ ref: ref("class", "classes.html", "Warlock", "PHB"), level: 5 }],
    background: { ref: ref("background", "backgrounds.html", "Sage", "PHB") },
    abilities: { str: 8, dex: 14, con: 14, int: 12, wis: 10, cha: 17 },
    proficiencies: {
      skills: [],
      languages: [],
      tools: [],
      savingThrows: [],
      expertise: [],
      toolExpertise: [],
      armor: [],
      weapons: [],
      masteries: [],
    },
    feats: [],
    optionalFeatures: [],
    spells: [],
    equipment: [],
    derived: { hp: 38, ac: 13, proficiencyBonus: 3 },
  } as never;
}

let env: { BUILDS: ReturnType<typeof memoryKv> };

beforeEach(() => {
  env = { BUILDS: memoryKv() };

  vi.stubGlobal("fetch", (url: string | URL | Request, init?: RequestInit) =>
    handle(new Request(String(url), init as never) as never, env as never),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/** Cuántos códigos hay guardados, sin contar las marcas de dueño. */
const codigosGuardados = () =>
  [...env.BUILDS.data.keys()].filter((key) => key.startsWith("build:")).length;

describe("el código es del personaje, no del envío", () => {
  test("compartir dos veces deja un código, no dos", async () => {
    const primero = await publishBuild(payload(), initialState);
    expect(primero.writeToken).toMatch(/^[0-9a-f]{32}$/);

    const share = { code: primero.code, writeToken: primero.writeToken as string };
    const segundo = await publishBuild(payload("Kaelen, mas tarde"), initialState, share);

    expect(segundo.code).toBe(primero.code);
    expect(codigosGuardados()).toBe(1);

    // Y lo que abre ese código es la versión nueva: el link ya pegado en un
    // chat sigue sirviendo, que es la razón de que el código sea estable.
    const leido = await (await fetch(`http://x/builds/${primero.code}`)).json();
    expect(leido.payload.identity.characterName).toBe("Kaelen, mas tarde");
  });

  test("el código no viene con permiso para pisarlo", async () => {
    const mio = await publishBuild(payload(), initialState);

    // Alguien que tiene el código —para eso está— y no el token.
    await expect(
      publishBuild(payload("Suplantado"), initialState, {
        code: mio.code,
        writeToken: "0".repeat(32),
      }),
    ).rejects.toMatchObject({ status: 403 });

    const leido = await (await fetch(`http://x/builds/${mio.code}`)).json();
    expect(leido.payload.identity.characterName).toBe("Kaelen Thorne");
  });

  test("un código que se murió se reemplaza por uno nuevo, no por un error", async () => {
    // Es el caso real de todo código acuñado antes de que los códigos tuvieran
    // dueño: caducaban a los noventa días, y el Códice se queda con uno que ya
    // no apunta a nada.
    const publicado = await publishBuild(payload(), initialState, {
      code: "K7M2-X9F4",
      writeToken: "0".repeat(32),
    });

    expect(publicado.code).not.toBe("K7M2-X9F4");
    expect(publicado.writeToken).toMatch(/^[0-9a-f]{32}$/);
    expect(codigosGuardados()).toBe(1);
  });

  test("el token nunca vuelve del almacén", async () => {
    const publicado = await publishBuild(payload(), initialState);

    const crudo = await (await fetch(`http://x/builds/${publicado.code}`)).text();

    expect(crudo).not.toContain(publicado.writeToken);
  });

  test("el código que se muestra alterna letra y número", async () => {
    const publicado = await publishBuild(payload(), initialState);

    // Lo que hace que dictarlo funcione: la posición dice de qué tipo es cada
    // carácter, así que un 0 en casilla de letra sólo pudo haber sido una O.
    expect(publicado.code).toMatch(/^[A-Z][0-9][A-Z][0-9]-[A-Z][0-9][A-Z][0-9]$/);
  });

  test("un código viejo, de diez caracteres, sigue abriendo", async () => {
    // Están escritos en fichas de papel y guardados en mundos de Foundry. Un
    // cambio de esquema no es razón para que dejen de resolver.
    env.BUILDS.data.set(
      "build:K7M2XQF9AB",
      JSON.stringify({ payload: payload("De antes"), createdAt: "2026-01-01T00:00:00.000Z" }),
    );

    const leido = await (await fetch("http://x/builds/K7M2X-QF9AB")).json();
    expect(leido.payload.identity.characterName).toBe("De antes");
  });
});
