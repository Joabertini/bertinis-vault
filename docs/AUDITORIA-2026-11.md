# Auditoría 2026-11 — reglas, ítems y creación de personajes

> Registro. Abierta y cerrada el 2026-11-10 (salvo el 11), leyendo el código
> por GitHub (sin correr nada local: la PC es HDD). Cada arreglo va en su rama
> con su test; los verifica el CI "Verify Workspace". Los PR los mergea el dueño.

## Estado

| # | Problema | Dónde | Estado |
|---|---|---|---|
| 1 | El kit inicial se re-suma al cambiar clase/trasfondo/edición y nunca saca el anterior (duplica ítems, deja el kit de la clase vieja) | `routes/Forge.tsx` efecto `kitSignature`, `lib/starting-kit.ts` | mergeado (#108) |
| 2 | Multiclase: la segunda clase no da mejoras de característica ni dotes | `lib/improvements.ts` `improvementPlan`, `levelChoices` por nivel de la clase principal | mergeado (#112) |
| 3 | Cambiar de clase conserva elecciones de nivel que la clase nueva no tiene (un guerrero→mago se queda la de nivel 6) | `vault-store.ts` `releasedByPick`, `bonusesFromChoices` | mergeado (#112) |
| 4 | Caballero Arcano / Embaucador Arcano de una sola clase usan nivel/3 redondeado abajo (regla multiclase) en vez de su tabla (arriba) | `domain/src/derive.ts` `subclassCarriesTheCasting` | mergeado (#109) |
| 5 | Foundry: `applyItemState` busca por nombre y toma el primero; el conjuro Escudo recibe el estado del escudo; ítems homónimos quedan sin estado | `foundry-module/src/import.js` | mergeado (#110) |
| 6 | Dos armaduras viajan equipadas (espacio + bolso); arma/armadura del espacio y del bolso duplicadas | `lib/builder.ts` normalización de equipo, `to-payload.ts` `isWorn` | mergeado (#111) |
| 7 | Sacar una clase lanzadora o bajar de nivel deja conjuros y dones exportados e invisibles | `Forge.tsx` `removeClass`/`changeClass`/`setLevel` | mergeado (#113) |
| 8 | Subclase de clase extra no se borra al bajar su nivel; misma clase extra dos veces | `components/forge/Multiclass.tsx` | mergeado (#114) |
| 9 | PG: falta Duro (Tough), Dureza Enana, Resiliencia Dracónica | `domain/src/derive.ts`, `lib/builder.ts` | mergeado (#115) |
| 10 | Deduplicación de conjuros: el `Map` se queda con el último, el comentario dice el primero | `lib/builder.ts` `spells` | mergeado (#117) |
| 11 | Dotes repetibles (Elemental Adept, Magic Initiate 2024) colapsan en una | `lib/feats.ts` `featIdsFor` | abierto: el índice no trae `repeatable`; hace falta regenerarlo desde Plutonium y guardar las elecciones por instancia de dote |
| 12 | Los dones opcionales (invocaciones, estilos, metamagia, maniobras) solo salían de la primera clase y a su nivel | `lib/optional-features.ts` `talentPools`, `Forge.tsx` | mergeado (#116) |

## Qué falta ver en una mesa real

- **PG con Duro en Foundry (#115).** El módulo escribe `hp.max` con el total del
  constructor, que ahora incluye Duro. Si la dote que importa Plutonium además
  suma su bono por efecto activo, el actor tendría Duro dos veces. Importar un
  personaje con Duro y comparar contra la hoja del constructor.
- **Escudo (#110).** Importar un Caballero Arcano con el conjuro Escudo y un
  escudo, y ver que el escudo queda equipado y el conjuro preparado.
- **Módulo:** #110 cambia `apps/foundry-module`; hay que instalarlo (o sacar un
  tag `v*`) para que llegue a una mesa.

## Orden de merge

Mergeados en orden de número (#108 → #117) el 2026-11-10, después de que el
CI pasara sobre la combinación en #118 (cerrado).

## Notas para retomar

- Leer código: `gh api -H "Accept: application/vnd.github.raw" repos/Joabertini/bertinis-vault/contents/<ruta>`.
- Nada de tests/builds locales sin autorización: se empuja la rama y se mira `gh run list`.
- `ImportPayload` no cambia en ninguno de estos arreglos salvo que se diga: no hace falta desplegar el Worker.
- El 5 cambia `apps/foundry-module`: instalar el módulo es parte de mergear (ver `AI-HANDOFF.md`).
