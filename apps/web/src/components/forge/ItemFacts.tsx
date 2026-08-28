/**
 * What the object you just picked actually does.
 *
 * Until this existed the Equipo chamber was three search boxes: you picked a
 * glaive and the sheet's armour class moved, or did not, and nothing said why.
 * A weapon's damage, its reach, whether it needs both hands — those are the
 * facts the pick is made on, and they were only visible after exporting.
 *
 * Everything here is read off the index through `factsFor`; nothing is
 * hand-written per item.
 */

import type { ItemFacts as Facts } from "@/lib/item-facts";
import { KIND_LABEL, RARITY_LABEL, RARITY_TINT } from "@/lib/item-facts";

export default function ItemFacts({ facts, accent }: { facts: Facts; accent: string }) {
  const { row, weapon, armor } = facts;

  return (
    <div className="mt-4 border-l-2 pl-4" style={{ borderColor: `${accent}55` }}>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="font-display text-base font-bold" style={{ color: accent }}>
          {row.name}
        </span>
        <span className="font-mono text-[9px] uppercase tracking-[0.25em] text-bone/30">
          {KIND_LABEL[facts.kind]}
        </span>
        {/*
          Rarity, only for things that have one.
          Saying "comun y corriente" over a longsword is noise; saying "muy
          raro" over a magic one is the first thing a player wants to know.
        */}
        {facts.magic && (
          <span
            className="font-mono text-[9px] uppercase tracking-[0.25em]"
            style={{ color: RARITY_TINT[facts.rarity] }}
          >
            {RARITY_LABEL[facts.rarity]}
          </span>
        )}
        {facts.attunement && (
          <span className="font-mono text-[9px] uppercase tracking-[0.25em] text-ember/70">
            Requiere sintonizacion
          </span>
        )}
      </div>

      {/* The numbers, on one line. */}
      <div className="mt-2 flex flex-wrap items-baseline gap-x-4 gap-y-1 font-mono text-[11px] text-bone/60">
        {weapon?.damage && <span style={{ color: accent }}>{weapon.damage}</span>}
        {armor && <span style={{ color: accent }}>{armor.armorClass}</span>}
        {armor?.strength !== null && armor?.strength !== undefined && (
          <span className="text-bone/40">Fuerza {armor.strength}</span>
        )}
        {armor?.stealthDisadvantage && (
          <span className="text-ember/60">Desventaja en Sigilo</span>
        )}
        {facts.weight && <span className="text-bone/30">{facts.weight}</span>}
        {facts.price && <span className="text-bone/30">{facts.price}</span>}
      </div>

      {/*
        The properties, each with what it changes.
        Named and explained together: a player who knows what Sutil means skims
        the names, and one who does not gets the sentence for free.
      */}
      {weapon && weapon.properties.length > 0 && (
        <ul className="mt-3 space-y-1">
          {weapon.properties.map((property) => (
            <li key={property.code} className="font-body text-xs leading-relaxed text-bone/40">
              <span className="text-bone/70">{property.label}</span>
              {property.means && ` — ${property.means}`}
            </li>
          ))}
        </ul>
      )}

      {/* Maestrias: 2024 only, and only for the classes that get them. */}
      {weapon && weapon.masteries.length > 0 && (
        <div className="mt-3">
          <p className="font-mono text-[9px] uppercase tracking-[0.25em] text-gold/60">Maestria</p>
          <ul className="mt-1 space-y-1">
            {weapon.masteries.map((mastery) => (
              <li key={mastery.name} className="font-body text-xs leading-relaxed text-bone/40">
                <span className="text-bone/70">{mastery.name}</span>
                {mastery.means && ` — ${mastery.means}`}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
