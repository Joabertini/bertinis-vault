/**
 * Whether the character actually works.
 *
 * Everything else in this front answers "is this legal" — does it derive, does
 * it validate, does it cross to Foundry. None of that tells a player whether
 * the thing they built can do its job on turn one, which is a different
 * question with its own arithmetic.
 *
 * The rules encoded here are not opinions: a primary score too low to do its
 * job at level one, a Constitution dumped under a build that holds
 * concentration, two concentration spells competing for the one slot either
 * could occupy.
 *
 * The numbers are stated and not explained. What a player wants mid-build is
 * their attack bonus and their save DC, the way a character sheet gives them —
 * not the arithmetic behind them. Which die roll beats which armour class is
 * encounter-design maths, and it belongs to whoever is building the encounter.
 *
 * Deliberately absent: any judgement about armour class. It is whatever the
 * build assembles, and "good AC" at level 3 and level 15 are different
 * numbers. Inventing a threshold would be the confident wrong answer this
 * project treats as worse than saying nothing.
 */

import type { CharacterBuild } from "@bertinis-vault/contracts";
import type { RulesVersion } from "@bertinis-vault/vetools-ref";

import { savingThrowsForClass } from "@bertinis-vault/domain";

import { ABILITY_IDS, abilityLabels, type AbilityId } from "./abilities";
import type { BuilderState } from "./builder";
import { classInfoFor } from "./index-options";
import type { ActionProfile } from "./spells";

export type AdviceKind =
  /** A number the player should be reading, stated plainly. */
  | "number"
  /** Something the guide calls a build smell. */
  | "smell"
  /** A cheaper way to get the same thing. */
  | "note";

export type Advice = {
  id: string;
  kind: AdviceKind;
  title: string;
  detail: string;
};

/** The proficiency bonus the rules hand out, by level. */
export function proficiencyAt(level: number): number {
  if (level >= 17) return 6;
  if (level >= 13) return 5;
  if (level >= 9) return 4;
  if (level >= 5) return 3;
  return 2;
}

/** The next level that raises it, or null at the top of the table. */
export function nextProficiencyLevel(level: number): number | null {
  for (const breakpoint of [5, 9, 13, 17]) {
    if (level < breakpoint) return breakpoint;
  }
  return null;
}

export function modifierOf(score: number): number {
  return Math.floor((score - 10) / 2);
}

export function signed(value: number): string {
  return value >= 0 ? `+${value}` : `${value}`;
}

/**
 * The ability the character lives or dies by.
 *
 * The index records `spellcastingAbility` but no primary for the martials, so
 * for those the better of Strength and Dexterity is read off the scores
 * themselves rather than guessed from a hand-written table that would be wrong
 * for every build that swings the other way.
 */
export function primaryAbilityOf(
  state: BuilderState,
  rulesVersion: RulesVersion,
): { ability: AbilityId; source: "conjuros" | "armas" } | null {
  if (!state.classId) return null;

  const spellAbility = classInfoFor(state.classId, rulesVersion)?.spellcastingAbility;
  if (spellAbility && isAbilityId(spellAbility)) {
    return { ability: spellAbility, source: "conjuros" };
  }

  const swing: AbilityId = state.str >= state.dex ? "str" : "dex";
  return { ability: swing, source: "armas" };
}

function isAbilityId(value: string): value is AbilityId {
  return (ABILITY_IDS as readonly string[]).includes(value);
}

/**
 * Whether anything on the sheet already props up a concentration save.
 *
 * Three sources, and only three: the class grants the Constitution save at
 * level one, Resilient was taken and pointed at Constitution, or War Caster
 * was taken and rolls it with advantage. Those two are the only feats in
 * either edition that touch this save, so matching them by id does not become
 * a table of special cases — and which ability Resilient was pointed at is
 * read from the draft rather than assumed.
 *
 * A character who already spent a feat here is left alone. The arithmetic
 * further down would rank the other feat higher past level 13, but "spend a
 * second feat on the same save" is not advice worth interrupting anyone for.
 */
function holdsConSave(state: BuilderState): boolean {
  if (state.classId && savingThrowsForClass(state.classId).includes("con")) return true;

  for (const choice of Object.values(state.levelChoices)) {
    if (choice.kind !== "feat") continue;
    if (choice.featId === "war-caster") return true;
    if (choice.featId === "resilient" && (state.featAbilityChoices.resilient?.con ?? 0) > 0) {
      return true;
    }
  }

  return false;
}

/**
 * What the build is doing well or badly, in the order a player should read it.
 *
 * Returns nothing at all for a draft too early to judge — advice about a
 * character with no class is noise, and noise trains people to ignore the
 * panel that will later hold something worth reading.
 */
export function counselFor(
  snapshot: CharacterBuild,
  state: BuilderState,
  rulesVersion: RulesVersion,
  concentrationSpells: string[] = [],
  /**
   * How the spell list spreads across a turn.
   *
   * Spells only. The index records a casting time per spell and nothing of the
   * sort for class features or optional features, so this is a partial view
   * and the panel says so rather than implying it covers the whole character.
   */
  actions: ActionProfile | null = null,
): Advice[] {
  const advice: Advice[] = [];
  if (!state.classId) return advice;

  const scores = snapshot.abilities.final;
  const level = state.level;
  const prof = snapshot.derived.proficiencyBonus;
  const primary = primaryAbilityOf(state, rulesVersion);

  /* ---------------- the numbers ---------------- */

  if (primary) {
    const score = scores[primary.ability];
    const mod = modifierOf(score);
    const attack = prof + mod;

    advice.push({
      id: "ataque",
      kind: "number",
      title: `${signed(attack)} al ataque`,
      detail:
        primary.source === "conjuros"
          ? `Se suma a tus tiradas de ataque con conjuros. Competencia ${signed(prof)} mas ${abilityLabels[primary.ability]} ${signed(mod)}.`
          : `Se suma a tus tiradas de ataque. Competencia ${signed(prof)} mas ${abilityLabels[primary.ability]} ${signed(mod)}.`,
    });

    if (score < 16 && level >= 1) {
      advice.push({
        id: "principal-baja",
        kind: "smell",
        title: `${abilityLabels[primary.ability]} ${score}`,
        detail:
          "Dieciseis es el piso habitual para hacer tu trabajo desde el nivel 1. Con menos, cada tirada de ataque o cada CD arranca por debajo de lo que el juego espera.",
      });
    }

    if (score % 2 === 1) {
      advice.push({
        id: "principal-impar",
        kind: "note",
        title: `${abilityLabels[primary.ability]} ${score} es impar`,
        detail:
          "Un puntaje impar desperdicia medio modificador. Una media-dote lo sube a par y te da la dote en el mismo lugar, que una mejora suelta no puede igualar.",
      });
    }
  }

  const spellDC = snapshot.derived.spellcasting?.saveDC;
  if (typeof spellDC === "number") {
    advice.push({
      id: "cd",
      kind: "number",
      title: `CD ${spellDC}`,
      detail: "La dificultad que tus enemigos tienen que superar para resistir tus conjuros.",
    });
  }

  /* ---------------- defences ---------------- */

  if (scores.con <= 10) {
    advice.push({
      id: "con-baja",
      kind: "smell",
      title: `Constitucion ${scores.con}`,
      detail:
        "Casi imposible de dejar de lado: sostiene los puntos de golpe y la salvacion que protege la concentracion. Un personaje que la baja muere antes de que su plan termine de pasar.",
    });
  }

  /* ---------------- action economy ---------------- */

  if (actions) {
    const enCombate = actions.action.length + actions.bonus.length + actions.reaction.length;

    if (enCombate > 0) {
      advice.push({
        id: "reparto",
        kind: "number",
        title: `${actions.action.length} accion · ${actions.bonus.length} adicional · ${actions.reaction.length} reaccion`,
        detail:
          "Cada turno tenes una de cada. Los conjuros que comparten tipo compiten entre ellos, y el que no tenes queda sin usar.",
      });
    }

    /*
     * A whole action type left on the table.
     *
     * The guide names this outright: a character with no reaction use is idle
     * on everyone else's turn. Held back until the list is long enough for the
     * absence to mean something — scolding a level 1 caster with two spells
     * for lacking Shield is noise, not counsel.
     */
    if (enCombate >= 4 && actions.reaction.length === 0) {
      advice.push({
        id: "sin-reaccion",
        kind: "smell",
        title: "Ningun conjuro de reaccion",
        detail:
          "Tu reaccion queda libre en todos los turnos que no son tuyos. Un conjuro como Escudo o Contrahechizo ocupa un lugar que hoy no usa nadie.",
      });
    }

    // Two bonus-action spells cannot both go off in the same turn, and in 2014
    // casting a levelled one with the bonus action leaves the action able to
    // hold only a cantrip.
    if (actions.bonus.length >= 3) {
      advice.push({
        id: "adicional-lleno",
        kind: "note",
        title: `${actions.bonus.length} conjuros de accion adicional`,
        detail: `Solo uno por turno. ${actions.bonus.slice(0, 3).join(", ")} se estorban entre si mas de lo que parece al elegirlos.`,
      });
    }

    if (actions.long.length > 0) {
      const uno = actions.long.length === 1;
      advice.push({
        id: "fuera-de-combate",
        kind: "note",
        title: `${actions.long.length} ${uno ? "conjuro tarda" : "conjuros tardan"} un minuto o mas`,
        detail: `${actions.long.slice(0, 3).join(", ")} no ${uno ? "entra" : "entran"} en una pelea. ${
          uno ? "Es util, pero no cuenta" : "Son utiles, pero no cuentan"
        } para lo que podes hacer en un turno.`,
      });
    }
  }

  /* ---------------- concentration ---------------- */

  /*
   * Concentration is a resource with no save proficiency behind it.
   *
   * A character holding a concentration spell rolls a Constitution save every
   * time it is hit, and two thirds of the classes never grant that save. The
   * crossover below is computed, not quoted: advantage on the roll is worth
   * `q * (1 - q)` where `q` is the unaided success chance, and proficiency is
   * worth a flat `p / 20`. Against the DC 10 that most hits produce, advantage
   * stays ahead until proficiency reaches +5 — level 13, or level 9 once
   * Constitution is 18 and the base chance is already high.
   *
   * Both stop mattering against a single huge hit: a 40-damage blow asks for
   * DC 20, which a +2 modifier fails on 17 of 20 faces with or without a feat.
   */
  if (concentrationSpells.length >= 1 && !holdsConSave(state)) {
    const conMod = modifierOf(scores.con);
    const resilientAt = conMod >= 4 ? 9 : 13;
    const ventaja = level < resilientAt;

    advice.push({
      id: "salvacion-concentracion",
      kind: "smell",
      title: "Sin competencia en la salvacion de Constitucion",
      detail:
        `Cada golpe que recibas mientras concentras pide esa salvacion, y hoy tiras ${signed(conMod)} pelado. ` +
        (ventaja
          ? `Hasta nivel ${resilientAt} conviene Lanzador de Guerra: la ventaja rinde mas que la competencia mientras esta baja.`
          : `Desde nivel ${resilientAt} conviene Resiliencia (Constitucion): tu competencia ${signed(prof)} ya supera a la ventaja.`),
    });
  }

  if (concentrationSpells.length >= 2) {
    advice.push({
      id: "concentracion",
      kind: "smell",
      title: `${concentrationSpells.length} conjuros de concentracion`,
      detail: `Solo uno puede estar activo. ${concentrationSpells.slice(0, 3).join(", ")}${
        concentrationSpells.length > 3 ? " y otros" : ""
      } compiten por el mismo lugar, asi que la mitad de lo que preparaste no va a estar en juego.`,
    });
  }

  /* ---------------- the curve ---------------- */

  const next = nextProficiencyLevel(level);
  advice.push({
    id: "competencia",
    kind: "number",
    title: `Competencia ${signed(prof)}`,
    detail: next
      ? `Sube a ${signed(prof + 1)} cuando llegues a nivel ${next}.`
      : "Ya estas en el techo de la tabla.",
  });

  return advice;
}
