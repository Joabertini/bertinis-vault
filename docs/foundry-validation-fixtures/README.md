# Foundry Validation Packet

Generated at: `2026-08-29T05:00:41.440Z`

## Fixture Summary

| Fixture | Result | Blockers | Warnings | Issues | Output |
| --- | --- | ---: | ---: | --- | --- |
| `martial-fighter-5` | ok | 0 | 0 | - | `docs/foundry-validation-fixtures/martial-fighter-5.json` |
| `prepared-cleric-5` | ok | 0 | 0 | - | `docs/foundry-validation-fixtures/prepared-cleric-5.json` |
| `pact-warlock-5` | ok | 0 | 0 | - | `docs/foundry-validation-fixtures/pact-warlock-5.json` |
| `background-feat` | ok | 0 | 0 | - | `docs/foundry-validation-fixtures/background-feat.json` |
| `wizard-spellbook-5` | ok | 0 | 0 | - | `docs/foundry-validation-fixtures/wizard-spellbook-5.json` |
| `warning-only` | ok | 0 | 3 | `SPELL_ID_LABEL_MISMATCH`, `SPELL_LEVEL_MISMATCH`, `EQUIPMENT_CATEGORY_MISMATCH` | `docs/foundry-validation-fixtures/warning-only.json` |
| `blocked-invalid-class` | blocked | 1 | 1 | `UNKNOWN_CLASS_ID`, `UNEXPECTED_DERIVED_SPELLCASTING` | `docs/foundry-validation-fixtures/blocked-invalid-class.json` |

## Manual Validation Workflow

1. Run `corepack pnpm mvp:verify` before opening Foundry if you want the full MVP gate.
2. Run `corepack pnpm foundry:fixtures` to refresh the packet if you only changed export/preflight logic.
3. Open `docs/FOUNDRY-MANUAL-VALIDATION.md` for the live Foundry checklist.
4. Record human results in `docs/FOUNDRY-MANUAL-VALIDATION-REPORT.md` or the generated working copy below.

## Operator Checklist

| Fixture | Expected live result | Auto issues |
| --- | --- | --- |
| `martial-fighter-5` | create actor cleanly without blockers or warnings | - |
| `prepared-cleric-5` | create actor cleanly without blockers or warnings | - |
| `pact-warlock-5` | create actor cleanly without blockers or warnings | - |
| `background-feat` | create actor cleanly without blockers or warnings | - |
| `wizard-spellbook-5` | create actor cleanly without blockers or warnings | - |
| `warning-only` | allow actor creation with visible warning feedback | `SPELL_ID_LABEL_MISMATCH`, `SPELL_LEVEL_MISMATCH`, `EQUIPMENT_CATEGORY_MISMATCH` |
| `blocked-invalid-class` | block actor creation with visible blocker feedback | `UNKNOWN_CLASS_ID`, `UNEXPECTED_DERIVED_SPELLCASTING` |
