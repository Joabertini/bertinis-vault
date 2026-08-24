# Foundry Manual Validation Working Copy

Generated at: `2026-08-24T01:09:37.534Z`

Start from `docs/FOUNDRY-MANUAL-VALIDATION-REPORT.md` for the canonical template.

## Automatic Baseline

| Fixture | Label | Preflight | Expected live result | Blockers | Warnings | Issues | Output |
| --- | --- | --- | --- | ---: | ---: | --- | --- |
| `martial-fighter-5` | Martial with armor and shield | ok | create actor cleanly without blockers or warnings | 0 | 0 | - | `docs/foundry-validation-fixtures/martial-fighter-5.json` |
| `prepared-cleric-5` | Prepared caster cleric | ok | create actor cleanly without blockers or warnings | 0 | 0 | - | `docs/foundry-validation-fixtures/prepared-cleric-5.json` |
| `pact-warlock-5` | Pact caster warlock | ok | create actor cleanly without blockers or warnings | 0 | 0 | - | `docs/foundry-validation-fixtures/pact-warlock-5.json` |
| `background-feat` | Background feat plus chosen feat | ok | create actor cleanly without blockers or warnings | 0 | 0 | - | `docs/foundry-validation-fixtures/background-feat.json` |
| `wizard-spellbook-5` | Wizard spellbook | ok | create actor cleanly without blockers or warnings | 0 | 0 | - | `docs/foundry-validation-fixtures/wizard-spellbook-5.json` |
| `warning-only` | Warning-only validation case | ok | allow actor creation with visible warning feedback | 0 | 3 | `SPELL_ID_LABEL_MISMATCH`, `SPELL_LEVEL_MISMATCH`, `EQUIPMENT_CATEGORY_MISMATCH` | `docs/foundry-validation-fixtures/warning-only.json` |
| `blocked-invalid-class` | Blocked invalid class case | blocked | block actor creation with visible blocker feedback | 1 | 1 | `UNKNOWN_CLASS_ID`, `UNEXPECTED_DERIVED_SPELLCASTING` | `docs/foundry-validation-fixtures/blocked-invalid-class.json` |

## Manual Notes

### 1. Martial with armor and shield

- Fixture: `martial-fighter-5`
- Automatic baseline: ok; blockers=0; warnings=0
- Expected live result: create actor cleanly without blockers or warnings
- Automatic issues: none
- Live Foundry result:
- Notes:
- Screenshot paths:

### 2. Prepared caster cleric

- Fixture: `prepared-cleric-5`
- Automatic baseline: ok; blockers=0; warnings=0
- Expected live result: create actor cleanly without blockers or warnings
- Automatic issues: none
- Live Foundry result:
- Notes:
- Screenshot paths:

### 3. Pact caster warlock

- Fixture: `pact-warlock-5`
- Automatic baseline: ok; blockers=0; warnings=0
- Expected live result: create actor cleanly without blockers or warnings
- Automatic issues: none
- Live Foundry result:
- Notes:
- Screenshot paths:

### 4. Background feat plus chosen feat

- Fixture: `background-feat`
- Automatic baseline: ok; blockers=0; warnings=0
- Expected live result: create actor cleanly without blockers or warnings
- Automatic issues: none
- Live Foundry result:
- Notes:
- Screenshot paths:

### 5. Wizard spellbook

- Fixture: `wizard-spellbook-5`
- Automatic baseline: ok; blockers=0; warnings=0
- Expected live result: create actor cleanly without blockers or warnings
- Automatic issues: none
- Live Foundry result:
- Notes:
- Screenshot paths:

### 6. Warning-only validation case

- Fixture: `warning-only`
- Automatic baseline: ok; blockers=0; warnings=3
- Expected live result: allow actor creation with visible warning feedback
- Automatic issues: SPELL_ID_LABEL_MISMATCH, SPELL_LEVEL_MISMATCH, EQUIPMENT_CATEGORY_MISMATCH
- Live Foundry result:
- Notes:
- Screenshot paths:

### 7. Blocked invalid class case

- Fixture: `blocked-invalid-class`
- Automatic baseline: blocked; blockers=1; warnings=1
- Expected live result: block actor creation with visible blocker feedback
- Automatic issues: UNKNOWN_CLASS_ID, UNEXPECTED_DERIVED_SPELLCASTING
- Live Foundry result:
- Notes:
- Screenshot paths:

