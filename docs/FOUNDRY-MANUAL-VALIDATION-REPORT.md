# Foundry Manual Validation Report

Signed by a person who ran the module in a live world. `pnpm release:ready`
refuses to publish while anything below is `pending`, and that is the point:
the automated gate proves the pipeline is internally consistent, and only a
live run proves it produces a character.

**This report covers `apps/foundry-module`** — the module that ships. It used
to cover `packages/foundry-exporter`, the fabricate-items pipeline this
architecture replaced, which is why the release workflow failed for v0.2.0,
v0.2.1 and v0.2.2 while the module itself was fine. Anything about those
fixtures belongs in
[`FOUNDRY-MANUAL-VALIDATION.md`](./FOUNDRY-MANUAL-VALIDATION.md) until the
legacy exporter is deleted.

## How to run it

Each scenario is a character built at the web builder and imported into Foundry
by its code. No fixtures: the point is to exercise the whole loop, and a fixture
would skip the half of it that has broken every time.

For each one, watch for three things:

1. **No window opens.** The module reports any that does, by name — see
   `src/window-watch.js`. An `ActorDirectory` sighting is not reported; it is
   the sidebar redrawing.
2. **The sheet matches what was built** — level, subclass, abilities, hit
   points, skills, spell slots.
3. **The items work when clicked.** A fabricated item looks right on the sheet
   and does nothing, which is the failure this whole architecture exists to
   avoid.

## Run Info

- Status: pending
- Date:
- Operator:
- Foundry version:
- dnd5e system version:
- Plutonium version:
- Module version:
- Module commit:

## Scenario Results

### 1. Martial, armour and shield

A fighter with armour, a shield and a weapon. Checks armour class, weapon
attacks, and that equipped state survives the import.

- Result: pending
- Notes:
- Screenshot paths:

### 2. Prepared caster

A cleric. Checks prepared spells, slots by level, spell save DC and attack
bonus.

- Result: pending
- Notes:
- Screenshot paths:

### 3. Pact caster

A warlock. Checks that pact slots land on their own resource rather than in the
ordinary slot table, and at the right level.

- Result: pending
- Notes:
- Screenshot paths:

### 4. Species and background grants

A character whose species and background grant skills, tools, languages and a
feat. Checks that each lands once — the ability bonus in particular, which the
builder has already applied and which the interactive import used to apply a
second time.

- Result: pending
- Notes:
- Screenshot paths:

## Summary

- Scenarios run:
- Windows that opened during an import:
- Items that did not function when clicked:
- Follow-up fixes needed:
- Release recommendation: pending

## Previous runs

### 2026-08-25 — the import came out clean

Not a full round; recorded because it is the run that closed the
Charactermancer problem and the evidence for v0.2.2.

One character built in the web builder and imported by code. **14 entries, no
prompts, no Charactermancer.** The only warning was `window-watch` reporting
`ActorDirectory`, which was the sidebar redrawing after the actor was created,
and is now filtered out.

Not covered by that run: whether the items function when clicked, the sheet
values against what was built, pact slots, and the species/background grants
landing once. Those are scenarios 1 through 4 above, and they are why this
report is still pending.
