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

### The generation method was a lie

`generationMethod` was the literal `"manual"`. The builder has had point buy,
standard array and 4d6 for as long as it has had a stats step; the build always
claimed the scores were typed by hand.

Now the method is part of the build state and is recorded.

## Still missing, in the order worth doing

### 1. Multiclassing

`classing.classes` is an array and has always been one. The builder writes a
single entry, and the UI offers one class.

Needs the 13-in-the-ability requirement, per-class levels, the multiclass
spell slot table (which is not the single-class one), and the rule that only
the first class grants saving throws and starting equipment.

### 2. Expertise

Absent everywhere. Rogues and bards double proficiency on chosen skills at
level 1 and again later, and the payload has no way to say so.

Needs `ImportPayload.proficiencies.expertise` filled — the field is already
there — plus the per-class rules for how many picks and when.

### 3. Spell text, and prepared versus known

The picker offers the class's whole list now. Two things are still missing: the
index carries no spell description, because the full text of every spell is
roughly twenty times the size of the index; and the count label does not
distinguish prepared from known, so a wizard sees the size of their spellbook
rather than the number of spells they prepare.

The class rows now carry `preparedSpells` (`"<$level$> + <$int_mod$>"`), which
is the formula that answers the second half.

### 4. 2024 rules, beyond which books are legal

The ruleset switch chooses sources. The rules themselves are still 2014:
backgrounds do not grant the 2024 ability bonus or origin feat, and the derived
numbers come from the 2014 tables.

`packages/domain/src/dnd5e-2014.ts` is named honestly. A 2024 sibling is the
real work here. The data for it is in place — weapon mastery is on the item
rows, and the class rows carry each edition's progression.

### 5. Equipment as choices

Starting equipment is a fixed list per class. The PHB offers an A-or-B choice
and a gold alternative, and neither exists. Quantities are always one.
Attunement and carrying capacity are not modelled.

### 6. Nothing serves optimisation

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
| class | hit die, saving throws, spellcasting ability, caster progression, prepared-spell formula, improvement levels, subclass level |
| subclass | 203 rows, which did not exist |
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
