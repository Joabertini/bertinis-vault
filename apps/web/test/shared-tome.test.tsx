/**
 * El tomo prestado: un codigo de otra persona, abierto como personaje.
 *
 * La costura que se prueba aca cruza tres capas y ninguna la ve sola. El
 * Ritual publica, el almacen guarda, y esta pagina lee — y lo que la pagina
 * necesita no es lo que Foundry consume. Si el estado no viaja con el payload,
 * el codigo sigue importando en Foundry y esta pagina queda en blanco, que es
 * exactamente el modo de falla que ningun test de una sola capa nota.
 *
 * Y la otra mitad: quedarse una copia es una bifurcacion. El personaje entra
 * al Codice con identidad propia; si compartiera la del original, corregir la
 * ficha de otro le pisaria la suya.
 */

import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import SharedTome from "../src/routes/SharedTome";
import { initialState } from "../src/lib/builder";
import { shareLinkFor } from "../src/lib/share-link";
import { publishBuild, fetchBuild } from "../src/lib/vault-client";
import { useVault } from "../src/lib/vault-store";

const pageText = () => (document.body.textContent ?? "").replace(/\s+/g, " ");

/** Un personaje armado, tal como lo guarda el Codice: estado, no ficha. */
const sharedState = {
  ...initialState,
  characterName: "Kaelen Thorne",
  playerName: "Otra persona",
};

/** El almacen, contestando lo que contesta de verdad: `{ payload, state }`. */
function storeThatHolds(build: Record<string, unknown> | null, status = 200) {
  return vi.fn(async () =>
    build === null
      ? new Response(JSON.stringify({ error: "No build found for that code." }), { status })
      : new Response(JSON.stringify(build), { status: 200 }),
  );
}

const openTome = (code = "ABCDE-12345") =>
  render(
    <MemoryRouter initialEntries={[`/tomo/${code}`]}>
      <Routes>
        <Route path="/tomo/:code" element={<SharedTome />} />
        <Route path="/forge" element={<p>LA FRAGUA</p>} />
      </Routes>
    </MemoryRouter>,
  );

beforeAll(() => {
  // `EmberField` pinta sobre canvas, que jsdom no implementa. Lo que se prueba
  // aca es el tomo, no las brasas.
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

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("publicar y leer un codigo", () => {
  test("el estado del constructor viaja al lado del payload, no en su lugar", async () => {
    const fetchMock = vi.fn(
      async (_url: string | URL | Request, _init?: RequestInit) =>
        new Response(JSON.stringify({ code: "ABCDE-12345" }), { status: 201 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await publishBuild({ identity: { characterName: "Kaelen" } } as never, sharedState);

    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(body.payload.identity.characterName).toBe("Kaelen");
    expect(body.state.characterName).toBe("Kaelen Thorne");
  });

  test("sin estado, el sobre no inventa uno", async () => {
    const fetchMock = vi.fn(
      async (_url: string | URL | Request, _init?: RequestInit) =>
        new Response(JSON.stringify({ code: "ABCDE-12345" }), { status: 201 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await publishBuild({ identity: { characterName: "Kaelen" } } as never);

    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(body).toHaveProperty("payload");
    expect(body).not.toHaveProperty("state");
  });

  test("leer un codigo devuelve las dos mitades", async () => {
    vi.stubGlobal("fetch", storeThatHolds({ payload: { version: 1 }, state: sharedState }));

    const build = await fetchBuild("ABCDE-12345");
    expect((build.state as { characterName: string }).characterName).toBe("Kaelen Thorne");
  });
});

describe("el enlace que se comparte", () => {
  test("lleva al tomo, en mayusculas y sin depender de como lo tipearon", () => {
    expect(shareLinkFor(" abcde-12345 ", "https://alba.test")).toBe(
      "https://alba.test/tomo/ABCDE-12345",
    );
  });
});

describe("abrir un tomo prestado", () => {
  test("muestra el personaje de la otra persona", async () => {
    vi.stubGlobal("fetch", storeThatHolds({ payload: { version: 1 }, state: sharedState }));
    openTome();

    await waitFor(() => expect(pageText()).toContain("Kaelen Thorne"));
  });

  test("quedarse una copia la mete en el Codice con identidad propia y abre la Fragua", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", storeThatHolds({ payload: { version: 1 }, state: sharedState }));
    openTome();

    await waitFor(() => expect(pageText()).toContain("Kaelen Thorne"));
    await user.click(screen.getByText(/Quedarme una copia/));

    const { characters, draft, editingId } = useVault.getState();
    expect(characters).toHaveLength(1);
    expect(characters[0]?.id).toBeTruthy();
    expect(draft.characterName).toBe("Kaelen Thorne");
    // Editar la copia tiene que sellar sobre la copia, nunca sobre el original.
    expect(editingId).toBe(characters[0]?.id);
    expect(pageText()).toContain("LA FRAGUA");
  });

  test("guardar sin editar deja el borrador en curso donde estaba", async () => {
    const user = userEvent.setup();
    useVault.setState({ draft: { ...initialState, characterName: "A medio forjar" } });
    vi.stubGlobal("fetch", storeThatHolds({ payload: { version: 1 }, state: sharedState }));
    openTome();

    await waitFor(() => expect(pageText()).toContain("Kaelen Thorne"));
    await user.click(screen.getByText(/Guardar sin editar/));

    expect(useVault.getState().characters).toHaveLength(1);
    expect(useVault.getState().draft.characterName).toBe("A medio forjar");
  });

  /*
   * Los codigos anteriores a esta feature traen la ficha calculada y ninguna
   * decision. Se puede importar en Foundry y no se puede abrir aca, y decirlo
   * es mas util que un tomo vacio.
   */
  test("un codigo viejo, sin estado, lo dice en vez de abrir en blanco", async () => {
    vi.stubGlobal(
      "fetch",
      storeThatHolds({ payload: { version: 1, identity: { characterName: "Vieja Guardia" } } }),
    );
    openTome();

    await waitFor(() => expect(pageText()).toContain("solo viaja a Foundry"));
    expect(pageText()).toContain("Vieja Guardia");
  });

  test("un codigo que no existe no deja la pagina cargando para siempre", async () => {
    vi.stubGlobal("fetch", storeThatHolds(null, 404));
    openTome();

    await waitFor(() => expect(pageText()).toContain("Ese codigo no abrio nada"));
  });
});
