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
- [x] **Multiclase.** *La nota vieja decía que `deriveCharacterBuild` usa
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
      - [x] **UI para sumar y sacar una clase** (`Multiclass.tsx`) y el
            barrido de nivel, los dos juntos. `state.level` ahora significa el
            nivel de la **primera clase**; el "Nivel N" de la ficha, el bono de
            competencia y el consejo pasaron a `characterLevelFor`, y la ficha
            parte la línea de clase — "Nivel 8 · Guerrero 5 / Mago 3".

            Los requisitos de dote leen ahora a todo el personaje: pasaban una
            sola clase, así que una dote que pide un rasgo de Lanzamiento de
            conjuros se le negaba a un guerrero 5 / mago 1 que sí lo tiene, y a
            un Caballero Arcano, que lanza aunque su clase no lance.

            Decisiones del panel, todas por "qué haría un jugador":
            cambiar la clase de una fila le borra la senda; los veinte niveles
            se reparten y el deslizador de la primera clase también se acota;
            los requisitos de característica se **informan**, no se niegan.
      - [x] **Lo que el multiclase da y lo que no.** Medido: el equipo inicial
            y las salvaciones ya salían sólo de la primera clase, así que esa
            mitad estaba bien sin saberlo. Faltaba la otra: lo que una segunda
            clase **sí** concede, que la Forja no daba en absoluto. Un toque de
            pícaro ofrece **una** pericia de su lista y herramientas de ladrón,
            no las cuatro que elige un pícaro de nivel 1.

            Sólo pericias y herramientas, que es lo que `proficiencyPlan`
            modela. Ver el hueco nuevo de abajo.
- [x] **Competencias de armadura y arma con más de una clase.** *La nota que
      escribí primero estaba mal en las dos mitades: dije que ningún personaje
      las recibe y que el índice trae el bloque inicial. Medido: el actor
      exportado sí las lleva — `foundry-exporter` tiene su propia tabla escrita
      a mano — y el índice **no** trae el bloque inicial, sólo el de
      multiclase.*

      El bug real era otro y más filoso: `fillProficiencies` leía `classes[0]`
      y nada más. **Un mago 4 / guerrero 1 exportaba sin ninguna competencia de
      armadura**, con las armas de un mago — un personaje que no puede equipar
      la armadura que lleva puesta. Arreglado sumando el bloque de multiclase
      de cada clase posterior, con tabla partida por edición sacada del índice.

      Lo que queda abierto de verdad es más chico: **la Forja no le muestra al
      jugador sus competencias de armadura y arma**. Llegan a Foundry, pero el
      constructor nunca se lo dice. `proficiencyPlan` sólo modela pericias y
      herramientas.

- [x] **`mvp:verify` no corría los tests de `foundry-exporter`.** Encontrado al
      agregarle tests: el paquete quedaba fuera de la lista del script y tenía
      un test rojo desde antes. Zanjado leyendo el `dnd5e.mjs` instalado
      (5.3.3): una herramienta guarda el nivel de competencia en `value`
      (`DND5E.ProficiencyLevel`) y **no existe** el campo `prof` — el test
      estaba viejo, el exportador bien. Test corregido y paquete metido en la
      puerta: 18 tests, `mvp:verify` en verde.

- [x] **Maestría de armas.** Vertical entera: contrato, estado, panel y
      exportador. La pieza que tenía que estar bien es el vocabulario —
      `traits.weaponProf.mastery.value` es un Set que dnd5e consulta con
      `has(item.type.baseItem)`, así que guarda **ids de arma base**:
      `longsword`, nunca "Longsword" y nunca la propiedad "Sap". Leído del
      `dnd5e.mjs` instalado (5.3.3), no de memoria.

      Minúsculas sin separadores mapea las 38 armas base del índice sobre los
      38 `weaponIds` de dnd5e sin fallar en ninguna dirección. El test fija las
      dos y nombra las once del índice que dnd5e no conoce como objeto base
      (armas de fuego modernas, la Hoja Psíquica, dos bastones), para que una
      nueva no aparezca en silencio.

      Reglas resueltas midiendo: con dos clases que la conceden se toma la más
      alta y no la suma; la restricción de cuerpo a cuerpo del bárbaro cede si
      otra clase que la concede no la tiene; los objetos mágicos no son opción
      aparte porque se domina el tipo de arma.
- [x] **Expertise (maestría).** *La nota decía que
      `normalizedProficiencyKindSchema` no tiene el kind. Medido: sí lo tiene,
      y `toolExpertise` también, e `ImportPayload` tiene el campo, y
      `packages/domain/src/expertise.ts` está entero — grants activos,
      validación de respuestas, el gate de variante de Deft Explorer.* **Nadie
      lo llamaba.** Era código muerto, no una pieza faltante.

      Cableado, entonces: los grants salen del índice (campo `expertise`), el
      pozo es lo que el personaje ya sabe hacer, las respuestas se guardan por
      clave de concesión — un pícaro responde la misma pregunta a nivel 1 y a
      nivel 6 — y se revisan en el orden en que se ganaron, cada una contra lo
      que las anteriores tomaron.

      La maestría viaja **al lado** de la competencia que dobla, nunca en su
      lugar. El exportador escribe `value = 2` en una segunda pasada y saltea
      —no promueve— una maestría sin competencia. La percepción pasiva la lee:
      es el número que la mesa juega sin tirar.
- [x] **Smoke test de la Forja** (`test/forge-smoke.test.tsx`, 8 casos). Cubre
      el primer arranque de verdad — la Forja pregunta el ritmo antes de abrir
      ninguna cámara —, el recorrido del riel, y cuatro personajes que
      ejercitan lo nuevo: guerrero 2024 con maestría, pícaro con expertise, y
      un multiclase que tiene que pintar "Nivel 8" y no "Nivel 5".

      Al escribirlo salieron dos cosas. Los botones del riel **no tenían nombre
      accesible**: leídos en voz alta eran una fila de botones sin nombre.
      Y se leyó por fin el spec parqueado de maestría de armas, que **no se
      había mirado antes de construirla** — ver `test/pending/README.md`:
      tenía razón en que elegir de más se recortaba en silencio, y en que un
      `""` guardado sobrevivía al `coerce`.
- [x] **Cortar el bundle.** Era un solo chunk de 2.07 MB (323 kB gzip) que
      llegaba entero antes del primer pixel — la portada precargaba el índice
      completo para pintar un título.

      | | antes | después |
      | --- | ---: | ---: |
      | primer pintado | 323 kB gzip | **151 kB gzip** |
      | entrar a la Forja | 0 | 151 kB gzip |

      Tres cortes: el estado del borrador salió a `builder-state.ts`, que no
      importa el índice (la Gate necesita la *forma* de un borrador, no los
      datos); la Forja, el Códice y el Ritual cargan al entrar; y
      `manualChunks` separa el índice —que cambia casi nunca— de las librerías
      y de la app. En un solo chunk, arreglar una errata hacía que cada jugador
      se bajara todo D&D de nuevo.

      Los bytes totales son los mismos: llegan cuando hacen falta. El aviso de
      "chunk mayor a 500 kB" **queda a propósito**: nombra un hecho real y
      subir el límite sería taparlo.
- [x] **Modificadores de salvación y pericia en la ficha.** `checks.ts` +
      `Checks.tsx`. Las dieciocho pericias, no sólo las que sabe hacer: la
      tirada sin competencia es la que nadie se sabe de memoria, y esconderla
      es esconder el número que el jugador está por errar. Competencia con un
      punto, maestría con dos.

      El mapa de pericia a característica sale del `dnd5e.mjs` instalado
      (5.3.3), no de memoria — 2024 no cambió ninguna. Las salvaciones salen de
      la primera clase sola, que es la regla y no una simplificación.
- [x] **Oro inicial.** *La nota decía que no se calcula. Medido: `kitCopper` ya
      lo calculaba y `coinLabel` ya lo escribía — no había dónde ponerlo.* El
      contrato no tenía campo y el actor salía con la bolsa en cero, así que
      quien se llevaba el dinero en vez del equipo se quedaba sin las dos cosas.

      2024 plantea el kit entero como una fila —este montón de equipo, o el
      dinero— así que quien se lleva el dinero elige una opción **sin objetos**,
      y leer sólo lo que cayó en la mochila no encontraba nada. `takenOptions`
      lee lo concedido más lo contestado, que es por donde viajan las monedas.

      El contrato cuenta en cobre, que es la única unidad que nunca redondea.
      El reparto en monedas es presentación y vive en el exportador — y **no se
      sube a platino**: el libro dice 150 monedas de oro, así que la ficha dice
      150 po. Enrollarlo en 15 de platino es el mismo dinero y otra respuesta.
- [ ] **Export/importar el Códice.** Los personajes viven sólo en `localStorage`.
      Se pierden al limpiar el navegador, en incógnito, o en otra máquina.

### Para seguir trabajando en el front

`corepack pnpm web:dev` levanta en `127.0.0.1:4173`. Los paquetes resuelven a su
`src/`, así que tocar `packages/domain` se ve sin reconstruir. Antes de un PR:
`corepack pnpm web:verify` y `corepack pnpm --filter @bertinis-vault/web probe`.

Para cambiar el aspecto: un color o una face es `styles/`; una receta repetida es
`styles/recipes.ts`; lo que aparece una sola vez sigue inline en su componente,
que es donde se lee mejor.
