# MVP Release Status

Generated at: `2026-08-28T00:51:40.274Z`

## Automated Gate

- Status: **PASS**
- Command: `corepack pnpm mvp:verify`
- Clean fixtures: 5
- Warning-only fixtures: 1
- Blocked fixtures: 1

## Automated Expectations

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

- [ ] Run the live Foundry validation pass in `docs/FOUNDRY-MANUAL-VALIDATION.md`.
- [ ] Fill out `docs/FOUNDRY-MANUAL-VALIDATION-REPORT.md` with actual results and screenshot paths.
- [ ] Confirm no valid fixture imports with unexpected blockers.
- [ ] Confirm the warning-only fixture still creates an actor with understandable warnings.
- [ ] Confirm the blocked fixture stops actor creation cleanly.

## Current Recommendation

Automated verification is strong enough to move directly into the live Foundry pass. Do not spend more time on broad refactors before that human validation.

