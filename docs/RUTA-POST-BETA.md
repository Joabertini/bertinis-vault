# La ruta después de la beta

Escrito el 2026-09-03, con los reportes de los players ya arreglados o
ordenados. Existe porque había dos backlogs y uno no estaba en ningún lado:
`AI-HANDOFF.md` lleva la deuda de ingeniería y `BUILDER-COVERAGE.md` lleva lo
que las reglas obligan a modelar, pero lo que los jugadores pidieron vivía
solamente en una conversación.

Este documento **afirma**: dice qué se decidió y en qué orden va. Lo que narra
por qué se rompió algo vive en los mensajes de commit.

## Qué se cerró

Tres PRs el 2026-09-02:

- **#76** — los ocho reportes de la beta: conjuros multiclase, mejoras de
  nivel, competencias por dotes, especies duplicadas en la estantería, clases
  auxiliares sin separar, la caja del tamaño desbordada, sugerencia de
  apariencia.
- **#77** — la Forja en pantalla negra, más compra de puntos y "a mano" que no
  se podían terminar, las tiradas que se borraban al cambiar de método, el
  humano 2024 que abría en 6/3, y la lista de dotes cortada en 24.
- **#78** — el estilo de lucha se elige en Clase, no en Mejoras.

## Las dos decisiones que faltaban

### Códigos para compartir: solo lectura

Un código abierto en la web muestra una ficha que no se puede editar.

La cañería ya existe entera — `POST /builds`, `GET /builds/{código}`, base32 de
Crockford de diez caracteres — porque nació para que un jugador dictara el
código en Foundry. Falta una ruta web que muestre el personaje en vez de que
solo Foundry lo consuma.

Solo lectura por dos razones. La primera es que **no agrega exposición**: quien
tiene el código ya puede importar ese personaje a Foundry hoy, así que una
vista web no revela nada que el código no revelara. La segunda es que una copia
editable no es una vista, es una bifurcación: pide identidad propia, procedencia
y una respuesta a qué pasa cuando el original cambia. Eso es una feature aparte.

El caso que se pidió —"que el DM los pueda revisar"— se resuelve entero con
solo lectura. "Pasame tu build y lo tuneo" queda para después, y una vez que la
vista existe es un botón encima de ella, no un rediseño.

### Emojis de función: mixto, derivado primero

El pedido fue "una bota para las cosas que dan movilidad". Movilidad es una
**función** —qué hace por vos— y eso no es un campo del dato. El índice guarda
hechos: escuela, tiempo de lanzamiento, alcance, concentración, ritual. Escuela
no es función: *Misty Step* y *Blink* son las dos Conjuración y una te mueve y
la otra no.

Las tres opciones y su diferencia real:

| Camino | Cobertura | Costo de mantener | Dice lo que se pidió |
|---|---|---|---|
| Derivado del dato | 100% | cero | no |
| Tabla curada a mano | lo que se escriba | crece con el catálogo | sí |
| Mixto | 100% con función en lo que importa | acotado | en lo que importa |

Va el mixto, **y el derivado primero**, porque es lo que se puede tener sin
prometer nada: coste de acción, concentración, ritual, alcance. Son los hechos
que un jugador mira en medio de un combate y salen gratis para todo el
catálogo.

La capa curada se suma después y solo para el puñado que se mira en combate,
guardada como dato y con un test que exija que cada id curado exista en el
índice. Este repositorio ya se comió esa lección: las tablas escritas a mano
salieron mal para ocho de trece clases y para 112 de 161 trasfondos, y la
regla que quedó es que un dato que se puede medir no se escribe a mano.

## El orden, y qué decide cada puesto

El principio: **primero lo que hace que un personaje esté mal, después lo que
lo hace incómodo.** Y entre dos cosas parecidas, primero la que ya está medida.

1. ~~**Tamaño 2024.**~~ Hecho. Era lo único de la lista que producía un
   personaje *incorrecto*.

   **Y era más grande de lo que decía este documento: no son tres especies,
   son treinta.** Medido contra el bundle: además de Aasimar, Humano y Tiefling
   de XPHB, imprimen `["S","M"]` veintisiete más de MPMM, VRGR, AAG, EFA, RHW,
   LFL, SCC, TCE y WBtW — Changeling, Genasi, Harengon, Kenku, Tabaxi, Tortle,
   Yuan-Ti, Warforged, Plasmoid, Thri-kreen, Owlin, Dhampir, Hexblood, Reborn,
   Shifter, Lupin, Rimekin, Khoravar, Custom Lineage y las variantes por libro.
   Las treinta se exportaban como Pequeñas.

   Las cuatro puntas: la fila del índice guarda `sizes` (la oferta entera, y
   `null` — no `[]` — cuando la especie no dice nada, porque `raceInfoFor`
   fusiona la subraza salteando nulls); `BuilderState.sizeChoice` guarda la
   respuesta como letra del índice; la cámara Linaje pregunta cuando hay dos; y
   `foundrySizeFor` recontrasta la respuesta contra la oferta, así que un
   halfling rehecho goliat no se lleva el "Pequeño" puesto.

   Sin responder no viaja nada, que Foundry lee como Mediano — lo mismo que
   pasaba antes de que esto existiera. `ImportPayload` no cambió
   (`ancestry.size` ya estaba), así que **no hace falta desplegar el Worker**.

2. ~~**"Descender" → "Siguiente", con scroll al tope, y las flechas a los
   costados.**~~ Hecho.

   El scroll al tope va con el cambio de cámara y es instantáneo: el
   cruce-fundido de 500 ms ya lleva el cambio, y un scroll suave corriendo
   contra él se lee como dos eventos en vez de uno.

   "A los costados" pedía una decisión que este documento no tenía: las dos ya
   estaban en los extremos del pie. Resuelto como **flechas fijas a los bordes
   del viewport**, que no scrollean — el pie está abajo, así que quien está a
   media cámara larga tenía que recorrerla entera para salir.

   Aparecen **de `xl` (1280 px) para arriba**. La página es `max-w-6xl`
   (1152 px) centrada, así que recién ahí hay margen real donde pararse; por
   debajo flotarían sobre la cámara, y una flecha que tapa la pregunta que
   contesta es peor que una flecha a la que hay que bajar. El pie queda igual
   en todos los anchos, así que no se pierde nada cuando no están.

   Deshabilitadas y no ocultas en las puntas del riel: una flecha que
   desaparece mueve a la otra, y un control que se mueve es un control que hay
   que volver a encontrar. La puerta es la misma del pie — sin contestar la
   cámara, no deja pasar.

3. ~~**Higiene sin decisiones.**~~ Hecho, y ninguna de las dos era inocua.

   **El "antes" de la semi-dote.** `scoresBefore` excluía la mejora del nivel
   que se está editando pero no la **dote** de ese mismo nivel, así que el
   editor de una semi-dote sumaba su punto sobre un total que ya lo tenía: un
   19 se leía 20 y no ofrecía nada, y un 18 con una semi-dote de dos puntos
   perdía el segundo. Es el mismo doble conteo que los jugadores reportaron
   del lado de las mejoras, en la otra mitad de la cámara. Se excluye por
   nivel, no todas las dotes: la de nivel 4 sigue siendo el piso de la de 8.

   **`spellPrerequisiteLabel` se conectó.** Las tres invocaciones que declaran
   el requisito como descripción (Agonizing Blast, Eldritch Spear, Repelling
   Blast, todas XPHB) traen `prerequisiteText` vacío, así que **no listaban
   ningún requisito**: las tres más tomadas del juego parecían no pedir nada.
   Va a `notes`, que es el canal de lo que el jugador juzga, al lado de los
   prerrequisitos en prosa. Dicho, no exigido — siguen elegibles, porque
   negar una pick por un requisito que no se puede leer es inventar un
   veredicto.

4. **El agujero del test de humo.** Recorre las ocho cámaras y en cada una
   comprueba que la página diga "Nivel", que es cierto en todas: si un click de
   riel dejara de navegar, seguiría pasando. Va acá y no más abajo porque
   protege todo lo que viene después.

5. **La preview en dos columnas.** El reparto está decidido —a la izquierda lo
   que se calcula, a la derecha lo que se lee, "cómo pelea" abajo a ancho
   completo— pero hay que medir contra la ficha real qué campos existen antes
   de mover nada.

6. **La hoja estilo roll20 al abrir el tomo**, con la cheatsheet como opción
   intercambiable. Es la más grande de la lista y se parte en features propias
   para no pisarse: primero la hoja, después el selector, después recordar la
   preferencia.

7. **La vista de código compartido**, solo lectura, según lo decidido arriba.

8. **La capa derivada de símbolos.**

9. **Competencias de armas y armaduras por dotes, e idiomas por dotes.**

10. **El sugeridor de builds.** Aparcado por pedido, y con una pregunta sin
    responder que hay que cortar antes de escribir una línea: biblioteca de
    guías contra generación por IA.

## Lo medido y lo que sigue siendo una suposición

**Medido.**

- Bajo 2024 el guerrero no tiene pool de estilo de lucha en este dato. Solo
  hechicero y brujo traen pools. Bajo 2014 los traen artificiero, guerrero,
  paladín, explorador, hechicero y brujo.
- Doce trasfondos otorgan una dote que carga competencias, no trece.
- Un personaje puede tomar 108 dotes bajo 2014 y 168 bajo 2024.
- Tres de las diez especies 2024 imprimen el tamaño como elección — **pero
  contando todos los libros son treinta**, y las otras veintisiete son de
  fuentes 2014. El recorte a "2024" era del lector, no del dato: la pregunta la
  hacen MPMM, VRGR, AAG y seis libros más.
- De las 31 clases del índice, las únicas cuatro sin equipo inicial son Rune
  Scribe y los tres auxiliares de Tasha.
- **Las competencias de armas y armaduras sí llegan al personaje** desde la
  clase y la especie: `gearProficienciesFor` las recibe y la ficha viva las
  muestra. Lo que falta es la fuente *dote*. El ítem 9 es sumar una fuente, no
  construir la cañería.

**Sin medir, y hay que medirlo antes de prometer nada.**

- Cuántas dotes declaran armas, armaduras e idiomas. Los números que circulan
  —cuatro, seis, siete— vienen de la conversación, no del bundle.
- Si el índice guarda texto de objetos. Si no lo guarda, los globos con impacto
  mecánico no tienen de dónde salir y el ítem cambia de forma. `spellInfoFor`
  ya dice que el texto de los conjuros no está.
