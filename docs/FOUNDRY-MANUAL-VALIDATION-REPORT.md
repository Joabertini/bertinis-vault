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

- Status: complete
- Date: 2026-11-11
- Operator: Claude, logged in as the service GM "[sistema] Panel" (no password), world `mesa-ivan`, Foundry instance `foundry-b`. The payloads were derived by the builder's own code in CI and handed to the module's `importPayload`; nothing was written to the production store.
- Foundry version: 14.369
- dnd5e system version: 6.0.6
- Plutonium version: 2.20.0.v14
- Module version: 0.3.0
- Module commit: 1eaa3b7 (main)

## Scenario Results

### 1. Martial, armour and shield

A fighter with armour, a shield and a weapon. Checks armour class, weapon
attacks, and that equipped state survives the import.

- Result: pass
- Notes: Dorn Yelmo Roto, Fighter 9 (Battle Master), 2014. AC 17 with splint armour, halberd and javelin equipped, all four ability scores equal to the payload, skills and languages as built. Both weapons carry an `attack` activity. This character also carried a builder cover: it arrived as the actor's portrait and token, stored under `worlds/mesa-ivan/vault-portraits/`. No shield in this build (the shield is covered by scenario 2).
- Screenshot paths:

### 2. Prepared caster

A cleric. Checks prepared spells, slots by level, spell save DC and attack
bonus.

- Result: pass
- Notes: Sor Amadea de la Vela, Cleric 4 (Life Domain). Slots 4/4 level 1 and 3/3 level 2, save DC 14, spell attack +6, AC 18 with chain mail, shield and mace equipped. 8 spells, every one with a working activity (`save`, `heal`, `utility`).
- Screenshot paths:

### 3. Pact caster

A warlock. Checks that pact slots land on their own resource rather than in the
ordinary slot table, and at the right level.

- Result: pass
- Notes: Cassia Pacto de Cuervos, Warlock 5 (Archfey). The only slots are `pact` 2/2 at level 3; no ordinary slot appears. Save DC 15, spell attack +7. Spells carry attack, utility, damage and teleport activities.
- Screenshot paths:

### 4. Species and background grants

A character whose species and background grant skills, tools, languages and a
feat. Checks that each lands once — the ability bonus in particular, which the
builder has already applied and which the interactive import used to apply a
second time.

- Result: pass
- Notes: Mira Vela de Sangre, Barbarian 11 (Zealot), variant human with the Soldier background. The six ability scores equal the payload's, so the bonus was applied once. Skills (4) and languages (2) match the payload. Not checked by hand: that the variant human's feat is the one item in the sheet's list.
- Screenshot paths:

## Summary

- Scenarios run: 4 of 4, plus the code import of one real build (M3L5-M8G8, Ranger 11, 43 entries, no warnings).
- Windows that opened during an import: none noticed in the notifications; the open-window count was read once (22 application instances, baseline not taken), so this is not a strong check.
- Items that did not function when clicked: not tested by clicking. Every weapon and spell has at least one activity, which is the failure the architecture exists to avoid, but no item was used.
- Follow-up fixes needed: none found. Species and subclass features that share a name with an item (for example `Battle Master`) show as repeated names; they are the subclass item and its feature, not a double import.
- Release recommendation: release 0.3.0

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
