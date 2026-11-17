# Hoja de personaje 2024 (C1)

Decidido por el dueño el 2026-11-17. Este documento es la referencia del
formato; se actualiza con cada cambio de la hoja.

## Formato

La hoja de la Forja **es la hoja de personaje de Foundry dnd5e (v2), copiada
píxel a píxel**: mismas plantillas, mismo CSS, mismas pestañas. No se diseña
nada propio salvo el arte que reemplaza al de Wizards (ver abajo).

Fuente: el sistema dnd5e **6.0.6** instalado en nuestro Foundry
(`/home/foundry/data/Data/systems/dnd5e`). Si el servidor actualiza el
sistema, se vuelve a copiar desde ahí.

### Estructura (de `module/applications/actor/character-sheet.mjs`)

- **Encabezado** (`templates/actors/character-header.hbs`): nombre, clase,
  insignia de nivel, inspiración, botones de descanso, barra de experiencia.
- **Características** (`character-ability-scores.hbs`): la fila de seis
  puntuaciones bajo el encabezado.
- **Barra lateral** (`character-sidebar.hbs`): retrato, CA y agotamiento,
  iniciativa, velocidad, competencia, puntos de golpe, dados de golpe,
  salvaciones de muerte, favoritos.
- **Pestañas**, en este orden:
  1. Detalles (`tabs/character-details.hbs`): habilidades y herramientas,
     trasfondo, salvaciones, sentidos, resistencias, inmunidades,
     vulnerabilidades, competencias de armadura y armas, idiomas.
  2. Inventario (`tabs/character-inventory.hbs`).
  3. Rasgos (`tabs/character-features.hbs`).
  4. Conjuros (`tabs/creature-spells.hbs`).
  5. Efectos (`tabs/actor-effects.hbs`).
  6. Biografía (`tabs/character-biography.hbs`).
  7. Bastión (`tabs/character-bastion.hbs`), solo si tiene.
  8. Renombre (`tabs/actor-renown.hbs`), solo si tiene.
  9. Rasgos especiales (`tabs/creature-special-traits.hbs`).

## Qué se copia y qué no

| Parte | Licencia | Uso |
|---|---|---|
| Plantillas `.hbs`, CSS `dnd5e.css`, código | MIT (Andrew Clayton) | se copian tal cual, con el aviso de copyright |
| Fuentes Roboto, Roboto Condensed, Roboto Slab | libres (cada una con su LICENSE) | se copian |
| Íconos `icons/` | game-icons.net, CC BY 3.0 / CC0 | se copian, con los créditos de `icons/LICENSE` |
| Texturas e insignias de `ui/` (fuera de `official/`) | MIT del repo | se copian |
| `ui/official/*` | **copyright Wizards**, solo para usar dentro de Foundry | **no se copian**: se reemplazan por arte nuestro del mismo tamaño |
| CSS base de Foundry (`foundry2.css`), fuentes Signika y Modesto, Font Awesome Pro | licencia de Foundry | **no se copian**: las variables se definen propias con los mismos valores; Font Awesome por la versión libre |

### Arte a reemplazar

| Archivo de Wizards | Tamaño | Dónde va | Reemplazo |
|---|---|---|---|
| `banner-character.jpg` | 800×170 | fondo del encabezado, modo claro | arte nuestro, con el logo de la marca (sin definir) |
| `banner-character-dark.webp` | 1391×510 | fondo del encabezado, modo oscuro | ídem |
| `pill-texture-race/background/type.webp` | 260×52 | píldoras de especie, trasfondo y tipo | arte nuestro o liso |
| `classes/*.webp` | 350×453 | arte de clase en la hoja | arte nuestro o se saca |

## Lo que la hoja necesita además de plantillas y CSS

Medido al armar el boceto con una hoja real de foundry-b (mesa-ivan, dnd5e 6.0.6,
modo juego, tema oscuro). Todo esto hay que traerlo al producto:

- **Componentes con shadow DOM cerrado** de dnd5e (MIT): `filigree-box` (los
  marcos de Habilidades y Salvaciones), `proficiency-cycle` (los círculos de
  competencia), `dnd5e-icon`, `dnd5e-checkbox`, `slide-toggle`. Sin ellos la hoja
  pierde los marcos. Se copian sus clases de `dnd5e.mjs`.
- **Fuentes registradas por JS**: Roboto, Roboto Condensed y Roboto Slab no
  están en `dnd5e.css`; dnd5e las registra en `CONFIG.fontDefinitions`. Van
  como `@font-face` propios con los archivos de `fonts/`.
- **Columnas del inventario por ancho**: `dnd5e-inventory` oculta columnas
  (Roll, Formula, Charges…) según el ancho con un `ResizeObserver`
  (`_cacheSections` + `_onResize`). Se copia esa lógica.
- **Monedas**: la regla de los íconos de moneda la inyecta dnd5e por JS.
- **Base del núcleo de Foundry**: 126 reglas de `foundry2.css` tocan la hoja,
  repartidas en capas (`@layer reset, variables, elements, blocks,
  applications, …`). **Las capas importan**: sin ellas, el núcleo le gana a
  dnd5e y cambian los colores. En el producto se reescriben propias, en las
  mismas capas. Fuentes del núcleo usadas: Signika (libre, Google Fonts),
  Modesto Condensed (nombre del personaje), Amiri, Bruno Ace: revisar la
  licencia de Modesto antes de usarla.
- **Lo que no es de la hoja**: el botón "Level Up" junto a la experiencia y
  las imágenes de objetos de `cdn.5e.tools` los agrega el módulo Plutonium; no
  se copian. Los íconos de objetos de `icons/…` son del núcleo de Foundry; van
  imágenes nuestras.

## Estado

- [x] Boceto de las 7 pestañas (2026-11-17), en `Desktop\capturas\hoja-2024-boceto`: `index.html` navegable y `comparar-<pestaña>.png` (original de Foundry al lado). Falta la aprobación del dueño.
- [ ] Copia de plantillas y CSS al repo, con los avisos de licencia.
- [ ] Arte propio y logo.
