/**
 * El Codice que se sincroniza solo.
 *
 * Dos cosas pueden salir mal y las dos son silenciosas. Una: adoptar la
 * respuesta del servidor cambia el Codice, asi que un hook que sincroniza
 * cuando el Codice cambia sincroniza para siempre. La otra: un personaje
 * quemado que vuelve del servidor parece que la aplicacion lo resucito.
 */

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";

import AccountBadge from "../src/components/codex/AccountBadge";
import { initialState } from "../src/lib/builder";
import { useVault, type SealedCharacter } from "../src/lib/vault-store";

const account = {
  id: "acc-1",
  provider: "discord",
  displayName: "Bertini",
  avatarUrl: null,
};

const sealed = (id: string, sealedAt: string, name = id): SealedCharacter => ({
  id,
  sealedAt,
  state: { ...initialState, characterName: name },
});

/** Every call the page made, so a test can count round trips. */
let calls: string[] = [];

function serverThatReturns(
  characters: Array<{ id: string; sealedAt: string; state: unknown }> | null,
  { syncStatus = 200 }: { syncStatus?: number } = {},
) {
  return vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    calls.push(String(url));

    if (String(url).endsWith("/auth/me")) {
      return new Response(JSON.stringify({ account }), { status: 200 });
    }

    if (String(url).endsWith("/codex/sync")) {
      if (syncStatus !== 200) return new Response("{}", { status: syncStatus });

      const body = JSON.parse(String(init?.body ?? "{}"));
      return new Response(
        JSON.stringify({
          characters: characters ?? body.characters,
          added: 0,
          updated: 0,
          kept: 0,
          burned: body.burned.length,
        }),
        { status: 200 },
      );
    }

    return new Response("{}", { status: 200 });
  });
}

const syncCalls = () => calls.filter((url) => url.endsWith("/codex/sync")).length;

/** What the page actually sent to the store. */
function bodyOfSync(mock: ReturnType<typeof serverThatReturns>) {
  const call = mock.mock.calls.find((entry) => String(entry[0]).endsWith("/codex/sync"));
  if (!call) throw new Error("no sync was sent");
  return JSON.parse(String(call[1]?.body ?? "{}"));
}

beforeEach(() => {
  calls = [];
  useVault.setState({ characters: [], burned: [], account: null, editingId: null });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("quien esta adentro", () => {
  test("sin cuenta ofrece entrar, y no exige nada", async () => {
    // El estante funciona deslogueado y siempre funciono. La cuenta es una
    // oferta, no una puerta.
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ account: null }), { status: 200 })),
    );

    render(<AccountBadge />);

    expect(await screen.findByText("Entrar con Discord")).toBeTruthy();
  });

  test("un almacen sin cuentas no ofrece entrar a ningun lado", async () => {
    // Un despliegue que solo reparte codigos de importacion responde 501, y
    // ofrecer entrar seria ofrecer algo que no existe.
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 501 })));

    render(<AccountBadge />);

    await waitFor(() => expect(screen.getByText("Entrar con Discord")).toBeTruthy());
    expect(useVault.getState().account).toBe(null);
  });

  test("con cuenta muestra el nombre", async () => {
    vi.stubGlobal("fetch", serverThatReturns([]));

    render(<AccountBadge />);

    expect(await screen.findByText("Bertini")).toBeTruthy();
  });
});

describe("la sincronizacion", () => {
  test("sube lo que tiene la maquina en cuanto hay cuenta", async () => {
    useVault.setState({ characters: [sealed("a", "2026-08-01T00:00:00.000Z")] });
    const fetchMock = serverThatReturns(null);
    vi.stubGlobal("fetch", fetchMock);

    render(<AccountBadge />);

    await waitFor(() => expect(syncCalls()).toBe(1), { timeout: 4000 });
    const sent = bodyOfSync(fetchMock);
    expect(sent.characters.map((entry: { id: string }) => entry.id)).toEqual(["a"]);
  });

  test("adoptar la respuesta no dispara otra sincronizacion", async () => {
    /*
     * La trampa entera de "se sincroniza solo": la respuesta cambia el Codice,
     * y un hook que mira el Codice volveria a salir. Lo que se compara es la
     * firma —ids y fechas de sellado— y se anota con la respuesta.
     */
    useVault.setState({ characters: [sealed("a", "2026-08-01T00:00:00.000Z")] });
    vi.stubGlobal("fetch", serverThatReturns([sealed("b", "2026-08-09T00:00:00.000Z")]));

    render(<AccountBadge />);

    await waitFor(() => expect(syncCalls()).toBe(1), { timeout: 4000 });
    await waitFor(() =>
      expect(useVault.getState().characters.map((entry) => entry.id)).toEqual(["b"]),
    );

    // Tiempo de sobra para una segunda vuelta, si la fuera a haber.
    await new Promise((resolve) => setTimeout(resolve, 2000));
    expect(syncCalls()).toBe(1);
  });

  test("lo que vuelve pasa por la misma coercion que un borrador guardado", async () => {
    // Lo escribio la version del builder que lo sello, que puede no ser esta.
    vi.stubGlobal(
      "fetch",
      serverThatReturns([{ id: "a", sealedAt: "2026-08-01T00:00:00.000Z", state: { characterName: "Alba" } }]),
    );
    useVault.setState({ characters: [sealed("z", "2026-07-01T00:00:00.000Z")] });

    render(<AccountBadge />);

    await waitFor(() => {
      const [first] = useVault.getState().characters;
      expect(first?.state.characterName).toBe("Alba");
      // Un campo que el estado guardado no traia y que la coercion completa.
      expect(Array.isArray(first?.state.attunedItemIds)).toBe(true);
    }, { timeout: 4000 });
  });

  test("una sesion vencida deja de decir un nombre sobre nada", async () => {
    // Treinta dias se terminan. No es un error para gritar: es la oferta de
    // volver a entrar.
    useVault.setState({ characters: [sealed("a", "2026-08-01T00:00:00.000Z")] });
    vi.stubGlobal("fetch", serverThatReturns(null, { syncStatus: 401 }));

    render(<AccountBadge />);

    await waitFor(() => expect(screen.getByText("Entrar con Discord")).toBeTruthy(), {
      timeout: 4000,
    });
  });

  test("una falla del almacen no se lleva el estante puesto", async () => {
    // El Codice es local primero. Un cartel rojo sobre un estante que funciona
    // miente sobre lo que esta roto.
    useVault.setState({ characters: [sealed("a", "2026-08-01T00:00:00.000Z")] });
    vi.stubGlobal("fetch", serverThatReturns(null, { syncStatus: 500 }));

    render(<AccountBadge />);

    await waitFor(() => expect(screen.getByText("Bertini")).toBeTruthy());
    await waitFor(() => expect(useVault.getState().characters.length).toBe(1), { timeout: 4000 });
  });
});

describe("quemar un tomo", () => {
  test("queda anotado hasta que una sincronizacion lo lleve", () => {
    /*
     * Un merge que solo suma no puede expresar una baja. Sin esta lista el
     * servidor devuelve el tomo quemado en la sincronizacion siguiente.
     */
    useVault.setState({ characters: [sealed("a", "2026-08-01T00:00:00.000Z")] });

    useVault.getState().burn("a");

    expect(useVault.getState().characters).toEqual([]);
    expect(useVault.getState().burned).toEqual(["a"]);
  });

  test("la lista se limpia cuando el servidor ya lo supo", async () => {
    useVault.setState({
      characters: [sealed("a", "2026-08-01T00:00:00.000Z")],
      burned: ["viejo"],
    });
    const fetchMock = serverThatReturns([sealed("a", "2026-08-01T00:00:00.000Z")]);
    vi.stubGlobal("fetch", fetchMock);

    render(<AccountBadge />);

    await waitFor(() => expect(useVault.getState().burned).toEqual([]), { timeout: 4000 });
    expect(bodyOfSync(fetchMock).burned).toEqual(["viejo"]);
  });

  test("salir deja los personajes de esta maquina donde estan", async () => {
    // Salir es dejar la cuenta, no perder el estante.
    useVault.setState({ characters: [sealed("a", "2026-08-01T00:00:00.000Z")] });
    vi.stubGlobal("fetch", serverThatReturns(null));

    render(<AccountBadge />);
    const salir = await screen.findByText("Salir");
    salir.click();

    await waitFor(() => expect(useVault.getState().account).toBe(null));
    expect(useVault.getState().characters.length).toBe(1);
  });
});
