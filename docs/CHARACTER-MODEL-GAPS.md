# What a character is, and what the builder models

An audit of the builder against 5e character creation, written after the first
round of bug reports from the deployed app. It exists to stop the same ground
being re-covered: what is missing, why it matters, and in what order it is
worth fixing.

Every claim here was checked against the code, and the code moves. Treat the
line references as of 2026-08-23.

## The distinction that decides what counts as a gap

Two categories, and only one of them is the builder's problem.

**Plutonium's.** Species traits, class features, weapon properties, spell text.
The builder sends a reference and the real document arrives with all of it.
That the builder does not know what darkvision is costs nothing — it is the
design, and it is why a level 5 wizard is 948 bytes instead of 37KB.

**The builder's.** Every choice the player makes, and the four numbers the
payload carries: `hp`, `ac`, `proficiencyBonus` and `spellcasting`. Get one of
those wrong and the imported sheet is wrong, with nothing downstream to correct
it.

Everything below is the second category.

## Fixed

### Ability scores were never modified

`base` and `final` were assigned the same six values. Species bonuses did not
exist, ability score improvements did not exist, and half-feats added nothing.
Since hit points, armour class, the spell save DC and the attack bonus all read
`final`, every character above level 3, and every character with a species
bonus, exported wrong numbers.

Now: `applyAbilityBonuses` composes the base scores with a species/background
bonus and with spent improvement points, capped at 20.

The bonus is edited rather than derived, and deliberately so. Monsters of the
Multiverse reprinted most species with a floating bonus the player assigns, 2024
moved the bonus to the background, and 136 of the 160 species in the index have
no entry in any table the repo could hold. A button fills in the 2014 PHB
species whose bonus is fixed; the rest start at zero and are the player's to
set.

Improvements are now a decision per level rather than a pool. See **Levels
asked no questions** below.

### Saving throws were never exported

`ImportPayload.proficiencies.savingThrows` has existed since the payload was
written, and nothing ever filled it. The builder classified a proficiency as a
skill, a tool, a weapon, an armour or "other" — there was no `savingThrow` kind
to classify one as. Every character exported before this reached Foundry
proficient in no saving throws at all.

Now: `savingThrowsForClass` supplies the two every class grants, they travel as
ability ids, and the contract has the kind.

Only the first class grants saves, which will matter when multiclassing lands.

### Levels asked no questions

The builder took a level and derived everything from it in one shot. Ability
score improvements were a single pool of points — two per improvement level —
with no record of which level they came from, and no way to take a feat instead
of one. The count of improvements came from a hardcoded [4, 8, 12, 16, 19],
which is wrong for three cases in every edition.

Now each level that asks a question is a row: raise two scores, split however
the rules allow, or take a feat in its place. `packages/domain/src/levelling.ts`
holds the model; `improvementProblems` reports an over-spent or over-cap
improvement rather than quietly clamping it.

The levels are read off the class rather than assumed. `improvementLevels` and
`subclassLevel` are now on the class row, extracted from each class's own
feature list at index build time:

| | 2014 | 2024 |
| --- | --- | --- |
| improvements | fighter also 6 and 14, rogue also 10, everyone 19 | same extras, no 19 — it is an epic boon |
| subclass | cleric, sorcerer, warlock at 1; druid, wizard at 2; rest at 3 | every class at 3 |

Two of those the builder had wrong. The subclass gate was hardcoded to "1 for
cleric, sorcerer and warlock, 3 for everyone else", so a 2014 wizard or druid
was told to wait until 3 for a subclass they get at 2. And a level 20 fighter
was offered five improvements where the rules give seven.

Drafts saved under the old pool are not lost: the points fold into the level 4
improvement, which is where a player spending a pool of two would have put them.

Still standing in for something: a feat's ability bonus is recorded by the
player rather than derived. The index has no machine-readable statement of what
a feat grants, and inventing one would be worse than asking.

### Backgrounds granted no feat

The feat a background gives came from the hand-written catalog, which listed 27
backgrounds and knew the feat for 13 of them. The index carries 161, of which
74 grant a feat. Everything outside that list of 13 granted nothing —
including every 2024 background, all of which grant an origin feat, so a 2024
character exported without the feat their origin gives them.

The grant is now on the background row, and it is a *choice* rather than a
list. 5etools records it as an array under `feats`, and every background in the
data with more than one entry reads as an alternative: Ruined is "the Alert,
Skilled, or Tough feat (your choice)", Haunted One is "Survivor or a Dark Gift
feat of your choice". Reading that array as several grants would have handed
Ruined all three.

Four backgrounds carry more than one entry and all four are worded "or", which
is the whole evidence for that reading. A background that genuinely granted two
feats would be misread; none exists in this data.

Three shapes follow from it:

| | Example | What the builder does |
| --- | --- | --- |
| one named feat | 2024 Farmer grants Tough | grants it, asks nothing |
| several named | Ruined: Alert, Skilled or Tough | asks, grants nothing until answered |
| open | Haunted One: Survivor or any Dark Gift | asks, with the whole feat list available |

A background that offers a choice and has not been answered says so and exports
without the feat, rather than picking the first option. Changing background
clears the answer: Alert answers Ruined and not Rewarded.

A sub-choice the background already made travels in the label — the 2024
Acolyte grants Magic Initiate (Cleric), not a bare Magic Initiate the player
still has to aim.

### The generation method was a lie

`generationMethod` was the literal `"manual"`. The builder has had point buy,
standard array and 4d6 for as long as it has had a stats step; the build always
claimed the scores were typed by hand.

Now the method is part of the build state and is recorded.

## Second audit run

The first pass read the code. This one ran it: every hardcoded table in
`data-engine` and `domain` was compared against the 5etools data field by
field, and a real payload was built and fed to the Foundry module's own
functions. The scripts are throwaway; the findings are not.

What it changed about the picture: the worst problems are not missing features.
They are two ends of the pipe that were built against different assumptions and
never tested against each other.

### A. The payload the builder emits is not the payload the module reads

The module's tests pass against a hand-written fixture. The builder emits
something else, and nothing anywhere compares the two. Building a level 5
wizard and handing it to `proficiencyUpdates` and `derivedUpdates` produces:

```
system.spells.spellspell1.value   4     <- no such path
system.skills.Arcana.value        1     <- dnd5e keys are "arc", not "Arcana"
system.traits.languages.value     ["Common"]
```

Three separate faults:

**Spell slots reach nothing.** The builder keys slots `spell1`…`spell9`; the
module prefixes what it receives, producing `spellspell1`. The contract's own
comment says the keys are `{"1": 4}`, and the module's fixture uses that, so
the module and the contract agree and the builder is the odd one out. Every
character imported through the module has zero spell slots.

Warlocks are wrong twice over: `getSpellSlotsForClassLevel` folds pact slots
into `spell3`, and the module has a `pact` branch that nothing ever reaches.

**Skill proficiencies reach nothing.** They travel as display labels —
"Arcana", "Sleight of Hand" — because `classifyProficiencyKind` recognises a
skill by name and then stores the name. dnd5e keys skills as `arc`, `slt`. The
module writes the label straight into the path.

**Armour class is computed, carried, and dropped.** `derivedUpdates` writes hit
points and slots. It never writes `system.attributes.ac`. All of the armour
work — the index formulas, the generalized parser — stops at the payload.

Verifying the exact dnd5e key forms needs a live world. The double prefix does
not: it is wrong on its own terms.

**Fixed.** `apps/foundry-module/test/conformance.test.mjs` derives a real
build, converts it exactly as the web app does, and asserts on what the
module's own functions produce from it. It writes no fixture, so nothing in it
can drift away from the builder.

Slots now travel keyed by the level they are, which is what the contract always
said; a warlock's go under `pact` with a `pactLevel` beside them. Skills travel
as `dnd5e` keys, and a skill with no key is dropped rather than written to a
path that does nothing. Languages the system knows become keys and the rest
become the free-text field beside them.

Armour class is still not written, and that is now a decision rather than an
oversight: Foundry recomputes it live from what the character has equipped, and
a flat value would freeze it against everything the player does afterwards. So
the payload marks worn items worn — `equipment[].equipped`, which nothing had
ever set — and lets Foundry compute. The builder's `derived.ac` remains what
the player saw, and the two being comparable is now the point. If the intent is
that the builder's number wins the way its hit points do, that is a one-line
change and a deliberate one.

### B. Class skill choices are wrong for eight of thirteen classes

`classSkillOptionsByClassId` was written by hand and drifted:

| Class | Against the data |
| --- | --- |
| Barbarian | **absent entirely** — no options, and `getClassSkillPickCount` returns 0 |
| Bard | listed as 6 fixed skills; the rules say *any* 3 |
| Artificer | missing Sleight of Hand |
| Druid | missing Arcana |
| Rogue | missing Performance and Persuasion |
| Fighter (2024) | missing Persuasion |
| Rogue (2024) | missing Persuasion |
| Wizard (2024) | missing Nature |

The barbarian is the worst of these: it is offered in the class list and gets
no skill choice at all.

The 2024 rows also show the general shape of the problem — the table has one
entry per class where the data has one per class *per edition*.

**Fixed (2026-08-24).** `classSkillOptionsByClassId` and
`classSkillPickCountByClassId` are gone from `data-engine`. The index carries
`ClassRow.skillChoice` instead — `{options, count}`, read straight from
`startingProficiencies.skills` for all 31 class rows across both editions.
`{any: N}` (the bard, and only the bard) resolves to all eighteen skills at
generation time rather than an empty list with a flag to special-case, so a
consumer never has to know the difference between "any 3" and "these 3 of
18." `apps/web/src/index-options.ts` exposes it as `skillChoiceForClass`.

### C. Background proficiencies cover 13 of 161

Same catalog, same 13 backgrounds as the feat grant did. 112 backgrounds grant
skills the builder knows nothing about. Four of the 13 it does know are wrong:

| | Builder | Data |
| --- | --- | --- |
| Criminal (2014) | Deception, Stealth, Thieves' Tools | Deception, Stealth — the tools are a *tool* proficiency, not a skill |
| Criminal (2024) | Deception, Stealth | Sleight of Hand, Stealth |
| Sailor (2024) | Athletics, Perception | Acrobatics, Perception |
| Urchin | Sleight of Hand, Stealth, Thieves' Tools | Sleight of Hand, Stealth |

The fix is the one the feat grant already got: put it on the index row.

**Fixed (2026-08-24).** `backgroundGrantedProficienciesById` is gone from
`data-engine`. `BackgroundRow` now carries `skillsGranted` (fixed, no choice),
`skillChoice` (a bounded choice a handful of SCAG backgrounds stack on top —
one fixed skill and a choice of a second — folded into the same picker and
limit as the class's own skill choice, rather than a second one), and
`toolsGranted` (fixed tools, kept separate from skills this time). Read from
`skillProficiencies` and `toolProficiencies` for all 161 backgrounds.
Category-scoped tool grants ("any gaming set", "any musical instrument") are
deliberately left out — they are already a player choice with no single name
to pre-fill — and the one background whose grant is several alternative
*pairs* rather than one set (House Agent, ERLW) is skipped rather than merged
into a fixed list that would hand the player tools they do not get.
`apps/web/src/index-options.ts` exposes it as `proficiencyGrantForBackground`.

**What this does not close:** `toolsGranted` now reaches the payload
correctly, but `apps/foundry-module/src/import.js` never reads
`payload.proficiencies.tools` — no tool proficiency has ever reached the
actor, background-granted or otherwise. See
[`CHARACTER-SHEET-FIELDS.md`](./CHARACTER-SHEET-FIELDS.md)'s skills-and-tools
section. Closing it needs `dnd5e`'s real tool ids (`thief`, `disg`, `calligrapher`,
…), not the generic ones `packages/domain`'s `TOOL_ALIAS_TO_ID` currently
invents for gaming sets and instruments — worth its own pass rather than
folding into this one.

### D. The weapon and armour lists are invention

`classWeaponOptionIdsByClassId` gives a fighter six weapons. A fighter is
proficient with every simple and martial weapon — 37 of them in the 2014 PHB.
The lists are a shortlist someone typed, and they correspond to nothing in the
rules: not starting equipment, not proficiency.

Same for armour. A cleric is offered chain mail, scale mail and a shield; the
class grants light, medium and shields, which is a different and much larger
set, and chain mail is heavy armour a cleric is not proficient with at all.

The proficiencies themselves are fine — the payload deliberately does not send
weapon and armour proficiency, because the class document Plutonium imports
carries them. It is only the *choice list* that is fiction.

**Fixed (2026-08-24), after it turned out to be a live bug and not just a bad
list.** The weapon picker had already moved to the index; the armour picker
had not, and its leftover restriction was not merely narrow — it was actively
undoing the player's choice. `filteredArmorOptions` fed a `useEffect` that
snapped `armorId` back to the shortlist's first entry whenever the current
pick was outside it, so picking any armour that was not one of the class's
three hand-written ids silently reverted. From the outside this reads as "the
builder will not let me choose armour", which is how it was reported.

Both tables and their accessors are gone from `data-engine`. Both pickers now
search the full item index, unfiltered by class, exactly as every other picker
does — Plutonium's class document grants the real proficiency regardless of
what was picked, so the builder restricting the list bought nothing.

Two things fell out of it: the comment saying the weapon no longer needed a
snap-back effect was sitting directly above the armour effect that still had
one, and `initialState.armorId` was `"mage-armor"` — not an item, a spell, and
a slug that resolves to nothing in the index (finding I lists it). The default
is now empty, meaning unarmoured, and an empty `armorId` is filtered out of
the equipment list rather than exported as an unresolvable pick.

### E. Unarmored Defense is modelled and never used

`calculateArmorClass` takes an `unarmoredAbilityModifier`. Nothing in the
repository passes it. The barbarian's Constitution and the monk's Wisdom never
reach armour class — and the barbarian, per B, does not really exist in the
builder anyway.

### F. Half-caster slots were wrong at half their levels

What the audit first spotted was a level 1 paladin holding two spell slots it
does not have until level 2 — the 2024 rule applied to a 2014 character.

Writing the fix found the larger fault. The code halved the class level
*rounding down* and read the full-caster table with the result. That is not the
half-caster table. It matches at even levels and undershoots at every odd level
from 3 up: a level 5 ranger was given three first-level slots where the table
gives four first and two second.

A half-caster reads the full-caster table at `ceil(level / 2)`, and the two
editions differ in exactly one row — whether level 1 casts at all. The
artificer is the class the 2024 rule was named after and casts from 1 in both.

**Fixed**, and checked against the 5etools tables for all 20 levels of every
casting class in both editions: 300 class-levels, no mismatches. The published
half-caster table is written out in `packages/domain/test/spell-slots-payload.test.mjs`,
because deriving it is what went wrong.

Hit dice, spellcasting abilities and every full-caster and pact slot count
check out against the data — those were verified, not assumed.

### G. Payload fields nothing has ever filled

| Field | Consequence |
| --- | --- |
| `proficiencies.expertise` | always `[]`; rogues and bards lose their defining feature |
| `spells[].prepared` | never set, so nothing distinguishes prepared from known |
| `spells[].grantedBy` | never set |
| `equipment[].equipped` | ~~never set~~ **fixed** — armour, shields and weapons now arrive worn |
| `equipment[].attuned` | never set |
| `derived.speed` | never set, though race rows now carry speed |
| `derived.initiative` | never set — arguably right, Foundry derives it |

`equipment[].equipped` compounds the AC fault in A: the builder does not send
armour class, and does not say the armour is worn either.

### H. Hit points ignore everything but class and Constitution

`calculateEstimatedHitPoints` takes a hit die, a level and a Constitution
modifier. It has no room for the hill dwarf's extra point per level, the Tough
feat's two, or a player who rolled. Nor for the 2024 rule change.

### I. A third of the equipment catalog resolves to nothing

Seven of the 21 hand-written equipment ids do not resolve to any item in the
index. Two of them should not — `unarmored` and `mage-armor` are states rather
than things. The other five are names the catalog and the data spell
differently:

`leather`, `arcane-focus`, `holy-symbol`, `rope-hempen`, `rations`

Each one silently drops the item from the exported character. `leather` is the
one that shows: it is the leather armour every light-armour class starts with.

Recorded rather than fixed, because it belongs with D — the catalog is the
wrong place for this list at all.

### J. Features were a decorative list, and the real choices are not modelled

Found 2026-08-24, during the first live Foundry run.

The builder had a "Features sugeridas" checkbox list built from a hand-written
table in `apps/web/src/feature-suggestions.ts`. Two things were wrong with it,
and the second is the one that matters.

**It did nothing.** `choices.features` is not read by `buildToPayload`, is not
a field on `ImportPayload`, and is not read by `foundry-exporter`. Every box a
player ticked stopped at the build object. Nothing reached Foundry.

That part is arguably correct by design — automatic features arrive with the
class document Plutonium imports, so they were never the builder's to send.
Checking `Rage` on a barbarian should be a no-op, because the barbarian gets
Rage whether or not anyone ticks a box.

**It conflated two different things.** Checked against the data, of the 35
features the table listed, exactly two are choices — `Fighting Style` and
`Metamagic` — and the rest are automatic grants. The list offered all of them
identically, as optional extras to tick. A player reading it would think
Fighting Style was optional (it is not: a fighter must pick one) and that
ticking Second Wind was doing something (it was not).

The list is now gone. What replaces it is not another list: it is the missing
half of the model. A 5e character's *choices* at level-up — which Fighting
Style, which Metamagic, which Eldritch Invocations, which Maneuvers — are
`optionalfeature` entities in 5etools, with a `featureType` code (`FS:F` for a
fighter's fighting styles, `MM` for metamagic, `EI` for invocations) saying
which choice they answer. The builder models none of them, the payload has
nowhere to put them, and the module therefore cannot answer them.

That is the same gap as the Charactermancer problem below: Plutonium prompts
for these because we never told it the answers.

### K. The module re-asks every question the builder already asked

Found 2026-08-24, on the first live Foundry run. The import works — the actor
is created and the documents arrive — but Plutonium's importers prompt the
player for choices the builder already collected, and apply grants the builder
already applied.

Read from the Plutonium 2.17.2 bundle, the two mechanisms are:

- `Charactermancer_FeatureOptionsSelect.pGetUserInput(...)`, called by the
  feature importer for every feature carrying an `options` entry. This is what
  opens a picker mid-import.
- `Charactermancer_AbilityScoreSelect.pFillActorAbilityData(...)`, called by
  the race importer's `_pImportEntry_pFillAbilities`, which *adds* the racial
  bonus to whatever the actor already has. The builder bakes that same bonus
  into `abilities.final` before it sends them, so it lands twice. The same
  shape applies to `pPromptAndFill` for skills, tools and languages.

`ImportOpts` has an `isCharactermancer` flag, but it does not mean "suppress
the UI" — it marks where the call came from, and the prompts fire either way.

`ImportOpts` has an `isDataOnly` flag documented as "If this import should
simply return the data, rather than import anything", and that was the first
answer. It shipped, and the Charactermancer opened anyway, still asking for
levels. **`isDataOnly` is honoured by `ImporterBase._pImportEntry` and by
nothing else.** `ImporterClass` and `ImporterFeature` override that method
outright and never read the flag; with an actor in hand they go straight to
their interactive paths. `DataConverterClass` has no `pGetDocumentJson` for the
flag to call either — it has `pGetDocumentJsonClass`. So `race`, `background`,
`spell` and `item` obeyed the flag, and `class`, `subclass` and `feat` ignored
it in silence.

`isTemp: true` with no actor was the second answer. It does avoid the
Charactermancer — `_pImportEntryClass` tests `isTemp` before `actor` — and a
live run still opened windows.

`isTemp: true` with no actor was the second answer, and a live run still opened
windows.

**Why both were wrong, found 2026-08-25.** All three attempts were fixing the
*build*. The window came from the *write*.

Plutonium registers a `preCreateItem` hook per prop — `class`, `subclass`,
`race`, `background`, `feat`, `item`, `optionalfeature`, every prop a payload
carries but `spell`. Any item created on an actor carrying Plutonium's own
flags is intercepted, the player asked whether to use the importer, and the
Charactermancer opened. The documents the converters build carry those flags
because they *are* Plutonium's documents, so it never mattered how quietly they
had been built.

The fix is two things:

- **`markAsDirectImport`** sets `flags.plutonium.isDirectImport` on every
  document before `createEmbeddedDocuments`. That is the hook's own escape:
  `if (flags.isStandardDragDrop || flags.isDirectImport) return;`.
- **The converters, not the importers.** No `DataConverter*` class in the
  bundle calls `pGetUserInput`, `InputUiUtil`, `Dialog` or `DialogV2` — they
  are pure functions, and the importers are the interactive layer wrapped
  around them. No flag turns an importer quiet because being quiet was never
  one of its jobs.

Details in [`PLUTONIUM-INTEGRATION.md`](./PLUTONIUM-INTEGRATION.md), including
why `getPlutoniumApi` reads `globalThis.plutonium` rather than `module.api`
— the second symptom of the same session, an installed Plutonium reported as
missing at startup.

What the interactive path would have prompted for now travels as converter
options instead. `dataOpts` reaches the converter untouched:

| Option | Replaces | Effect |
| --- | --- | --- |
| `level` | `Charactermancer_Class_LevelSelect` | the class item's `system.levels` |
| `proficiencyImportMode` | `Charactermancer_Class_ProficiencyImportModeSelect` | `1` for the first class, `0` for each later one |

`proficiencyImportMode` is not optional. `_getClassAdvancements` matches
neither branch when it is unset and builds the class with **no proficiency
advancement at all** — the character arrives without the armour, weapon and
save proficiencies its own class grants. That is part of D, and it was arriving
by accident through the interactive prompt.

What this moves onto us: everything the importer applied as an actor update
rather than as an item — racial ability bonuses, proficiency grants, senses,
size, speed. That is the point rather than the cost, since those are the
values arriving twice today.

Forking Plutonium and adapting it was considered and rejected: its
`module.json` declares `"license": "UNLICENSED"`, and `data/` is 5etools
content that is not ours to redistribute either. Calling its runtime API is
ordinary module interop; shipping its code is not.

Verified working state before any of this is tagged
`checkpoint-module-works-in-foundry`.

### What holds this in place

`apps/foundry-module/test/plutonium-bundle.test.mjs` asserts every claim above
against `Bundle.js` itself, not against a fixture — including a sweep over
every converter class in the file checking that none of them asks the user
anything. It is what the first two attempts lacked: 300 tests were green while
the live import opened windows, because each of them checked a belief against a
fixture written by the same hand that held the belief. Run it with
`PLUTONIUM_DIR` set; without it the suite skips, since a 6MB copy of someone
else's bundle does not belong in this repository.

`src/window-watch.js` is the other half, and exists because "a window appeared"
cost three round trips to turn into a call site. It watches every application
render for the duration of an import and reports the class, title and stack of
anything that opens.

### What this run did not cover

Whether the dnd5e key forms in A are exactly right, and whether the subclass
hash resolves — both need a live Foundry world, which is the repo's standing
open question and belongs to the user's machine.

## Still missing, in the order worth doing

**Nothing on this list is still missing.** It is kept as written because the
order it argued for turned out to be the right one, and because the reasoning
is worth more than the checklist: a wrong answer is worse than a gap, since
nothing about the sheet tells the player it happened.

What became of each, in the order they were done:

| Then | Now |
| --- | --- |
| 0. Make the payload and the module agree | Done. Findings A and F, plus the conformance test that catches their kind. Still open from A, and still a decision rather than a bug: whether the builder's armour class should overwrite Foundry's |
| 1. Multiclassing | Done. The rules, the interface, the 13-in-the-ability requirement, and the short proficiency list a second class actually grants |
| 2. Expertise | Done. The grants come off 5etools' Foundry companion data rather than a table written here, and skills and tools both reach the actor doubled |
| 3. Spell text, and prepared versus known | Half done, and deliberately. `spellCountLabel` reads each class's own table, so a 2024 caster sees prepared and a 2014 bard sees known. Spell text is still out: the full text of every spell is roughly twenty times the size of the index, and Plutonium already delivers it inside Foundry |
| 4. 2024 rules, beyond which books are legal | Done where the editions differ: the origin ability increase, the origin feat, weapon mastery, and the prepared and cantrip counts. The spell slot tables are shared, which is correct rather than outstanding |
| 5. Equipment as choices | Done, with the gold alternative, quantities, the background's own list, currency, carrying capacity and attunement |
| 6. Nothing serves optimisation | Partly, and only the honest half. Feat prerequisites and the multiclass requirement are read from the data and **reported, not enforced** — a table that allows one is making a ruling. Nothing compares options or estimates damage, and that is still last on purpose |

Finding H — hit points from class and Constitution only — was closed on
2026-08-28 by asking the question instead: the method is the player's, per
level, with each level's own die. Tough and Dwarven Toughness are still not
modelled, and are the remaining half of it.

## The index, and what it now carries

`scripts/build-vetools-index.mjs` builds the index from a 5etools data
directory — the one inside a Plutonium install. It used to record only what a
picker needed to draw a row, which is why so much above began "the index does
not carry".

It now records, at a cost of 15KB gzip:

| Row | Added |
| --- | --- |
| spell | the class lists it is on, each with the class's own source; range as a distance |
| item | damage, damage type, versatile damage, properties, 2024 mastery, armour class, minimum Strength, stealth disadvantage |
| race | the fixed part of the species bonus, size, speed |
| class | hit die, saving throws, spellcasting ability, caster progression, prepared-spell formula, improvement levels, subclass level |
| subclass | 203 rows, which did not exist |
| background | the feat it grants, as a choice |
| subrace | 98 rows, which did not exist |

#### The subclass copies, and why dropping them loses nothing

A 2014 subclass is attached to both editions of its class: School of Abjuration
hangs off the 2014 Wizard and again off the 2024 Wizard, the second marked
`_copy`, both carrying source `PHB`. Two rows with the same name and source are
indistinguishable to the resolver, so every subclass reported as ambiguous. The
generator keeps the original and drops the copy.

That does not cost an edition. The 2024 subclasses are separate entities with
their own names and their own source — the 2024 Wizard has Abjurer, Diviner,
Evoker and Illusionist under `XPHB`, not a second School of Abjuration — and
where a 2024 book does reuse a name, as College of Lore does, the two rows
differ by source and both survive. Verified in
`packages/vetools-index/test/resolve.test.mjs`.

What the copy encodes is that a 2024 character may take a legacy subclass. The
builder does not offer that, because a build declares one ruleset and the
picker filters by it. That is a ruleset decision, not a consequence of the
dedupe.

#### A subclass does not hash like anything else

Every other entity hashes as `encodeArrayForHash(name, source)`. A subclass has
no page of its own — it is a piece of state on its class's page — so from
`UrlUtil.URL_TO_HASH_BUILDER["subclass"]` in the Plutonium bundle its hash is:

```
wizard_phb,state:sub_abjuration_phb=b1
```

the class's hash, then the subclass as a state part keyed by `shortName` and
its own source, with `b1` being `UrlUtil.mini.compress(true)`, all lowercased.
The class part uses the subclass's `classSource`, not its own: the same
document attached to the two editions of the Wizard is two different hashes.

The repo built subclass references with the generic builder until this was
read, so no subclass reference would have resolved. `buildSubclassRef` in
`packages/vetools-ref` now produces the real form, and `refOf` and the resolver
route subclasses through it. Plutonium writes the same hash onto the actor item
it creates for a subclass, which is what confirms the form.

What the index still does not carry, on purpose: entity text. Spell
descriptions, class features, species traits. Plutonium supplies all of it from
the real document on import, and carrying it would multiply the bundle for
something read once.

### Regenerating

```
node scripts/build-vetools-index.mjs <plutonium>/data
```

The data directory lives inside the Plutonium module zip, published at
`https://github.com/TheGiddyLimit/plutonium-next/releases/latest/download/module.json`
— the manifest names the zip, and the zip contains both `data/` and the
unminified `js/Bundle.js` that `scripts/extract-vetools-sources.mjs` reads.
