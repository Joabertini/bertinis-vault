# Tests en espera

Estos ocho archivos probaban `apps/web` cuando el front era el viejo. Siguen
siendo válidos como especificación — describen comportamiento que el producto
debería tener — pero llaman a funciones que el Faro del Alba todavía no expone.

**No están rotos: están esperando.** Se borrarían sólo si se decidiera que el
comportamiento que describen ya no se quiere, y esa decisión no se tomó.

Quedan fuera de `vitest run` y del `typecheck` (ver `vitest.config.ts` y
`tsconfig.json`). Aparcarlos costó **un** test que pasaba, en `multiclass`;
los otros 78 verdes siguen en el gate.

## Qué espera cada uno

| Archivo | Casos | Espera |
|---|---:|---|
| `feat-prerequisites.test.ts` | 13 | `featPrerequisiteProblemsFor`, `unmetFeatPrerequisitesFor`, `featCandidateFor` |
| `optional-features.test.ts` | 13 | `optionalFeatureSlotsFor`, `optionalFeaturePrerequisitesFor`, `unmetOptionalFeaturesFor`, `optionalFeatureGrantersFor`, `optionalFeatureContextFor` |
| `weapon-mastery.test.ts` | 13 | `weaponMasterySlotsFor`, `masteryProblemsFor`, `masteryOptionsFor`, `masteryIsMeleeOnlyFor`, y `weaponMasteryIds` en `BuilderState` |
| `multiclass.test.ts` | 15 | `multiclassGrantsFor`, `unmetMulticlassRequirementsFor`, `classesFor` |
| `starting-equipment.test.ts` | 11 | `startingEquipmentFor`, `equipmentListsFor` |
| `subclass-spells.test.ts` | 10 | `spellPoolFor` |
| `origin-abilities.test.ts` | 10 | `originAbilityBonusesFor`, `originAbilityChoiceForBuild`, `pendingOriginAbilitiesFor` |
| `spell-counts.test.ts` | 8 | `spellCountsFor` |

## No todos piden lo mismo

Cinco de los ocho prueban cosas que el Faro **sí hace**, con otra API: conjuros
(`lib/spells.ts`), dotes y prerrequisitos (`lib/improvements.ts`), talentos
(`lib/optional-features.ts`), equipo inicial (`lib/grants.ts` y la cámara
Equipo), y bonos de origen (`components/forge/BonusEditor.tsx`). Para esos, el
trabajo es reescribir el test contra el módulo que hoy dueño del comportamiento
— no portar una función.

Los otros tres — **multiclase**, **maestría de armas** y expertise, que nunca
llegó a tener test — son huecos reales del Faro. Los tres además están rotos
río abajo en los paquetes, así que arreglarlos es más que devolverle un control
al front. Ver `docs/MIGRACION-FRONT.md`.
