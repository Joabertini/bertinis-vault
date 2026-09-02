# Tests en espera

**Queda uno.** De las ocho suites que se aparcaron aquí el 2026-08-27, siete se
resolvieron y se fueron. Este archivo describía las ocho y siguió haciéndolo
hasta el 2026-09-02; la tabla de abajo es la que corresponde al directorio.

Estos archivos probaban `apps/web` cuando el front era el viejo. Siguen siendo
válidos como especificación — describen comportamiento que el producto debería
tener — pero llaman a funciones que el Faro del Alba no expone con ese nombre.

Quedan fuera de `vitest run` y del `typecheck` (ver `vitest.config.ts` y
`tsconfig.json`).

## Lo que queda

| Archivo | Casos | Espera | Quién tiene hoy el comportamiento |
|---|---:|---|---|
| `starting-equipment.test.ts` | 11 | `startingEquipmentFor`, `equipmentListsFor`, sobre `lib/builder` | `lib/starting-kit.ts` (`startingKitFor`, `grantedOptions`, `takenOptions`, `kitCopper`), con **22 casos** en `test/starting-kit.test.ts` |

**Hay una decisión pendiente y no es técnica.** El comportamiento está
implementado y probado con el doble de casos que este spec; lo que este archivo
aporta no es cobertura sino once redacciones distintas de la misma pregunta.
Reescribirlo contra `starting-kit.ts` es trabajo real y puede no valer la pena.
Se deja hasta que alguien decida, porque borrarlo en silencio es justo lo que
esta carpeta existe para evitar.

## No todos piden lo mismo

El triaje del 2026-08-27 partió las ocho en dos montones, y los dos se
vaciaron:

- **Cinco probaban cosas que el Faro sí hacía con otra API** — conjuros
  (`lib/spells.ts`), dotes y prerrequisitos (`lib/improvements.ts`), talentos
  (`lib/optional-features.ts`), equipo inicial y bonos de origen. Se
  reescribieron contra el módulo dueño del comportamiento, que era el trabajo
  que este archivo decía que había que hacer. Sólo el equipo inicial quedó sin
  reescribir, y por eso sigue arriba.
- **Tres eran huecos reales** — multiclase, maestría de armas y expertise, que
  nunca llegó a tener test. **Los tres se construyeron** entre las PRs #42 y
  #61, incluyendo lo que estaba roto río abajo en los paquetes.

La lección del triaje se sostuvo: *"reescribir el test, no portar la
función"*. Ningún test aparcado terminó pidiendo que se resucitara una función
vieja.

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
