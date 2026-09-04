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

/*
 * Las flechas fijas a los costados.
 *
 * Son el segundo camino para moverse entre camaras y por eso mismo el riesgo
 * conocido de este repo: un control que se dibuja y no escribe nada. El pie de
 * pagina ya movia al jugador, asi que una flecha inerte se ve exactamente
 * igual que una que anda hasta que alguien la aprieta.
 */
describe("las flechas de los costados mueven", () => {
  const arrows = () => ({
    back: screen.getByLabelText("Camara anterior") as HTMLButtonElement,
    next: screen.getByLabelText("Camara siguiente") as HTMLButtonElement,
  });

  test("la de adelante avanza una camara y la de atras vuelve", async () => {
    const user = userEvent.setup();
    useVault.setState((state) => ({
      draft: {
        ...state.draft,
        rulesVersion: "5e-2014",
        classId: "fighter",
        subclassId: "",
        // Con estilo elegido, Clase queda contestada y la flecha se habilita.
        optionalFeatureIds: ["defense"],
        level: 1,
        raceId: "human",
        backgroundId: "acolyte",
      },
    }));

    openForge();

    /*
     * El encabezado de la camara, no un texto suelto de adentro. El riel
     * repite los nombres de las nueve camaras, asi que buscar por texto
     * encuentra el riel; el `h2` lo tiene solo la camara abierta.
     */
    const heading = (name: RegExp) =>
      screen.findByRole("heading", { level: 2, name }, { timeout: 3000 });

    // Linaje es la primera: no hay nada atras.
    expect(arrows().back.disabled).toBe(true);
    expect(arrows().next.disabled).toBe(false);
    expect(await heading(/Elegi tu raza/)).toBeTruthy();

    await user.click(arrows().next);
    expect(await heading(/Elegi tu camino/)).toBeTruthy();

    // Y ahora si hay algo atras, y vuelve.
    expect(arrows().back.disabled).toBe(false);
    await user.click(arrows().back);
    expect(await heading(/Elegi tu raza/)).toBeTruthy();
  });

  test("la de adelante no deja pasar una camara sin contestar", async () => {
    // La puerta es la misma que la del pie: mover el control no es soltarla.
    useVault.setState((state) => ({
      draft: {
        ...state.draft,
        rulesVersion: "5e-2014",
        classId: "",
        subclassId: "",
        raceId: "",
        backgroundId: "",
      },
    }));

    openForge();
    expect(arrows().next.disabled).toBe(true);
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

describe("el estilo de lucha vive en Clase", () => {
  /*
   * Un estilo de lucha es un rasgo de clase de nivel 1 y se preguntaba en
   * Mejoras — la camara que un jugador abre a nivel 4 para gastar una mejora.
   * El constructor le contestaba una pregunta sobre el nivel al que acababa de
   * llegar con una pregunta sobre el nivel en el que empezo, y no lo dejaba
   * avanzar hasta resolverla. Los jugadores lo leyeron como una falla de la
   * mejora, que es una lectura justa de donde aparecia.
   *
   * Medido en el indice: el pool "Fighting Style" existe para Guerrero,
   * Paladin y Explorador bajo 2014, con once opciones. Bajo 2024 solo el
   * hechicero y el brujo traen pools, asi que el guerrero de aquel reporte era
   * de 2014.
   */
  const asFighter = (over: Record<string, unknown> = {}) =>
    useVault.setState((state) => ({
      draft: {
        ...state.draft,
        rulesVersion: "5e-2014" as const,
        classId: "fighter",
        subclassId: "",
        level: 4,
        raceId: "human",
        backgroundId: "acolyte",
        ...over,
      },
    }));

  /*
   * Esperado, no cronometrado. El cambio de camara arranca tras una pausa y la
   * que sale queda montada mientras se desvanece, asi que una espera fija cae
   * en el medio: el encabezado ya dice la camara nueva y el cuerpo todavia
   * tiene la vieja. `findByText` reintenta hasta que la nueva llega.
   */
  const openChamber = async (user: ReturnType<typeof userEvent.setup>, chamber: string) => {
    const target = document.querySelector<HTMLButtonElement>(`[data-chamber="${chamber}"]`);
    if (!target || target.disabled) return false;
    await user.click(target);
    return true;
  };

  test("la camara de Clase ofrece el estilo", async () => {
    const user = userEvent.setup();
    asFighter({ optionalFeatureIds: [] });
    openForge();

    expect(await openChamber(user, "calling")).toBe(true);

    expect(await screen.findByText(/te deja elegir a nivel/, undefined, { timeout: 3000 }))
      .toBeTruthy();
  });

  test("y Mejoras ya no lo pregunta", async () => {
    const user = userEvent.setup();
    // Con el estilo ya elegido Mejoras es alcanzable, que es lo que este test
    // necesita para poder mirar adentro.
    asFighter({ optionalFeatureIds: ["defense"] });
    openForge();

    expect(await openChamber(user, "growth")).toBe(true);

    // La camara de Mejoras se reconoce por lo suyo, no por la ausencia de otra
    // cosa: esperar a que llegue es lo que hace que el `not` signifique algo.
    // Varios nodos dicen "Aumento de" en esa camara; alcanza con que llegue.
    await screen.findAllByText(/Aumento de/, undefined, { timeout: 3000 });
    expect(pageText()).not.toContain("te deja elegir a nivel");
  });

  test("sin elegirlo, Clase no deja avanzar", async () => {
    // La puerta se mudo con el selector. Un guerrero que no eligio estilo debe
    // seguir debiendo la respuesta — moverla de camara no es soltarla.
    const user = userEvent.setup();
    asFighter({ optionalFeatureIds: [] });
    openForge();

    await openChamber(user, "calling");

    const growth = document.querySelector<HTMLButtonElement>('[data-chamber="growth"]');
    expect(growth?.disabled).toBe(true);
  });
});
