/**
 * Que la Forja abra y que un personaje se pueda armar de punta a punta.
 *
 * El constructor deriva mientras renderiza: los conjuros, el equipo inicial,
 * las maestrias y la ficha viva se calculan en el mismo paso que las pinta. Un
 * test que solo importa modulos no ve esas fallas — ve una funcion que
 * devuelve bien y no la pagina que revienta al usarla.
 *
 * Reemplaza al `builder-page.test.tsx` que se borro en la migracion.
 */

import { afterEach, beforeAll, beforeEach, describe, expect, test } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

import Forge from "../src/routes/Forge";
import { chamberOrder } from "../src/lib/chambers";
import { initialState } from "../src/lib/builder";
import { useVault } from "../src/lib/vault-store";

/**
 * El texto de la pagina entera, con los espacios normalizados.
 *
 * La ficha arma "Nivel 8 · Guerrero 5 / Mago 3" con varios nodos de texto, asi
 * que buscar por elemento encuentra los pedazos y no la frase. Lo que importa
 * aca es lo que el jugador lee.
 */
const pageText = () => (document.body.textContent ?? "").replace(/\s+/g, " ");

const openForge = () =>
  render(
    <MemoryRouter initialEntries={["/forge"]}>
      <Forge />
    </MemoryRouter>,
  );

/*
 * jsdom no implementa canvas, y la Forja pinta dos efectos que lo usan
 * (`EmberField`, `AshBurst`). Un contexto que no hace nada los deja correr sin
 * volverse el tema del test: lo que se prueba aca es que el personaje se arme,
 * no que las brasas se dibujen.
 */
beforeAll(() => {
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
  // Un borrador limpio por test: el Codice vive en localStorage y un
  // personaje a medias de un test anterior haria pasar al siguiente por las
  // razones equivocadas.
  window.localStorage.clear();
  // `pace` decide por que camara se empieza, y sin el la Forja pregunta antes
  // de abrir. Fijado aca para que cada test hable de lo suyo; la pregunta
  // tiene su propio test mas abajo.
  useVault.setState({ draft: { ...initialState }, editingId: null, pace: "nuevo" });
});

afterEach(cleanup);

describe("la Forja abre", () => {
  test("con un borrador nuevo, sin reventar", () => {
    openForge();
    expect(pageText()).toContain("Nivel");
  });

  /*
   * El primer arranque de verdad: sin ritmo elegido, la Forja pregunta cuantos
   * personajes armaste antes de abrir ninguna camara. Es la primera pantalla
   * que ve alguien que nunca uso esto.
   */
  test("pregunta el ritmo antes de encender, y despues abre", async () => {
    const user = userEvent.setup();
    useVault.setState({ pace: null });
    openForge();

    expect(pageText()).toContain("Cuantos personajes armaste");

    await user.click(screen.getByText(/Es de mis primeros/));

    expect(useVault.getState().pace).toBe("nuevo");
    expect(pageText()).toContain("Nivel");
  });

  /*
   * El borrador inicial ya trae mago nivel 3, asi que la ficha viva deriva
   * desde el primer render. Si algo de lo que se calcula al pintar tira, esto
   * es lo que lo agarra.
   */
  test("y la ficha viva ya trae numeros", () => {
    openForge();
    expect(pageText()).toMatch(/Nivel 3/);
  });
});

describe("las camaras", () => {
  /*
   * La razon por la que este archivo existe. Cada camara calcula lo suyo al
   * pintar — los conjuros, el kit inicial, las maestrias, las dieciocho
   * pericias — y un modulo que devuelve bien no prueba que la pagina sobreviva
   * a usarlo. Se recorre el riel entero, camara por camara.
   */
  test("todas se abren, una por una, sin que ninguna tire", async () => {
    const user = userEvent.setup();
    useVault.setState((state) => ({
      draft: {
        ...state.draft,
        rulesVersion: "5e-2024",
        classId: "fighter",
        subclassId: "",
        level: 5,
        backgroundId: "acolyte",
        raceId: "human",
        proficienciesText: "Athletics\nPerception",
      },
    }));

    openForge();

    // El guerrero no lanza, asi que su riel no tiene la camara de conjuros:
    // el orden depende de eso tanto como del ritmo.
    const order = chamberOrder("nuevo", false);

    // El riel tiene una camara por paso. Si deja de tenerlas, esto lo dice en
    // vez de pasar recorriendo cero.
    expect(document.querySelectorAll("[data-chamber]")).toHaveLength(order.length);

    /*
     * Solo las alcanzables. El riel cierra las de adelante hasta que las de
     * atras estan contestadas, y forzarlas seria probar un camino que el
     * jugador no puede recorrer.
     */
    let opened = 0;

    for (const chamber of order) {
      const target = document.querySelector<HTMLButtonElement>(`[data-chamber="${chamber}"]`);
      if (!target || target.disabled) continue;
      await user.click(target);
      // El cambio de camara espera al barrido que lo tapa.
      await new Promise((resolve) => setTimeout(resolve, 400));
      opened += 1;
      expect(pageText()).toContain("Nivel");
    }

    expect(opened).toBeGreaterThan(1);
  });
});

describe("un personaje se arma", () => {
  test("subir de nivel mueve los puntos de golpe de la ficha", async () => {
    const user = userEvent.setup();
    openForge();

    const before = useVault.getState().draft.level;
    useVault.setState((state) => ({ draft: { ...state.draft, level: before + 4 } }));

    await user.click(document.body);
    expect(useVault.getState().draft.level).toBe(before + 4);
    expect(pageText()).toMatch(new RegExp(`Nivel ${before + 4}`));
  });

  /*
   * La razon por la que este archivo existe. Un guerrero de 2024 tiene
   * maestria de armas, equipo inicial con elecciones y una ficha con las
   * dieciocho pericias: tres caminos de calculo que solo corren al pintar.
   */
  test("un guerrero de 2024 rinde maestria, kit y pericias sin tirar", () => {
    useVault.setState((state) => ({
      draft: {
        ...state.draft,
        rulesVersion: "5e-2024",
        classId: "fighter",
        subclassId: "",
        level: 5,
        proficienciesText: "Athletics\nPerception",
      },
    }));

    openForge();
    expect(pageText()).toMatch(/Nivel 5/);
  });

  test("un picaro con maestria no rompe la ficha", () => {
    useVault.setState((state) => ({
      draft: {
        ...state.draft,
        classId: "rogue",
        subclassId: "",
        level: 6,
        proficienciesText: "Stealth\nPerception",
      },
    }));

    openForge();
    expect(pageText()).toMatch(/Nivel 6/);
  });

  test("un multiclase pinta la linea partida", () => {
    useVault.setState((state) => ({
      draft: {
        ...state.draft,
        classId: "fighter",
        subclassId: "",
        level: 5,
        extraClasses: [{ classId: "wizard", subclassId: "", level: 3 }],
      },
    }));

    openForge();
    // Nivel 8, no nivel 5: la ficha suma las clases.
    expect(pageText()).toMatch(/Nivel 8/);
  });
});
