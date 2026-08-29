/**
 * The Vault's client state.
 *
 * One draft being forged, and the shelf of sealed characters behind it.
 *
 * The draft is the repo's own `BuilderState` rather than a shape of this
 * front's invention: every rule, derivation and export in the project reads
 * that type, so inventing a lighter one here would mean a translation layer
 * that silently drops whatever it does not know about — which is how the old
 * fabricated-actor import broke.
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";

/*
 * From `builder-state`, not `builder`: the store is what the Gate reads to
 * know whether a draft is in progress, and reaching through `builder` would
 * pull the whole index into the first paint.
 */
import {
  coerceBuilderState,
  initialState,
  type BuilderRulesVersion,
  type BuilderState,
} from "./builder-state";
import type { Pace } from "./chambers";
import type { Account, StoredCharacter } from "@bertinis-vault/contracts";

import { mergeCodex, type CodexMerge } from "./codex-file";

/** A character sealed in the Codex. */
export type SealedCharacter = {
  id: string;
  sealedAt: string;
  /**
   * The full builder state, not a derived sheet.
   *
   * Stored this way so a tome can be reopened and edited: a derived snapshot
   * would have to be reverse-engineered back into choices, and some choices
   * (which book a shared name came from, which ability a half-feat raised)
   * cannot be recovered from the result at all.
   */
  state: BuilderState;
};

/**
 * Where the dice are, between rolling and binding.
 *
 * Deliberately outside `BuilderState`: the canonical shape has `str`..`cha` as
 * plain numbers, which cannot express "rolled but not yet given a name". This
 * is the Forge's own scratch, and keeping it here rather than in component
 * state is what stops a reload mid-roll from throwing the loose scores away.
 */
export type ForgeScratch = {
  /** Rolled scores not yet bound to an ability. */
  pool: number[];
  /** Which abilities currently hold a bound score. */
  bound: string[];
  /**
   * The rolled sets still on offer.
   *
   * A player gets three throws and keeps whichever they like, so all three
   * have to survive walking to another chamber and back — which is the whole
   * reason this scratch exists rather than living in component state.
   * Empty for every method that is not rolling.
   */
  sets: number[][];
};

const emptyScratch: ForgeScratch = { pool: [], bound: [], sets: [] };

/**
 * How much of D&D the player already knows.
 *
 * Not a difficulty setting — it only decides what the Forge asks first. A
 * player who has never made a character picks a species and a class because
 * those are the parts they can picture; a player who has made twenty already
 * knows they want a 16 in the primary stat and would rather assign the six
 * numbers before anything else, since every later choice is judged against
 * them.
 *
 * `null` means unasked. Stored beside the Codex rather than on a character:
 * it is a fact about the person, not about the character being built.
 *
 * Defined next to the chamber order it decides, so the two cannot drift.
 */
export type { Pace } from "./chambers";

type VaultStore = {
  draft: BuilderState;
  scratch: ForgeScratch;
  characters: SealedCharacter[];
  /** Answered once, remembered. Null until the Forge asks. */
  pace: Pace | null;
  /**
   * The sealed character the draft came from, when one did.
   *
   * Without this, editing a sealed character and sealing again would shelve a
   * second copy beside the first — the Codex would fill with near-duplicates
   * and the player would have to burn the stale one by hand.
   */
  editingId: string | null;
  /**
   * Who is signed in, if anyone.
   *
   * Not persisted: the session lives in a cookie the page cannot read, so the
   * only honest way to know is to ask the store on load. A remembered account
   * would show somebody's name over a session that expired last month.
   */
  account: Account | null;
  /**
   * Characters burned on this machine since the last sync, by id.
   *
   * A newest-wins merge can only ever add, so a deletion has to be carried
   * separately — without this the account hands the burned tome straight back
   * on the next sync and it reads as the app resurrecting it.
   */
  burned: string[];

  /** Start a fresh draft for an edition. Called when entering the Forge. */
  beginDraft: (rulesVersion: BuilderRulesVersion) => void;
  /** Record — or clear, with null — how the Forge should order itself. */
  setPace: (pace: Pace | null) => void;
  patchDraft: (patch: Partial<BuilderState>) => void;
  setScratch: (scratch: ForgeScratch) => void;
  /** Load a sealed character back onto the anvil. */
  reforge: (id: string) => void;
  /** Seal the draft — as a new tome, or over the one being edited. */
  seal: () => string | null;
  /**
   * Shelve a character that was built somewhere else.
   *
   * Separate from `seal` because it never touches the anvil: a player who
   * drops a Foundry actor onto the Codex while halfway through forging
   * someone else must not lose the half-forged one.
   */
  admit: (state: BuilderState) => string;
  burn: (id: string) => void;
  /**
   * Fold an imported Codex into this one.
   *
   * Merged, never replaced — see `mergeCodex`. Returns what it did so the page
   * can say it: an import that reports nothing looks like an import that did
   * nothing.
   */
  importCharacters: (incoming: SealedCharacter[]) => CodexMerge;
  setAccount: (account: Account | null) => void;
  /**
   * Take the account's answer whole.
   *
   * The server already merged, so this replaces rather than merges again — and
   * it clears the burn list, because those deletions have now been carried.
   */
  adoptCharacters: (incoming: StoredCharacter[]) => void;
};

function freshDraft(rulesVersion: BuilderRulesVersion): BuilderState {
  return {
    ...initialState,
    rulesVersion,
    createdAt: new Date().toISOString(),
    // The repo's `initialState` is a worked demo character (Seraphina Vale, a
    // level 3 wizard). That is right for a dev harness and wrong for a player
    // opening the Forge, so the identity fields start empty here.
    characterName: "",
    playerName: "",
    alignment: "",
    trait: "",
    ideal: "",
    bond: "",
    flaw: "",
    notes: "",
    raceId: "",
    subraceId: "",
    classId: "",
    subclassId: "",
    backgroundId: "",
    backgroundFeatId: "",
    featId: "",
    level: 1,
    statMethod: "roll",
    // Unassigned. The Attributes chamber binds rolled scores onto these.
    str: 10,
    dex: 10,
    con: 10,
    int: 10,
    wis: 10,
    cha: 10,
    abilityBonuses: {},
    levelChoices: {},
    optionalFeatureIds: [],
    featAbilityChoices: {},
    sourceBooks: {},
    weaponId: "",
    armorId: "",
    extraEquipmentText: "",
    proficienciesText: "",
    languagesText: "",
    cantripsText: "",
    spellsText: "",
    spellbookText: "",
    spellVariantChoices: {},
    spellAbilityChoices: {},
    grantedSpellChoices: {},
    featuresText: "",
  };
}

export const useVault = create<VaultStore>()(
  persist(
    (set, get) => ({
      draft: freshDraft("5e-2014"),
      scratch: emptyScratch,
      characters: [],
      pace: null,
      editingId: null,
      account: null,
      burned: [],

      setPace: (pace) => set({ pace }),

      beginDraft: (rulesVersion) =>
        set({
          draft: freshDraft(rulesVersion),
          scratch: emptyScratch,
          editingId: null,
        }),

      patchDraft: (patch) => set((s) => ({ draft: { ...s.draft, ...patch } })),

      setScratch: (scratch) => set({ scratch }),

      reforge: (id) => {
        const found = get().characters.find((c) => c.id === id);
        if (!found) return;

        set({
          draft: found.state,
          // Every ability of a sealed character is bound by definition, so the
          // scratch is rebuilt as "all bound, nothing loose" — otherwise the
          // Attributes chamber would show six unassigned scores over a
          // character that already has them.
          // No leftover throws either: the dice that made this character were
          // rolled once, and offering to keep a different set now would mean
          // re-rolling a sealed character rather than editing it.
          scratch: { pool: [], bound: ["str", "dex", "con", "int", "wis", "cha"], sets: [] },
          editingId: id,
        });
      },

      seal: () => {
        const { draft, characters, editingId } = get();
        if (!draft.characterName.trim()) return null;

        /*
         * The anvil is cleared by sealing.
         *
         * It used to keep the sealed character sitting in `draft`, which made
         * the Gate offer "Retomar la forja" over work that was already
         * finished — and since `editingId` is dropped here, accepting that
         * offer and sealing again filed a second copy of the same character
         * in the Codex. A sealed character is reached through the Codex, not
         * through the anvil it came off.
         *
         * The edition survives, because it is a table's setting rather than
         * one character's, and the player who forges a second character
         * almost always forges it under the same rules.
         */
        const cleared = { draft: freshDraft(draft.rulesVersion), scratch: emptyScratch };

        // Re-sealing a reforged character overwrites its tome in place, and
        // keeps its shelf position rather than jumping it to the front: the
        // Codex is ordered by when a character was first sealed.
        if (editingId && characters.some((c) => c.id === editingId)) {
          set({
            characters: characters.map((entry) =>
              entry.id === editingId
                ? { ...entry, sealedAt: new Date().toISOString(), state: draft }
                : entry,
            ),
            editingId: null,
            ...cleared,
          });
          return editingId;
        }

        const id = crypto.randomUUID();
        set({
          characters: [
            { id, sealedAt: new Date().toISOString(), state: draft },
            ...characters,
          ],
          editingId: null,
          ...cleared,
        });
        return id;
      },

      admit: (state) => {
        const id = crypto.randomUUID();
        set((s) => ({
          characters: [{ id, sealedAt: new Date().toISOString(), state }, ...s.characters],
        }));
        return id;
      },

      importCharacters: (incoming) => {
        const result = mergeCodex(get().characters, incoming);
        set({ characters: result.characters });
        return result;
      },

      burn: (id) =>
        set((s) => ({
          characters: s.characters.filter((c) => c.id !== id),
          // Burning the tome currently on the anvil turns the edit into a new
          // character rather than leaving `seal` pointing at nothing.
          editingId: s.editingId === id ? null : s.editingId,
          // Remembered until a sync carries it. A character burned offline is
          // still burned when the machine comes back.
          burned: s.burned.includes(id) ? s.burned : [...s.burned, id],
        })),

      setAccount: (account) => set({ account }),

      adoptCharacters: (incoming) =>
        set((s) => ({
          characters: incoming.map((entry) => ({
            id: entry.id,
            sealedAt: entry.sealedAt,
            // Read through the same coercion a stored draft goes through: what
            // comes back was written by whichever version of the builder sealed
            // it, which may not be this one.
            state: coerceBuilderState(entry.state),
          })),
          burned: [],
          // A tome that is no longer on the shelf cannot be the one being
          // edited, whether it left by burning or by a sync from elsewhere.
          editingId: incoming.some((entry) => entry.id === s.editingId) ? s.editingId : null,
        })),
    }),
    {
      name: "bertinis-vault:codex",
      /**
       * Drafts written by an older build are run through the repo's own
       * coercion rather than trusted, which is what keeps a stored draft
       * readable after the state shape gains a field.
       */
      merge: (persisted, current) => {
        const saved = persisted as Partial<VaultStore> | undefined;
        if (!saved) return current;

        const characters = Array.isArray(saved.characters)
          ? saved.characters.map((entry) => ({
              id: entry.id,
              sealedAt: entry.sealedAt,
              state: coerceBuilderState(entry.state),
            }))
          : [];

        return {
          ...current,
          draft: coerceBuilderState(saved.draft),
          scratch: coerceScratch(saved.scratch),
          characters,
          // Anything that is not one of the two answers is treated as unasked,
          // which is also what every Codex saved before this existed carries.
          pace: saved.pace === "nuevo" || saved.pace === "veterano" ? saved.pace : null,
          // A reload mid-edit stays an edit. Checked against the shelf so a
          // stale id — the tome was burned in another tab — cannot make `seal`
          // silently discard the draft by overwriting a character that is gone.
          editingId:
            typeof saved.editingId === "string" &&
            characters.some((c) => c.id === saved.editingId)
              ? saved.editingId
              : null,
          // Carried across reloads for the same reason it exists at all: a
          // machine that burns a tome offline has to be able to say so later.
          burned: Array.isArray(saved.burned)
            ? saved.burned.filter((id): id is string => typeof id === "string" && id.length > 0)
            : [],
        };
      },
    },
  ),
);

/** A stored scratch, or an empty one. Drafts saved before it existed have none. */
function coerceScratch(value: unknown): ForgeScratch {
  if (!value || typeof value !== "object") return emptyScratch;

  const candidate = value as Partial<ForgeScratch>;
  return {
    pool: Array.isArray(candidate.pool)
      ? candidate.pool.filter((entry): entry is number => typeof entry === "number")
      : [],
    bound: Array.isArray(candidate.bound)
      ? candidate.bound.filter((entry): entry is string => typeof entry === "string")
      : [],
    // Absent from every scratch saved before the three throws existed, so a
    // reload of an older draft has to land on an empty list, not undefined.
    sets: Array.isArray(candidate.sets)
      ? candidate.sets
          .filter((entry): entry is number[] => Array.isArray(entry))
          .map((entry) => entry.filter((score): score is number => typeof score === "number"))
      : [],
  };
}

/**
 * Whether the anvil currently holds work worth losing.
 *
 * `beginDraft` replaces the draft outright, so anyone who returns to the Gate
 * mid-forge and presses the button out of habit loses a whole character with
 * no confirmation and no way back. Knowing whether there is anything there is
 * what lets the Gate offer to continue instead of silently discarding.
 *
 * The name alone counts: someone who has typed who this is has started.
 */
export function hasProgress(state: BuilderState): boolean {
  return Boolean(
    state.characterName.trim() ||
      state.raceId ||
      state.classId ||
      state.backgroundId ||
      state.level > 1,
  );
}

/**
 * What a species or class change has to let go of.
 *
 * Nothing downstream re-checks these against the new pick, so keeping them
 * exports a character carrying another species' or class's choices — a wizard
 * turned fighter who still casts Fireball, a dwarf turned elf who still has
 * the dwarf's Constitution because the species seed only runs when no bonus
 * has been assigned.
 *
 * Returns both the patch and the names of what went, so the Forge can say it
 * out loud: dropping a pick in silence is its own kind of wrong.
 */
export function releasedByPick(
  prop: "race" | "class" | "background",
  draft: BuilderState,
): { patch: Partial<BuilderState>; shed: string[] } {
  if (prop === "background") {
    /*
     * Only the chosen feat, and only where one was chosen.
     *
     * Almost every 2024 background names a single feat, which is derived from
     * the background itself and needs nothing released. The four that let the
     * player choose are the ones that leave a stale id behind — a feat the new
     * background does not grant, exported as though it did.
     *
     * Proficiencies and languages are not released here: two effects in the
     * Forge already re-derive them from whatever background is current.
     */
    return {
      patch: { backgroundFeatId: "" },
      shed: draft.backgroundFeatId ? ["la dote del trasfondo"] : [],
    };
  }

  if (prop === "race") {
    const shed: string[] = [];
    if (draft.subraceId) shed.push("la subraza");
    if (Object.keys(draft.abilityBonuses).length > 0) shed.push("la mejora de especie");
    return { patch: { subraceId: "", abilityBonuses: {} }, shed };
  }

  const shed: string[] = [];
  if (draft.subclassId) shed.push("la subclase");
  if (draft.optionalFeatureIds.length > 0) shed.push("los dones");
  if (draft.cantripsText.trim() || draft.spellsText.trim() || draft.spellbookText.trim()) {
    shed.push("los conjuros");
  }

  return {
    patch: {
      subclassId: "",
      optionalFeatureIds: [],
      cantripsText: "",
      spellsText: "",
      // The book is a wizard's, and a player leaving the wizard behind is not
      // taking it with them.
      spellbookText: "",
    },
    shed,
  };
}

/** The edition a draft targets, in the index's vocabulary. */
export function rulesVersionOf(state: BuilderState): "2014" | "2024" {
  return state.rulesVersion === "5e-2024" ? "2024" : "2014";
}
