/**
 * What the character rolls, for everything.
 *
 * The sheet already said which proficiencies a character has. This says how
 * much each one adds, which is what a player actually looks up: the question
 * at a table is "what do I roll for Stealth?" and the answer is a number.
 *
 * All eighteen skills, not only the trained ones. The untrained roll is the
 * one nobody knows by heart, and hiding it is hiding the number the player is
 * about to get wrong. Proficiency is marked instead — a dot for trained, two
 * for doubled — so the list still reads at a glance as what this character is
 * good at.
 */

import type { Check } from "@/lib/checks";
import { LABEL_MB2 } from "@/styles/recipes";

const ABILITY_LABEL: Record<string, string> = {
  str: "FUE",
  dex: "DES",
  con: "CON",
  int: "INT",
  wis: "SAB",
  cha: "CAR",
};

const SKILL_LABEL: Record<string, string> = {
  acrobatics: "Acrobacias",
  "animal handling": "Trato con animales",
  arcana: "Arcanos",
  athletics: "Atletismo",
  deception: "Engano",
  history: "Historia",
  insight: "Perspicacia",
  intimidation: "Intimidacion",
  investigation: "Investigacion",
  medicine: "Medicina",
  nature: "Naturaleza",
  perception: "Percepcion",
  performance: "Interpretacion",
  persuasion: "Persuasion",
  religion: "Religion",
  "sleight of hand": "Juego de manos",
  stealth: "Sigilo",
  survival: "Supervivencia",
};

const signed = (value: number) => (value >= 0 ? `+${value}` : `${value}`);

export default function Checks({
  saves,
  skills,
  accent,
}: {
  saves: Check[];
  skills: Check[];
  accent: string;
}) {
  return (
    <div className="mt-6 border-t border-iron/40 pt-5">
      <p className={LABEL_MB2}>Salvaciones</p>
      <div className="mb-6 grid grid-cols-3 gap-x-3 gap-y-1.5">
        {saves.map((check) => (
          <Row
            key={check.ability}
            label={ABILITY_LABEL[check.ability] ?? check.ability}
            check={check}
            accent={accent}
          />
        ))}
      </div>

      <p className={LABEL_MB2}>Pericias</p>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
        {skills.map((check) => (
          <Row
            key={check.name}
            label={SKILL_LABEL[check.name] ?? check.name}
            check={check}
            accent={accent}
            ability={ABILITY_LABEL[check.ability] ?? check.ability}
          />
        ))}
      </div>
    </div>
  );
}

function Row({
  label,
  check,
  accent,
  ability,
}: {
  label: string;
  check: Check;
  accent: string;
  ability?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="flex min-w-0 items-baseline gap-1.5">
        {/* One dot trained, two doubled. Quieter than a word and readable in
            the same glance that reads the number. */}
        <span
          className="font-mono text-[10px] leading-none"
          style={{ color: check.proficient ? accent : "transparent" }}
          title={check.expert ? "Maestria" : check.proficient ? "Competente" : ""}
        >
          {check.expert ? "••" : "•"}
        </span>
        <span
          className="truncate font-body text-xs"
          style={{ color: check.proficient ? undefined : "rgb(245 240 230 / 0.35)" }}
        >
          {label}
        </span>
        {ability && (
          <span className="font-mono text-[10px] uppercase tracking-wide text-bone/60">
            {ability}
          </span>
        )}
      </span>
      <span
        className="shrink-0 font-mono text-xs tabular-nums"
        style={{ color: check.proficient ? accent : "rgb(245 240 230 / 0.4)" }}
      >
        {signed(check.modifier)}
      </span>
    </div>
  );
}
