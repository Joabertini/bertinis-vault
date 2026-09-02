# Foundry Validation Matrix

> **Historical record, exporter era. Closed 2026-09-02.**
>
> Everything below is coverage of `packages/foundry-exporter`, which fabricates
> actor payloads by hand — the approach this project abandoned. It still runs
> and still catches regressions in that package, but it does not exercise the
> import path a player takes.
>
> The live pass is [`FOUNDRY-MANUAL-VALIDATION.md`](./FOUNDRY-MANUAL-VALIDATION.md).

## Goal

Keep one short matrix of the MVP build shapes we should validate regularly in Foundry and in exporter regressions.

## Current Regression Coverage

Automated exporter coverage now includes representative cases for:

1. Martial or mixed equipment handling, including armor and shield equip behavior.
2. Prepared caster export shape with cleric spellcasting and language handling.
3. Pact caster export shape with warlock slot behavior.
4. Background-granted feat inclusion alongside chosen feats.
5. Wizard spellbook-adjacent export shape with spell metadata and spellbook gear preserved.
6. Defensive deduplication for repeated spell selections in exporter payloads.
7. Preflight warnings for mismatched or duplicate normalized choices.

Primary automated coverage lives in:

- `packages/foundry-exporter/test/index.test.mjs`
- `packages/foundry-exporter/test/fixtures.mjs`
- `packages/domain/test/preflight.test.mjs`

Generated validation payloads can be refreshed with:

- `corepack pnpm foundry:fixtures`
- output directory: `docs/foundry-validation-fixtures/`
- human packet entrypoint: `docs/foundry-validation-fixtures/README.md`

## Manual Foundry Matrix

Validate these five builds in a real Foundry import pass:

1. Martial with armor and shield.
Expected:
Chain armor equips, shield equips, AC looks sane, weapon imports as expected.

2. Prepared caster.
Suggested build:
Cleric level 5.
Expected:
Spellcasting ability is WIS, prepared spells import, language and holy-symbol style gear survive import.

3. Pact caster.
Suggested build:
Warlock level 5.
Expected:
CHA spellcasting survives import, pact-slot level and count look correct, warlock spells import with metadata.

4. Background feat case.
Suggested build:
`wildspacer` or another feat-granting background plus one chosen feat.
Expected:
Background-granted feat and chosen feat both appear without duplication.

5. Wizard spellbook case.
Suggested build:
Wizard level 5.
Expected:
Spellbook-supporting export shape remains stable, leveled spell list survives import, Foundry payload includes spell metadata.

## When To Update This File

Update this matrix when:

1. a new MVP-critical build shape is added;
2. a regression test is added or removed;
3. a manual import finds a recurring failure mode worth tracking.
