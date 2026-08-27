# Migración del front — Faro del Alba a `apps/web`

Estado: **cableado hecho y verificado.** Falta cerrar tres huecos de mecánica y
reescribir ocho suites de test contra la API nueva.

El front que vivía suelto en `Downloads/bertinis-vault-front` — Puerta, Forja de
nueve cámaras, Códice con la Visión, Ritual — ahora es `apps/web`. El front
anterior queda en la historia de git; su último commit antes del traspaso es el
padre de éste.

## Por qué se hizo así

**El nombre del paquete no cambió.** Sigue siendo `@bertinis-vault/web`, así que
`vercel.json`, `web:verify`, `mvp:verify` y todos los scripts de la raíz siguen
funcionando sin tocarse. La preview de Vercel de este PR sirve el Faro sin que
producción se entere.

**Ningún import cambió.** El front suelto ya importaba los `@bertinis-vault/*`
bajo sus nombres reales, aliaseados al `dist/` del repo. Migrar fue borrar esos
alias y quedarse con los que `apps/web` ya tenía, que apuntan al `src/index.ts`
de cada paquete — mejor, porque editar un paquete se ve en el próximo reload sin
reconstruir.

## Verificación

| Comprobación | Resultado |
|---|---|
| `pnpm typecheck` | limpio |
| `pnpm test` | 78 de 78 |
| `pnpm build` | 567 módulos |
| `pnpm probe` (conformance del Faro) | **EXIT=0** — 154 casos, 0 cambian al sellar y reabrir |

**La prueba de que el producto no cambió:** el CSS compilado conserva el mismo
hash de contenido, `index-YQMBYcR5.css` (32.26 kB), desde antes de partir los
estilos hasta después de extraer las recetas. Vite hashea por contenido: si algo
visual se hubiera movido, ese nombre sería otro.

## Estilos, sectorizados

`globals.css` era un archivo de 79 líneas con cinco responsabilidades mezcladas.
Quedó partido, y `main.tsx` los importa en ese orden porque **el orden es la
cascada** — `base.css` pisa a propósito el preflight de Tailwind, así que tiene
que cargar después. Un `@import` dentro del CSS no serviría: la regla obliga a
que los `@import` precedan a todo lo demás, lo que invertiría la cascada.

| Archivo | Qué guarda |
|---|---|
| `styles/globals.css` | las tres directivas `@tailwind`, nada más |
| `styles/fonts.css` | el `@font-face` de Jim Nightshade |
| `styles/base.css` | ground, tipografía por defecto, selección, scrollbar |
| `styles/animations.css` | los `@keyframes` que la purga de Tailwind no vería inline |
| `styles/recipes.ts` | las 12 recetas de Tailwind que la interfaz repite |

**Criterio de `recipes.ts`:** entra lo que aparece **tres veces o más** *y*
carga una decisión de diseño. `flex flex-wrap gap-2` aparece cuatro veces y
queda inline a propósito — nombrar un idiom de layout lo esconde sin que nada
sea más fácil de cambiar. Se reemplazaron 49 usos en 12 archivos.

## Tareas

### Hecho

- [x] `git init` y commit del front suelto antes de mover nada
- [x] Rama `feat/faro-front`; `src/`, `probes/`, `public/`, `index.html`, configs de Tailwind y PostCSS dentro de `apps/web`
- [x] `package.json`: deps del Faro sumadas, los 6 paquetes siguen `workspace:*`
- [x] `vite.config.ts`: alias `@` sumado, alias de paquetes apuntando a `src/`
- [x] `tsconfig.json`: path `@/*`, `probes/` incluido, `test/pending` excluido
- [x] `.env` del front descartado: `apps/web/.env.production` ya traía el Worker desplegado
- [x] `globals.css` partido en cuatro; recetas extraídas
- [x] 169 tests corridos y triados contra los módulos del Faro
- [x] `dice.ts` arreglado por `noUncheckedIndexedAccess`
- [x] Tres `TS2375` de `exactOptionalPropertyTypes` arreglados sin tocar comportamiento

### Hecho después de la migración

Las suites se cerraron una por una, y cada una destapó un bug de producto —
ninguna era sólo un cambio de import.

- [x] **`spell-counts`** — las cuentas salían de `dnd5e-2014.ts`, que no recibe
      edición, así que todo lanzador 2024 recibía números de 2014. Un paladín
      2024 nivel 1 recibía cero conjuros en vez de 2.
- [x] **`subclass-spells`** — nada leía la subclase. Un Eldritch Knight abría el
      selector vacío, y **50 de 135 subclases en 2014 y 42 de 68 en 2024**
      perdían su lista ampliada: todos los dominios, juramentos y patrones.
- [x] **`feat-prerequisites`** — el Faro validaba talentos y no dotes. Con
      **143 de 168 dotes 2024** pidiendo algo, un personaje de nivel 1 podía
      tomarse un Epic Boon de nivel 19.
- [x] **`optional-features`** → reescrita como `talents.test.ts`, más
      `unmetTalents`: un talento que dejó de ser legal ahora se avisa.
- [x] **`origin-abilities`** — **los 60 trasfondos de 2024** declaran qué tres
      características admiten y el Faro no leía ninguno: el +2 de un Acólito
      podía ir a Fuerza.

### Pendiente, en orden

- [x] **Dote de origen del trasfondo** — se mostraba y nunca se registraba.
      59 de 60 trasfondos 2024 la otorgan. Ver `docs/AUDITORIA-CREACION.md`.

- [x] **Números de mesa: iniciativa, percepción pasiva, velocidad** —
      `src/lib/table-numbers.ts`, en la ficha viva. Límite conocido y fijado en
      el test: **ninguna de las 98 subrazas trae velocidad** en el índice, así
      que un elfo del bosque lee 30 y no 35.
- [x] **Aplicar el kit inicial.** `starting-equipment` no era API renombrada
      como decía el triaje: el Faro **imprimía** el equipo de clase como texto y
      el jugador tenía que buscar cada objeto a mano en la mochila. Ahora cada
      fila es una pregunta — lo concedido entra solo, lo elegible al contestar.
      `starting-kit.ts` + `StartingKit.tsx`, 14 tests.

      Al cablearlo salió un bug más viejo que el kit: **la mochila perdía las
      cantidades**. Es una caja de texto y una caja de texto no tiene columna
      para "cuántos", así que las dos hachas del bárbaro entraban como dos
      líneas iguales, `uniqueEntries` las colapsaba a una y
      `normalizeEquipmentEntry` estampaba `quantity: 1`. Las veinte flechas del
      explorador importaban a Foundry **como una flecha**. Arreglado en
      `gear-lines.ts`: una línea puede llevar la cuenta como ` x20`, las dos
      formas de escribir tres dagas suman igual, y `GearBag` pesa por cantidad.

      Queda fuera el **oro inicial** como alternativa al kit: `kitCopper` ya lo
      calcula y la UI lo muestra, pero `ImportPayload` no tiene campo de
      monedas, así que hoy se informa y no se exporta. Es la tarea "Oro
      inicial" de más abajo, y toca `packages/`.
- [ ] **Multiclase.** *La nota vieja decía que `deriveCharacterBuild` usa
      `classes[0]` y que por eso arreglar el front no alcanzaba. Medido: es
      falso.* `packages/domain/src/multiclass.ts` ya existe y `derive.ts`
      ramifica en `entries.length > 1` para PG (`:61`) y para espacios
      (`:111`). Ejecutado contra el dominio compilado:

      | Personaje | Dominio | A mano |
      | --- | --- | --- |
      | Guerrero 5 / Mago 3, CON +2 | 62 PG | 12 + 4×8 + 3×6 = 62 |
      | Guerrero 5 / Mago 3 | 4/2 espacios | nivel lanzador 3 |
      | Explorador 5 / Clérigo 1 | 4/2 espacios | ⌊5/2⌋ + 1 = 3 |

      Los 68 PG que la nota reportaba eran la rama de **una sola clase**
      (d10 a nivel 8), no un error del cálculo multiclase. El explorador es el
      caso que importa: solo contribuye 2, no los 3 que su propia tabla le da.

      Lo que falta es todo del lado del front: `BuilderState` tiene `classId`,
      `subclassId` y `level` en singular, así que la Forja no puede emitir más
      de una entrada. Por tramos:

      - [x] **Estado y payload.** `extraClasses` en el borrador, migración de
            los borradores viejos, emisión con `hitDie`, `casterProgression` y
            requisitos por clase (`classing.ts`, 15 tests + el spec parqueado
            desparqueado). Sin UI: `extraClasses` queda siempre vacío, así que
            ningún personaje existente cambia.

            Este tramo destapó un bug de la capa lógica: **un Caballero Arcano
            de una sola clase no lanzaba nada**. `derive.ts` pedía la
            característica de lanzamiento sólo si el personaje era multiclase,
            así que caía a la del guerrero — que es ninguna — y los espacios
            salían de la tabla del guerrero en vez de la fracción de un tercio.
            Arreglado en `packages/domain/src/derive.ts`; los fixtures de
            Foundry no cambiaron de contenido.
      - [ ] **UI para sumar y sacar una clase**, con los requisitos de
            característica (`unmetMulticlassRequirementsFor` ya está listo y
            probado). Va junto con el barrido de "nivel del personaje": hoy 33
            referencias leen `state.level`, que pasa a ser el nivel de la
            *primera clase*, y las que significan el nivel del personaje tienen
            que pasar a `characterLevelFor`. Los dos juntos, para que la
            inconsistencia no llegue a estar en pantalla.
      - [ ] **Lo que el multiclase *no* da.** Un jugador que suma una clase no
            recibe su equipo inicial ni sus salvaciones — sólo la tabla de
            competencias de multiclase. `multiclassGrantsFor` ya la lee del
            índice y está probada; falta que la Forja la use en lugar del
            bloque inicial.
- [ ] **Maestría de armas.** El Faro muestra la maestría de un arma pero no deja
      elegirla. Bloqueado además porque no se escribe al actor.
- [ ] **Expertise.** Nunca tuvo test. `normalizedProficiencyKindSchema` no tiene
      el kind, así que hoy se elegiría algo que nunca llega al payload.
- [ ] **Smoke test de la Forja** que reemplace a `builder-page.test.tsx`.
- [ ] **Cortar el bundle.** 2.03 MB, 312 kB gzip, en un solo chunk.
- [ ] **Modificadores de salvación y pericia en la ficha.** Se sabe *cuáles*
      tiene el personaje, no *cuánto* suma cada uno.
- [ ] **Oro inicial.** No se calcula, y `ImportPayload` no tiene campo de moneda.
- [ ] **Export/importar el Códice.** Los personajes viven sólo en `localStorage`.
      Se pierden al limpiar el navegador, en incógnito, o en otra máquina.

### Para seguir trabajando en el front

`corepack pnpm web:dev` levanta en `127.0.0.1:4173`. Los paquetes resuelven a su
`src/`, así que tocar `packages/domain` se ve sin reconstruir. Antes de un PR:
`corepack pnpm web:verify` y `corepack pnpm --filter @bertinis-vault/web probe`.

Para cambiar el aspecto: un color o una face es `styles/`; una receta repetida es
`styles/recipes.ts`; lo que aparece una sola vez sigue inline en su componente,
que es donde se lee mejor.
