# MVP Release Status

Generated at: `2026-09-02T03:25:21.067Z`

## Automated Gate

- Status: **PASS**
- Command: `corepack pnpm mvp:verify`
- Clean fixtures: 5
- Warning-only fixtures: 1
- Blocked fixtures: 1

## Automated Expectations

These fixtures come from `packages/foundry-exporter`, which is legacy: they
are fabricated actors, not `ImportPayload`, and the module cannot consume
them. They still catch exporter regressions, but they do not exercise the
import path. The live pass in `docs/FOUNDRY-MANUAL-VALIDATION.md` does.

| Fixture | Expected live result | Auto issues |
| --- | --- | --- |
| `martial-fighter-5` | create actor cleanly without blockers or warnings | - |
| `prepared-cleric-5` | create actor cleanly without blockers or warnings | - |
| `pact-warlock-5` | create actor cleanly without blockers or warnings | - |
| `background-feat` | create actor cleanly without blockers or warnings | - |
| `wizard-spellbook-5` | create actor cleanly without blockers or warnings | - |
| `warning-only` | allow actor creation with visible warning feedback | `SPELL_ID_LABEL_MISMATCH`, `SPELL_LEVEL_MISMATCH`, `EQUIPMENT_CATEGORY_MISMATCH` |
| `blocked-invalid-class` | block actor creation with visible blocker feedback | `UNKNOWN_CLASS_ID`, `UNEXPECTED_DERIVED_SPELLCASTING` |

## Manual Release Blockers Still Open

- [ ] Confirm the installed module matches `HEAD` **by hash**, not by version.
- [ ] Publish a build with `apps/web/probes/rehearsal.ts` and import it by code in a live world.
- [ ] Confirm the actor holds real compendium documents: `system.identifier` populated, spells with `activities`, weapons with `damage.base`.
- [ ] Compare the imported actor against Rathma, the hand-levelled reference, and explain every difference.
- [ ] Fill out `docs/FOUNDRY-MANUAL-VALIDATION-REPORT.md` with actual results and screenshot paths.

## Current Recommendation

Automated verification is strong enough to move directly into the live Foundry pass. Do not spend more time on broad refactors before that human validation.

