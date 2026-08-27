# Tests en espera

Estos archivos probaban `apps/web` cuando el front era el viejo. Siguen
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

## Los que se fueron

`multiclass.test.ts` se desaparcó entero y pasa sin cambios: la API que pedía
—`classesFor`, `unmetMulticlassRequirementsFor`, `multiclassGrantsFor`— se
construyó contra él.

`weapon-mastery.test.ts` se retiró después de reconciliarlo. Tenía razón en dos
cosas que la implementación hacía mal, y las dos se arreglaron:

- **Elegir de más se recortaba en silencio.** Ahora `masteryProblemsFor` lo
  reporta con los dos números. Recortar callado es el modo de falla que este
  constructor viene arreglando en todas las otras cámaras.
- **Un `""` guardado sobrevivía al `coerce`**, pasaba el `typeof` y después no
  coincidía con ningún arma: en pantalla se leía como una maestría que el
  jugador no podía sacar.

**Y hay un punto donde se decidió lo contrario, a propósito.** El spec esperaba
más de 80 opciones —todas las armas con maestría, objetos mágicos incluidos— e
ids en forma de slug (`antimatter-rifle`). La implementación ofrece 38: las
armas base que dnd5e 5.3.3 tiene como `weaponIds`.

La razón es evidencia que el spec no tenía. `traits.weaponProf.mastery.value`
es un Set que el sistema consulta con `has(item.type.baseItem)`, leído del
`dnd5e.mjs` instalado. Una maestría exportada fuera de esa lista no falla: **no
pasa nada**, y el jugador ve la elección hecha y en la mesa no ocurre. Ofrecer
"Dagger of Venom" aparte tampoco es una elección real — se domina el tipo de
arma, y "Dagger" ya lo cubre.
