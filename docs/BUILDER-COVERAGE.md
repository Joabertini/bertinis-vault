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
| **Prepared versus known** | missing — the count label does not distinguish, so a wizard sees the size of their spellbook rather than how many they prepare. The class rows already carry `preparedSpells` (`"<$level$> + <$int_mod$>"`) |
| Always-prepared spells (Domain, Circle, Oath) | missing |
| Spells granted by species or feat | missing |
| Spell text in the picker | missing — the full text of every spell is roughly twenty times the size of the index |

## 3. Defenses

| Thing | State |
| --- | --- |
| Hit points | done, but from hit die and Constitution only (finding H) — Tough, Dwarven Toughness and Hill Dwarf are ignored |
| AC from armour and shield | done |
| **Unarmored Defense** (Barbarian, Monk, Draconic Sorcerer) | missing — it is implemented in `domain` and never called (finding E) |
| Saving throw proficiencies | done, first class only, which is the rule |
| Resistances and immunities from species | arrive with the document |

Unarmored Defense is in the "answers wrong" half rather than the "does not
answer" half: the sheet shows an armour class, it is simply the wrong one, and
nothing tells the player.

## 4. Ability scores and breakpoints

| Thing | State |
| --- | --- |
| Four generation methods — roll, standard array, point buy, manual | done |
| ASI versus feat at every eligible level | done — `levelChoices` holds `{kind: "improvement"}` or `{kind: "feat"}` |
| **The +1 a half-feat grants** | done, 2026-08-25 — see below |
| Feat prerequisites | missing |
| The 13-in-the-ability requirement for multiclassing | missing |

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
| **Multiclassing** | missing — `classing.classes` has been an array from the start and the interface writes a single entry. Needs per-class levels, the multiclass slot table (which is not the single-class one), and the rule that only the first class grants saving throws and starting equipment |
| Class skill choices | done — read from the index rather than a hand-written table |
| **Expertise** | missing — the payload field exists and nothing fills it. Rogues and bards double proficiency at level 1 and again later |

## 6. Proficiencies

| Thing | State |
| --- | --- |
| Skills, languages, saving throws | done |
| Expertise | done — the grants come off 5etools' Foundry companion data, the choice is asked, and skills reach the actor doubled. Tool expertise travels in the payload and lands nowhere, for the same reason tools do not |
| **Artificer's Tool Expertise** | missing, and not in the data — it doubles *every* tool at once rather than a chosen one, so there is nothing for the companion file to record. Needs the tools to land first |
| **Tools** | half done — they reach the payload correctly and the module never writes them. `TOOL_ALIAS_TO_ID` in `domain` has six ids right; gaming sets, instruments and artisan's tools are generic placeholders rather than the per-item ids `dnd5e` uses |
| Armour and weapons | arrive with the class document |

## 7. Equipment

| Thing | State |
| --- | --- |
| A fixed list per class | done |
| **The PHB's A-or-B choice** | missing |
| **The gold alternative** | missing |
| Quantities | missing — always one |
| Attunement, and its three slots | missing |
| Carrying capacity, currency | missing |

## 8. The 2024 rules

The ruleset switch chooses **sources**, not rules. Backgrounds do not grant the
2024 ability increases or the origin feat, and every derived number comes from
the 2014 tables. `packages/domain/src/dnd5e-2014.ts` is named honestly; a 2024
sibling is the real work.

The data is already in place — weapon mastery is on the item rows, and the class
rows carry each edition's progression.

## 9. Identity

Name, player, alignment and biography are done. Appearance, age, height, weight
and deity are not. Cosmetic, and last.

## The order worth building in

1. ~~**Level choices (`optionalfeature`)**~~ — modelled end to end. The picker
   is the remaining half, and it belongs with the interface work.
2. ~~**The half-feat `+1`**~~ — done, picker included.
3. ~~**Expertise**~~ — done, picker included. The grants are read from
   5etools' Foundry companion file rather than a hand-written table, so the
   editions differ where the books differ and Tasha's optional ranger feature
   stays optional.
4. **Tools that land**, with `dnd5e`'s real ids.
5. **Unarmored Defense** — written, never called. Answers wrong rather than not
   at all, which puts it ahead of anything merely absent.
6. **Multiclassing** — the largest, and the one that reshapes the wizard.
7. **Equipment as choices**, with the gold alternative.
8. **The 2024 rules**, properly.
9. **Prerequisites and legality checking.**

Three through five are cheap and change the character that comes out the most.
Six is what will demand a redesign of the wizard, which is where the interface
work belongs.

Nothing here is about how the builder should *look*. That is its own track, and
deliberately not mixed in: the design work happens against a model that is
complete, not alongside one being changed underneath it.
