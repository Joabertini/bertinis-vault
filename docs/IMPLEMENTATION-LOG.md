# Bertini's Vault - Implementation Log

> **Historical record, closed 2026-04-03. Do not read this as instructions.**
>
> This log covers the era when the exporter fabricated item bodies by hand. That
> approach was abandoned: a spell it produced fell back to a default school and
> carried no activities, so it appeared on the sheet and did nothing when
> clicked. The design that replaced it — reference entities, never fabricate
> them — is in [`../ARCHITECTURE-PLAN.md`](../ARCHITECTURE-PLAN.md).
>
> Kept because deleting history is worse than keeping it. Start at
> [`AI-HANDOFF.md`](./AI-HANDOFF.md) instead.

## 2026-04-03

### JSON export/import deep-dive and native filename alignment

A full JSON pipeline audit was performed against native Foundry exports and all current `rambo` variants.

Delivered:

- `docs/FOUNDRY-JSON-PIPELINE-ANALYSIS.md` with:
  - end-to-end architecture of the export path;
  - structural gap analysis per file (`rambo 1/2/3/4` vs `alpaca`);
  - reasoning about filename relevance;
  - applied fixes and remaining risk.
- exporter shape corrected back toward native actor data for dnd5e import compatibility;
- spell item shape tightened to avoid non-native fields;
- web download filename normalized to Foundry-style pattern:
  - `fvtt-Actor-<slug>-<id>.json`.

## 2026-04-02

### Slice urgente sobre spell metadata e import JSON

Se abrio un slice directo sobre los dos bugs mas graves de MVP: spells mostrando `Sin dato` en la UI y JSON builder-side que todavia no entra limpio en Foundry.

Cambios principales:

- `apps/web/src/App.tsx` ahora resuelve la ficha activa del spell por `spellId`, mezclando:
  - entry visible en la grilla;
  - `builderOptions` cargadas;
  - fallback local;
  - detalle puntual de `GET /spells/:id`;
- `packages/contracts/src/foundry.ts` ahora permite `_id` y `sort` en el actor exportado;
- `packages/foundry-exporter/src/index.ts` alinea mejor el actor exportado con Foundry:
  - `_id` root;
  - `sort`;
  - `system.attributes.ac.calc = "default"`;
  - `system.attributes.ac.flat = null`;
  - HP con `min`, `temp`, `tempmax`, `bonuses`;
  - movement y senses mas compatibles;
  - `system.spells.spell1..spell9` con `override: null`;
- `packages/foundry-exporter/test/index.test.mjs` se actualizo para cubrir el nuevo shape esperado;
- se dejo handoff tecnico focalizado en `docs/FOUNDRY-IMPORT-HANDOFF.md` y version imprimible en `docs/FOUNDRY-IMPORT-HANDOFF.html`.

Referencia usada:

- `D:/Users/Martin/Desktop/RESPALDO/D&D 5e/Documents/web builder/Bertinis-Foundry-Technical-Reference.docx`

Estado al cierre:

- la ausencia de datos de spell ya no deberia depender solo del payload resumido de la grilla;
- el actor exportado queda mas cerca del formato nativo que Foundry exporta/importa;
- sigue pendiente la prueba manual definitiva de import con un actor regenerado desde este commit.

## 2026-03-22

### Roadmap de tres etapas para salida a beta

Se formalizo un roadmap nuevo para ordenar el siguiente tramo del proyecto alrededor de tres etapas:

- Stage A: estabilizar preflight, import/export y convergencia del exporter;
- Stage B: completar la migracion canonica y reducir dependencia del runtime legacy;
- Stage C: preparar una beta defendible con demo, persistencia y disciplina de release.

Cambios principales:

- nuevo documento `docs/THREE-STAGE-ROADMAP.md`;
- enlace desde `docs/AI-HANDOFF.md` para que futuras iteraciones arranquen desde ese orden de prioridades;
- referencia desde `README.md` para que la direccion del repo no quede solo implícita en docs internas.

Decision importante:

- la prioridad inmediata pasa a ser Stage A;
- no conviene abrir trabajo amplio de polish o beta antes de fortalecer el pipeline operativo Foundry-side.

### Contrato inicial de preflight compartido

Se abrio el primer slice tecnico de Stage A con una base tipada para preflight dentro de `packages/contracts`.

Ahora incluye:

- nuevo archivo `packages/contracts/src/preflight.ts`;
- severidades compartidas: `blocker`, `warning`, `info`;
- scopes iniciales para build canonico, export, import, compatibilidad y datasets;
- `preflightIssueSchema` para findings estructurados;
- `preflightTargetSchema` para capturar el target Foundry/sistema/modulo;
- `preflightResultSchema` con `issues` y `summary`;
- export desde `packages/contracts/src/index.ts`;
- tests nuevos en `packages/contracts/test/preflight.test.mjs`.

Impacto:

- el proyecto ya tiene un shape unico para reportar blockers y warnings;
- las siguientes capas de Stage A pueden construir checks reales sin inventar contratos nuevos;
- Foundry, exporter y validacion compartida ya tienen un punto comun para converger.

### Primer builder real de preflight en domain

Se agrego la primera implementacion operativa de preflight en `packages/domain`.

Ahora incluye:

- nuevo `packages/domain/src/preflight.ts`;
- `buildPreflightResult(...)` como punto compartido para validar builds antes del export/import;
- bloqueo temprano para fallas estructurales del contrato canonico usando `characterBuildInputSchema.safeParse(...)`;
- checks semanticos iniciales contra `packages/data-engine` para:
  - clases;
  - raza;
  - background;
  - feats;
  - spells normalizados;
  - equipment normalizado;
- `summary` agregado con conteo de `blockers`, `warnings`, `info` y `total`;
- export desde `packages/domain/src/index.ts`;
- tests nuevos en `packages/domain/test/preflight.test.mjs`.

Validacion ejecutada:

- build de `packages/domain` correcto;
- `node --test packages/domain/test/*.test.mjs` pasando.

Impacto:

- Stage A ya no depende solo de un schema vacio de preflight;
- existe una capa compartida que puede ser consumida por exporter, web y Foundry runtime;
- el siguiente paso natural es cablear este resultado a la experiencia de export/import y ampliar la matriz de checks.

### Limpieza de rutas locales en documentacion

Se corrigieron referencias absolutas a rutas locales y de sandbox que no deberian vivir dentro del repo.

Ahora incluye:

- reemplazo de rutas locales absolutas y referencias de sandbox;
- conversion a links relativos portables dentro de `README.md`, `ARCHITECTURE-PLAN.md`, `docs/`, y `apps/foundry-module/README.md`;
- eliminacion de referencias locales a `ddimport.js` como path absoluto.

Impacto:

- la documentacion deja de filtrar rutas de maquina;
- los links quedan portables para cualquier clon del repo;
- los commits futuros ya no deberian arrastrar este problema salvo que se vuelva a introducir manualmente.

### Preflight integrado al foundry-exporter

Se conecto el preflight compartido al flujo de exportacion a Foundry.

Ahora incluye:

- nuevo `buildFoundryExportResult(...)` en `packages/foundry-exporter/src/index.ts`;
- ejecucion de `buildPreflightResult(...)` antes de producir payload;
- retorno conjunto de:
  - `preflight`
  - `payload` opcional;
- bloqueo de export cuando existen blockers reales de preflight;
- `buildFoundryActorPayload(...)` ahora pasa por el mismo carril y falla solo si el preflight bloquea;
- resumen de preflight agregado dentro de `flags.bertinis-vault.preflight` cuando el export es valido;
- tests ampliados en `packages/foundry-exporter/test/index.test.mjs`.

Validacion ejecutada:

- build de `packages/foundry-exporter` correcto;
- `node --test packages/foundry-exporter/test/*.test.mjs` pasando.

Impacto:

- exporter y preflight ya no viven en carriles separados;
- cualquier superficie que quiera exportar puede inspeccionar blockers y warnings antes de tocar Foundry;
- el siguiente paso natural es mostrar este resultado en web o en el runtime Foundry como feedback de operador.

### Preflight visible en apps/web

Se llevo el resultado del preflight integrado a la superficie web de demo.

Ahora incluye:

- `apps/web/src/App.tsx` usando `buildFoundryExportResult(...)` en lugar de exportar Foundry a ciegas;
- nueva tarjeta visual de preflight con:
  - blockers;
  - warnings;
  - info;
  - lista resumida de hallazgos;
- bloqueo elegante de copia/descarga Foundry cuando el preflight no permite exportar;
- fallback de la vista tecnica para mostrar `preflight` cuando no existe payload Foundry;
- estilos nuevos en `apps/web/src/styles.css` para integrar el chequeo al lenguaje visual actual.

Validacion ejecutada:

- `corepack pnpm web:typecheck`;
- `corepack pnpm web:build`.

Impacto:

- la demo ya comunica claramente si la build esta lista para Foundry;
- el export deja de ser una accion ciega desde la UI;
- el siguiente paso natural es exponer el mismo preflight en el runtime legacy de Foundry.

### Preflight integrado al runtime legacy de Foundry

Se conecto una primera capa de preflight al flujo real de creacion del actor dentro del modulo legacy.

Ahora incluye:

- nuevo `scripts/preflight-bridge.js` como espejo temporal del preflight compartido para el runtime Foundry actual;
- chequeo previo dentro de `scripts/vault-app.js` antes de llamar a `buildActor(...)`;
- bloqueo de creacion cuando existen blockers de preflight;
- warnings mostrados al operador via `ui.notifications.warn(...)` cuando la exportacion puede continuar;
- persistencia del resultado dentro de `flags.bertinis-vault.canonicalPreflight` desde `scripts/character-builder.js`.

Validacion ejecutada:

- `node --check scripts/preflight-bridge.js`;
- `node --check scripts/character-builder.js`;
- `node --check scripts/vault-app.js`.

Limite actual:

- esta sesion no puede validar el flujo completo dentro de Foundry VTT, asi que la confirmacion final del comportamiento runtime sigue pendiente de prueba manual en Foundry.

Impacto:

- Stage A ya cubre preflight en contrato, dominio, exporter, web y runtime legacy;
- el camino operativo de import/export queda mucho mas cerca del benchmark procesal definido para el proyecto;
- el siguiente paso natural es reemplazar este bridge temporal por consumo mas directo del carril compartido cuando el modulo legacy deje de ser el centro del runtime.

### Matriz inicial de edge cases para preflight

Se reforzo el preflight compartido con checks mas cercanos a fallas reales de build y de normalizacion.

Ahora incluye:

- blocker nuevo `TOTAL_LEVEL_EXCEEDS_20` cuando la suma de multiclass supera el maximo de nivel 20;
- warning nuevo `SPELL_ID_LABEL_MISMATCH` cuando `spellId` y `label` resuelven a spells distintos;
- warning nuevo `SPELL_LEVEL_MISMATCH` cuando el nivel informado no coincide con el catalogo compartido;
- warning nuevo `EQUIPMENT_CATEGORY_MISMATCH` cuando la categoria normalizada no coincide con el catalogo compartido;
- tests ampliados en `packages/domain/test/preflight.test.mjs`;
- tests ampliados en `packages/foundry-exporter/test/index.test.mjs` para verificar propagacion de warnings mas ricos.

Validacion ejecutada:

- build de `packages/domain` correcto;
- build de `packages/foundry-exporter` correcto;
- `node --test packages/domain/test/preflight.test.mjs` pasando;
- `node --test packages/foundry-exporter/test/index.test.mjs` pasando.

Impacto:

- el preflight deja de cubrir solo "ids faltantes" y empieza a detectar inconsistencias internas del build canonico;
- exporter y runtime heredan mejores diagnosticos sin agregar logica paralela;
- el siguiente paso natural es ampliar fixtures reales de spellcasting, proficiencies y multiclass antes de converger mas codigo legacy.

### Consistencia de multiclass y derived dentro del preflight

Se agrego una segunda capa de edge cases orientada a detectar snapshots canonicos stale o internamente inconsistentes.

Ahora incluye:

- warning nuevo `DUPLICATE_CLASS_ID` cuando una misma clase aparece repetida dentro de `classing.classes`;
- warning nuevo `DERIVED_PROFICIENCY_BONUS_MISMATCH` cuando `derived.proficiencyBonus` no coincide con el nivel total;
- warning nuevo `UNEXPECTED_DERIVED_SPELLCASTING` cuando una clase no caster arrastra `derived.spellcasting`;
- warnings nuevos para spellcasting derivado inconsistente:
  - `DERIVED_SPELL_ABILITY_MISMATCH`
  - `DERIVED_SPELL_ATTACK_BONUS_MISMATCH`
  - `DERIVED_SPELL_SAVE_DC_MISMATCH`
  - `DERIVED_SPELL_SLOTS_MISMATCH`
- tests ampliados en `packages/domain/test/preflight.test.mjs` con fixtures de multiclass duplicado y non-caster stale;
- tests ampliados en `packages/foundry-exporter/test/index.test.mjs` para verificar propagacion de warnings de `derived`.

Validacion ejecutada:

- build de `packages/domain` correcto;
- build de `packages/foundry-exporter` correcto;
- `node --test packages/domain/test/preflight.test.mjs` pasando;
- `node --test packages/foundry-exporter/test/index.test.mjs` pasando.

Impacto:

- el preflight ya no valida solo la entrada canonica, tambien detecta snapshots derivados desalineados con las reglas compartidas;
- esto ayuda a identificar exportaciones potencialmente "correctas de schema pero stale de calculo";
- el siguiente paso natural es ampliar la matriz a proficiencies y fixtures mas realistas de caster/non-caster antes de reducir mas duplicacion legacy.

### Proficiencies compartidas y preflight mas estricto

Se avanzo sobre `proficiencies` con una mejora que no solo agrega warnings: tambien reduce duplicacion entre dominio y exporter.

Ahora incluye:

- nuevo modulo compartido `packages/domain/src/proficiencies.ts` para resolver:
  - skills
  - languages
  - tools
- `packages/foundry-exporter/src/index.ts` reutilizando esa capa compartida en lugar de depender solo de mapas locales;
- warnings nuevos en preflight para proficiencies:
  - `UNRESOLVED_PROFICIENCY`
  - `DUPLICATE_PROFICIENCY_ENTRY`
  - `PROFICIENCY_KIND_LABEL_MISMATCH`
- cobertura tanto para `choices.normalized.proficiencies` como para el array legacy `choices.proficiencies`;
- tests ampliados en `packages/domain/test/preflight.test.mjs` y `packages/foundry-exporter/test/index.test.mjs`.

Validacion ejecutada:

- build de `packages/domain` correcto;
- build de `packages/foundry-exporter` correcto;
- `node --test packages/domain/test/preflight.test.mjs` pasando;
- `node --test packages/foundry-exporter/test/index.test.mjs` pasando.

Impacto:

- preflight ahora detecta mejor picks de skill/language/tool que hoy se perderian silenciosamente al exportar;
- exporter y preflight comparten una misma logica de resolucion, lo que baja riesgo de divergencia;
- el siguiente paso natural es ampliar fixtures mixtos de equipment y continuar la convergencia del runtime Foundry con esta capa compartida.

### Exportacion de equipment mixto sin truncar inventario

Se corrigio una limitacion concreta del exporter compartido: antes conservaba solo una arma y una pieza defensiva principal.

Ahora incluye:

- `packages/foundry-exporter/src/index.ts` exportando todas las entradas de `choices.equipment` / `choices.normalized.equipment`;
- preservacion de `quantity` en:
  - armas
  - equipment defensivo
  - gear/loot
- logica de `equipped` mas razonable:
  - primera armor no-shield equipada
  - primer shield equipado
  - piezas defensivas adicionales exportadas pero no equipadas
- test nuevo en `packages/foundry-exporter/test/index.test.mjs` para cubrir:
  - multiples armas
  - armor + shield + armor extra
  - gear con cantidad mayor a 1

Validacion ejecutada:

- build de `packages/foundry-exporter` correcto;
- `node --test packages/foundry-exporter/test/index.test.mjs` pasando.

Impacto:

- el exporter deja de perder inventario valido en personajes con equipo mas realista;
- la salida Foundry se acerca mas a un actor utilizable sin post-edicion manual;
- el siguiente paso natural es llevar esta misma claridad operativa al flujo de operador Foundry, especialmente settings y feedback de importacion.

### Settings operativos y feedback de importacion en Foundry

Se dio un paso mas orientado al operador dentro del runtime legacy de Foundry, sin esperar todavia a reemplazar toda la UI.

Ahora incluye:

- nuevos settings en `scripts/vault.js`:
  - `createFolderIfMissing`
  - `notifyPreflightWarnings`
  - `openSheetOnCreate`
- uso real de `defaultFolder` durante la creacion del actor desde `scripts/vault-app.js`;
- creacion opcional de carpeta de actores cuando la configuracion lo pide y la carpeta no existe;
- mensajes de progreso mas explicitos durante:
  - validacion canonica
  - preparacion de export
  - creacion del actor
- resumen de preflight visible en la pantalla de exito;
- apertura automatica de la hoja del actor cuando el setting cliente lo habilita;
- notificacion explicita de error de importacion via `ui.notifications.error(...)`.

Validacion ejecutada:

- `node --check scripts/vault.js`;
- `node --check scripts/vault-app.js`.

Limite actual:

- sigue pendiente la validacion manual dentro de Foundry VTT para confirmar render final, creacion real de carpeta y comportamiento visual del spinner/resultado.

Impacto:

- Stage A ya no mejora solo el modelo y el exporter: tambien mejora el proceso real de importacion para la persona que opera el modulo;
- la configuracion del modulo empieza a tener consecuencias concretas dentro del flujo de creacion;
- el siguiente paso natural es seguir convergiendo `vault-app` / `character-builder` con el exporter compartido para que el runtime legacy deje de reconstruir partes del actor por su cuenta.

### Runtime legacy reutilizando el inventario completo del exporter compartido

Se aplico un slice pequeno pero importante de convergencia entre `scripts/character-builder.js` y el exporter compartido.

Ahora incluye:

- `scripts/character-builder.js` reutilizando `canonicalFoundryPreview.items` completo cuando la preview compartida esta disponible;
- eliminacion del armado parcial que antes solo copiaba:
  - class items
  - feat items
  - spell items
  - un arma fallback
- fallback legacy mantenido solo cuando no hay `canonicalFoundryPreview.items`.

Validacion ejecutada:

- `node --check scripts/character-builder.js`.

Impacto:

- el runtime legacy deja de perder equipment/loot que la capa compartida ya sabe exportar;
- baja la divergencia entre "actor creado en Foundry" y "payload producido por el exporter compartido";
- el siguiente paso natural es empujar la misma convergencia sobre mas secciones de `system`, no solo sobre `items`.

### Preview legacy mas alineada con equipment y cantidades del exporter compartido

Se reforzo `scripts/foundry-export-bridge.js` para que la preview canonica que consume el runtime legacy deje de quedarse en un inventario minimo.

Ahora incluye:

- soporte para `choices.normalized.equipment` y `choices.normalized.spells` cuando existen;
- exportacion de:
  - multiples armas
  - armor + shield + armor extra
  - gear/loot
- preservacion de `quantity` en armas, equipo defensivo y loot;
- criterio simple de `equipped` en la preview:
  - primera armor no-shield equipada
  - primer shield equipado
  - defensas adicionales no equipadas
- `scripts/character-builder.js` manteniendo consumo directo de `canonicalFoundryPreview.items`, por lo que esta mejora ya impacta el actor legacy final.

Validacion ejecutada:

- `node --check scripts/foundry-export-bridge.js`;
- `node --check scripts/character-builder.js`.

Limite actual:

- sigue faltando una prueba manual dentro de Foundry para confirmar que la UX final y la hoja del actor resultante se comportan como esperamos con inventarios mas ricos.

Impacto:

- el puente legacy deja de ser una preview demasiado recortada respecto del exporter compartido;
- se reduce otra fuente importante de divergencia entre carril canonico y runtime activo;
- el siguiente paso natural es converger mas `system` del bridge/builder con la salida compartida, no solo `items`.

### Convergencia inicial de `system` entre preview legacy y builder activo

Se dio el siguiente paso despues de `items`: acercar tambien la forma base de `system` entre la preview legacy y el actor que finalmente crea Foundry.

Ahora incluye:

- `scripts/foundry-export-bridge.js` enriquecido con mas estructura de `system`, incluyendo:
  - `currency`
  - `bastion`
  - `attributes` mas completos
  - `details` con mas campos base
- `scripts/character-builder.js` reutilizando mas datos de `previewSystem` en lugar de regenerar tantos defaults locales para:
  - `currency`
  - `attributes`
  - `bastion`
  - `details`
  - `traits`
  - `resources`
  - `favorites`

Validacion ejecutada:

- `node --check scripts/foundry-export-bridge.js`;
- `node --check scripts/character-builder.js`.

Impacto:

- el runtime legacy empieza a depender mas de una estructura compartida y menos de merges manuales dispersos;
- baja el riesgo de que una mejora del bridge se pierda antes de llegar al actor final;
- el siguiente paso natural es seguir reduciendo codigo legacy redundante dentro de `character-builder.js`, especialmente helpers y defaults que ya quedaron cubiertos por la preview.

### Bridge legacy consumiendo mas elecciones normalizadas

Se reforzo `scripts/foundry-export-bridge.js` para que la preview canonica aproveche mejor el contrato estructurado cuando ya existe.

Ahora incluye:

- uso de `choices.normalized.proficiencies` para:
  - skills
  - languages
  - tools
- uso de `choices.normalized.features` para derivar feats/features del actor preview;
- fallback legacy mantenido cuando la build todavia no trae elecciones normalizadas.

Validacion ejecutada:

- `node --check scripts/foundry-export-bridge.js`;
- `node --check scripts/character-builder.js`.

Impacto:

- el bridge legacy deja de depender tanto de parsing tardio de strings cuando la build canonica ya viene mejor estructurada;
- se reduce otra diferencia importante entre runtime activo y carril compartido del monorepo;
- el siguiente paso natural es seguir eliminando codigo legacy ahora realmente redundante dentro de `character-builder.js` y `foundry-export-bridge.js`.

### Preview legacy mas cercana a un actor completo en top-level

Se agrego otra capa de convergencia en `scripts/foundry-export-bridge.js`: ya no solo se acerca en `system` e `items`, sino tambien en la forma general del actor.

Ahora incluye:

- `prototypeToken` dentro de la preview legacy;
- `_stats`, `ownership` y `folder` en la salida preview;
- helper local `makeToken(...)` para que la preview ya tenga forma mucho mas parecida a un actor Foundry completo.

Validacion ejecutada:

- `node --check scripts/foundry-export-bridge.js`.

Impacto:

- se reduce la distancia entre "preview canonica" y "actor completo" incluso fuera de `system`;
- prepara mejor el terreno para que futuras limpiezas del builder legacy puedan confiar mas en la preview completa;
- el siguiente paso natural es una pasada mas agresiva de eliminacion de codigo redundante dentro de `character-builder.js`.

### Base architecture bootstrap

Se agrego la base inicial del monorepo sin romper el prototipo actual de Foundry.

Cambios principales:

- raiz con `package.json`, `pnpm-workspace.yaml` y `tsconfig.base.json`;
- estructura inicial de `apps/web`, `apps/api` y `apps/foundry-module`;
- `packages/contracts` con schema inicial `CharacterBuild`;
- `packages/domain` con calculos base para modificadores, progresion, HP y AC;
- documento maestro en `ARCHITECTURE-PLAN.md`;
- actualizacion de `README.md` para explicar la nueva direccion del repo.

Decision importante:

- el modulo actual de Foundry sigue siendo el prototipo de referencia;
- la nueva arquitectura se construye alrededor de el hasta que la logica deje de vivir en la raiz.

### Siguiente objetivo

Extraer reglas reales desde el prototipo hacia paquetes compartidos:

- spellcasting;
- hit dice y progresion;
- spell slots;
- primeras piezas del exportador a Foundry.

### Reglas y exportador extraidos

Se avanzo un paso mas en la separacion del dominio:

- se agrego `packages/domain/src/dnd5e-2014.ts` con:
  - hit dice por clase;
  - spellcasting ability por clase;
  - progresion de spell slots;
  - helper para normalizar `classId`;
- `packages/domain/src/derive.ts` ahora usa esas reglas compartidas;
- se agrego `packages/foundry-exporter` con un primer `buildFoundryActorPayload`;
- se creo esta bitacora en `docs/IMPLEMENTATION-LOG.md` para registrar avances de trabajo.

Estado del exportador:

- inicial;
- suficiente para mapear nombre, abilities, HP, AC y spellcasting base;
- ahora tambien genera items de clase, feats/features y spells desde `CharacterBuild`;
- todavia no migra armas, proficiencies, biography completa ni payload completo de actor `dnd5e`.

### Siguiente objetivo actualizado

- migrar mas reglas reales desde `scripts/character-builder.js`;
- crear `packages/data-engine` para ids y catálogos normalizados;
- empezar a conectar el modulo Foundry actual con `packages/foundry-exporter`.

### Exportador ampliado

Se actualizo `packages/foundry-exporter/src/index.ts` para:

- construir items de clase desde `classing.classes`;
- construir feats de background, feats elegidas y features de clase;
- parsear spells con formato `NvX: Nombre`;
- emitir un payload Foundry mas cercano al prototipo actual, aunque todavia parcial.

### Data engine inicial

Se agrego `packages/data-engine` como primera capa de normalizacion.

Incluye:

- catalogo inicial de clases con aliases en ingles y español;
- catalogo inicial de razas;
- catalogo inicial de backgrounds;
- helpers para resolver labels del prototipo a ids canonicos.

Impacto inmediato:

- `packages/domain` ahora puede resolver clases como `Bárbaro`, `Guerrero`, `Pícaro` y traducirlas a ids canonicos;
- eso reduce el riesgo de romper la migracion por el cambio entre labels del modulo actual y el modelo nuevo.

### Puente con el modulo actual

Se agrego `scripts/model-bridge.js` dentro del modulo Foundry actual.

Objetivo:

- producir un `CharacterBuild` canonico desde el `formData` legacy;
- guardar ese objeto dentro de `flags.bertinis-vault.canonicalBuild` al crear el actor;
- empezar a conectar el prototipo actual con la nueva arquitectura sin romper el flujo existente.

Estado:

- el actor todavia se construye con el builder legacy;
- pero ahora ya queda embebida una representacion canonica del personaje para la migracion futura.

### Preview export paralelo

Se agrego `scripts/foundry-export-bridge.js`.

Objetivo:

- derivar un payload Foundry-like desde `canonicalBuild`;
- guardarlo junto al actor legacy sin cambiar todavia el flujo de creacion real;
- poder comparar la salida vieja y la nueva durante la migracion.

Estado:

- el actor que se crea en Foundry sigue saliendo del builder viejo;
- pero ahora tambien se guarda `flags.bertinis-vault.canonicalFoundryPreview`;
- esa preview ya incluye abilities, HP, AC, clase, feats/features y spells derivadas del modelo canonico.

### Sustitucion progresiva del payload legacy

Se empezo a reutilizar la preview derivada del modelo canonico dentro de `scripts/character-builder.js`.

Partes que ahora salen del camino nuevo:

- `system.abilities`;
- `system.spells`;
- `system.attributes.ac`;
- `system.attributes.hp`;
- `system.attributes.spellcasting`;
- `system.details.alignment`;
- `system.details.biography`;
- `system.details.race`;
- `system.details.background`;
- `system.details.originalClass`;
- `system.details.trait`;
- `system.details.ideal`;
- `system.details.bond`;
- `system.details.flaw`;
- `system.traits.weaponProf`;
- `system.traits.armorProf`;
- items de tipo `class`;
- items de tipo `feat`;
- items de tipo `spell`;
- item de arma principal cuando puede resolverse desde la preview.

Partes que siguen en legacy por ahora:

- partes mas finas del `system`;
- secciones detalladas restantes de traits y token.

Motivo:

- mover primero las piezas mas seguras;
- reducir duplicacion;
- mantener el riesgo bajo mientras comparamos salidas.

### Inicio del frontend web

Se creo el scaffold inicial de `apps/web`.

Incluye:

- `package.json` y `tsconfig.json` propios;
- `index.html`;
- `src/main.tsx`;
- `src/App.tsx`;
- `src/styles.css`.

Estado:

- ya existe una base real para la web app fuera de Foundry;
- por ahora funciona como pantalla de producto y de estado del proyecto;
- el siguiente paso sera convertirla en builder por pasos conectado a `contracts` y `domain`.

### Primer builder web interactivo

Se transformo `apps/web` desde una pantalla estatica a un builder inicial con estado local.

Incluye:

- pasos navegables;
- datos de identidad;
- raza, clase y nivel;
- atributos editables;
- personalidad basica;
- preview viva de character summary.

Estado:

- ya no es solo scaffold;
- ya existe una primera experiencia real de builder web;
- el siguiente paso sera conectarlo al modelo canonico compartido y ampliar opciones del personaje.

### Snapshot canónico en web

Se agrego `apps/web/src/builder.ts` para derivar un snapshot canonico desde el estado del builder.

Impacto:

- la web ya no solo edita campos visuales;
- ahora tambien muestra una representacion estructurada del personaje;
- eso acerca la UI web al `CharacterBuild` que ya usa la arquitectura nueva.

### Ampliacion del builder web

Se agregaron decisiones nuevas al flujo web:

- background;
- feat destacada;
- arma principal;
- proteccion/armor.

Impacto:

- el builder ya se parece mas a un creador real de personaje;
- el snapshot canonico web ahora incluye mas decisiones relevantes;
- la siguiente capa natural sera spells, features y una sheet visual mas completa.

### Magia y features en web

Se agregaron al builder web:

- cantrips;
- spells por linea;
- features por linea.

Impacto:

- el flujo web ya cubre una porcion mucho mas realista del personaje;
- el snapshot canonico ahora incluye magia y rasgos editables;
- el siguiente paso natural es convertir la preview en una sheet visual mas parecida al producto final.

### Preview elevada a character sheet

Se mejoro la preview lateral del builder web para que se parezca mas a una sheet final.

Ahora incluye:

- seccion de build;
- tags de background, feat y equipo;
- bloques de magia;
- bloques de features;
- distribucion mas cercana a una hoja visual de personaje.

### Persistencia local del builder web

Se agrego guardado automatico del borrador del builder web en el navegador.

Ahora incluye:

- restauracion del personaje al recargar la pagina;
- guardado local automatico al cambiar campos;
- reinicio rapido del borrador desde la interfaz.

Impacto:

- la web ya no se siente como una demo descartable;
- permite iterar un personaje sin perder progreso al refrescar;
- deja lista una base simple para futuras capas de autosave real o cuentas de usuario.

### Export inicial desde la web

Se agrego una primera salida util del personaje directamente desde el builder web.

Ahora incluye:

- copia del snapshot canonico al portapapeles;
- descarga del personaje como archivo `.canonical.json`;
- estado visual simple para confirmar si la exportacion salio bien.

Impacto:

- el builder web ya produce una salida portable;
- acerca la web al flujo real de exportacion futura hacia Foundry;
- deja una base simple para agregar exportadores mas adelante sin rehacer la UI.

### Preview Foundry desde la web

Se conecto el builder web con el exportador Foundry compartido del workspace.

Ahora incluye:

- snapshot web mas alineado al contrato canonico del proyecto;
- generacion de preview de actor Foundry desde la misma UI;
- copia y descarga del payload inicial de actor.

Impacto:

- la web ya no exporta solo el formato interno;
- acerca mucho mas el builder al flujo final de Foundry;
- reduce la distancia entre la experiencia web y el modulo actual.

### Payload Foundry mas rico en la capa compartida

Se reforzo el exportador Foundry compartido para producir un actor mas completo.

Ahora incluye:

- biografia y detalles descriptivos dentro de `system.details`;
- proficiencias de armas y armaduras dentro de `system.traits`;
- arma principal reconocida como item de tipo `weapon`.

Impacto:

- la preview Foundry web se parece mas al actor real esperado;
- el exportador compartido absorbe logica que antes vivia solo en el puente legacy;
- prepara mejor el terreno para reemplazar piezas del modulo actual con la capa nueva.

### Biografia completa en el builder web

Se completo la captura de personalidad y notas dentro del builder web.

Ahora incluye:

- bond;
- flaw;
- notes;
- y reflejo de esos campos en la preview de personaje.

Impacto:

- el `CharacterBuild` web alimenta mejor la biografia canonica;
- la salida hacia Foundry ya puede aprovechar mas campos narrativos;
- la sheet web empieza a sentirse mas cercana a una character sheet real.

### Preview local lista para web

Se preparo `apps/web` para levantarse con un preview local real usando Vite.

Ahora incluye:

- script `dev` para desarrollo local;
- script `preview` para revisar el build;
- configuracion `vite.config.ts`;
- comandos documentados en el README del frontend.

Impacto:

- ya no dependemos de imaginar la UI solo leyendo codigo;
- el equipo puede abrir la web localmente mucho mas rapido;
- acelera validacion visual y futuras iteraciones de diseño.

### Aliases de workspace para preview web

Se ajusto Vite para resolver los paquetes internos del monorepo directo desde `src` en desarrollo.

Ahora incluye:

- alias para `@bertinis-vault/contracts`;
- alias para `@bertinis-vault/domain`;
- alias para `@bertinis-vault/foundry-exporter`.

Impacto:

- la web puede levantar en modo dev sin exigir builds previos de cada paquete;
- reduce friccion para revisar la UI localmente;
- mejora el flujo diario de trabajo del proyecto.

### Calculo de AC mas realista en la capa compartida

Se mejoro la derivacion del personaje para que tenga en cuenta mejor la proteccion elegida.

Ahora incluye:

- catalogo inicial de armaduras compartido en `data-engine`;
- deteccion de armadura y escudo desde `choices.equipment`;
- uso de `derived.ac` dentro de la sheet web.

Impacto:

- la web y Foundry quedan mas alineados en defensa real del personaje;
- el dominio deja de asumir siempre `10 + DEX`;
- seguimos moviendo reglas concretas al motor compartido del proyecto.

### Catalogo de armas compartido

Se movio la informacion basica de armas a `data-engine` para evitar duplicacion.

Ahora incluye:

- catalogo inicial de armas reutilizable;
- resolucion y busqueda compartida de armas;
- uso del catalogo desde la UI web y desde el exportador Foundry.

Impacto:

- web y exportador comparten la misma fuente de verdad para armas;
- baja el riesgo de que una opcion exista en la UI pero no se exporte bien;
- seguimos consolidando reglas y datos fuera de capas aisladas.

### Base inicial de `apps/api`

Se abrio la base del backend/BFF para empezar a formalizar la relacion con 5etools.

Ahora incluye:

- scaffold del servicio API;
- endpoint de salud;
- endpoint de opciones del builder usando datasets compartidos;
- cliente base configurado para la API de 5etools en Render.

Impacto:

- la estrategia de datos deja de ser solo conceptual;
- empezamos a materializar el BFF que va a desacoplar web y fuentes externas;
- prepara el camino para sincronizaciones y proxies mas selectivos contra 5etools.

### Web conectada a datasets del BFF

Se dio el primer paso para que la UI deje de depender solo de imports locales.

Ahora incluye:

- carga de opciones del builder desde `apps/api`;
- fallback automatico a datasets locales si la API no esta disponible;
- estado visible en la UI para saber de donde vienen los datos;
- CORS basico habilitado para pruebas locales entre web y API.

Impacto:

- empezamos a usar el BFF como fuente de datos real del builder;
- la integracion con tu stack de Render/5etools ya tiene una ruta concreta;
- mantenemos estabilidad local aunque la API todavia no este arriba.

### Proxy selectivo hacia 5etools

Se agrego la primera ruta de upstream controlado dentro de `apps/api`.

Ahora incluye:

- `GET /upstream/json?path=...`;
- validacion de prefijos permitidos;
- cache en memoria para respuestas del upstream;
- estado enriquecido en `/upstream/status`.

Impacto:

- el BFF ya puede consultar tu API de Render sin exponer directamente toda la UI al upstream;
- empezamos a tener una base real para sincronizaciones o lecturas selectivas de 5etools;
- mantenemos una integracion controlada en vez de llamadas crudas desde frontend.

### Feats dentro del flujo de datasets

Se saco la lista de feats del hardcodeo local de la web y se paso a la capa de datos compartida.

Ahora incluye:

- catalogo inicial de feats en `data-engine`;
- inclusion de feats en `apps/api/src/builder-options.ts`;
- consumo de feats desde `builder-options` en la UI web.

Impacto:

- el builder web depende menos de listas embebidas en componentes;
- la arquitectura de datos del builder queda mas consistente;
- deja mejor preparado el terreno para enriquecer feats desde upstream o datasets versionados.

### Endpoints semanticos para datasets del BFF

Se dio un paso mas en `apps/api` para pasar de rutas generales a rutas de producto mas claras.

Ahora incluye:

- `GET /datasets/meta`;
- `GET /datasets/classes`;
- `GET /datasets/races`;
- `GET /datasets/backgrounds`;
- `GET /datasets/feats`;
- `GET /datasets/equipment`.

Impacto:

- el BFF ya empieza a parecer una API del producto y no solo un proxy o agregador ad hoc;
- deja la web mejor preparada para consumir datasets de forma mas granular;
- ordena el backend para futuras mezclas entre curado local y upstream de 5etools.

### Web consumiendo datasets granulares

La carga de opciones del builder web ya no depende de un solo endpoint agregado.

Ahora incluye:

- carga separada de `meta`, `classes`, `races`, `backgrounds`, `feats` y `equipment`;
- recomposicion local del payload de opciones;
- misma politica de fallback local si la API no responde.

Impacto:

- la web queda lista para evolucionar datasets por categoria;
- el frontend empieza a parecerse mas al flujo real de producto;
- prepara mejor la integracion futura con upstream semantico desde 5etools.

### Backgrounds con modo local/upstream/hibrido

Se convirtio `backgrounds` en el primer dataset semantico preparado para mezclar curado local con upstream.

Ahora incluye:

- `source=local|upstream|hybrid` en `GET /datasets/backgrounds`;
- normalizacion flexible del payload externo;
- merge local/upstream para modo hibrido;
- fallback limpio a local cuando upstream no responde.

Impacto:

- el BFF ya tiene una primera ruta de integracion real, no solo teórica, con 5etools;
- valida el enfoque de mezclar estabilidad local con datos externos;
- abre el camino para repetir el mismo patron en clases, feats, spells y equipo.

### Feats con modo local/upstream/hibrido

Se repitio el mismo patron de integracion semantica para feats.

Ahora incluye:

- `source=local|upstream|hybrid` en `GET /datasets/feats`;
- normalizacion flexible del payload externo;
- merge local/upstream para modo hibrido;
- fallback limpio a local si el upstream falla.

Impacto:

- confirmamos que el patron del BFF no depende de una sola categoria;
- el builder gana otra categoria lista para enriquecerse desde 5etools;
- seguimos convirtiendo el backend en una capa de producto real.

### Classes con modo local/upstream/hibrido

Se aplico el mismo patron de integracion controlada a la categoria de clases.

Ahora incluye:

- `source=local|upstream|hybrid` en `GET /datasets/classes`;
- normalizacion flexible del payload externo;
- merge local/upstream para modo hibrido;
- fallback limpio a local cuando el upstream no responde.

Impacto:

- reforzamos una de las categorias mas importantes del builder;
- acercamos el BFF a un consumo mas real de 5etools sin perder estabilidad;
- dejamos lista una base mas solida para conectar web y exportacion a clases enriquecidas.
- la web ahora puede empezar a consumir `classes`, `backgrounds` y `feats` en modo hibrido desde el BFF.

### Resolucion compartida y builds del monorepo

Se corrigio un hueco importante de tooling que estaba frenando compilaciones reales del workspace.

Ahora incluye:

- alias comun para `@bertinis-vault/data-engine` en Vite y `tsconfig.base.json`;
- `apps/api` compila su dependencia `data-engine` antes de construir;
- verificacion positiva de build para `@bertinis-vault/api` y `@bertinis-vault/web`.

Impacto:

- el repo queda bastante mas sano para seguir iterando sin romper compilacion;
- la integracion nueva de datasets hibridos ya no vive solo en teoria;
- reducimos friccion para previews, builds locales y proximas validaciones.

### Races con modo local/upstream/hibrido

Se extendio el mismo patron hibrido a la categoria de razas.

Ahora incluye:

- `source=local|upstream|hybrid` en `GET /datasets/races`;
- normalizacion flexible del payload externo;
- merge local/upstream para modo hibrido;
- consumo del modo hibrido desde la web.

Impacto:

- completamos otra de las selecciones centrales del builder;
- la web ya depende menos de catalogos puramente locales;
- seguimos acercando la experiencia final a una integracion real con tu API de 5etools.

### Equipment con modo local/upstream/hibrido

Se aplico el mismo patron al catalogo de equipo para armas y armaduras.

Ahora incluye:

- `source=local|upstream|hybrid` en `GET /datasets/equipment`;
- normalizacion flexible del payload externo de items;
- merge local/upstream para armas y armaduras;
- consumo del modo hibrido desde la web.

Impacto:

- el builder queda mejor alineado con AC, armas y exportacion Foundry;
- reducimos mas la dependencia de catalogos puramente embebidos;
- preparamos mejor el terreno para una hoja visual y una exportacion mas fieles.

### Spells con modo local/upstream/hibrido

Se sumo una primera capa semantica para magia dentro del BFF y el builder web.

Ahora incluye:

- `GET /datasets/spells?source=local|upstream|hybrid`;
- catalogo compartido inicial de cantrips y spells;
- normalizacion flexible del payload externo;
- sugerencias rapidas de magia en la UI web.

Impacto:

- el builder gana una base mas real para la parte magica del personaje;
- acercamos la hoja y la exportacion a Foundry a un flujo mas creible;
- dejamos listo el terreno para pasar luego de texto libre a seleccion mas estructurada.

### Seleccion estructurada inicial de magia en web

Se dio el siguiente paso en la UX del builder: la magia ya no depende solo de escribir texto manualmente.

Ahora incluye:

- chips visibles para cantrips y spells seleccionados;
- agregar desde sugerencias rapidas con deduplicacion;
- quitar picks directamente desde la UI;
- sincronizacion con el texto que ya usa el snapshot canonico.

Impacto:

- el builder se siente menos como demo y mas como herramienta real;
- mantenemos compatibilidad con el modelo actual sin rehacer todo el flujo;
- preparamos la transicion a seleccion estructurada tambien para features y equipo.

### Equipo extra estructurado en web

Se expandio la seccion de elecciones para soportar mas que arma principal y proteccion.

Ahora incluye:

- catalogo compartido inicial de gear/adventuring equipment;
- `gear` dentro de `/datasets/equipment`;
- chips para equipo extra seleccionado;
- sugerencias rapidas y texto sincronizado para mantener compatibilidad con el snapshot actual.

Impacto:

- el personaje web ya se parece mas a una hoja real con inventario base;
- mejoramos la fidelidad del `CharacterBuild` sin romper el flujo existente;
- dejamos mucho mejor preparado el salto a exportacion Foundry mas completa.

### Exportacion Foundry mas cercana a actor real

Se reforzo el exportador compartido para que la salida hacia Foundry deje de depender solo de clase, feats, spells y un arma principal.

Ahora incluye:

- item de armadura/equipo defensivo cuando corresponde;
- items de gear/loot para equipo extra del personaje;
- conteo visible de items generados dentro de la preview web.

Impacto:

- la exportacion empieza a parecerse mas a un actor utilizable en Foundry;
- el trabajo reciente sobre `choices.equipment` ya se refleja en el destino final;
- reducimos la distancia entre builder web y export real del personaje.

### Features estructuradas en web

Se aplico el mismo enfoque de seleccion visible y sugerida a los rasgos del personaje.

Ahora incluye:

- chips de features seleccionadas;
- sugerencias segun clase, background y feat;
- agregar/quitar sin romper la compatibilidad con `featuresText`.

Impacto:

- el builder gana otra capa de estructura por encima del texto libre;
- los rasgos del personaje quedan mas claros y mas faciles de revisar;
- seguimos acercando la experiencia al comportamiento de un builder real.

### Actor Foundry con estructura mas completa

Se reforzo el exportador compartido para que el actor exportado se acerque mas al formato completo de Foundry dnd5e.

Ahora incluye:

- `prototypeToken`;
- `_stats`, `ownership` y `folder`;
- `currency`, `bonuses`, `skills`, `tools`, `resources` y `favorites`;
- atributos adicionales de actor que antes no estaban presentes en la salida compartida.

Impacto:

- la exportacion web deja de parecer un preview minimo y se acerca mas a un actor listo;
- reducimos la brecha entre el builder nuevo y el flujo legacy del modulo;
- mejora la base para una importacion mas confiable dentro de Foundry.

### Exportacion Foundry con salvaciones y pericias base

Se mejoro el exportador compartido para que el actor resultante respete mejor competencias basicas del personaje.

Ahora incluye:

- proficiencias de salvacion derivadas por clase principal;
- pericias base derivadas por background clasico;
- lectura de `choices.proficiencies` para futuras selecciones mas estructuradas;
- `system.skills` menos vacio y mas cercano a un actor util en Foundry.

Impacto:

- el actor exportado refleja mejor lo que el personaje sabe hacer;
- reducimos una diferencia importante entre "personaje armado" y "actor realmente jugable";
- dejamos preparada la base para exponer estas elecciones con mas detalle en la UI mas adelante.

### Puente legacy alineado con la nueva exportacion

Se actualizo el puente del modulo actual para aprovechar mejor lo que ya sabe el exportador compartido.

Ahora incluye:

- `skills` provenientes de la preview canonica;
- `bonuses`, `tools`, `resources` y `favorites` reutilizados desde la capa nueva cuando existen;
- mejor continuidad entre el actor creado hoy en Foundry y la estructura del exportador compartido.

Impacto:

- el flujo legacy empieza a beneficiarse de la nueva logica sin esperar una migracion total;
- reducimos divergencias entre "lo que exporta la web" y "lo que crea el modulo";
- damos otro paso hacia una unica fuente de verdad para el actor Foundry.

### Lenguajes y tools dentro del flujo de exportacion

Se extendio el builder web y el exportador para que competencias mas finas viajen hasta Foundry.

Ahora incluye:

- campos visibles para `skills/tools` y `lenguajes` en el builder web;
- sugerencias rapidas para cargar esas elecciones sin depender solo de texto libre;
- serializacion de lenguajes dentro de `choices.proficiencies`;
- separacion en exportacion hacia `system.skills`, `system.tools` y `system.traits.languages`;
- alineacion del bridge legacy para interpretar esos mismos datos.

Impacto:

- el personaje exportado se parece mas a un actor jugable y menos a un esqueleto;
- cerramos mejor el bloque de "tools y demas" que faltaba en la ficha;
- dejamos lista la base para futuras validaciones mas estrictas de background, clase y elecciones de proficiencia.

### Baseline de tests compartidos y docs de continuidad

Se reforzo la continuabilidad del repo para futuras iteraciones humanas o de IA.

Ahora incluye:

- tests reales en `packages/contracts`, `packages/data-engine`, `packages/domain` y `packages/foundry-exporter`;
- limpieza de imports cruzados que apuntaban directo a `src/` de otros paquetes;
- nueva matriz de migracion en `docs/MIGRATION-MATRIX.md`;
- nueva guia operativa para continuidad en `docs/AI-HANDOFF.md`;
- referencias desde el `README.md` a la documentacion clave de arquitectura, migracion y handoff.

Impacto:

- el repo deja de depender tanto de memoria tacita o relectura manual para retomar trabajo;
- la siguiente IA puede ubicar mas rapido el limite entre legado, transicion y capa compartida;
- mejora la base para seguir reemplazando el modulo legacy con el core compartido sin perder trazabilidad.

### Ajustes de build del workspace y compatibilidad ESM

Se corrigieron varios puntos que estaban frenando validaciones reales sobre los paquetes compartidos.

Ahora incluye:

- `tsconfig` de `packages/domain` y `packages/foundry-exporter` ajustados para consumir declaraciones compiladas de dependencias del workspace en lugar de resolver directo a `src`;
- `apps/web/tsconfig.json` alineado para typecheck contra declaraciones compiladas y tipos de Vite;
- imports relativos de los paquetes compartidos actualizados a sufijos `.js` para compatibilidad real con Node ESM al ejecutar `dist`;
- correcciones menores de strictness en dominio y exportador;
- limpieza e ignorado de artefactos generados accidentalmente dentro de `src/`.

Impacto:

- los paquetes compartidos ya compilan de forma mas predecible en el repo real;
- los tests de `contracts`, `data-engine`, `domain` y `foundry-exporter` pueden ejecutarse contra `dist` sin romper por resolucion ESM;
- baja bastante la friccion para que la siguiente IA valide cambios sin reencontrarse con el mismo set de problemas de tooling.

### Demo web orientada a financiadores

Se reposiciono la pantalla principal de `apps/web` para que funcione como demo compartible, sin perder el builder real debajo.

Ahora incluye:

- hero principal con narrativa de producto en lugar de foco puramente tecnico;
- tarjeta de snapshot del personaje con stats, tags y estado de exportacion;
- bloques de valor pensados para explicar builder, modelo canonico y salida a Foundry;
- preview de character sheet mas legible para compartir en capturas o reuniones;
- `showTechnicalView` para esconder JSON y detalle de diagnostico por defecto;
- bloque de entregables separado de la vista tecnica.

Impacto:

- la web deja de verse solo como herramienta interna y pasa a comunicar mejor el producto;
- se puede mostrar el proyecto a financiadores sin exponer inmediatamente el ruido de implementacion;
- queda mas claro para la siguiente IA que `apps/web` tiene doble funcion: demo visible y builder operativo.

### Flujo explicito para handoff de frontend e integracion

Se dejo preparado un carril de trabajo para dividir visual/frontend por un lado y validacion/build por otro.

Ahora incluye:

- scripts root `web:typecheck`, `web:build` y `web:verify`;
- uso explicito de `corepack pnpm` en scripts root para evitar fallos de entorno en Windows;
- nueva guia `docs/FRONTEND-INTEGRATION.md` con alcance, restricciones y secuencia de integracion;
- referencias en `docs/AI-HANDOFF.md` y `apps/web/README.md` a este flujo.

Impacto:

- la integracion de cambios visuales ya no depende de memoria o comandos sueltos;
- se reduce friccion al recibir trabajo de otra IA enfocada solo en frontend;
- el repo queda mejor preparado para iteraciones rapidas sobre la demo sin perder disciplina de validacion.

### Presets de demo y narrativa inicial reforzada

Se integraron aportes orientados a mejorar la primera impresion de la web para demos y reuniones.

Ahora incluye:

- `apps/web/src/demo-presets.ts` con presets `wizard`, `rogue` y `cleric`;
- hero inicial separado como componente local con CTA hacia builder y preview;
- barra de presets visible arriba del flujo principal;
- story block corto para explicar modelo, integracion y compartibilidad;
- captura `docs/web-demo-financiers.png` regenerada despues del cambio.

Impacto:

- la demo se puede mostrar con personajes mas intencionales y menos dependientes del estado que haya quedado guardado;
- mejora la narrativa de producto sin tocar la logica central del builder;
- queda una base mucho mejor para una futura segunda pasada puramente visual.

### Pulido seguro de seleccion de presets

Se hizo una pasada de refinamiento sin tocar la estructura central del builder.

Ahora incluye:

- preset activo visible dentro del hero principal;
- highlight visual del preset seleccionado;
- captura `docs/web-demo-financiers.png` regenerada despues del ajuste;
- cambios limitados a `apps/web/src/App.tsx` y `apps/web/src/styles.css` para mantener bajo el riesgo.

Impacto:

- la demo comunica mejor que hay escenarios listos para mostrar;
- se mejora la lectura de la home sin reabrir deuda de arquitectura;
- el flujo sigue siendo facil de validar con `corepack pnpm web:verify`.

### Resumen visible del preset activo

Se sumo una capa mas de lectura de demo arriba del builder para que el preset seleccionado no quede solo como un boton marcado.

Ahora incluye:

- bloque `ActivePresetSummary` debajo de la barra de presets;
- contexto rapido sobre el personaje de demo cargado;
- estados vacios mas claros en magia y rasgos dentro de la preview;
- captura de referencia actualizada otra vez en `docs/web-demo-financiers.png`.

Impacto:

- mejora la narrativa cuando se comparte la pantalla o una captura;
- baja la friccion para entender por que ese preset es util como demo;
- conserva el builder intacto mientras mejora el framing comercial.

### Character sheet inspirada en Foundry para la preview

Se adapto una nueva hoja visual para la columna de preview sin reemplazar la logica real del builder.

Ahora incluye:

- nuevo componente `apps/web/src/components/CharacterSheet.tsx`;
- integracion en `apps/web/src/App.tsx` alimentada por `state` y `canonicalSnapshot`, no por un mock paralelo;
- layout de ficha con header fuerte, stats en grilla, secundarios compactos y cards de magia/rasgos;
- acciones de export conectadas al snapshot canonico y al actor Foundry ya existentes;
- captura `docs/web-demo-financiers.png` actualizada para reflejar la nueva ficha.

Impacto:

- la preview se acerca mas al lenguaje visual de una hoja jugable;
- mejora el valor de la demo para mostrar producto, no solo formulario;
- la integracion mantiene intactos builder, datasets y exportador compartido.

### Comparativa procedural contra `ddimport.js`

Se incorporo una comparativa formal entre el pipeline de `ddimport.js` y el flujo actual de Bertini's Vault.

Ahora incluye:

- nuevo documento `docs/DDIMPORT-COMPARISON.md`;
- lectura de `ddimport.js` como benchmark operacional, no como plantilla de dominio;
- comparacion de etapas `entrada -> validacion -> normalizacion -> agregado -> transformacion -> persistencia -> post-proceso`;
- definicion de brechas concretas en nuestro servicio:
  - falta de preflight fuerte;
  - falta de un resolved export package;
  - falta de settings persistidos de import/export;
  - falta de una fase Foundry-side de sync/import realmente orquestada.

Impacto:

- el criterio para evolucionar `apps/foundry-module` queda mucho mas claro;
- futuras IAs ya no tienen que deducir desde cero que nos falta alrededor del exportador;
- la migracion deja de ser solo una lista de archivos y pasa a ser tambien una lista de etapas operacionales.

### CharacterSheet como preview principal real

Se corrigio la integracion visual de la ficha inspirada en Foundry para que deje de convivir con la preview vieja como duplicado.

Ahora incluye:

- `apps/web/src/components/CharacterSheet.tsx` como superficie principal de preview;
- reemplazo del bloque visual heredado por cards de soporte mas livianas;
- hoja central con acciones de export visibles y resumen secundario fuera de la ficha;
- validacion completa con `corepack pnpm web:verify`.

Impacto:

- la visual del builder ahora responde de verdad a la direccion de UI definida para la demo;
- desaparece la sensacion de que la ficha nueva estaba "montada arriba" de la preview anterior;
- futuras iteraciones visuales pueden trabajar sobre una sola hoja principal en vez de dos previews mezcladas.

### Simplificacion de la ruta principal del builder

Se removio la landing editorial intermedia que seguia viviendo dentro de la misma pantalla del builder.

Ahora la ruta principal queda mucho mas cerca del esquema trabajado para frontend:

- hero;
- presets;
- resumen de preset activo;
- story block;
- `builder + character sheet` como superficie principal.

Impacto:

- baja la friccion visual entre demo comercial y builder real;
- la pagina ya no compite con una segunda landing dentro de la misma ruta;
- la ficha y el builder quedan como protagonistas reales de la experiencia.

### Simplificacion del lenguaje visual general

Se aplico una pasada de simplificacion visual usando como referencia directa los bloques segmentados de frontend.

Ahora incluye:

- tipografia general sans-serif para toda la pagina;
- `CharacterSheet` mas cercana al componente de referencia;
- presets con copy actualizado y acentos visibles;
- overrides en `styles.css` para llevar hero, presets, layout principal y sheet a una lectura mas simple.

Impacto:

- la pagina se aleja del look editorial pesado y se acerca a un producto mas directo;
- la ficha queda mejor alineada con la estructura entregada para frontend;
- el builder sigue conectado al estado real pero con una presentacion menos barroca.

### Contratos canonicos reforzados

Se avanzo de forma deliberada sobre `packages/contracts` para acercar la capa canonica a una version realmente reusable y mas completa.

Ahora incluye:

- descomposicion del contrato en sub-schemas exportados:
  - `characterMetaSchema`
  - `identitySchema`
  - `ancestrySchema`
  - `classingSchema`
  - `backgroundSchema`
  - `abilitiesSchema`
  - `choicesSchema`
  - `derivedSchema`
- nuevo `characterBuildInputSchema` para representar el build canonico antes de `derived`;
- nueva capa opcional `choices.normalized` con colecciones estructuradas para:
  - feats
  - proficiencies
  - spells
  - equipment
  - features
- integracion de esos datos normalizados desde:
  - `apps/web/src/builder.ts`
  - `scripts/model-bridge.js`
- ajuste de `packages/domain/src/derive.ts` para validar entrada canonica tipada antes de derivar;
- tests ampliados en `packages/contracts/test/character-build.test.mjs`.

Impacto:

- el contrato canonico deja de ser solo un schema plano minimo y pasa a ser una base mas seria para evolucion futura;
- web y bridge legacy ya pueden poblar informacion estructurada sin romper consumidores actuales;
- se reduce el riesgo de que cada capa siga inventando su propia forma de representar spells, equipment y proficiencies.

### Exportador orientado a contrato estructurado

Se tomo una decision de mantenimiento importante: desde ahora el flujo compartido debe tratar `choices.normalized` como fuente principal cuando exista.

Ahora incluye:

- `packages/foundry-exporter/src/index.ts` actualizado para preferir:
  - `choices.normalized.proficiencies`
  - `choices.normalized.spells`
  - `choices.normalized.equipment`
  - `choices.normalized.features`
- arrays string-based mantenidos solo como fallback transicional;
- tests nuevos en `packages/foundry-exporter/test/index.test.mjs` para verificar que el exporter use la forma normalizada por encima del legado.

Impacto:

- la arquitectura ya no solo acepta el contrato enriquecido: tambien lo consume de verdad;
- mejora mantenimiento y escalabilidad porque el exporter deja de depender primero de labels sueltos;
- el siguiente tramo de migracion puede reducir strings legacy sin bloquear el runtime actual.

### Dominio como dueño de la normalizacion derivada

La siguiente consolidacion se hizo en `packages/domain`: la logica compartida para resolver elecciones canonicamente dejo de vivir duplicada dentro del exporter.

Ahora incluye:

- nuevo `packages/domain/src/choices.ts` con helpers compartidos para:
  - proficiencies por tipo (`skill`, `language`, `tool`)
  - spells normalizados o legacy
  - features normalizados o legacy
  - equipment normalizado o legacy
- exportacion de esa capa desde `packages/domain/src/index.ts`;
- tests nuevos en `packages/domain/test/choices.test.mjs` para cubrir prioridad de `choices.normalized` y fallback legacy;
- `packages/foundry-exporter/src/index.ts` simplificado para consumir esas derivaciones desde `@bertinis-vault/domain`.

Impacto:

- `packages/domain` pasa a ser realmente la capa de reglas y seleccion compartida, en vez de delegar esa responsabilidad al exporter;
- se reduce duplicacion entre capas y baja el riesgo de divergencia entre web, exporter y futuros procesos de import/sync;
- la siguiente etapa puede enfocarse en ids canonicos y reglas de progresion sin arrastrar parsing repetido en consumidores.

### Reutilizacion de metadata top-level del preview compartido

Se hizo otra pasada de convergencia sobre el runtime legacy de Foundry, esta vez en la envoltura del actor y no solo en `system` o `items`.

Ahora incluye:

- `scripts/character-builder.js` actualizado para preferir metadata top-level de `canonicalFoundryPreview`;
- reutilizacion de `name`, `type`, `img`, `prototypeToken`, `effects`, `folder`, `_stats` y `ownership` cuando la preview compartida ya los trae;
- merge de flags existentes del preview antes de agregar `bertinis-vault`, evitando reconstruir toda la envoltura del actor con defaults legacy.

Impacto:

- el actor creado por el runtime activo queda mas alineado con la salida del exporter compartido;
- baja otra fuente de divergencia silenciosa entre preview/export y actor real;
- deja mejor preparado el terreno para eliminar defaults legacy top-level en iteraciones futuras.

### Preflight reforzado contra duplicados canonicos

Se reforzo otra capa del pipeline de Stage A, esta vez sobre inconsistencias que no rompen el contrato estructural pero si degradan import/export y sincronizacion operativa.

Ahora incluye:

- `packages/domain/src/preflight.ts` actualizado para advertir:
  - feats otorgados duplicados en `background.grantedFeatIds`
  - feats elegidos duplicados en `choices.feats`
  - spells duplicados en `choices.normalized.spells`
  - equipment duplicado en `choices.normalized.equipment`
- nuevos tests en `packages/domain/test/preflight.test.mjs`;
- propagacion validada en `packages/foundry-exporter/test/index.test.mjs`.

Validacion ejecutada:

- `corepack pnpm --filter @bertinis-vault/domain build`
- `corepack pnpm --filter @bertinis-vault/foundry-exporter build`
- `node --test packages/domain/test/preflight.test.mjs`
- `node --test packages/foundry-exporter/test/index.test.mjs`

Impacto:

- el preflight detecta mejor duplicaciones que antes podian pasar como builds tecnicamente validas pero operativamente inconsistentes;
- sube la confiabilidad del pipeline compartido sin depender del runtime legacy para descubrir estos casos;
- Stage A queda mas cerca de una linea defensible para import/export repetible.

### Runtime Foundry prioriza preview canonica al crear actores

Se hizo un cambio importante en el flujo activo de importacion: el runtime Foundry ya no depende solamente del ensamblado final de `buildActor(...)` para crear el actor real.

Ahora incluye:

- `scripts/vault-app.js` actualizado para detectar `flags['bertinis-vault'].canonicalFoundryPreview` en la salida de `buildActor(...)`;
- cuando esa preview existe, `Actor.create(...)` usa la preview canonica como base real del actor;
- los flags enriquecidos del runtime legacy se mergean sobre la preview compartida para no perder metadata operacional ni trazabilidad;
- se mantiene fallback completo a `buildActor(...)` si la preview canonica no estuviera disponible.

Validacion ejecutada:

- `node --check scripts/vault-app.js`
- `node --check scripts/character-builder.js`

Impacto:

- el runtime activo queda mas cerca del exporter compartido, no solo la previsualizacion;
- baja otro tramo de divergencia entre lo que se valida/exporta y lo que finalmente se crea en Foundry;
- este cambio empuja de verdad la transicion desde Stage A hacia Stage B, porque reduce el peso del ensamblado legacy en el camino critico real.

### Wrapper legacy usa la preview como sistema principal

Se dio otro paso de Stage B para que `scripts/character-builder.js` deje de comportarse como una segunda implementacion completa del actor.

Ahora incluye:

- `scripts/character-builder.js` actualizado para usar `previewActor.system` como fuente principal cuando la preview canonica ya existe;
- el objeto local extendido queda como `fallbackSystem`, no como camino preferido;
- nuevo documento estable `docs/PROJECT-STATUS.md` para dejar una foto resumida del proyecto, porcentajes y proximos pasos en caso de corte del hilo.

Validacion ejecutada:

- `node --check scripts/character-builder.js`

Impacto:

- baja todavia mas el peso real del ensamblado legacy dentro del wrapper;
- formaliza mejor la transicion hacia un `character-builder` de compatibilidad y metadata, no de ensamblado principal;
- deja una referencia de estado pensada para continuidad entre sesiones o ultimos mensajes.

### Runtime activo desacoplado de buildActor

Se completo otro salto importante de migracion: el runtime activo ya no necesita llamar a `buildActor(...)` para crear actores en Foundry.

Ahora incluye:

- `scripts/vault-app.js` actualizado para construir el actor real desde `canonicalBuild` + `buildFoundryActorPreview(...)`;
- enriquecimiento de flags directamente en el runtime con:
  - `canonicalBuild`
  - `canonicalFoundryPreview`
  - `canonicalPreflight`
  - `createdBy`
  - `version`
- `scripts/character-builder.js` convertido efectivamente en wrapper de compatibilidad que devuelve la preview canonica enriquecida;
- `docs/PROJECT-STATUS.md` actualizado para reflejar `Stage B` en `90%`.

Validacion ejecutada:

- `node --check scripts/vault-app.js`
- `node --check scripts/character-builder.js`

Impacto:

- el camino activo de creacion de actor ya es shared-first, no legacy-first;
- `buildActor(...)` deja de ser pieza critica del runtime y pasa a ser soporte de compatibilidad;
- Stage B sube de forma material porque la propiedad real del ensamblado ya esta en el carril canonico compartido.

### Stage C arranca con beta framing y checklist de release

Se empezo Stage C con entregables visibles y reutilizables, no solo con notas de backlog.

Ahora incluye:

- nueva seccion `BetaReadinessSection` en `apps/web/src/App.tsx` con:
  - porcentajes por stage
  - framing ejecutivo del estado del proyecto
  - checklist visible de base para beta
- estilos nuevos en `apps/web/src/styles.css` para esa superficie;
- nuevo documento `docs/BETA-RELEASE-CHECKLIST.md` con criterio de salida y validaciones recomendadas;
- `docs/PROJECT-STATUS.md` actualizado para reflejar `Stage C` en `55%`.

Validacion ejecutada:

- `corepack pnpm web:typecheck`
- `corepack pnpm --filter @bertinis-vault/web build`

Impacto:

- la demo web ya comunica mejor el estado real del producto, no solo la build puntual;
- el proyecto gana una base concreta para beta sharing y handoff con terceros;
- Stage C deja de ser solamente polish futuro y pasa a tener artefactos reales de release.

### Stage C suma alcance soportado y release notes

Se agrego otra capa de presentacion util para beta, enfocada en compartir el proyecto sin depender de explicacion oral constante.

Ahora incluye:

- nueva `BetaScopeSection` en `apps/web/src/App.tsx` con:
  - alcance soportado
  - riesgos honestos
  - framing mas claro para viewers y testers
- estilos asociados en `apps/web/src/styles.css`;
- nuevo documento `docs/BETA-RELEASE-NOTES.md`;
- `docs/PROJECT-STATUS.md` actualizado para reflejar `Stage C` en `70%`.

Validacion ejecutada:

- `corepack pnpm web:typecheck`
- `corepack pnpm --filter @bertinis-vault/web build`

Impacto:

- la demo ya sirve mejor como superficie de sharing con terceros;
- el proyecto gana material concreto para tester onboarding y release communication;
- Stage C sube con entregables reales, aunque todavia depende de validacion manual Foundry y una pasada final de anuncio/release.

### Stage C suma artefactos para cierre operativo

Se preparo el ultimo tramo de Stage C con documentos ejecutables para que la salida beta no dependa de recordatorio manual.

Ahora incluye:

- nuevo `docs/FOUNDRY-MANUAL-VALIDATION.md` con escenarios y criterio de salida para la pasada manual en Foundry;
- nuevo `docs/BETA-ANNOUNCEMENT-TEMPLATE.md` con version corta y larga del anuncio beta;
- `docs/PROJECT-STATUS.md` actualizado para reflejar `Stage C` en `80%`.

Impacto:

- el tramo restante de Stage C queda mucho mas operacionalizado;
- ya no faltan tanto artefactos, sino ejecucion final de validacion y anuncio;
- el proyecto queda mejor preparado para continuidad si el cierre beta lo hace otra sesion o colaborador.

### Stage C suma captura y feedback para testers

Se preparo otra parte del cierre beta enfocada en sharing y recepcion de feedback.

Ahora incluye:

- nuevo `docs/DEMO-CAPTURE-GUIDE.md` con la lista minima de capturas y reglas visuales;
- nuevo `docs/TESTER-FEEDBACK-TEMPLATE.md` para ordenar hallazgos de testers;
- `docs/PROJECT-STATUS.md` actualizado para reflejar `Stage C` en `85%`.

Impacto:

- el ultimo tramo de beta queda menos dependiente de coordinacion oral;
- mejora la capacidad de compartir el proyecto y recoger feedback util de forma consistente;
- el gap restante hasta `90%` ya depende casi por completo de ejecutar la validacion manual y la pasada final de release.

### Stage C queda formalmente preparado para cierre y siguiente etapa

Se completo la preparacion repo-side de Stage C y se definio la etapa siguiente para evitar un vacio de roadmap despues del beta.

Ahora incluye:

- nuevo `docs/BETA-SIGNOFF.md` para cerrar la etapa con un registro claro;
- nuevo `docs/POST-BETA-HARDENING.md` como siguiente etapa logica;
- `docs/PROJECT-STATUS.md` actualizado para reflejar `Stage C` en `90%`.

Impacto:

- Stage C queda completo desde el lado de preparacion del repo;
- lo que falta ya es ejecucion de los pasos finales, no ausencia de materiales;
- el proyecto tiene continuidad clara hacia una etapa post-beta enfocada en findings, deuda legacy y regresiones.

### Limpieza fuerte del wrapper legacy

Se hizo una pasada de limpieza fuerte sobre `scripts/character-builder.js`, que venia arrastrando una gran cantidad de ensamblado inalcanzable desde que el runtime activo dejo de depender de esa ruta.

Ahora incluye:

- `scripts/character-builder.js` reescrito como wrapper minimo;
- eliminacion del bloque legacy muerto de armado de actor, items, system y token que ya no participaba del camino activo;
- mantenimiento de compatibilidad a traves de:
  - `abilityMod(...)`
  - `calculateAC(...)`
  - `buildActor(...)` como wrapper canonico enriquecido

Validacion ejecutada:

- `node --check scripts/character-builder.js`
- `node --check scripts/vault-app.js`

Impacto:

- baja de forma material la deuda legacy mas ruidosa del repo;
- reduce confusion futura al dejar mas claro que `character-builder.js` ya no es una segunda implementacion completa;
- prepara mejor el terreno para pasar del cleanup interno al trabajo de superficie web/producto.

### Superficie web muestra el paquete beta completo

Despues de la limpieza de bridges y codigo muerto, se avanzo sobre el area web para mejorar la presentacion del proyecto como paquete compartible.

Ahora incluye:

- nueva `BetaPackageSection` en `apps/web/src/App.tsx`;
- estilos asociados en `apps/web/src/styles.css`;
- esa seccion resume de forma visible:
  - release notes
  - validation guide
  - capture guide
  - tester feedback

Validacion ejecutada:

- `corepack pnpm web:typecheck`
- `corepack pnpm --filter @bertinis-vault/web build`
- `node --check scripts/character-builder.js`

Impacto:

- la demo ya comunica no solo el producto, sino tambien el material de release disponible;
- mejora el valor de sharing para colaboradores, testers y stakeholders;
- conecta mejor la limpieza tecnica previa con una superficie mas lista para uso real.

### Reestructuracion fuerte del frontend compartible

Se hizo una pasada de producto sobre `apps/web` para que la demo deje de sentirse como una acumulacion de iteraciones y pase a leerse como una superficie mas cerrada y compartible.

Ahora incluye:

- `apps/web/src/App.tsx` reordenado alrededor de:
  - hero de producto
  - builder overview
  - builder por pasos
  - sheet preview
  - deliverables y vista tecnica
- nuevo `apps/web/src/components/AppSections.tsx` para separar secciones de superficie y reducir el peso del archivo principal;
- `apps/web/src/components/CharacterSheet.tsx` rehecha para una lectura mas clara y una presentacion mas fuerte;
- `apps/web/src/styles.css` reemplazado por una capa visual mas consistente y sin acumulacion de overrides viejos;
- `apps/web/README.md` actualizado para reflejar la nueva estructura y expectativas de validacion.

Validacion ejecutada:

- `corepack pnpm web:typecheck`
- `corepack pnpm web:build`

Impacto:

- la home ya presenta mejor el valor del producto antes de entrar al detalle tecnico;
- el builder y la sheet quedaron mejor alineados visualmente;
- el frontend tiene una base mas mantenible para futuros pases de polish o captura de demo.

### Pipeline transicional unificado para Foundry

Se hizo una pasada puntual sobre la migracion legacy para sacar duplicacion entre entrypoints del runtime Foundry.

Ahora incluye:

- nuevo `scripts/foundry-pipeline.js` como ruta unica para:
  - derivar stats desde el form legacy;
  - construir `CharacterBuild`;
  - correr preflight;
  - producir el payload final de actor con flags canonicos;
- `scripts/vault-app.js` ahora usa esa misma ruta al crear actores;
- `scripts/character-builder.js` queda como wrapper fino en lugar de recalcular todo por su cuenta.

Validacion prevista:

- `node --check scripts/foundry-pipeline.js`
- `node --check scripts/character-builder.js`
- `node --check scripts/vault-app.js`

Impacto:

- baja el drift entre el creador Foundry activo y el wrapper legacy;
- evita que el actor final dependa de dos implementaciones paralelas del mismo pipeline canonico;
- mejora de forma real la seccion de migracion porque la ultima milla transicional ahora tiene una sola ruta de armado.

### Congelamiento del camino a MVP y handoff para el siguiente DEV

Se hizo una pasada de orientacion para que el repo deje de apuntar a prioridades antiguas y el siguiente DEV entre directo al trabajo correcto para MVP.

Ahora incluye:

- `README.md` actualizado para declarar el foco MVP actual en vez de seguir priorizando slices historicos;
- handoff explicito para el siguiente DEV en el README raiz;
- `docs/PROJECT-STATUS.md` reordenado para poner la validacion manual de Foundry antes de mas expansion o cleanup;
- `docs/MVP-STEP-BY-STEP.md` ajustado para reflejar que el cuello de botella actual es confianza operativa, no falta de arquitectura.

Validacion ejecutada en esta pasada:

- `corepack pnpm verify:env`
- `corepack pnpm web:typecheck`
- `corepack pnpm web:build`
- `corepack pnpm --filter @bertinis-vault/api build`
- `corepack pnpm foundry:verify`

Impacto:

- el repo ahora comunica mejor que el siguiente paso real hacia MVP es probar en Foundry y endurecer contra evidencia;
- reduce el riesgo de que el siguiente DEV reabra rediseños o vuelva a dispersar prioridades;
- deja una entrada mas clara para cerrar MVP antes de pasar a post-beta hardening.

### Hardening rapido del API y del gate de CI para la deadline MVP

Se hizo una pasada corta y de alto impacto para reducir riesgo operativo antes de la validacion manual final en Foundry.

Ahora incluye:

- nuevos tests en `apps/api/test/server.test.mjs` para cubrir:
  - cache de `/upstream/json`;
  - fallback de datasets `hybrid` cuando el upstream falla;
  - respuestas `502` de datasets `upstream` cuando el upstream falla;
- `apps/api/src/server.ts` ahora permite tambien las rutas upstream legacy exactas usadas por defecto por el propio API (`/classes`, `/races`, `/backgrounds`, `/feats`, `/items`, `/spells`) ademas de los prefijos `/data/` y `/api/`;
- `.github/workflows/verify.yml` ahora exige:
  - `corepack pnpm web:verify`
  - `corepack pnpm --filter @bertinis-vault/api test`
  - ademas de los checks que ya existian.

Validacion ejecutada:

- `corepack pnpm --filter @bertinis-vault/api test`
- `corepack pnpm web:verify`
- `corepack pnpm foundry:verify`

Impacto:

- baja el riesgo de llegar a la demo/validacion manual con el API rompiendo solo cuando se usa `source=hybrid` o `source=upstream`;
- sube el piso del CI para que web y API queden cubiertos en cada push/PR;
- da una base bastante mejor para usar los 3 dias restantes en validacion real y no en descubrir regresiones evitables.

### Gate de release endurecido para no publicar un tag roto

Se hizo una pasada puntual sobre `.github/workflows/release.yml` para que publicar una release deje de depender de memoria humana o de un workflow demasiado liviano.

Ahora incluye:

- instalacion de dependencias con `pnpm` antes de empaquetar;
- ejecucion de `corepack pnpm mvp:verify` dentro del workflow de release;
- actualizacion de `module.json` y `package.json` con la version del tag;
- correccion de la ruta del ZIP adjunto en `softprops/action-gh-release`.

Impacto:

- baja mucho el riesgo de publicar un tag que no haya pasado el gate automatizado real del MVP;
- evita una falla silenciosa por adjuntar el archivo ZIP desde una ruta incorrecta;
- deja el camino de release mas alineado con la urgencia actual: validar primero, publicar despues.

### Release readiness ahora tambien exige evidencia humana

Se agrego un ultimo gate para que el repo no pueda publicar un tag solamente con verificacion automatizada.

Ahora incluye:

- nuevo `corepack pnpm release:ready`;
- nuevo `scripts/check-release-readiness.mjs`;
- `docs/FOUNDRY-MANUAL-VALIDATION-REPORT.md` con estados `pending` parseables;
- `docs/BETA-SIGNOFF.md` con `signoff status` y `decision` parseables;
- workflow de release ejecutando `corepack pnpm release:ready` despues de `corepack pnpm mvp:verify`.

Impacto:

- un tag ya no puede salir si la validacion manual sigue sin correr o si el signoff sigue incompleto;
- fuerza un cierre mas limpio de estos ultimos 3 dias: primero evidencia humana, despues publicacion;
- deja mensajes de fallo accionables en vez de depender de leer varios docs manualmente.

### Fix directo para import de actor Foundry y detalles de spells

Se hizo una pasada sobre los dos problemas mas cercanos al producto:

- actor JSON generado por Vault demasiado legacy para Foundry 13/dnd5e 5.x;
- detalles de spells cayendo en `Sin dato` aunque exista fuente upstream o catalogo local.

Ahora incluye:

- `packages/foundry-exporter/src/index.ts` exportando:
  - `system.abilities` con `max`, `check.roll` y `save.roll`;
  - `system.attributes.ac` con `calc` + `flat`;
  - `system.attributes.hp` con `temp`, `tempmax` y `bonuses`;
  - `system.spells` con objetos `{ value }` y bloque `pact` en vez de numeros planos;
- regresiones nuevas/actualizadas en `packages/foundry-exporter/test/index.test.mjs` para esa forma de actor;
- `apps/api/src/upstream-spells.ts` preservando mas metadata cuando el upstream la entrega;
- regresion nueva en `apps/api/test/server.test.mjs` para metadata rica de spells;
- `packages/data-engine/src/spells.ts` enriquecido con detalles concretos para spells MVP visibles y frecuentes como `Magic Missile`, `Shield`, `Mage Hand`, `Eldritch Blast`, `Misty Step`, `Fireball`, `Counterspell` y otros del flujo actual.

Validacion ejecutada:

- `corepack pnpm --filter @bertinis-vault/data-engine build`
- `corepack pnpm web:verify`
- `corepack pnpm --filter @bertinis-vault/api test`
- `corepack pnpm --filter @bertinis-vault/foundry-exporter test`
- `corepack pnpm mvp:verify`

Impacto:

- baja materialmente la brecha entre el actor exportado por Vault y el actor que Foundry genera nativamente;
- mejora la chance de que el JSON builder-importable deje de romper por forma de `system.*`;
- reduce el `Sin dato` en la UI para varios spells MVP incluso sin depender por completo del upstream;
- deja una mejor base para la siguiente comparacion directa contra el JSON real que reporto el usuario.
