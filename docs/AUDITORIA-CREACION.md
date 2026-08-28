# Auditoría: crear un personaje, paso por paso

Fecha: 2026-08-27. Método: los pasos que el manual imprime, contra lo que el
Forge realmente produce. Todo número acá está medido contra el índice o contra
un personaje armado, no leído del código ni recordado.

La pregunta en cada fila no es si el código es bueno. Es **qué pasa con el
jugador que llega a ese paso**.

## Resumen

De los pasos que el manual pide, el Forge cubre la mayoría y falla en un patrón
repetido: **muestra lo correcto y no lo registra**. Tres de los cinco hallazgos
de esta auditoría son eso mismo — el panel imprime la palabra justa y el
personaje sale sin ella.

## Paso 1 — Especie / Raza

| Qué pide el manual | Estado |
|---|---|
| Raza | ✅ las 160, con buscador |
| Subraza (sólo 2014) | ✅ `subrace: "races.html"` en `PROP_TO_PAGE`; 5etools fusiona las subrazas en la lista de razas, así que hashea como una raza |
| Aumento de característica (2014) | ✅ sembrado desde el índice, editable |
| Rasgos raciales | ✅ como items en la ficha, uno por rasgo con nombre |
| Idiomas | ✅ de la especie, la subespecie y el trasfondo, medidos del índice |
| Tamaño | ✅ del índice al actor (`foundrySizeFor`). Una especie de 2014 imprime `"V"` —variable— y se lee como nada en vez de adivinarse |
| Velocidad | ✅ `speedFor`, en la ficha viva. Límite fijado en el test: **ninguna de las 98 subrazas trae velocidad**, así que un elfo del bosque lee 30 y no 35 |
| Sentidos (visión en la oscuridad) | ❌ **el índice no lo trae**: una fila de especie sólo tiene `name, source, size, ability, speed, armorClass`. Hueco de datos, no de código |

## Paso 2 — Clase

| Qué pide el manual | Estado |
|---|---|
| Clase | ✅ |
| Subclase, al nivel que corresponde | ✅ con el umbral por edición |
| Puntos de golpe | ✅ `derived.hp` |
| Dado de golpe | ✅ mostrado |
| Método de PG (promedio o tirada) | ❌ `combat.ts:52` sólo promedia; el contrato no tiene override |
| Competencias de armadura, armas, herramientas | ✅ |
| Salvaciones | ✅ `savingThrowsForClass` |
| Pericias, con su cupo | ✅ |
| Equipo inicial | ✅ cada fila es una pregunta; lo concedido entra solo, lo elegible al contestar |
| Multiclase | ✅ estado, UI y competencias. *La nota sobre `classes[0]` era falsa: el dominio ya ramificaba* |

## Paso 3 — Características

| Qué pide el manual | Estado |
|---|---|
| Tirada 4d6 | ✅ con dado 3D |
| Arreglo estándar | ✅ |
| Tabla de compra | ✅ |
| Aumento de origen (2024) | ✅ **arreglado en esta auditoría** — antes ofrecía las seis; los 60 trasfondos nombran tres |
| Tope de 20 | ✅ y avisa cuando el tope se comió el punto |

## Paso 4 — Describir al personaje

| Qué pide el manual | Estado |
|---|---|
| Trasfondo | ✅ los 161 |
| Competencias del trasfondo | ✅ otorgadas y elegibles, separadas |
| **Dote de origen (2024)** | ✅ **arreglado en esta auditoría** — se mostraba y nunca se registraba. 59 de 60 trasfondos la otorgan |
| Rasgo, ideal, vínculo, defecto | ✅ |
| Alineamiento | ✅ |
| Nombre | ✅ |
| Edad, altura, peso, aspecto | ❌ no se capturan |
| Prosa del trasfondo | ❌ el índice de 5etools no guarda una línea descriptiva de nada |

## Paso 5 — Equipo

| Qué pide el manual | Estado |
|---|---|
| Kit de clase | ✅ aplicado, con las cantidades (`gear-lines.ts`) |
| Kit de trasfondo | ✅ igual |
| Alternativa de oro inicial | ✅ `startingCopper` en el contrato, repartido en po/pp/pc en el exportador. No se sube a platino: el libro dice 150 po, la ficha dice 150 po |
| Arma y armadura equipadas | ✅ la armadura mueve la CA real |
| Mochila | ✅ buscador sobre 2658 objetos |
| Peso y capacidad de carga | ❌ |

## Paso 6 — Los números de la mesa

Acá está el hueco más ancho, y es el que más se nota **jugando**.

| Número | Estado |
|---|---|
| Clase de Armadura | ✅ |
| Puntos de golpe | ✅ |
| Bonificador de competencia | ✅ |
| CD de salvación de conjuros | ✅ |
| Bonificador de ataque con conjuros | ✅ |
| **Iniciativa** | ❌ |
| **Percepción pasiva** | ❌ sólo como prosa en la Visión |
| **Velocidad** | ❌ |
| **Modificadores de salvación** | ❌ se sabe *cuáles* tiene, no *cuánto* |
| **Modificadores de pericia** | ❌ igual |
| **Bonificador de ataque cuerpo a cuerpo / a distancia** | ❌ |

Foundry calcula todo esto solo, así que para el cruce no falta nada. Falta para
el jugador que abre el Códice en la mesa: iniciativa y percepción pasiva son de
lo primero que se pide en una sesión, y hoy no están en ningún lado.

## Conjuros

| Qué pide el manual | Estado |
|---|---|
| Cuántos trucos y conjuros, por clase y nivel | ✅ **arreglado en esta auditoría** — servía cuentas de 2014 a personajes 2024 |
| Lista ampliada por subclase | ✅ **arreglado en esta auditoría** — 50 de 135 subclases 2014 y 42 de 68 de 2024 la perdían |
| Espacios por nivel | ✅ |
| **El brujo podía elegir conjuros** | ✅ **arreglado en esta auditoría** — sus espacios se llaman `pact` y el techo se leía `NaN`: cero conjuros de nivel, a cualquier nivel |
| **Caballero Arcano y Pícaro Arcano** | ✅ **arreglado en esta auditoría** — tenían espacios en la ficha y ningún selector |
| Preparados contra conocidos | ✅ sale de la tabla de la clase |
| **Libro de conjuros del mago** | ✅ **arreglado en esta auditoría** — el mago preparaba de la lista de clase, sin libro |
| **Estado de preparación en Foundry** | ✅ **arreglado en esta auditoría** — se escribía en un campo que dnd5e no tiene desde 5.1 |
| Ritual y concentración | ✅ en la Visión |
| **Lo que concede la especie** | ✅ **arreglado en esta auditoría** — un tiefling llegaba sin Taumaturgia |
| **El linaje 2024** | ✅ **arreglado en esta auditoría** — XPHB no trae subrazas: el elfo y el tiefling eligen ahí y en ningún otro lado |
| Lo que conceden dotes, trasfondos y dones | ❌ leídos ya en el índice; falta preguntarlos en la Forja |
| Arcanum Místico del brujo | ❌ un conjuro de nivel 6 a 9, 1/día, fuera de los espacios de pacto. Niveles 11, 13, 15 y 17 |
| **Elegir de un filtro concedido** | ❌ el elfo alto elige *un* truco de mago y todavía no hay dónde. Es la misma máquina que necesitan Iniciado Mágico y Lanzador de Rituales, así que va con ellos |
| Filtros de ritual y de tipo de ataque | ❌ `parseSpellFilter` lee class/level/school/source y descarta en silencio los otros dos |

## Progresión y dotes

| Qué pide el manual | Estado |
|---|---|
| Mejora de característica o dote por nivel | ✅ leyendo `improvementLevels` del índice |
| Medio-dotes | ✅ distingue grant fijo de elección |
| **Prerrequisitos de dotes** | ✅ **arreglado en esta auditoría** — no se validaban; 143 de 168 dotes 2024 piden algo |
| Talentos de clase y subclase | ✅ con su cupo por nivel |
| Talento que dejó de ser legal | ✅ **agregado en esta auditoría** |
| Expertise | ❌ el schema no tiene el kind; un pícaro nv1 exporta sin su competencia doble |
| Maestría de armas (2024) | ❌ se muestra el nombre, no se elige |

## Lo que esta auditoría cambió

Cinco arreglos, todos encontrados mirando los pasos del manual y no el código:

1. Cuentas de conjuros por edición
2. Lista de conjuros ampliada por subclase
3. Prerrequisitos de dotes
4. Aumento de característica restringido a lo que el trasfondo nombra
5. Dote de origen del trasfondo, registrada

El patrón que comparten los tres últimos: **el panel mostraba la palabra
correcta y nada la escribía**. Un builder que imprime "Elegís una dote de:
Magic Initiate" y no guarda la elección se ve completo y no lo está. Vale
revisar con esa sospecha cualquier panel que sólo pinte chips.

## Lo que queda, después de la migración (2026-08-27)

La lista de `MIGRACION-FRONT.md` quedó sin pendientes, así que ésta pasa a ser
la cola. Medido contra el código, no contra las notas viejas:

| Hueco | Dónde muerde |
| --- | --- |
| **Método de PG** | `combat.ts:52` sólo promedia; el contrato no tiene forma de decir "tiré los dados" |
| **Lo que la especie concede y no se pregunta** | El enano elige una de tres herramientas de artesano y el elfo recibe Percepcion gratis. El indice trae `skillProficiencies` y `toolProficiencies` en crudo; la Forja no los pide ni los suma. Los idiomas ya se cerraron |
| **Edad, altura, peso, aspecto** | No se capturan |
| **Peso y capacidad de carga** | `GearBag` pesa la mochila; nadie compara contra la capacidad |

> **Dónde vive cada cosa.** Hay dos salidas y no hacen lo mismo.
> `apps/foundry-module` + `to-payload.ts` es la que usa el jugador: manda
> referencias `{page, source, hash}` y Plutonium importa los documentos reales,
> así que la raza y la clase traen sus propios sentidos, velocidad y
> competencias. `packages/foundry-exporter` arma un actor JSON completo y hoy
> **no lo llama ningún camino de producto** — sólo sus tests y el script de
> fixtures. Sigue siendo correcto y verificado, pero un arreglo ahí no le llega
> a nadie hasta que esa salida se ofrezca.

### Cerrado desde entonces

- **Cada lanzador tiene su regla, y dos no la tenían.** Al pasar los diez
  lanzadores por el mismo camino que usa la Forja aparecieron dos que no
  funcionaban.
  El **brujo** no podía elegir un solo conjuro de nivel, a ningún nivel. La
  magia de pacto se guarda bajo su propia clave —`{ pact: 2 }` son dos
  espacios, no uno de nivel 2—, así que el nivel no está en el mapa; leerlo
  como si estuviera daba `NaN` y el techo quedaba en cero. Los trucos sí
  llegaban, que es lo que hacía que no se notara.
  El **Caballero Arcano** y el **Pícaro Arcano** tenían espacios en la ficha y
  ningún selector: la progresión del guerrero es "ninguna" y eso cortaba el
  plan antes de empezar. Sus números están impresos en la subclase y en ningún
  otro lado —un Caballero Arcano de 7 conoce cinco conjuros, que no es ninguna
  fila de la tabla del guerrero porque el guerrero no tiene tabla—. Ahora se
  leen de ahí, incluido el renombre de 2024 de "Spells Known" a
  "Spells Prepared".
  Lo demás se midió y estaba bien: el paladín 2014 empieza a nivel 2 y el 2024
  a nivel 1; el artificiero redondea **para abajo** los preparados y **para
  arriba** los espacios, que son dos redondeos distintos en la misma clase; el
  explorador conoce cero a nivel 1; ni el paladín ni el explorador reciben
  trucos en ninguna edición; y el nivel de lanzador multiclase suma un tercio
  hacia abajo, la mitad hacia abajo y la del artificiero hacia arriba.

- **Lo que concede la especie, y el linaje que lo decide.** 5etools guarda todo
  esto en un solo campo, `additionalSpells`, y la Forja lo leía sólo en las
  subclases. Medido: 128 subclases lo tienen, y también **66 dotes, 54 dones,
  50 subrazas, 30 razas, 15 trasfondos y 7 clases**. Ninguna de esas 222 le
  llegaba a un personaje. Un tiefling llegaba sin Taumaturgia.
  Y en 2024 no es un detalle de conjuros: **XPHB no trae ni una subraza**. Los
  tres linajes del elfo —Drow, High Elf, Wood Elf— y los tres del tiefling
  existen únicamente como el nombre de estos bloques, así que hasta ahora la
  elección no se podía hacer. Se pregunta en la cámara que la levanta, no en la
  de conjuros: un guerrero elfo nunca abre esa cámara y tiene linaje igual.
  Sin responder no concede nada. Tres linajes a la vez son tres personajes.
  El nivel que abre la puerta es el **del personaje** y no el de una clase: el
  tiefling recibe su conjuro de nivel 3 al nivel 3 aunque multiclasee.
  Un filtro no es una concesión. El elfo alto elige *un* truco de mago; elegirlo
  por él sería poner en la ficha un conjuro que nadie eligió, así que eso
  ensancha la lista y no la llena.

- **Los conjuros de dominio se cobraban dos veces.** `prepared` en el dato
  quiere decir *siempre preparado*: un clérigo del Dominio de la Vida tiene
  Bendecir y Curar Heridas listos sin gastar una de las preparaciones del día.
  La Forja los metía en el selector, así que el clérigo pagaba una preparación
  por un conjuro que el dominio regala. Ahora se conceden con
  `prepared: 2` y salen del selector.
  `expanded` es la otra regla y sí es una oferta: un brujo del Archihada
  *puede* aprender Fuego Feérico, y nada dice que lo haya hecho. Esa sigue
  ensanchando la lista.

- **Con qué se lanza lo que concede la especie.** Un guerrero elfo no tiene
  característica de lanzamiento: la clase no le da ninguna, así que su truco de
  especie llegaba sin CD de salvación y sin bonificador de ataque. Medido en
  dnd5e 5.3.3: `SpellData#availableAbilities` devuelve la del **conjuro** si la
  tiene y recién después cae en la de la clase. O sea que el campo existe y es
  `system.ability`.
  El dato lo trae de dos formas. El tiefling 2014 la fija —Carisma— y no hay
  nada que preguntar. Las especies 2024 ofrecen Inteligencia, Sabiduría o
  Carisma, y eso se pregunta: elegir por el jugador sería fijarle una CD que no
  eligió. Sin responder el conjuro queda sin característica, que se ve en la
  ficha en vez de estar mal en la ficha.

- **Innato no es preparado.** Un conjuro que la especie da 1/día se lanza sin
  gastar espacio. Importarlo como conjuro común le cobraba a un tiefling un
  espacio de nivel 1 por un Represalia Infernal que las reglas regalan. Ahora
  viaja con `system.method: "innate"` y sus usos —`system.uses.max` y una
  `recovery` con el período de dnd5e (`day`, `lr`)—, con los nombres de
  `DND5E.spellcasting` y `DND5E.limitedUsePeriods` y no con inventados.

- **Tres sufijos, no uno.** Una referencia se escribe `nombre|libro#marca`.
  El libro importa donde el mismo nombre está impreso dos veces —al tiefling
  2024 le dan `faerie fire|xphb`, y el conjuro 2014 de ese nombre es otro
  documento—. `#c` marca truco, que es una nota para un lector y no para
  nosotros. Y `#2` a `#9` son **el nivel al que se lanza**: el
  `hellish rebuke#2` del tiefling 2014 se lanza como conjuro de nivel 2, y
  dejarlo pegado al nombre hacía que ese conjuro no resolviera a nada.

- **El libro del mago.** El mago preparaba directo de la lista de clase, que es
  la clase de otro: un mago prepara **de su libro**, y el libro es lo que la
  clase es. Lo dice la misma prosa en las dos ediciones —"seis conjuros de
  nivel 1 a nivel 1" y "dos más por cada nivel de mago después"—, y no está en
  ninguna columna de ninguna tabla, así que se escribe una vez con la cita.
  Ahora son dos pistas: el libro se llena de la lista de mago, y los preparados
  salen del libro. Borrar un conjuro del libro lo despreparara también, porque
  no se puede preparar lo que no está escrito. El tope de preparados sigue
  siendo el de la clase: seis escritos no son seis preparados.
  Los trucos quedan afuera a propósito — "excepto tus trucos, que están fijos
  en tu mente".

- **Dónde vive "preparado".** El módulo lo escribía en
  `system.preparation.prepared` como booleano. Ese campo es de dnd5e anterior a
  5.1 y no existe en ninguna parte desde entonces: en un actor exportado no hay
  clave `preparation` en ningún conjuro. El campo es `system.prepared` y es
  número, porque los estados son tres y no dos —
  `DND5E.spellPreparationStates`: `unprepared: 0`, `prepared: 1`, `always: 2`.
  El tercero es el de los conjuros de dominio o de patrón, que se preparan sin
  gastar una preparación.
  El contrato ahora los nombra con las palabras de dnd5e y no con inventadas,
  así que un renombre del sistema rompe un test en vez de escribir el número
  equivocado en silencio. Y nada además del libro dice `unprepared`: la
  ausencia se lee como preparado, que es lo que quiere decir toda ficha escrita
  antes de que el campo existiera.

- **Rasgos de especie.** El renglón decía "viajan como texto libre en
  `featuresText`". Medido: `featuresText` no está atado a ningún componente y
  nunca entra al payload del módulo — es un campo vestigial. Lo que faltaba de
  verdad era que la Forja nunca mostró qué da la especie. Ahora se listan por
  nombre, sin los encabezados que toda página repite.
  Con el mismo dato se cerró el hueco que dejé abierto en las competencias:
  **un enano es competente con cuatro armas tome la clase que tome**, y eso no
  lo concede ningún documento de clase.
  La subraza **suma** rasgos y competencias donde **pisa** tamaño, velocidad y
  visión. Las dos reglas están en los libros; confundirlas parte una especie o
  duplica un número.

- **Sentidos y velocidades.** El renglón decía "hueco de datos, hay que sacarlo
  de otra fuente". Los datos crudos de Plutonium sí traen `darkvision`,
  `blindsight` y los modos de movimiento; el build del índice los tiraba.
  Al medirlo salió algo peor que el hueco: **la subraza pisa a la raza**, y
  ninguna de las 98 filas traía velocidad ni visión. El elfo de los bosques
  caminaba 30 en vez de 35 y el drow veía 60 en vez de 120.
  Del lado de Foundry no hacía falta nada: Plutonium escribe
  `senses.ranges.darkvision` al importar el documento de raza.

- **Competencias de armadura y arma.** El renglón decía que llegaban a Foundry
  y sólo faltaba mostrarlas. Medido contra `dnd5e.mjs`, no llegaban: el
  exportador escribía `"light"`, `"medium"`, `"heavy"` donde
  `DND5E.armorProficiencies` sólo acepta `lgt`, `med`, `hvy`, `shl`, y metía
  las armas en el campo de texto libre en vez de `sim`/`mar`. **Todo personaje
  exportado llevaba su armadura sin competencia** — desventaja en cada tirada
  de Fuerza y Destreza, sin lanzar conjuros — y atacaba sin bonificador.
  La tabla se mudó a `packages/domain/src/class-proficiencies.ts`, partida por
  edición (2024 le saca la armadura media al druida y le da armas simples al
  mago), y la Forja ya la muestra con la clase que concedió cada línea.

- **Subraza a Foundry.** No era un string mal puesto: `subrace` no era un
  `VetoolsProp`, así que no había forma de pedirlo. Ninguna de las 98 subrazas
  resolvía y cada enano de las colinas llegaba como un enano a secas. Arreglar
  el prop arregló también la pista de libro en silencio: `sourceBookKey` armaba
  `race:<id>` y la Forja guarda `subrace:<id>`, así que las **10 subrazas que
  existen en más de un libro** (el Eladrin está en el DMG y en Mordenkainen's,
  con rasgos distintos) se rechazaban por ambiguas sin que la pista llegara.

- **Rasgos de clase, subclase y especie.** La pestaña Features llegaba vacía.
  El comentario del módulo decía que estaban a salvo porque viajaban dentro del
  documento de clase, en `system.advancement`. Medido sobre dos actores
  importados: ni un solo `ItemGrant` en ningún documento. La razón es la misma
  que dejaba al personaje sin competencias — **un advancement se aplica cuando
  el personaje sube de nivel a través de él**, y una importación directa no
  sube ningún nivel.
  Ahora se construyen y se cuelgan junto a su documento padre. El nivel filtra:
  un mago de 3 no lleva lo que tiene uno de 10. Se saltean los renglones que no
  son habilidades — "Arcane Tradition feature" apunta al rasgo de subclase que
  se importa al lado, y el ASI ya está en la ficha como los puntos mismos —
  con la misma regla que usa Plutonium (`getImportableFeatures`).
  Y cuando hay subraza, la raza base no aporta rasgos: 5etools fusiona las
  entradas de la raza dentro de la subraza, así que un enano de las colinas
  llevaría Visión en la Oscuridad dos veces.

- **Idiomas.** El renglón decía "con la regla de la raza". La regla era una
  tabla escrita a mano de **25 razas contra las 160** del índice, y todo lo que
  quedaba afuera —cinco de cada seis especies, las 98 subrazas y los 161
  trasfondos— caía en Común y nada más. El gnomo de las profundidades llegaba
  sin Infracomún; el Acólito, sin los dos idiomas de los que su trasfondo está
  hecho en buena parte.
  Ahora salen del dato. Son cuatro formas y no una: idiomas fijos, N a elección
  entre los ocho estándar, N de una lista con nombre, y el que **no puede ser
  una lista** — "el que vos y tu DM acuerden". Ese último se cuenta y se
  escribe a mano; ofrecer los ocho estándar en su lugar sería inventar una
  regla que el libro se negó a escribir.
  La subespecie **suma**, como los rasgos. El trasfondo se pregunta aparte de
  la especie, por la misma razón que las habilidades: leídos como una sola
  lista, las elecciones de uno llenaban el cupo del otro y la cámara no se
  podía cerrar.

- **Armadura sin competencia.** Lo encontró el jugador: la cámara de equipo lo
  dejaba ponerle armadura a un mago sin decir nada. Ponérsela es legal —y a
  veces es lo que uno quiere— pero la penalización viaja a Foundry con el
  personaje: desventaja en toda tirada de Fuerza y Destreza y ningún conjuro
  mientras la lleve puesta. Ahora avisa, y avisa qué pasa en vez de qué falta.
  El arma mágica no se juzga: la fila se llama "Scimitar of Speed" y dnd5e mide
  la competencia contra la cimitarra que tiene debajo, que desde ahí no se ve.
