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

## Estado

- [ ] Boceto de la pestaña Detalles con las plantillas reales (Desktop\capturas), para aprobar.
- [ ] Copia de plantillas y CSS al repo, con los avisos de licencia.
- [ ] Arte propio y logo.
