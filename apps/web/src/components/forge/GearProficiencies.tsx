/**
 * What the character may wear and what they may swing.
 *
 * Shown as soon as there is a class, before the draft derives: a fighter is
 * proficient with martial weapons whether or not a background has been picked,
 * and the player choosing between a rapier and a greatsword is choosing now.
 *
 * A dip is marked with the class that granted it. The question a multiclassed
 * player asks is never "what am I proficient with" — it is "where did the
 * shield come from", and the answer is on the other class's page.
 */

import type { GearProficiencies, ProficiencyLine } from "@/lib/gear-proficiencies";
import { LABEL_MB2, WHISPER } from "@/styles/recipes";

export default function GearProficienciesPanel({
  proficiencies,
  classLabels,
  accent,
}: {
  proficiencies: GearProficiencies;
  /** Class id to the name the player picked it by. */
  classLabels: Record<string, string>;
  accent: string;
}) {
  const { armor, weapons } = proficiencies;
  if (!armor.length && !weapons.length) return null;

  return (
    <div className="mt-6 border-t border-iron/40 pt-5">
      <p className={LABEL_MB2}>Competencias de equipo</p>

      {/* A character with no armour proficiency at all — the monk, the wizard,
          the 2014 sorcerer — is told so. An empty space reads as a gap in the
          sheet rather than as the rule it is. */}
      <div className="mb-3">
        <p className="mb-1 font-mono text-[10px] uppercase tracking-wide text-bone/60">Armadura</p>
        {armor.length ? (
          <Lines lines={armor} classLabels={classLabels} accent={accent} />
        ) : (
          <p className={WHISPER}>
            Ninguna — con armadura tiras con desventaja y no podes lanzar conjuros.
          </p>
        )}
      </div>

      <div>
        <p className="mb-1 font-mono text-[10px] uppercase tracking-wide text-bone/60">Armas</p>
        <Lines lines={weapons} classLabels={classLabels} accent={accent} />
      </div>
    </div>
  );
}

function Lines({
  lines,
  classLabels,
  accent,
}: {
  lines: ProficiencyLine[];
  classLabels: Record<string, string>;
  accent: string;
}) {
  return (
    <ul className="space-y-1">
      {lines.map((line) => (
        <li key={line.id}>
          <span className="flex min-w-0 items-baseline gap-1.5">
            <span className="font-mono text-[10px] leading-none" style={{ color: accent }}>
              •
            </span>
            <span className="truncate font-body text-xs">{line.label}</span>
            {/* Only worth saying when more than one class is in play: on a
                single-class sheet every line came from the same place. */}
            {line.from.length > 0 && Object.keys(classLabels).length > 1 && (
              <span className="shrink-0 font-mono text-[10px] uppercase tracking-wide text-bone/60">
                {line.from.map((id) => classLabels[id] ?? id).join(", ")}
              </span>
            )}
          </span>
          {/* A rule spelled out. Written under the rule rather than behind a
              hover, because the player deciding what to buy is as likely to be
              on a phone as at a desk. */}
          {line.detail && (
            <span className="ml-3.5 block font-body text-[10px] leading-snug text-bone/60">
              {line.detail}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}
