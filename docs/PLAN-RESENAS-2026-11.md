# Plan de abordaje — reseñas del constructor (2026-11-17)

> Origen: reseñas de una mesa que probó alba.bertinilabs.xyz con un brujo humano
> 2024 y un guerrero goblin. Todo lo de abajo se leyó en el código y en los
> índices de reglas por GitHub (sin correr nada local). Donde la causa **no está
> confirmada** se dice, y el primer paso es un test que reproduzca el problema.

## Cómo está ordenado

Tres tipos de trabajo, en este orden, porque no pesan lo mismo:

- **A. Bugs de correctitud** — el constructor entrega algo distinto de lo que dicen las reglas. Chicos, un PR cada uno, con test.
- **B. Reglas de mesa** — contenido que es legal "si el DM lo permite". No es un bug: es una decisión que hoy el constructor toma solo. Comparten un mismo mecanismo.
- **C. Producto que falta** — la hoja 2024 y los recordatorios. Grandes.

## Resumen

| # | Reseña | Causa (leída) | Tipo | Tamaño |
|---|---|---|---|---|
| A1 | Giant Foundling no da Strike of the Giants | **sin confirmar**; el dato sí trae la dote | bug | S |
| A2 | No deja elegir más de un arma | `toOption` ignora `quantity` de las categorías | bug | S |
| A3 | Oro en vez de equipo no se descuenta de lo elegido a mano | no hay libro de gastos; solo se suman monedas | bug/feature | M |
| A4 | Aparecen todas las runas; Giant's Might escala mal | **sin confirmar** | bug | S–M |
| B1 | Invocaciones 2014 no disponibles en un brujo 2024 | el filtro de legalidad descarta todo el 2014 núcleo | regla de mesa | S |
| B2 | Trasfondo a medida (DMG 2024) | no existe | regla de mesa | M |
| B3 | 2014 deja repartir las características libremente, 2024 limita a 3 | es lo esperado; falta nombrarlo | UX | XS |
| C1 | La hoja 2024 no está lista | la hoja imprimible no distingue edición | producto | L |
| C2 | Los recordatorios son de 2014 | `playbook-data.ts` viene de la cheatsheet 2014 | producto | L |
| D1 | Vida máxima por nivel | solo hay promedio o tirada | producto | S |

## A. Bugs de correctitud

### A2 — Más de un arma (la más clara; empezar por acá)

`packages/forge/src/starting-kit.ts`, `toOption`: para una entrada de tipo
`category` agrega **un** `openPick` por categoría y no mira `quantity`. El
guerrero 2014, opción (b) "dos armas marciales", está en el índice como
`{ equipmentType: "weaponMartial", quantity: 2 }` y llega a la pantalla como una
sola elección. Hay 8 clases con una categoría de arma y cantidad en su kit.

- Arreglo: un `openPick` por unidad de `quantity`.
- Test: por cada una de esas 8 clases, contar los `openPick` de arma de la opción con cantidad.
- Cuidado: `kitChoices` guarda respuestas por fila; revisar que dos picks de la misma categoría no se pisen la clave.

### A1 — Dote del trasfondo que no llega

El índice **sí** trae la dote: `giant foundling|bgg` tiene
`feats: [{ "strike of the giants|bgg": true }]`, y la dote existe en `feat.json`
con prerrequisito "competencia con armas marciales + trasfondo Giant Foundling".
`featChoiceOf` (`scripts/build-vetools-index.mjs`) arma la elección, y
`backgroundFeatIdsFor` (`packages/forge/src/feats.ts`) la concede si es única.

No encontré por qué no llega. Hipótesis, en orden:
1. Algún paso descarta la dote por el prerrequisito (el guerrero goblin lo cumple, así que sería un bug de la comprobación).
2. El `BackgroundRow.featChoice` está documentado "null para los 2014, ninguno da dote": el comentario es falso (Giant Foundling y Rune Carver, ambos BGG, la dan) y puede haber una rama que lo asume.
3. Se concede, pero `featFeatureEntriesFor` no la encuentra por el `slug` ("Strike Of The Giants" vs "Strike of the Giants").

- Paso 1: fixture "guerrero goblin + Giant Foundling" que afirme que la dote está en `featIdsFor`, en las entradas de la hoja y en el `ImportPayload`. Que falle donde falle.
- Arreglo: el que diga el test. Corregir también el comentario falso del tipo.

### A3 — Oro en vez de equipo

`kitCopper` solo suma monedas de las opciones tomadas. Si el jugador elige "oro"
y después agrega equipo a mano, el oro no baja: no existe un libro de gastos.

- Diseño mínimo: saldo = oro inicial − precio de lo agregado a mano, mostrado en la cámara de Equipo y exportado en `ImportPayload.currency` ya descontado.
- Dato disponible: `item.json` trae `value` (en cobre) para 898 de 2742 ítems. El resto no tiene precio: esos **no descuentan** y se marcan "sin precio".
- Decisión del dueño (ver abajo): saldo negativo, ¿se bloquea o se avisa?
- Alternativa barata por si el libro de gastos se complica: advertencia "elegiste oro y agregaste equipo: el oro no se descuenta" en `gear-warnings.ts`.

### A4 — Runas y Giant's Might

Hay 6 runas (todas TCE) en el índice; Hill y Storm exigen Caballero Rúnico nivel 7.
El selector debe ofrecer las que cumplen el prerrequisito, pero **la hoja debe
mostrar solo las elegidas**. Dos lecturas de la reseña, sin confirmar cuál:
(a) el selector ofrece las 6 sin respetar nivel, o (b) la hoja/exportación lista las 6.
Sobre Giant's Might: los usos son por bonificador de competencia, no por el de FUE.

- Paso 1: fixture "guerrero 3 / Caballero Rúnico" y mirar qué sale en selector, hoja y payload.
- Si los usos se calculan con FUE, la fórmula está en el texto de la feature: leerla de ahí y no escribirla a mano.

## B. Reglas de mesa

### El mecanismo común

Ya existe `BookLibrary` (`edition | core | all`, en `packages/vetools-ref/src/sources.ts`)
y el constructor la toma del personaje. Generalizarla a un objeto "reglas de mesa"
por personaje, con banderas que el DM decide:

```
{ library, permitirNoReimpreso2014: boolean, trasfondoAMedida: boolean }
```

B1 y B2 son banderas de ese objeto. Un personaje nuevo parte de valores
conservadores y el jugador las cambia en la misma pantalla donde hoy elige la biblioteca.

### B1 — Contenido 2014 sin versión 2024

> **Decidido (17-11):** el PHB 2014 y el 2024 no se cruzan. Las invocaciones
> de los suplementos (Xanathar's, Tasha's…) sí, cuando el jugador arma el
> personaje con suplementos. Eso ya es lo que hace `isSourceAllowed` con la
> biblioteca `all`; B1 queda en un test que lo fija. Lo de abajo no se hace.

Causa exacta: `isSourceAllowed` (`vetools-ref/src/sources.ts`) deja entrar a un
personaje 2024 las ampliaciones 2014 (Tasha's, Xanathar's…) pero **excluye PHB/DMG/MM
completos** "porque la revisión los reemplaza". Es cierto para lo reimpreso y falso
para lo que no se reimprimió.

Medido en `optionalfeature.json`: el PHB tiene 32 invocaciones, 19 con
`reprintedAs` y **13 sin versión 2024**: Beast Speech, Beguiling Influence,
Bewitching Whispers, Chains of Carceri, Dreadful Word, Eldritch Sight, Eyes of the
Rune Keeper, Minions of Chaos, Mire the Mind, Sculptor of Flesh, Sign of Ill
Omen, Thief of Five Fates y Voice of the Chain Master. También 17 Disciplinas
Elementales PHB sin reimpresión.

- Arreglo: con la bandera activa, `filterLegal` admite filas de PHB/DMG **sin `reprintedAs`**, en las colecciones habilitadas. Usar `reprintedAs` (dato del índice) y no la coincidencia por nombre que se usa hoy.
- Alcance inicial: solo `optionalfeature`. Medir `spell`, `feat`, `item`, `race` y `class` antes de abrirlos: abrir una especie 2014 en un personaje 2024 cambia reglas de origen y no es lo que pidieron.
- UI: marcar cada opción admitida con una etiqueta "2014" para que el DM vea qué entró por la bandera.
- Test: un brujo 2024 con la bandera ve las 13 y no ve las 19 reimpresas del PHB; sin la bandera, no ve ninguna.

### B2 — Trasfondo a medida (DMG 2024)

El DMG 2024 permite armar un trasfondo propio; queda a criterio del DM. Un
"trasfondo virtual" con la forma de `BackgroundRow` (competencias, herramienta,
dote de origen, reparto +2/+1 o +1/+1/+1) detrás de la bandera `trasfondoAMedida`.
**Antes de escribir código**, leer el texto exacto en 5etools
(`book.html#xdmg,2,creating a background`): qué elige el jugador y con qué
límites. No lo implemento de memoria.

### B3 — "En 2014 me dejó elegir como quería"

Es lo esperado: en 2014 el aumento sale de la especie (y Tasha's permite
reasignarlo); en 2024 sale del trasfondo y ofrece tres características. No hay
bug. Sí hay confusión: nombrar la pantalla según la regla ("Origen personalizado
de Tasha's" en 2014; "Características del trasfondo" en 2024). Si B2 se hace, el
trasfondo a medida abre ese reparto en 2024.

## C. Producto que falta

### C1 — Hoja 2024

> **Formato decidido (17-11):** la hoja de Foundry dnd5e, con pestañas, copiada
> píxel a píxel. Referencia viva: [`docs/diseno/hoja-2024/README.md`](diseno/hoja-2024/README.md).

`ogl-attrs.ts` y `ogl-render.ts` (la hoja imprimible) no mencionan la edición en
ningún lado: una sola hoja para las dos. Alcance a definir con el dueño; lo que
cambia en 2024: especie en vez de raza, dote de origen, columna de Maestría de
armas, Inspiración heroica, columna "Preparados" de conjuros, trasfondo con sus
tres características. Hecho en dos tramos: (1) que la hoja deje de mostrar datos
que no existen en 2024 y muestre los que sí; (2) el diseño propio.

### C2 — Recordatorios

`playbook-data.ts` se genera desde `Joabertini/dnd-cheatsheet` (12 clases, 101
subclases, 22 dotes, 14 combinaciones), escrito para 2014. Tramos:
1. **Rápido:** etiquetar cada nota con su edición y, en un personaje 2024, mostrar "nota escrita para 2014" donde no se haya revisado. Mejor eso que una nota equivocada sin avisar.
2. Auditar por clase qué cambió en 2024 y escribir las variantes **en la cheatsheet** (el archivo dice "editá la cheatsheet, no este archivo"), regenerar.

## D. Pedidos nuevos

### D1 — Vida máxima

Hoy `hpMethod` es `average | rolled`. Sumar `max`: el dado entero en cada
nivel después del primero. Toca `builder-state` (tipo y coerción),
el cálculo de vida, la pantalla donde se elige el método y el import desde
Foundry (que hoy solo distingue promedio y tirada). Test: un guerrero 5 con
CON +2 en máximo tiene 10 + 4·10 + 5·2.

## Orden de trabajo

1. **Fase 0 — reproducir.** Un archivo de tests con las cuatro fixtures de las reseñas (brujo humano 2024, guerrero goblin + Giant Foundling, guerrero 2014 con "dos armas", guerrero con oro + equipo a mano, guerrero 3 Caballero Rúnico). Cada una falla antes de arreglarse.
2. **Fase 1 — A2, A1, A3.** Los tres que el jugador toca en los primeros minutos.
3. **Fase 2 — B1** con el mecanismo de reglas de mesa; después B3 (nombres) y B2.
4. **Fase 3 — A4**, ya con fixture y causa conocida.
5. **Fase 4 — C2 tramo 1** (etiqueta), después C1 y C2 tramo 2.

Reglas del repo: un PR por hallazgo, verificado por el CI "Verify Workspace",
sin tests ni builds locales, los PR los mergea el dueño. `ImportPayload` solo
cambia en A3 (moneda ya descontada); si cambia, avisar para el Worker.

## Decisiones del dueño (17-11)

1. **B1:** el PHB 2014 y el 2024 no se cruzan; los suplementos sí, si el jugador los elige. Ya funciona así; solo test.
2. **Reglas de mesa:** cada mesa decide. Las banderas quedan a mano del jugador, apagadas al crear.
3. **A3:** sin respuesta; queda el aviso.
4. **C1:** la hoja 2024 es la hoja de personaje de Foundry dnd5e (v2), copiada tal cual: su código es MIT (mantener el aviso de Andrew Clayton y los créditos de game-icons). Se reemplazan por arte nuestro las imágenes de `ui/official/` (copyright de Wizards: fondo del encabezado, texturas de las píldoras, arte de clase); lugar para el logo de la marca, aún sin definir. Font Awesome Pro por la versión libre; las variables del núcleo de Foundry las definimos nosotros. Boceto de la pestaña Detalles antes de codificar.
5. **Nuevo:** vida máxima como tercer método (D1).
