# What the sheet needs, field by field

A map from "the builder makes a choice" to "where that choice lands on the
actor," built by reading the `dnd5e` system's actor data model directly
(`foundryvtt/dnd5e`, `master`, checked 2026-08-24) and cross-referenced against
what `apps/foundry-module/src/import.js` actually writes today. It exists so
that closing a `CHARACTER-MODEL-GAPS.md` finding can be checked against the
real destination field instead of against what looks plausible.

This is reasoning from source, not observation — nothing here has been
confirmed inside a running Foundry world. See `AI-HANDOFF.md` item 2.

## Two sheets, two jobs

**Foundry's `dnd5e` actor (`system.*`)** is the wire target — what
`import.js` writes to. It is the only one that matters for correctness.

**D&D Beyond's sheet** is a UX reference — how a mature builder groups these
same choices for a human to review before finishing a character. Its section
boundaries are a decent model for how the web builder's own screens should
group picks, independent of how the data is stored.

## The actor's fields, by category

Each row: the `system.*` path, who owns filling it, and whether `import.js`
writes it today (checked against `apps/foundry-module/src/import.js`).

### Ability scores & saves

| Field | Owner | Written today? |
| --- | --- | --- |
| `abilities.<id>.value` | payload `abilities` | yes — `baseActorData` |
| `abilities.<id>.proficient` | payload `proficiencies.savingThrows` | yes — `proficiencyUpdates` |
| `abilities.<id>.bonuses.*`, `.check`, `.save` | class/feat documents | Plutonium, on import |

### Skills & tools

| Field | Owner | Written today? |
| --- | --- | --- |
| `skills.<id>.value` (0/0.5/1/2) | payload `proficiencies.skills` / `expertise` | yes, for `skills` (1) and `expertise` (2) |
| `tools.<id>.value` | payload `proficiencies.tools` | **no** — `proficiencyUpdates` never reads `payload.proficiencies.tools` |
| `skills.<id>.ability` | class documents (default ability per skill) | Plutonium/system default; not overridden |

The `tools` gap is not hypothetical: `proficiencyChoicesSchema` carries a
`tools` array, the contract has carried it since the payload was written, and
`import.js` builds `updates` from `skills`, `expertise`, `savingThrows` and
`languages` — `tools` is never read. Finding C's own example (Criminal 2014:
Thieves' Tools miscategorized as a skill) shows the builder's *catalog* is
being fixed to classify tools correctly; once it does, those tool picks still
have nowhere to land on the actor until this is closed too. Worth folding into
the B/C fix rather than leaving as a second trip.

### Traits (languages, resistances, proficiency lists)

| Field | Owner | Written today? |
| --- | --- | --- |
| `traits.languages.value` (known ids) | payload `proficiencies.languages` | yes, via `partitionLanguages` |
| `traits.languages.custom` (free text) | payload `proficiencies.languages` (unmapped names) | yes |
| `traits.weaponProf.value`, `traits.armorProf.value` | class/race documents | **deliberately not written** — see `import.js` comment; the payload doesn't send these because Plutonium's imported documents carry them, and writing over that would fight the import |
| `traits.di` / `traits.dr` / `traits.dv` (immune/resist/vulnerable) | race/class/feat documents | Plutonium, on import — payload carries nothing here |
| `traits.ci` (condition immunities) | same | same |
| `traits.size` | race document | Plutonium, on import |

### HP, AC, movement, senses, initiative

| Field | Owner | Written today? |
| --- | --- | --- |
| `attributes.hp.value` / `.max` | payload `derived.hp` | yes — both `baseActorData` and `derivedUpdates` set it (the second wins, after documents attach) |
| `attributes.ac.*` | Foundry's own AC calculator, reading equipped armor items | **not written** — `payload.derived.ac` exists on the contract but nothing writes `system.attributes.ac.*`; this is intentional per the file's own comment ("the importers recalculate HP and AC as they attach class and armour"), but it means `derived.ac` is currently write-only on the wire — nothing downstream consumes it. Worth a comment or a removal, not a silent no-op, if this is confirmed once a live import can be inspected. |
| `attributes.movement.*`, `attributes.senses.*` | race document | Plutonium, on import — payload carries nothing here |
| `attributes.init.*` | ability scores + class features | derived by the system itself from `abilities.dex` and any bonuses documents grant |
| `attributes.death.*`, `attributes.exhaustion` | play-time state | not part of character creation, correctly absent from the payload |

### Spellcasting

| Field | Owner | Written today? |
| --- | --- | --- |
| `spells.spell<N>.value` / `.max` | payload `derived.spellcasting.slots` | yes — `derivedUpdates`, keyed off the level string |
| `spells.pact.value` / `.max` / `.level` | payload `derived.spellcasting.slots.pact` / `.pactLevel` | yes |
| Per-spell `system.preparation.prepared` | payload `spells[].prepared` | yes, in the item-update pass |
| `attributes.spellcasting` (ability id) | class document's default, or payload | not overridden by the payload today — read this against `derived.spellcasting.ability`, which the payload does carry but which isn't in the `system.*` write list above; likely the same shape of gap as `ac` |

### Equipment (per-item, not per-actor)

| Field | Owner | Written today? |
| --- | --- | --- |
| `system.quantity` | payload `equipment[].quantity` | yes — `equipmentUpdates` |
| `system.equipped` | payload `equipment[].equipped` | yes |
| `system.attuned` | payload `equipment[].attuned` | yes |

### Details & biography

| Field | Owner | Written today? |
| --- | --- | --- |
| `details.alignment` | payload `identity.alignment` | yes |
| `details.biography.value` | payload `identity.biography` (via `biographyHtml`) | yes |
| `details.race`, `details.background` (`LocalDocumentField`) | set by Plutonium when it imports those documents onto the actor | Plutonium, on import |
| `details.level`, `.tier`, `.xp.*` | derived from imported class items | the system itself, from class levels present |
| `resources.primary/secondary/tertiary` | class/subclass features (Ki points, Rage uses, etc.) | Plutonium, on import — no payload involvement |

## What this confirms about B and C

**Finding B (class skills)** and **finding C (background proficiencies)**
both resolve to the same two destination fields: `system.skills.<id>.value`
for skills, `system.tools.<id>.value` for tools. The fix already planned —
move the grant onto the index row, same shape as the background feat grant —
is correct for skills. For any background whose grant includes a tool (the
Criminal example is one), the write side needs the `tools` fix above or the
grant will resolve correctly in the index and still not reach the actor.

## D&D Beyond's grouping, for the builder's own UI

Not a wire concern, but useful as a proven grouping for the web app's screens,
since players will review a build there before it becomes a code:

- **Abilities** — scores, modifiers, saves in one screen.
- **Skills** — every skill modifier, with proficiency/expertise/Jack-of-All-
  Trades shown together rather than split by source.
- **Actions/Attacks** — equipped weapons and spell attacks, i.e. the
  equipped subset of inventory + prepared spells, not a separate data source.
- **Spells** — slots, known/prepared list, save DC and attack bonus in one
  place.
- **Inventory** — equip/attune state and encumbrance alongside the item list,
  not on a separate screen.
- **Defenses** — speed, resistances/immunities/vulnerabilities grouped
  together, separate from AC.
- **Features & Traits** — class, subclass, race and background features in
  one list, tagged by source rather than four separate lists.

The Foundry sheet's own tabs (Details / Inventory / Features / Spells /
Effects / Biography) are close to the same grouping and are the one that
actually matters, since it's where a player using the module will look for
each of these after import.

## Sources

- `foundryvtt/dnd5e`, `module/data/actor/character.mjs`,
  `module/data/actor/templates/{attributes,creature,common,traits}.mjs`
  (`master` branch, read 2026-08-24).
- `apps/foundry-module/src/import.js` (this repo).
- [D&D Beyond — Sheet Sections](https://dndbeyond-support.wizards.com/hc/en-us/articles/7747193946388-Sheet-Sections)
- [D&D Beyond — Builder Sections](https://dndbeyond-support.wizards.com/hc/en-us/articles/7747202748436-Builder-Sections)
