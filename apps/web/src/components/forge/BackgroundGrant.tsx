/**
 * What a background actually hands the character.
 *
 * The chamber used to show a name and a book and nothing else, so choosing
 * between 161 backgrounds meant choosing between 161 strings. Every one of
 * them grants skills, most grant tools, many grant a feat, and 134 of the 161
 * carry a starting equipment list — all of it already in the index, none of it
 * on screen.
 *
 * Mechanics only, and that is a limit rather than a preference: the index
 * carries no prose at all. Not for backgrounds, not for species, not for
 * spells. There is no summary to show and no full text behind a link, because
 * the data does not exist on this side. Bringing it over means changing the
 * index, which is a repo change. See CONTEXT.md.
 *
 * Granted and chosen are kept apart. A skill the background simply gives you
 * is not a decision, and drawing it like one invites a player to try to
 * decline something they cannot.
 */

import { motion } from "framer-motion";

import type { RulesVersion } from "@bertinis-vault/vetools-ref";

import {
  featChoiceForBackground,
  featOptionLabel,
  proficiencyGrantForBackground,
  startingEquipmentForBackground,
} from "@/lib/index-options";

export default function BackgroundGrant({
  backgroundId,
  rulesVersion,
  sourceBook,
  accent,
}: {
  backgroundId: string;
  rulesVersion: RulesVersion;
  sourceBook?: string | undefined;
  accent: string;
}) {
  const grant = proficiencyGrantForBackground(backgroundId, rulesVersion, sourceBook);
  const feat = featChoiceForBackground(backgroundId, rulesVersion, sourceBook);
  const gear = startingEquipmentForBackground(backgroundId, rulesVersion, sourceBook);

  const nothing =
    grant.skillsGranted.length === 0 &&
    grant.toolsGranted.length === 0 &&
    !grant.skillChoice &&
    !feat &&
    gear.length === 0;

  if (nothing) {
    return (
      <p className="font-body text-sm italic text-bone/35">
        El indice no registra que este trasfondo otorgue nada.
      </p>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-5"
    >
      <Line label="Competencias" accent={accent} items={grant.skillsGranted} />
      <Line label="Herramientas" accent={accent} items={grant.toolsGranted} />

      {grant.skillChoice && (
        <Line
          label={`Elegis ${grant.skillChoice.count} de`}
          accent={accent}
          items={grant.skillChoice.options}
          chosen
        />
      )}

      {feat && (
        <Line
          label={feat.options.length === 1 ? "Dote" : "Elegis una dote de"}
          accent={accent}
          items={feat.options.map(featOptionLabel)}
          chosen={feat.options.length > 1}
        />
      )}

      {gear.length > 0 && (
        <Line label="Equipo inicial" accent={accent} items={gear} muted />
      )}
    </motion.div>
  );
}

/**
 * One row of grants.
 *
 * `chosen` tints the chips to say the player still has to pick; `muted` is for
 * the things that come along without mattering mechanically, like clothes.
 */
function Line({
  label,
  items,
  accent,
  chosen = false,
  muted = false,
}: {
  label: string;
  items: string[];
  accent: string;
  chosen?: boolean;
  muted?: boolean;
}) {
  if (items.length === 0) return null;

  return (
    <div>
      <p className="mb-2 font-mono text-[9px] uppercase tracking-[0.3em] text-bone/35">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {items.map((item) => (
          <span
            key={item}
            className="border px-2.5 py-1 font-body text-xs"
            style={
              chosen
                ? { borderColor: `${accent}55`, color: "#E6DFCE" }
                : muted
                  ? { borderColor: "rgba(74,70,64,0.4)", color: "rgba(230,223,206,0.4)" }
                  : { borderColor: `${accent}33`, background: `${accent}0f`, color: accent }
            }
          >
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}
