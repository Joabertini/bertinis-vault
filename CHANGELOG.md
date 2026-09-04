# Changelog

## [Unreleased] — 2026-09-02

Thirty-three pull requests, #41 through #74. The build order below closed on
2026-08-26 and this is everything after it: the front was replaced, accounts
arrived, and the import stopped losing things quietly.

### The front is now El Faro del Alba
- The prototype front replaced `apps/web` wholesale (#42). Nine chambers —
  Lineage, Calling, Origin, Abilities, Improvements, Gifts, Gear, Spells,
  Identity — plus the Gate, the Codex and the Ritual. The package name did not
  change, so the deploy did not either.
- The repository's `tsconfig` is stricter than the loose front's was
  (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`) and found two real
  bugs on contact: an unchecked index in `dice.ts` and three components passing
  an explicit `undefined` to an optional prop.
- Every supporting text was below the contrast floor at which text is text
  (#73). The whisper class measured **2.2:1** against a 4.5:1 requirement, and
  the gold labels 3.0:1. The ramp and the measurements are written above
  `styles/recipes.ts`. D&D rules stopped being permanent grey paragraphs and
  became a mark that opens them.

### Accounts
- Sign in with Discord, and a Codex that syncs itself (#60, #61). The shelf
  still works signed out: an account is an offer — take this to another
  machine — not a door.
- A wildcard origin never grants credentials (#62). `#60` had shipped
  `Access-Control-Allow-Credentials: true` unconditionally, which with a `*`
  origin is the shape of a CSRF.
- The store answers to `api.bertinilabs.xyz` and keeps answering on
  `workers.dev` (#66); the Faro addresses it by that name (#68); every route
  serves `index.html`, and a rejected login says why (#69).
- Account storage is Cloudflare D1, connected in #63.

### What a character is made of
Species proficiencies, senses and traits (#44); each proficiency offer charging
only for its own (#45); Origin Customization as a switch, in blocks (#46);
traits as real items, measured languages, and a warning for gear you are not
proficient with (#49); the wizard's spellbook and prepared state where `dnd5e`
keeps it (#50); 2024 lineage and three casters that did not work (#51); spells
from feats, backgrounds and gifts (#52); the warlock's Mystic Arcanum (#53);
hit points by average or by roll (#54); the elf that 2024 was not (#55); age,
height, weight and appearance in the `dnd5e` fields (#56); what you carry
against what you can carry (#57); attunement and its three slots (#59).

### What reaches Foundry
- Weapon and armour proficiencies reach the actor (#47), with a test that takes
  them from the builder rather than from the contract (#48).
- Currency and weapon mastery, which the builder knew and never sent (#58).
  Both were listed as known gaps below; both are closed.
- Tasha's optional class features are no longer granted for free (#65). A PHB
  wizard was being handed Cantrip Formulas.
- An item Foundry rejects is named instead of vanishing (#70), and an item
  whose damage part cannot be rolled is kept rather than dropped (#71).
- The payload says what is worn and what is only carried (#72, #74). Measured
  on a live import of a level 8 ranger: **one of ten** equipment entries
  carried an `equipped` key, and Plutonium equips whatever it imports, so the
  ranger reached the sheet wearing two suits of armour.

### The seam that hid a week of bugs
- `importPayloadSchema.safeParse` strips what it does not know and answers 200,
  so a deployed Worker older than the contract discards new fields in silence.
  On 2026-09-01 the deployed Worker was from 23 August and was throwing away
  **20 of 73 fields**, including `optionalFeatures` — every fighting style,
  invocation, pact boon, metamagic and maneuver. `apps/web/probes/
  store-fidelity.ts` round-trips a payload through the live store and names
  every field that does not come back (#64).
- The same PR fixed a gate that went red for the machine rather than the code:
  vitest was starting eight forks on a disk that gives 18 IOPS. Threads instead
  of forks, 111s instead of 219s.

### Size is a question, not the first letter
- The index kept `r.size?.[0]`, one letter, and **thirty species print two** —
  always `["S","M"]`, the 2024 human, aasimar and tiefling among them. All
  thirty exported as Small: a Small square at the table and half the carrying
  capacity, on a character nobody built that way. The row now carries the whole
  offer, the Lineage chamber asks, and an unanswered size travels as nothing —
  which Foundry reads as Medium, exactly as it did before any of this existed.
- The suggested appearance follows the answer too. A Small human and a Medium
  one are a metre apart, and the height box was filling with the Small one.
- Pinned in `index-data.test.ts` against the shipped rows rather than in the
  front: the front cannot ask a question the data already answered for it.

### Documentation
- The build order was closed (#41) and the handoff brought back in line with
  what shipped (#67).

## [Build order] — 2026-08-26

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
