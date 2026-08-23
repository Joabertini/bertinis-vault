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

Improvement points are a pool — two per improvement level — rather than a
decision made at each level. Leaving points unspent is what represents having
taken a feat instead, until feats can be chosen per level. See **Levelling** in
the path below.

### Saving throws were never exported

`ImportPayload.proficiencies.savingThrows` has existed since the payload was
written, and nothing ever filled it. The builder classified a proficiency as a
skill, a tool, a weapon, an armour or "other" — there was no `savingThrow` kind
to classify one as. Every character exported before this reached Foundry
proficient in no saving throws at all.

Now: `savingThrowsForClass` supplies the two every class grants, they travel as
ability ids, and the contract has the kind.

Only the first class grants saves, which will matter when multiclassing lands.

### The generation method was a lie

`generationMethod` was the literal `"manual"`. The builder has had point buy,
standard array and 4d6 for as long as it has had a stats step; the build always
claimed the scores were typed by hand.

Now the method is part of the build state and is recorded.

## Still missing, in the order worth doing

### 1. Levelling with decisions

The builder takes a level and derives everything from it in one shot. A real
character makes a decision at most levels: improvement or feat, a subclass at
its own level, a fighting style, an expertise pick.

This is the change that alters the shape of the app — from a flat form to
something that walks the levels — and most of what follows depends on it.

Blocks: feats per level, subclass timing, and turning the improvement pool back
into the choices it stands in for.

### 2. Multiclassing

`classing.classes` is an array and has always been one. The builder writes a
single entry, and the UI offers one class.

Needs the 13-in-the-ability requirement, per-class levels, the multiclass
spell slot table (which is not the single-class one), and the rule that only
the first class grants saving throws and starting equipment.

### 3. Expertise

Absent everywhere. Rogues and bards double proficiency on chosen skills at
level 1 and again later, and the payload has no way to say so.

Needs `ImportPayload.proficiencies.expertise` filled — the field is already
there — plus the per-class rules for how many picks and when.

### 4. Spell text, and prepared versus known

The picker offers the class's whole list now. Two things are still missing: the
index carries no spell description, because the full text of every spell is
roughly twenty times the size of the index; and the count label does not
distinguish prepared from known, so a wizard sees the size of their spellbook
rather than the number of spells they prepare.

The class rows now carry `preparedSpells` (`"<$level$> + <$int_mod$>"`), which
is the formula that answers the second half.

### 5. 2024 rules, beyond which books are legal

The ruleset switch chooses sources. The rules themselves are still 2014:
backgrounds do not grant the 2024 ability bonus or origin feat, and the derived
numbers come from the 2014 tables.

`packages/domain/src/dnd5e-2014.ts` is named honestly. A 2024 sibling is the
real work here. The data for it is in place — weapon mastery is on the item
rows, and the class rows carry each edition's progression.

### 6. Equipment as choices

Starting equipment is a fixed list per class. The PHB offers an A-or-B choice
and a gold alternative, and neither exists. Quantities are always one.
Attunement and carrying capacity are not modelled.

### 7. Nothing serves optimisation

No prerequisite is checked — not feat prerequisites, not the 13-in-the-ability
requirement for multiclassing. Nothing compares options, estimates damage, or
flags a wasted bonus.

The preflight (`packages/domain/src/preflight.ts`) validates the shape of the
data, not the legality of the character: that an id exists in a catalog, not
that the build is one the rules allow.

This is last on purpose. It is worth building on top of a model that is
complete, and worth nothing on top of one that is not.

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
| class | hit die, saving throws, spellcasting ability, caster progression, prepared-spell formula |
| subclass | 203 rows, which did not exist |
| subrace | 98 rows, which did not exist |

A subclass appears once per edition of its class under the same source, so the
generator keeps the original and drops the copy: two rows with the same name
and source are indistinguishable to the resolver, and every subclass would
report as ambiguous.

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
