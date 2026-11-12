/**
 * What a choice in the Forge writes.
 *
 * These were handlers inside the Forge route, each building a patch by hand
 * from whatever the component had in scope. That put a rule — lowering the
 * level drops the improvements earned above it, erasing a spell from the book
 * unprepares it — where only a React render could reach it, and where a panel
 * could show a choice that no handler ever wrote.
 *
 * Here a choice is data and writing it is one pure function. Any interface
 * dispatches the same action and gets the same character; a test can drive
 * the whole path without a page.
 *
 * Not every choice is here yet. The ones that remain in the route are the ones
 * that lean on what its effects compute; they move as those do.
 */

import type { AbilityId } from "./abilities";
import { rulesVersionOf, type BuilderState, type ExtraClass } from "./builder-state";
import { allOptions } from "./catalog";
import { classEntriesFor, emptyExtraClass } from "./classing";
import { resolveDraft } from "./derive";
import { fromLines, toLines } from "./grants";
import { levellingFor } from "./index-options";
import { spellPlansFor, strayChoices } from "./spells";
import {
  ROLL_ATTEMPTS,
  pointBuyFloor,
  scratchForMethod,
  type StatMethodId,
  type StatScratch,
} from "./stat-methods";

/** The draft being forged and the dice beside it. */
export type Anvil = {
  draft: BuilderState;
  scratch: StatScratch;
};

export type ForgeAction =
  | { type: "setLevel"; level: number }
  | { type: "toggleCantrip"; value: string }
  | { type: "toggleSpell"; line: string }
  | { type: "toggleBookSpell"; line: string }
  | { type: "addClass" }
  | { type: "changeClass"; index: number; next: ExtraClass }
  | { type: "removeClass"; index: number }
  | { type: "answerExpertise"; key: string; setIndex: number; of: "skills" | "tools"; id: string }
  | { type: "toggleMastery"; id: string }
  | { type: "toggleAttunement"; id: string }
  | { type: "setHitPointRoll"; level: number; roll: number | null }
  | { type: "setLevelChoice"; key: string; choice: BuilderState["levelChoices"][string] }
  | { type: "setFeatAbilities"; featId: string; bonuses: BuilderState["featAbilityChoices"][string] }
  | { type: "chooseStatMethod"; method: StatMethodId }
  | { type: "roll"; rolled: number[] }
  | { type: "keepSet"; index: number }
  | { type: "bindScore"; ability: AbilityId; value: number }
  | { type: "releaseScore"; ability: AbilityId };

export type Outcome = Anvil & {
  /**
   * What the change took with it, in words for the player.
   *
   * Absent when the action has nothing to say, which is not the same as an
   * empty list: an empty list clears the last notice, absence leaves it up.
   */
  shed?: string[];
};

const UNBOUND = { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 } as const;

const toggled = (list: readonly string[], value: string): string[] =>
  list.includes(value) ? list.filter((entry) => entry !== value) : [...list, value];

/**
 * What a change of classes or levels takes with it from the spell lists.
 *
 * Asked of the draft as it will be, against the plans it will have: the spells
 * only a class that is leaving offered, and the ones above the spell level a
 * lower level reaches. Done on the change itself, so a list brought in from a
 * Foundry actor is never pruned behind the player's back — only what their own
 * change made illegal goes.
 *
 * The snapshot is the current draft's, not the next one's: that is what the
 * route passed, and this move changes no behaviour.
 */
export function releaseStraySpells(
  current: BuilderState,
  next: BuilderState,
): { patch: Partial<BuilderState>; shed: string[] } {
  const rulesVersion = rulesVersionOf(current);
  const resolved = resolveDraft(current);
  const classes = allOptions("class", rulesVersion);

  const plans = spellPlansFor({
    entries: classEntriesFor(
      { classId: next.classId, subclassId: next.subclassId, level: next.level },
      next.extraClasses,
      rulesVersion,
    ),
    labelFor: (classId) => {
      const found = classes.find((entry) => entry.id === classId);
      return { label: found?.label ?? classId, source: found?.source ?? "" };
    },
    rulesVersion,
    snapshot: resolved.status === "ready" ? resolved.snapshot : null,
    spellbook: toLines(next.spellbookText),
  });
  const stray = strayChoices(plans, {
    cantrips: toLines(next.cantripsText),
    spells: toLines(next.spellsText),
    book: toLines(next.spellbookText),
  });
  const count = stray.cantrips.length + stray.spells.length + stray.book.length;
  if (count === 0) return { patch: {}, shed: [] };

  const without = (text: string, drop: string[]) =>
    fromLines(toLines(text).filter((line) => !drop.includes(line)));

  return {
    patch: {
      cantripsText: without(next.cantripsText, stray.cantrips),
      spellsText: without(next.spellsText, [...stray.spells, ...stray.book]),
      spellbookText: without(next.spellbookText, stray.book),
    },
    shed: [
      count === 1
        ? "un conjuro que ya no te ofrece ninguna clase"
        : `${count} conjuros que ya no te ofrece ninguna clase`,
    ],
  };
}

/** A patch that may take stray spells with it, and says so only when it did. */
function withStrays(anvil: Anvil, patch: Partial<BuilderState>): Outcome {
  const released = releaseStraySpells(anvil.draft, { ...anvil.draft, ...patch });
  return {
    draft: { ...anvil.draft, ...patch, ...released.patch },
    scratch: anvil.scratch,
    ...(released.shed.length ? { shed: released.shed } : {}),
  };
}

export function applyAction(anvil: Anvil, action: ForgeAction): Outcome {
  const { draft, scratch } = anvil;
  const write = (patch: Partial<BuilderState>): Outcome => ({ draft: { ...draft, ...patch }, scratch });

  switch (action.type) {
    case "setLevel": {
      const rulesVersion = rulesVersionOf(draft);
      const stillEntitled =
        action.level >= (levellingFor(draft.classId, rulesVersion).subclassLevel ?? 3);

      // Improvements recorded above the new level are dropped: the sum of the
      // map does not consult the level, so a character reforged down from 8 to
      // 4 would keep the points earned at 6 and 8. Only the first class's own
      // keys are levels of this class; `wizard:4` belongs to that class.
      const levelChoices = Object.fromEntries(
        Object.entries(draft.levelChoices).filter(
          ([at]) => at.includes(":") || Number(at) <= action.level,
        ),
      );

      return withStrays(anvil, {
        level: action.level,
        levelChoices,
        ...(stillEntitled ? {} : { subclassId: "" }),
      });
    }

    case "toggleCantrip":
      return write({ cantripsText: fromLines(toggled(toLines(draft.cantripsText), action.value)) });

    case "toggleSpell":
      return write({ spellsText: fromLines(toggled(toLines(draft.spellsText), action.line)) });

    case "toggleBookSpell": {
      const book = toLines(draft.spellbookText);
      if (!book.includes(action.line)) {
        return write({ spellbookText: fromLines([...book, action.line]) });
      }
      // Erasing a spell from the book unprepares it too: a wizard cannot
      // prepare what is not written down, and leaving it would keep a spell the
      // picker no longer offers — invisible on the page and still exported.
      return write({
        spellbookText: fromLines(book.filter((entry) => entry !== action.line)),
        spellsText: fromLines(toLines(draft.spellsText).filter((entry) => entry !== action.line)),
      });
    }

    case "addClass":
      return write({ extraClasses: [...draft.extraClasses, emptyExtraClass()] });

    case "changeClass":
      return withStrays(anvil, {
        extraClasses: draft.extraClasses.map((extra, at) =>
          at === action.index ? action.next : extra,
        ),
      });

    case "removeClass":
      return withStrays(anvil, {
        extraClasses: draft.extraClasses.filter((_, at) => at !== action.index),
      });

    case "answerExpertise": {
      // A pick already taken is dropped, so the same button chooses and
      // unchooses. Changing which set the grant is spent on clears the picks.
      const empty: BuilderState["expertiseChoices"][string] = {
        setIndex: action.setIndex,
        skills: [],
        tools: [],
      };
      const current = draft.expertiseChoices[action.key] ?? empty;
      const base = current.setIndex === action.setIndex ? current : empty;
      const picked = base[action.of];
      const next = action.id ? toggled(picked, action.id) : picked;

      return write({
        expertiseChoices: {
          ...draft.expertiseChoices,
          [action.key]: { ...base, [action.of]: next },
        },
      });
    }

    case "toggleMastery":
      return write({ weaponMasteryIds: toggled(draft.weaponMasteryIds, action.id) });

    case "toggleAttunement":
      // Attuning to a fourth is allowed and named, not refused.
      return write({ attunedItemIds: toggled(draft.attunedItemIds, action.id) });

    case "setHitPointRoll": {
      // Null clears, and clearing is not a zero: a level with no roll takes
      // the average, so the entry is removed rather than stored as a number.
      const hpRolls = { ...draft.hpRolls };
      if (action.roll === null) delete hpRolls[String(action.level)];
      else hpRolls[String(action.level)] = action.roll;
      return write({ hpRolls });
    }

    case "setLevelChoice":
      return write({ levelChoices: { ...draft.levelChoices, [action.key]: action.choice } });

    case "setFeatAbilities":
      return write({
        featAbilityChoices: { ...draft.featAbilityChoices, [action.featId]: action.bonuses },
      });

    case "chooseStatMethod": {
      if (action.method === draft.statMethod) return anvil;
      // Switching method clears what the last one produced and keeps the
      // throws; see `scratchForMethod`.
      return {
        draft: {
          ...draft,
          statMethod: action.method,
          ...(action.method === "pointbuy" ? pointBuyFloor() : UNBOUND),
        },
        scratch: scratchForMethod(action.method, scratch.sets),
      };
    }

    case "roll":
      // One throw, kept alongside the others until the player picks.
      return {
        draft: { ...draft, ...UNBOUND, statMethod: "roll" },
        scratch: {
          pool: [],
          bound: [],
          sets: [...scratch.sets, action.rolled].slice(-ROLL_ATTEMPTS),
        },
      };

    case "keepSet": {
      const chosen = scratch.sets[action.index];
      if (!chosen) return anvil;
      return {
        draft: { ...draft, ...UNBOUND },
        scratch: { pool: [...chosen], bound: [], sets: scratch.sets },
      };
    }

    case "bindScore": {
      const index = scratch.pool.indexOf(action.value);
      if (index < 0) return anvil;
      const pool = [...scratch.pool];
      pool.splice(index, 1);
      return {
        draft: { ...draft, [action.ability]: action.value },
        scratch: { ...scratch, pool, bound: [...scratch.bound, action.ability] },
      };
    }

    case "releaseScore": {
      if (!scratch.bound.includes(action.ability)) return anvil;
      return {
        draft: { ...draft, [action.ability]: 10 },
        scratch: {
          ...scratch,
          pool: [...scratch.pool, draft[action.ability]],
          bound: scratch.bound.filter((entry) => entry !== action.ability),
        },
      };
    }
  }
}
