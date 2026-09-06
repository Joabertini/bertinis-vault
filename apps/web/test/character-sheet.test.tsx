/**
 * La hoja, y la linea que un jugador tira en su turno.
 *
 * `packages/domain/weapon-attack.ts` existe desde el PR #85 y hasta ahora no
 * lo llamaba nadie: la aritmetica estaba probada y el cableado —que arma hay
 * en la mochila, que dice el indice de ella, si el personaje tiene competencia—
 * no existia. Esa es la costura que se prueba aca, con el catalogo de verdad y
 * no con una fila inventada.
 *
 * El caso que decide es el mismo espadon en dos manos distintas: el guerrero lo
 * blande con competencia y el mago no. Si el cableado se equivoca, los dos
 * suman el bonificador y la hoja miente en la unica linea que se tira.
 */

import { afterEach, beforeAll, beforeEach, describe, expect, test } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

import Tome from "../src/components/codex/Tome";
import { initialState } from "../src/lib/builder";
import { resolveDraft } from "../src/lib/derive";
import { attackLinesFor } from "../src/lib/sheet-attacks";
import { gearProficienciesFor } from "../src/lib/gear-proficiencies";
import { useVault, type SealedCharacter } from "../src/lib/vault-store";
import type { BuilderState } from "../src/lib/builder";

const pageText = () => (document.body.textContent ?? "").replace(/\s+/g, " ");

/** Un personaje entero, con un arma en la mochila. */
function characterWith(overrides: Partial<BuilderState>): BuilderState {
  return {
    ...initialState,
    characterName: "Kaelen Thorne",
    raceId: "human",
    subraceId: "",
    backgroundId: "soldier",
    weaponId: "longsword",
    ...overrides,
  };
}

function attacksOf(state: BuilderState) {
  const resolved = resolveDraft(state);
  if (resolved.status !== "ready") throw new Error(`no derivo: ${resolved.missing.join(", ")}`);

  const proficiencies = gearProficienciesFor([{ classId: state.classId }], "2014");
  return attackLinesFor(resolved.snapshot, "2014", proficiencies);
}

const sealed = (state: BuilderState): SealedCharacter => ({
  id: "tome-1",
  sealedAt: "2026-09-06T00:00:00.000Z",
  state,
});

beforeAll(() => {
  // jsdom no implementa canvas y el Codice pinta brasas.
  const noop = new Proxy(
    {},
    {
      get: (_target, key) =>
        key === "canvas" ? document.createElement("canvas") : () => noop,
    },
  );
  HTMLCanvasElement.prototype.getContext = (() => noop) as never;
});

beforeEach(() => {
  window.localStorage.clear();
  useVault.setState({ draft: { ...initialState }, characters: [], editingId: null, pace: "nuevo" });
});

afterEach(cleanup);

describe("la linea de ataque", () => {
  test("el guerrero suma competencia al espadon; el mago no", () => {
    const fighter = attacksOf(characterWith({ classId: "fighter", subclassId: "", str: 16 }));
    const wizard = attacksOf(characterWith({ classId: "wizard", subclassId: "", str: 16 }));

    const fighterSword = fighter.find((line) => /longsword/i.test(line.name));
    const wizardSword = wizard.find((line) => /longsword/i.test(line.name));

    expect(fighterSword?.proficient).toBe(true);
    expect(wizardSword?.proficient).toBe(false);
    // La misma arma, la misma Fuerza: la unica diferencia es el bonificador.
    expect(fighterSword!.attackBonus - wizardSword!.attackBonus).toBe(
      fighterSword!.attackBonus - fighterSword!.damageModifier,
    );
    expect(wizardSword!.attackBonus).toBe(wizardSword!.damageModifier);
  });

  test("el espadon es cuerpo a cuerpo y versatil, leido del catalogo", () => {
    const [sword] = attacksOf(characterWith({ classId: "fighter", subclassId: "", str: 16 }));

    expect(sword?.ranged).toBe(false);
    expect(sword?.ability).toBe("str");
    // Versatil: el catalogo trae los dos dados y la hoja tiene que traer los dos.
    expect(sword?.damage).toMatch(/^1d8 [+-]/);
    expect(sword?.versatileDamage).toMatch(/^1d10 [+-]/);
  });

  test("un arco largo se tira con Destreza", () => {
    const lines = attacksOf(
      characterWith({ classId: "fighter", subclassId: "", weaponId: "longbow", dex: 16 }),
    );

    const bow = lines.find((line) => /longbow/i.test(line.name));
    expect(bow?.ranged).toBe(true);
    expect(bow?.ability).toBe("dex");
  });
});

describe("el tomo abre en un selector", () => {
  const openTome = (state: BuilderState) =>
    render(
      <MemoryRouter>
        <Tome character={sealed(state)} onBurn={() => {}} onReforge={() => {}} />
      </MemoryRouter>,
    );

  test("ofrece las dos vistas en vez de abrir una sola", async () => {
    const user = userEvent.setup();
    openTome(characterWith({ classId: "fighter", subclassId: "" }));

    await user.click(screen.getByLabelText(/Abrir Kaelen Thorne/));

    expect(pageText()).toContain("La hoja");
    expect(pageText()).toContain("La chuleta");
  });

  test("la hoja trae los numeros derivados, no un resumen", async () => {
    const user = userEvent.setup();
    const state = characterWith({ classId: "fighter", subclassId: "", str: 16 });
    const resolved = resolveDraft(state);
    if (resolved.status !== "ready") throw new Error("no derivo");

    openTome(state);
    await user.click(screen.getByLabelText(/Abrir Kaelen Thorne/));
    await user.click(screen.getByText("La hoja"));

    const text = pageText();
    expect(text).toContain("Puntos de golpe");
    expect(text).toContain(String(resolved.snapshot.derived.hp));
    expect(text).toContain(String(resolved.snapshot.derived.ac));
    expect(text).toContain("Ataques");
    // Las seis puntuaciones, cada una con su modificador.
    expect(text).toContain("FUE");
    expect(text).toContain("CAR");
  });

  test("se puede pasar a la chuleta sin cerrar la ventana", async () => {
    const user = userEvent.setup();
    openTome(characterWith({ classId: "fighter", subclassId: "" }));

    await user.click(screen.getByLabelText(/Abrir Kaelen Thorne/));
    await user.click(screen.getByText("La hoja"));
    expect(pageText()).toContain("Puntos de golpe");

    await user.click(screen.getByText("La chuleta"));
    expect(pageText()).not.toContain("Puntos de golpe");
  });

  test("la ventana se cierra y devuelve la estanteria", async () => {
    const user = userEvent.setup();
    openTome(characterWith({ classId: "fighter", subclassId: "" }));

    await user.click(screen.getByLabelText(/Abrir Kaelen Thorne/));
    await user.click(screen.getByText("La hoja"));
    await user.click(screen.getByLabelText("Cerrar"));

    // La ventana sale con animacion, asi que "cerrada" es cuando termina de
    // desmontarse y no en el click.
    await waitFor(() => expect(pageText()).not.toContain("Puntos de golpe"));
  });
});
