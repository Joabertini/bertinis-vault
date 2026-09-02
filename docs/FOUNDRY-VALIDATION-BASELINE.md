# Foundry Validation Baseline

> **Historical record, exporter era. Closed 2026-09-02.**
>
> This explains how to read the generated fixture packet, which comes from
> `packages/foundry-exporter` — fabricated actors, not `ImportPayload`. The
> module cannot import them.
>
> The live pass is [`FOUNDRY-MANUAL-VALIDATION.md`](./FOUNDRY-MANUAL-VALIDATION.md).

## Purpose

This file explains how to read the generated Foundry validation packet before a human runs the live Foundry pass.

It separates:

- expected clean fixtures;
- intentionally noisy fixtures;
- warnings that still represent real follow-up work.

## Current Baseline

### Clean Fixtures

These fixtures are expected to have:

- `ok: true`
- `blockers: 0`
- `warnings: 0`

Current clean set:

1. `martial-fighter-5`
2. `prepared-cleric-5`
3. `pact-warlock-5`
4. `background-feat`
5. `wizard-spellbook-5`

If one of these starts emitting warnings or blockers, treat it as a regression candidate.

### Expected Warning Fixtures

These fixtures are expected to emit warnings today and should not be misread as accidental failures.

1. `warning-only`
Reason:
This fixture is intentionally malformed to prove that warning-only flows still export and stay understandable.
Expected issue codes:
- `SPELL_ID_LABEL_MISMATCH`
- `SPELL_LEVEL_MISMATCH`
- `EQUIPMENT_CATEGORY_MISMATCH`

2. `blocked-invalid-class`
Reason:
This fixture is intentionally invalid to prove that blocker flows stop creation cleanly.
Expected issue codes:
- `UNKNOWN_CLASS_ID`
- `UNEXPECTED_DERIVED_SPELLCASTING`

## Operator Rule Of Thumb

During manual Foundry validation:

1. if a clean fixture emits a new warning, log it as a likely regression;
2. if an intentionally noisy fixture behaves differently from its expected issue codes, log that as workflow drift;
3. if a blocker appears on a clean fixture, stop and treat it as high priority.

## Automated Gate

Before a manual pass, run:

```bash
corepack pnpm foundry:verify
```

This command:

1. regenerates the Foundry validation packet;
2. verifies that all clean fixtures remain warning-free;
3. verifies that intentionally noisy fixtures still emit the expected issue codes.

The same gate now runs in GitHub Actions via `.github/workflows/verify.yml`.
