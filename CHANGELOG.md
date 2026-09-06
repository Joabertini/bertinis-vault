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

### Moving between chambers
- "Descender" is "Siguiente", and changing chamber returns to the top of the
  page. The button that moves you is in the footer, so leaving the scroll where
  it was dropped every player into the middle of the next chamber, past its
  heading and its first question. Instant rather than smooth: the cross-fade
  already carries the change.
- Back and forward arrows pinned to the edges of the screen, from `xl` up.
  The page is `max-w-6xl` centred, so above 1280px there is margin to sit in;
  below that they would float over the chamber, and an arrow covering the
  question it asks about is worse than one you scroll to. Disabled rather than
  removed at the ends of the rail — an arrow that vanishes moves the other one.
  Same gate as the footer: an unanswered chamber does not let you past.

### Two quiet ones in the Improvements chamber
- A half-feat's editor counted itself. `scoresBefore` dropped the level's
  improvement but not the level's **feat**, so the editor added the point it
  was holding on top of a total that already had it: a 19 read as 20 and
  offered nothing, an 18 taking a two-point half-feat lost the second point.
  The same double-count the beta reported on the improvement side, in the
  other half of the chamber. Excluded by level, not wholesale — a level 4
  feat is still the floor a level 8 improvement starts from.
- The three invocations that state their requirement as a description —
  Agonizing Blast, Eldritch Spear, Repelling Blast, all XPHB — carry an empty
  `prerequisiteText` and so listed no requirement at all. The three
  most-taken invocations in the game looked like they asked for nothing.
  `spellPrerequisiteLabel` now feeds `notes`, the channel for what the player
  judges. Shown, not enforced: refusing a pick over a requirement the code
  cannot read would be inventing a verdict.

### The living record, in two columns
- Split by form rather than by topic, from `xl` up: what the sheet **computes**
  reads as tiles and numbers, what it **states** reads as sentences and lists.
  Run as one 340px strip they took turns, so the ability scores — the block a
  player checks most — sat under six paragraphs of prose.
- Saves and skills moved full width under both columns. Eighteen rows of
  number-plus-name wrap in half a column, and wrapped is unreadable for the one
  block anyone reads mid-turn.
- Below `xl` nothing changes: the chamber cannot give up 460px without leaving
  the card shelf in a single column.

### What a weapon rolls
- Nothing in the repository computed a weapon's attack bonus or damage.
  `derive.ts` produced the *spell* attack and stopped, so the sheet had every
  number except the line a player rolls on their turn.
  `packages/domain/src/weapon-attack.ts` has it: melee takes Strength, ranged
  takes Dexterity, Finesse takes the better of the two, and proficiency is
  asked of the proficiency layer rather than guessed.
- The catalogue does not write `type` as a bare `"M"`. **73 of the 2024 melee
  weapons carry `"M|XPHB"`, and 26 rows carry no type at all** — magic staves,
  rods and wands. Testing for `"M"` would have handed every 2024 greatsword to
  Dexterity. Ranged is `R` at the head of the type; everything else is melee,
  and the whole 325-weapon catalogue is run through the rule in a conformance
  test rather than asserted from a handful of rows.
- A weapon property is a code, never a stringified object. 5etools writes
  `property` as `"2H|XPHB"` almost everywhere and as `{uid, note}` where the
  property is conditional — the 2024 Lance is Two-Handed *unless mounted* —
  and `String(entry)` shipped that one to the index as the literal text
  `"[object Object]"`. `masteryOf` had already learned this in the field next
  door, with the lesson written above it; `property` never received it.

### What a feat lets you wear and swing
- Ten feats state armour or weapons and none of them reached the character. A
  wizard could spend a whole level on **Heavily Armored** and the sheet would
  still say they could not wear plate, and the Gear chamber would still warn
  that the leather they bought costs them their spells.
- Read per rules version, because the two editions disagree about the shield:
  **2014 puts it on Moderately Armored, 2024 on Lightly Armored.** A single
  hand-written table would have been wrong for half of every character.
- Three of the four weapon feats exist under one edition only — Gunner does not
  reach 2024, Weapon Master does not survive it, and the 2014 Tavern Brawler
  says nothing about weapons where the 2024 one grants improvised ones.
- Feats are the only source in the whole bundle that writes `martial`,
  `improvised` or `shield`. Handing them to the species reader would have filed
  "martial" as a weapon *name*, and Martial Weapon Training would have granted
  a base item that matches nothing. The reader throws on anything it does not
  model rather than guessing.
- Firearms, improvised weapons and "choose four martial weapons" are shown and
  grant nothing: dnd5e has no code for the first two, and nothing asks the
  player to make the third pick yet. The Giff's firearms had been reading
  `Firearms` in English on a Spanish sheet since species grants landed.
- The sheet now says **where** a proficiency came from whenever the answer is
  not the character's only class. It used to credit sources only on a
  multiclass sheet, so a species' warhammer — and now a feat's plate — appeared
  with no owner.

### A shared code opens a tome, and the copy is yours
- The same ten characters Foundry imports now open the character in the builder
  at `/tomo/:code`, with the tome's own page — the Vision, not a summary.
- The builder state travels beside the payload rather than instead of it. A
  payload is what the choices derived *to*, and the derivation does not run
  backwards: which ability a half-feat raised, which book a shared name came
  from and which method rolled the scores are all gone from it. The store keeps
  both, Foundry reads the payload and ignores the rest.
- Taking a copy is a fork, not a mirror. It lands in the Codex with its own id
  and nothing it does afterwards reaches the original — a DM fixing a sheet
  must not mutate the player's tome under them. The correction travels back the
  way it came, as a new code.
- Codes published before this carry no state. They still import into Foundry,
  and the page says so instead of drawing an empty tome.
- The store still accepts a bare payload, because the web builder and the
  Worker deploy separately and refusing one would break sharing for the minutes
  between the two.

### The tome opens onto a choice, and the sheet is one of them

- Opening a tome now asks which of the two views you want — the sheet or the
  cheat sheet — and opens it in a window that behaves like a table's: dragged
  by its title bar, resized from its corner, closed with Escape. Below `md` it
  fills the screen instead, because dragging a window with a thumb is a fight.
- The sheet is the SRD's arrangement, the one roll20 draws. That was chosen for
  the round trip and not the looks: roll20's importer moves characters as JSON,
  so building against this shape leaves that work done.
- It has no experience, inspiration or death saves. All three are play-time
  state this builder does not keep, and empty boxes would promise a tracker.
- `weapon-attack.ts` finally has a caller. It shipped with #85 and nothing used
  it: the arithmetic was tested and the wiring — which thing in the bag is a
  weapon, what the index says about it, whether the character is trained — did
  not exist.

### A weapon is a weapon, all 325 of them

- The bag filed everything outside a hand-written catalogue of **twenty-four**
  weapons as `other`. A **longbow** — the most common ranged weapon in the game
  — was one of the missing: no attack line on the sheet, and it did not reach
  Foundry as a weapon either.
- The index is asked when the catalogue cannot place something. The catalogue
  is still asked first, because it carries the Spanish aliases: "espada larga"
  is a name only it knows.
- The conformance test puts the whole weapon catalogue in one character's bag
  and demands it come out whole, under both editions. Written that way because
  the fault was not a wrong line but an incomplete list, and an incomplete list
  is only visible against the complete one.
- It also turned up a second thing the same test would have hidden: **two rows
  can share a name across books and disagree** — the Spider Staff of LMoP is
  not a weapon and the one from PaBTSO is. The Forge already records which book
  a picked item came from; the test now does too, instead of resolving by
  whichever row came first.

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
