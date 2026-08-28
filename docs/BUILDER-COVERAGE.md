# What a character is, and what the builder offers

Written 2026-08-25, the day the import came out clean: 14 entries, no
Charactermancer, no prompts. With the pipe finally working end to end, the
question stops being "does it arrive" and becomes "is what arrives a whole
character".

This is the answer to that, and the ordered list of what to build next. It is
the builder-facing companion to
[`CHARACTER-MODEL-GAPS.md`](./CHARACTER-MODEL-GAPS.md), which is the live
account of individual findings; this page is the shape of the whole.

## The principle that decides what belongs here

**The builder models only what the rules make the player choose.**

Everything else arrives inside the document Plutonium resolves — class features,
species traits, senses, resources, rules text, icons. Modelling those would mean
maintaining the same data twice and drifting out of sync, which is the mistake
this project already made once and spent months undoing.

So a gap is only a gap if it is a *decision a player makes* that the builder
cannot record.

The ordering below follows what actually decides whether a character works:
action economy first, cosmetics last.

## 1. Action economy — the large hole

What a character can *do on a turn* is barely modelled at all.

| Choice | Who gets it | State |
| --- | --- | --- |
| Fighting Style | Fighter, Paladin, Ranger, some subclasses | missing |
| Eldritch Invocations | Warlock — 2 at level 2, up to 8 | missing |
| Pact Boon | Warlock, level 3 | missing |
| Metamagic | Sorcerer — 2 at level 3 | missing |
| Maneuvers | Battle Master — 3 at level 3 | missing |
| Artificer Infusions | Artificer | missing |
| Totem / Circle / Domain picks | several subclasses | missing |

All of these are `optionalfeature` entities in 5etools, carrying a
`featureType` code — `FS:F` for a fighter's fighting styles, `EI` for
invocations, `MM` for metamagic — that says which choice they answer. This is
finding J.

This is not flavour. A Warlock without invocations and a Battle Master without
maneuvers are not characters missing decoration — they are characters missing
their core loop.

**Modelled, 2026-08-25. The interface is what is left.** Nothing about which
class offers which pool, or how many at what level, is written down in this
repository, because every table this project has hand-written turned out wrong
when it was finally compared against the data. Instead:

- A class states its own pools and counts in `optionalfeatureProgression`, and
  the index carries them as `ClassRow.optionalFeatureProgression` and
  `SubclassRow.optionalFeatureProgression`, flattened to twenty running totals.
- An option states the pools it belongs to, and its prerequisites — four kinds
  checkable (`level`, `pact`, `spell`, `optionalfeature`) and two that are prose
  for a person to judge.
- `packages/domain/src/optional-features.ts` turns a build into quotas, matches
  picks against them, and reports every unmet prerequisite rather than the
  first.
- `ImportPayload.optionalFeatures` carries the picks, and the module imports
  them exactly as it imports a feat.

Two consequences worth noting. The editions keep themselves apart with no rule
written: the 2024 sorcerer's metamagic progression differs from the 2014 one,
and the 2024 paladin has no fighting style because fighting styles became
feats — which shows up as the entry not existing. And a level prerequisite
counts the class it names rather than the character, so a Warlock 2 / Fighter 10
still cannot take an invocation that asks for Warlock 5, which is the thing
multiclassing gets wrong when it is not stated.

## 2. Resources and concentration

| Thing | State |
| --- | --- |
| Slots by level, pact slots separate | done |
| Spell save DC, spell attack bonus | done |
| Cantrips and spells from the class list | done |
| **Prepared versus known** | done. `spellCountLabel` reads the class's own table: a 2024 caster has a Prepared column, a 2014 bard has Spells Known, and the 2014 prepare-casters carry the formula instead |
| Always-prepared spells (Domain, Circle, Oath) | done. Handed over rather than offered — the cleric has them without spending a preparation, and offering them spent one on a free spell |
| Spells granted by species or feat | done. They travel with `method` and `uses`, so a once-a-day innate spell is not imported as one that costs a slot |
| Spell text in the picker | missing — the full text of every spell is roughly twenty times the size of the index |

## 3. Defenses

| Thing | State |
| --- | --- |
| Hit points | done, but from hit die and Constitution only (finding H) — Tough, Dwarven Toughness and Hill Dwarf are ignored |
| AC from armour and shield | done |
| Unarmored Defense (Barbarian, Monk, 2024 dancing Bard, Draconic Sorcerer) | done — the formula is read from the feature text, and the character uses the best of what they have |
| Natural armour (Tortle, Lizardfolk, Loxodon, Locathah, Autognome) | done, read from 5etools' Foundry companion formula |
| Saving throw proficiencies | done, first class only, which is the rule |
| Resistances and immunities from species | arrive with the document |

Unarmored Defense was in the "answers wrong" half rather than the "does not
answer" half — the builder showed an armour class, it was simply the wrong one,
and nothing told the player. It now computes the best of worn armour and every
feature the character has.

One deliberate divergence: a monk holding a shield loses Unarmored Defense, and
the builder says so. Neither Plutonium nor the `dnd5e` system models that
clause, so the Foundry sheet shows 2 higher for that one build.

## 3b. What a second class grants

**Done, 2026-08-26.** A class taken as a second class does not hand over its
starting proficiencies. The books print a shorter list for exactly this case,
and 5etools carries it as `multiclassing.proficienciesGained`. The difference is
not cosmetic: reading the starting list for a rogue dip hands the player four
skills and every rogue tool instead of one skill and thieves' tools.

Twenty-one classes carry a block; the wizard, the sorcerer and the 2024 monk
carry none, which is not the same as an empty one. The editions disagree — the
2024 fighter grants martial weapons where the 2014 fighter grants simple and
martial, and the 2024 druid drops medium armour — so the two are indexed apart
and the ruleset switch picks between them.

Two shapes needed reading rather than copying. Weapons are 5etools item tags, so
the 2014 monk's `{@item shortsword|phb|shortswords}` is a named weapon next to
the category "simple". Tools are sometimes a sentence: "one musical instrument
of your choice" in 2014 and "Choose one Musical Instrument" in 2024 are the same
instruction, and what is left after the instruction is the category to choose
from. A sentence is a choice; a name is a grant.

In the wizard, a granted tool is locked rather than offered — a rogue dip brings
thieves' tools whether the player wants them or not — and an extra skill choice
folds into the same pool the class and the background already feed, because the
player is picking skills either way.

**A known divergence in Foundry, not in the builder.** Plutonium's class import
grants each class's *full* starting proficiencies, for every class it imports.
A multiclass sheet will therefore show more armour and weapon proficiency than
the rules allow. The payload the module writes is right; the sheet Plutonium
built underneath it is not, and nothing in the module's reach corrects it.

One thing deliberately dropped: the druid's refusal of metal armour is prose
attached to the armour entry, not a rule a number can carry. It is a table's
business.

## 4. Ability scores and breakpoints

| Thing | State |
| --- | --- |
| Four generation methods — roll, standard array, point buy, manual | done |
| ASI versus feat at every eligible level | done — `levelChoices` holds `{kind: "improvement"}` or `{kind: "feat"}` |
| **The +1 a half-feat grants** | done, 2026-08-25 — see below |
| **Feat prerequisites** | done, 2026-08-26 — read from the feat's own data, reported not enforced |
| The 13-in-the-ability requirement for multiclassing | done — reported, not refused |

The half-feat is precisely the most efficient purchase in the game on an odd
primary score: it buys the effect *and* the modifier point a flat ASI would
have bought.

**Fixed, 2026-08-25.** The state it was in is worth stating precisely, because
it was subtler than "missing": a feat taken *at a level* could carry a raise, on
the level choice that took it — but nothing ever asked for one, and a feat
granted by a background or by the variant human had nowhere to put it at all.
So Resilient raised nothing, and the sheet showed a score one point lower than
the player had earned without saying why.

What changed:

- The index carries `FeatRow.ability` — 159 of the 276 feats raise something,
  as either a fixed grant or a pool to choose `count` abilities from by
  `amount`. Read from 5etools, not written down.
- The raise now lives under **the feat**, keyed by its id, not under the level
  that took it. That is the only shape that fits all three ways a feat arrives,
  and `bonusesFromChoices` ignores feat bonuses outright so a migrated draft
  cannot count the same point twice. Older drafts are migrated rather than
  dropped.
- `FeatAbilityPicker` asks the question wherever a feat is chosen, and renders
  nothing for the 117 feats that raise nothing.
- An unanswered half-feat is named on the review step instead of vanishing.

One thing fell out that matters for 2024: the improvement itself is a *feat*
there, named "Ability Score Improvement". 5etools marks its own increase
`hidden` for exactly that reason, and it is the only entity in the data that
carries the mark.

## 5. Class structure

| Thing | State |
| --- | --- |
| One class, its level, its subclass | done |
| **Multiclassing** — the rules | done. One combined caster level from each class's own fraction, pact slots kept apart, and hit points from the die of the class each level was taken in. The contribution is not the class's own table: a ranger 5 reads its own table at 3 and contributes 2 |
| **Multiclassing** — the interface | done, plainly. A row per extra class with its own level and subclass; the first class keeps its own place because the rules single it out. What it looks like belongs to the design track |
| **Multiclassing** — the prerequisite | done. Read from `multiclassing.requirements` in 2014 and from `primaryAbility` in 2024, which are different fields reaching the same answer. Reported, not refused |
| **Multiclassing** — what a second class grants | done, 2026-08-26. Read from `multiclassing.proficienciesGained`, which is the short list the books print separately from the starting one — see below |
| Class skill choices | done — read from the index rather than a hand-written table |
| Expertise | done — see Proficiencies |

## 6. Proficiencies

| Thing | State |
| --- | --- |
| Skills, languages, saving throws | done |
| Expertise | done — the grants come off 5etools' Foundry companion data, the choice is asked, and skills and tools both reach the actor doubled |
| **Artificer's Tool Expertise** | missing, and not in the data — it doubles *every* tool at once rather than a chosen one, so there is nothing for the companion file to record. Needs the tools to land first |
| Tools | done — 44 proficiencies generated from dnd5e's own `DND5E.tools` and the importer's name map, written to `system.tools` with the ability the running system says they roll |
| Armour and weapons | arrive with the class document |

## 7. Equipment

| Thing | State |
| --- | --- |
| A fixed list per class | done |
| **The PHB's A-or-B choice** | done, 2026-08-26 — see below |
| **The gold alternative** | done. 2014's "or 4d4 × 10 gp", which replaces every list at once |
| Quantities | done. Two daggers is one line of two, and an item granted twice adds up |
| The background's own list | done. It stacks when the class says it does, which is a flag on the class |
| Attunement, and its three slots | done, 2026-08-28. Asked wherever the bag holds something that requires it, marked per item as `system.attuned`, and a fourth is named rather than refused |
| Carrying capacity | done, 2026-08-27. The bag, the weapon and the armour on one scale, against Strength × 15, with the variant thresholds marked and never enforced |
| **Currency** | done, 2026-08-28. Counted in copper, split into gold, silver and copper, and written to `system.currency` by both export routes |

**Done, 2026-08-26.** The books write the list as a sentence — "(a) a rapier or
(b) a shortsword" — and a sentence cannot be answered, so the builder granted a
fixed list and never asked. Every rogue got a rapier. 5etools carries the same
list a second time in structured form, and that is what is read now: each row
is a question, each option is an answer, and a row the data grants outright is
shown but has nothing to pick.

The two editions divide the list differently and are read the same way. 2014
asks four small questions and offers a flat gold alternative; 2024 asks one big
one and folds the money into the options, so there the gold is an ordinary
answer rather than a rule beside the list. The monk's alternative is 5d4 gp
flat with no × 10, which a regex that assumed the multiplier would have turned
into ten times the money.

Three shapes needed more than a lookup. A category — "two simple weapons" — is
a second question with no item to point at, so it is reported as still open
rather than answered on the player's behalf. A special — the wizard's spellbook,
a letter from a dead colleague — has no item entry at all and is kept as text.
And a pouch that contains coins is two things in one entry: reading only the
item silently loses the starting money, which 69 backgrounds state that way.

**The gap worth naming: currency is computed and not exported.** A character who
takes the gold, or whose background hands over a pouch of 15 gp, has that money
counted correctly and shown in the wizard — and the import payload has nowhere
to put it, so it does not reach Foundry. The sheet will show the items and no
coins. Nothing about the equipment work fixes that; it needs a field on the
payload and a line in the module.

## 8. The 2024 rules

The ruleset switch chooses **sources**, and it is starting to choose rules.

| Thing | State |
| --- | --- |
| **The origin ability increase** | done, 2026-08-26 — see below |
| The origin feat | done. Read from the background's own `feats` |
| **Weapon mastery** | done, 2026-08-26 — see below |
| **Prepared spells and cantrips** | done, 2026-08-26 — read from each class's own table |
| Spell slots | shared between the editions, which is correct: the slot tables did not change |

`packages/domain/src/dnd5e-2014.ts` is named honestly. What is left in it is
the spell slot tables, which the editions share, and the selection-mode labels.

**Prepared spells and cantrips — done, 2026-08-26.** Both editions print these
in each class's own level table, and nothing read them: the builder carried a
hand-written switch over eight classes with the 2014 numbers and served 2024
characters from it too. Three separate things were wrong.

2024 replaced "Spells Known" with a **Prepared Spells** column for every
caster, and the numbers are not the same — a 2024 bard prepares nine at level
five where a 2014 bard knows eight. 2024 also **moved the paladin's and the
ranger's spellcasting from level 2 to level 1**, so a level-one 2024 paladin
could prepare nothing where the rules give them two; a constant "half casters
start at level 2" is wrong for exactly the two classes it was written for. And
the switch only knew eight classes, so anything outside it counted zero.

The 2014 prepare-casters are the one case a table cannot answer, because their
count depends on a casting modifier — they carry a formula instead, and it is
evaluated rather than re-derived per class. Its floor is one spell: "level plus
a negative modifier" is not zero spells, it is a character with a bad casting
stat.

One class in the whole dataset can count nothing either way: the Rune Scribe, an
unreleased UA prestige class that prints no table and states no formula. It is
named in a test rather than hidden behind a weaker assertion.

**Weapon mastery — done, 2026-08-26.** Every 2024 weapon carries one mastery
property, and that half was already indexed. The half that was missing is the
one that makes it usable: how many kinds of weapon a given character may use
them on. Five classes grant the feature, and they state the number two
different ways — the fighter and the barbarian in a column of their own level
table, because it grows from three to six and from two to four, and the
paladin, ranger and rogue in the feature's own text, where it is two and stays
two. Reading only the table loses three classes; reading only the prose freezes
the fighter at three.

The barbarian's is also narrower, Simple or Martial *Melee* only, and that
restriction lives in a filter tag rather than in a field. It binds only while
every class granting mastery has it: a barbarian/fighter may master a longbow,
because the fighter's own feature says so.

Two bugs came out of the same read. The index shipped the literal string
`"[object Object]"` as a mastery property on the Psychic Blade, because one
weapon in the game carries an object rather than a string — and the note in
that object is a rule, not a footnote: its Vex costs no slot. And melee-vs-
ranged was being judged from the properties, which puts the antimatter rifle
in the melee list; the item type is the field that answers it.

**What the books do not say.** Nothing states what happens when a character has
the feature from two classes. The 2024 multiclassing rules name exactly three
features with special handling — Extra Attack, Spellcasting, and alternative
Armor Class — and weapon mastery is not among them. The reading taken here is
Extra Attack's: the features do not stack, and the larger number counts.
Summing would tell a fighter 3 / rogue 2 they may master five weapons when
neither table ever says more than three at those levels.

**Not written to Foundry.** The picks are held on the build and shown in the
wizard. Whether `dnd5e` 5.3.3 exposes an actor path for mastery has not been
verified against an installed system, and guessing a path would write a field
that silently does nothing. That check needs a Foundry install.

**The origin ability increase — done, 2026-08-26.** This is the sharpest
difference between the editions at level one, and the builder got it wrong in
the quietest way available. 2014 puts the increase on the species: a dwarf is
+2 Constitution whoever they are. 2024 moved it to the background, and all ten
2024 species grant none at all — so a 2024 character reached the sheet **three
points short**, showing a 16 where the rules say 18. Nothing reported a
problem, because a 16 is a perfectly ordinary score.

Sixty backgrounds carry the increase, and the shape is uniform: two
alternatives over the same three abilities, either +2 and +1 to two of them or
+1 to each of the three. Both are worth three points, which is pinned by a test
— if one path were worth more the choice would not be a choice. Which abilities
is the player's answer; how much is not, and neither is which three are on
offer: the acolyte's are the mental ones and the soldier's are the physical.

Two things it deliberately does not do. It does not apply in 2014, even for a
character switched back after answering, because there the species carries the
increase. And it does not touch `abilityBonuses`, which stays the manual
species field it always was — the two are different rules, and a 2014
character can legitimately have both a species bonus and none from their
background.

## 9. Identity

Name, player, alignment and biography are done. Appearance, age, height, weight
and deity are not. Cosmetic, and last.

## The order worth building in

1. ~~**Level choices (`optionalfeature`)**~~ — done, picker included as of
   2026-08-26. The model had been finished for a while and nothing ever asked
   the questions.
2. ~~**The half-feat `+1`**~~ — done, picker included.
3. ~~**Expertise**~~ — done, picker included. The grants are read from
   5etools' Foundry companion file rather than a hand-written table, so the
   editions differ where the books differ and Tasha's optional ranger feature
   stays optional.
4. ~~**Tools that land**~~ — done. The table is generated from the game system
   rather than written by hand, so a dnd5e upgrade that renames a key fails a
   test instead of quietly dropping a proficiency.
5. ~~**Unarmored Defense**~~ — done, along with draconic scales and five
   species' natural armour. Parsed out of the feature text, because for the
   barbarian, the monk and the 2024 dancing bard there is nowhere else to read
   it from.
6. ~~**Multiclassing**~~ — done. The rules, the interface, the prerequisite,
   and what a second class grants. The last one is the short list the books
   print separately: a rogue taken second gives one skill, not four.
7. ~~**Equipment as choices**~~ — done, with the gold alternative, quantities
   and the background's own list. Currency is counted but has nowhere to go in
   the payload yet.
8. ~~**The 2024 rules**~~ — done where the editions actually differ: the origin
   ability increase, weapon mastery, and the prepared/cantrip counts. The spell
   slot tables are shared between the editions, which is correct rather than
   outstanding.
9. ~~**Prerequisites and legality checking**~~ — done. Feats, subclass spell
   lists, and the level-up choices with their own prerequisites. What is left
   is not legality but polish: identity fields, attunement, carrying capacity.

**The build order is complete as of 2026-08-26** — items 1 through 9, nine
merged pull requests. What is left is not rules work.

Three things are open and are written down rather than left to be rediscovered:

| Open | Why it is not done |
| --- | --- |
| ~~Starting currency does not reach Foundry~~ | Done 2026-08-28. `ImportPayload.currency` carries coins and `import.js` writes `system.currency`. The split into gold, silver and copper is `coinsFromCopper`, shared with the actor JSON export so the two routes cannot disagree |
| ~~Weapon mastery is not written to the actor~~ | Done 2026-08-28. Measured against the installed `dnd5e` 5.3.3: `system.traits.weaponProf.mastery.value`, a set tested with `.has(baseItem)`. The actor JSON export already wrote it; the payload had no field, so a fighter sent by code arrived with the feature and nothing chosen for it |
| The four manual Foundry validation scenarios | Blocked on the user, not on code: they need a live world and a signature. `release:ready` fails until then, which is correct |

Nothing in this document is unbuilt any more. The last three were polish
rather than rules and all three landed: carrying capacity on 2026-08-27, the
identity fields on 2026-08-28, and attunement with its three slots the same
day. What gets added here from now on comes from playing a character through
the builder, not from reading it against the books.

Every slice of this run followed the same method, and it is the part worth
carrying forward: **find the structured source before writing any table**. Every
hand-written table this project ever had turned out wrong when finally compared
against the data — class skills for eight of thirteen classes, background
proficiencies for 112 of 161, spell counts for both editions from one 2014
switch. None was written this time, and the deliverable of each slice was the
conformance test that would catch the class of bug, not the fix.

**Level-up choices — done, picker included, 2026-08-26.** Fighting styles,
eldritch invocations, the pact boon, metamagic, maneuvers, runes, arcane
shots, elemental disciplines and artificer infusions are one mechanism wearing
nine names: a pool, and a count that grows with level. All of it had been
modelled end to end in `packages/domain/src/optional-features.ts` — quotas,
matching, prerequisites — and **nothing ever asked the questions**. The build
carried a list nothing filled and nothing checked.

Both the class and the subclass are read, and for different reasons: the
fighter's fighting style is the class's and the battle master's maneuvers are
the subclass's, so a build reading only the class offered a battle master
nothing at all.

Three decisions carried over from the rules layer rather than reinvented in the
interface. A prerequisite that names a class counts the level in **that** class:
a Warlock 2 / Fighter 10 cannot take an invocation that asks for Warlock 5. An
option whose prerequisites are unmet is **shown and disabled** rather than
hidden — a player who cannot yet take Agonizing Blast is better served knowing
it exists and what it wants. And a build carrying more picks than its level
allows keeps them and reports the excess, because that is what a downgraded
level looks like and deleting a player's choices is worse.

Prose prerequisites are shown and never checked. Checking them would mean
guessing, and a guess that hides a legal option is worse than one the table has
to rule on.

**Subclass spell lists — done, 2026-08-26.** The headline failure: a class's
spell list comes off the spell rows themselves, and the fighter and the rogue
appear on none — so an **Eldritch Knight and an Arcane Trickster were offered
no spells at all**, in a builder that let you pick the subclass and set a
casting ability. Their list is the wizard's, and the subclass is the only place
that says so.

The same field carries every domain, circle and oath list, which 128 of the 203
subclasses have. Those were missing too: a Light domain cleric could not
prepare Burning Hands.

Four kinds appear and they are four rules rather than four spellings.
`prepared` and `expanded` widen what the character may prepare; `known` is
known outright; `innate` is cast **without** preparing it, and is deliberately
left out of the prepare pool — offering it would let the player spend a slot on
a spell they already have for free.

Two gates, and they are not interchangeable. Most subclasses state a class
level. The warlock patrons state a *spell* level — the data keys them "s1"
through "s5" — because a warlock gains those spells when its pact slots reach
that level. Reading an "s3" as class level 3 hands a level 3 warlock
third-level spells five levels early.

A spell is either named or described by a filter — "every wizard cantrip". The
filter stays a filter in the index: expanding it needs the spell list, which is
another collection, and baking 300 names into a subclass row would be both
large and stale. One subclass states its choice as three spell *names* instead,
which is a different rule and is modelled as one — treating that object as a
filter string was a crash, not a mismatch.

**Feat prerequisites — done, 2026-08-26.** 205 of the 276 feats state one and
nothing read any of them, so the builder offered Heavily Armored to a wizard
and Elemental Adept to a barbarian. Both are illegal and both reached the
sheet.

The list is alternatives — any one holding is enough, every field inside one
must hold at once — which is the same shape the multiclass requirement uses, so
`meetsRequirement` is reused for the ability half rather than rewritten. Ten
kinds appear in the data and a test fails if an eleventh ever does.

Two decisions worth stating. **Reported, never enforced**, the same stance the
multiclass prerequisite takes: a table may allow anything, and a builder that
refuses is a builder people work around. And **what a build cannot answer is
reported as unchecked rather than as met** — a Ravenloft campaign, a dragonmark
category, "no other dragonmark" are a table's business, and a silent pass would
be a claim this layer has no standing to make. Those travel beside a real
failure rather than replacing it.

Where several alternatives all fail, the one closest to holding is the one
reported: telling a player they are missing five things when they are one away
from a legal path is worse than saying nothing.

One deliberate divergence to know about: a monk holding a shield loses Unarmored
Defense, and the builder now says so. Neither Plutonium nor the `dnd5e` system
models that clause, so the Foundry sheet will show 2 higher for that one build.
The builder is right and the sheet is wrong, which is an uncomfortable place to
be but the correct one.

Nothing here is about how the builder should *look*. That is its own track, and
deliberately not mixed in: the design work happens against a model that is
complete, not alongside one being changed underneath it.
