/**
 * The rolls of this session, newest first: what the tray shows.
 *
 * Not persisted. A roll is a thing that happened at the table a minute ago; it is no use after a
 * reload, and a stored history would only grow.
 */

import { create } from "zustand";

import type { RollMode } from "@/lib/roll-formula";

export type RollEntry = {
  id: number;
  /** "Stealth", "Scimitar · Ataque"… */
  titulo: string;
  /** What was rolled. Empty for a notice. */
  formula: string;
  total: number | null;
  detalle: string;
  modo: RollMode;
  /** The natural d20: 20 and 1 are marked. */
  d20: number | null;
  /** A critical hit: the dice were doubled. */
  critico?: boolean;
  /** A line the sheet wants to say, not a roll: "Descanso largo", "Sintonía 3 / 3". */
  aviso: string | null;
};

const LIMIT = 40;
let next = 1;

type RollStore = {
  rolls: RollEntry[];
  push: (entry: Omit<RollEntry, "id">) => void;
  clear: () => void;
};

export const useRolls = create<RollStore>((set) => ({
  rolls: [],
  push: (entry) => set((s) => ({ rolls: [{ ...entry, id: next++ }, ...s.rolls].slice(0, LIMIT) })),
  clear: () => set({ rolls: [] }),
}));
