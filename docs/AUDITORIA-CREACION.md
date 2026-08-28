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
| Rasgos raciales | ⚠️ como texto libre en `featuresText`, no como items |
| Idiomas | ✅ con la regla de la raza |
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
| Preparados contra conocidos | ✅ sale de la tabla de la clase |
| Ritual y concentración | ✅ en la Visión |

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
| **Sentidos** | El índice no trae visión en la oscuridad. Hueco de datos: hay que sacarlo de otra fuente o escribirlo a mano |
| **Rasgos raciales** | Viajan como texto libre en `featuresText`, no como items |
| **Método de PG** | `combat.ts:52` sólo promedia; el contrato no tiene forma de decir "tiré los dados" |
| **Edad, altura, peso, aspecto** | No se capturan |
| **Peso y capacidad de carga** | `GearBag` pesa la mochila; nadie compara contra la capacidad |

### Cerrado desde entonces

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
