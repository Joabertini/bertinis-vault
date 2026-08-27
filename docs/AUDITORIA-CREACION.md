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
| Subraza (sólo 2014) | ⚠️ se elige y **no cruza a Foundry** — `to-payload.ts:80` la busca entre razas base y falta `subrace` en `PROP_TO_PAGE` |
| Aumento de característica (2014) | ✅ sembrado desde el índice, editable |
| Rasgos raciales | ⚠️ como texto libre en `featuresText`, no como items |
| Idiomas | ✅ con la regla de la raza |
| Tamaño | ❌ no se captura |
| Velocidad | ❌ no se deriva ni se muestra |
| Sentidos (visión en la oscuridad) | ❌ no se deriva |

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
| Equipo inicial | ⚠️ **se imprime como texto, no entra al personaje** |
| Multiclase | ❌ la Forja asume una clase; `deriveCharacterBuild` usa `classes[0]` |

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
| Kit de clase | ⚠️ impreso, no aplicado. 13 de 13 clases en 2024, 14 de 18 en 2014 |
| Kit de trasfondo | ⚠️ igual |
| Alternativa de oro inicial | ❌ no se calcula, y **`ImportPayload` no tiene campo de moneda** |
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
