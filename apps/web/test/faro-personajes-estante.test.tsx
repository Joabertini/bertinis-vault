/**
 * El estante 3D se arma de nuevo cada vez que cambia la lista de personajes que recibe. Marcar Disponible vuelve a
 * dibujar "Mis personajes": si la lista llega como un array nuevo, la escena se rearma debajo del panel abierto y
 * queda encimada con él.
 */

import { act, cleanup, render, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, expect, test, vi } from "vitest";

import { initialState } from "../src/lib/builder";
import { useVault, type SealedCharacter } from "../src/lib/vault-store";
import Personajes from "../src/routes/Personajes";

type Props = { characters: SealedCharacter[]; onDisponible: (id: string, value: boolean) => void };
const recibidos: Props[] = [];

vi.mock("../src/components/codex/shelf/CodexShelf", () => ({
  default: (props: Props) => {
    recibidos.push(props);
    return null;
  },
}));
vi.mock("../src/lib/codex-sync", () => ({
  useCodexSync: () => ({ account: null, accountsAvailable: null, status: { state: "idle" } }),
}));
vi.mock("../src/components/codex/CodexBackup", () => ({ default: () => null }));
vi.mock("../src/components/codex/DropActor", () => ({ default: () => null }));
vi.mock("../src/components/codex/OpenCode", () => ({ default: () => null }));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

test("marcar Disponible no le cambia la lista de personajes al estante", async () => {
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
  useVault.setState({
    characters: [{ id: "a", sealedAt: "2026-11-27", state: { ...initialState, characterName: "Vin" } } as unknown as SealedCharacter],
  });
  render(
    <MemoryRouter>
      <Personajes />
    </MemoryRouter>,
  );
  await waitFor(() => expect(recibidos.length).toBeGreaterThan(0));
  const antes = recibidos.at(-1)!;
  const dibujos = recibidos.length;

  act(() => antes.onDisponible("a", true));

  expect(recibidos.length).toBeGreaterThan(dibujos);
  expect(recibidos.at(-1)!.characters).toBe(antes.characters);
});
