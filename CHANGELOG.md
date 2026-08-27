# Changelog

## [Unreleased] — 2026-08-26

The build order in `docs/BUILDER-COVERAGE.md` is complete: items 1 through 9,
nine merged pull requests. Every one replaced a hand-written table with the
structured source 5etools already carries, and the deliverable each time was
the conformance test against the real data rather than the fix.

### Fixed
- **A 2024 character reached the sheet three ability points short.** 2014 puts
  the level-one ability increase on the species; 2024 moved it to the
  background, and all ten 2024 species grant none. Only the species was read,
  so the character showed a 16 where the rules say 18 — and nothing reported a
  problem, because a 16 is an ordinary score.
- **An Eldritch Knight and an Arcane Trickster were offered no spells at all.**
  A class's spell list comes off the spell rows, and the fighter and the rogue
  appear on none. Their list is the wizard's, and the subclass is the only
  place that says so. The same read supplies every domain, circle and oath
  list, which were also missing.
- **A second class granted no proficiency of any kind.** The books print a
  shorter list for multiclassing than for starting; reading the starting list
  instead would have been the worse bug, handing a rogue dip four skills.
- **Equipment was a fixed list, so every rogue got a rapier** and nobody ever
  got the shortsword. The A-or-B choices, the gold alternative, quantities and
  the background's own list are all read now.
- **Spell counts came from a hand-written switch over eight classes with the
  2014 numbers**, used for both editions. A 2024 bard prepared a 2014 bard's
  shorter list, and a level-one 2024 paladin could prepare nothing — 2024 moved
  the paladin's and the ranger's spellcasting to level 1.
- **205 of the 276 feats state a prerequisite and none were read**, so the
  builder offered Heavily Armored to a wizard and Elemental Adept to a
  barbarian.
- **The level-up choices were modelled end to end and never asked.** Fighting
  styles, invocations, the pact boon, metamagic, maneuvers, runes, arcane
  shots, elemental disciplines and infusions are one mechanism wearing nine
  names; the build carried a list nothing filled and nothing checked.
- The index shipped the literal string `"[object Object]"` as a weapon mastery
  property. One weapon in the game carries an object rather than a string, and
  the note inside it is a rule: the Psychic Blade's Vex costs no slot.
- `titleCase` treated an apostrophe as a word boundary and produced
  `"Tinker'S Tools"`. It had been doing the same to background tool grants
  since well before this run.
- `normalizeEquipmentEntry` hardcoded `quantity: 1`, so two daggers arrived as
  one.
- Melee-versus-ranged was judged from a weapon's properties, which put the
  antimatter rifle in the melee list. The item type is the field that answers
  it.

### Added
- 2024 weapon mastery: the count per class and level, the barbarian's melee
  restriction, and the picker.
- Multiclass ability prerequisites, reported rather than enforced.
- `packages/domain`: `starting-equipment`, `origin-abilities`, `weapon-mastery`,
  `spell-counts`, `feat-prerequisites`, `subclass-spells`.
- Pickers for equipment, the origin ability increase, weapon mastery, and the
  level-up choices.

### Known gaps, stated rather than papered over
- Starting currency is computed and shown and has nowhere to go in the import
  payload, so it does not reach Foundry.
- Weapon mastery is not written to the actor: whether `dnd5e` 5.3.3 exposes a
  path for it is unverified against a real install, and guessing would write a
  field that does nothing.
- Plutonium's class import grants each class's *full* starting proficiencies,
  so a multiclass sheet shows more armour and weapon proficiency than the rules
  allow. The payload is right; the sheet underneath it is not.
- A monk holding a shield loses Unarmored Defense and the builder says so.
  Neither Plutonium nor `dnd5e` models that clause, so the sheet shows 2 higher
  for that one build. The builder is right.

## [0.2.2] — 2026-08-25

### Fixed
- The import no longer opens any Plutonium window. It ran the Charactermancer,
  asked for class levels, and asked whether to use the importer; a character
  now arrives exactly as it was built.

  Three earlier attempts made *building* the document silent and missed where
  the windows came from. Plutonium registers a `preCreateItem` hook per prop and
  intercepts any item created on an actor that carries its flags — which the
  documents it builds do. Every document is now marked
  `flags.plutonium.isDirectImport`, the hook's own escape.

  The module also calls Plutonium's converters directly rather than its
  importers. Converters are pure functions; importers are the interactive layer.
- Plutonium is no longer reported as missing when it is installed and active.
  Its API was read from `game.modules.get("plutonium").api`, which Plutonium
  assigns at the end of an un-awaited async `ready` handler — after ours, since
  Foundry fires module hooks in id order. It now reads `globalThis.plutonium`,
  assigned when the bundle loads.
- Class items arrive at the level the payload asked for, and with the
  proficiency advancement their class grants. Both were being answered by a
  prompt before.
- Imported items keep their book out of their name, so equipped and prepared
  state finds them again.

### Added
- `test/plutonium-bundle.test.mjs` asserts what this module assumes about
  Plutonium against `Bundle.js` itself rather than a fixture. Set
  `PLUTONIUM_DIR` to run it; without it the tests skip.
- `src/window-watch.js` reports anything that opens a window during an import,
  with its class, title and stack.

## [0.1.0] — 2026-03-21

### Initial release
- 9-step character creation wizard
- All 13 D&D 5e 2014 classes with subclasses
- All races with subraces
- Backgrounds from PHB + supplements with automatic feat assignment
- 3-set dice roller (one roll, choose set)
- Standard Array, Point Buy (27 pts), Manual entry
- Proficiency-filtered armor and weapon selection
- ASI/Feat tracking per class level
- Spell slot calculation (full, half, pact casters)
- Direct actor creation via Foundry API (dnd5e 5.x schema)
- Spanish and English localization
- GM-only mode setting
