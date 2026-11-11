# El front (Faro del Alba): estructura y cómo se trabaja

Guía para quien retome `apps/web`. Describe lo que **hay hoy**; la historia vive en
`CHANGELOG.md` e `IMPLEMENTATION-LOG.md`. Actualizado el 2026-11-11.

## Stack

React 19, Vite 6, TypeScript estricto (`noUncheckedIndexedAccess`,
`exactOptionalPropertyTypes`), React Router 7 como SPA, Tailwind, framer-motion y
Zustand. Monorepo con pnpm. El back es un Worker de Cloudflare (`apps/worker`,
`api.bertinilabs.xyz`); el front se despliega en Vercel (`alba.bertinilabs.xyz`).

## La Forja: `routes/Forge.tsx` y sus cámaras

`Forge.tsx` es el director: tiene el estado del borrador (`useVault`), todo lo derivado
(`useMemo`) y los manejadores. **Cada cámara es un componente en `components/forge/`**
y `Forge` solo le pasa datos y funciones por props:

| Cámara (`ChamberKey`) | Componente |
|---|---|
| `ancestry` (Raza) | `AncestryChamber` |
| `calling` (Camino) | `CallingChamber` |
| `origin` (Origen) | `OriginChamber` |
| `attributes` (Aptitudes) | `AttributesChamber` |
| `growth` (Mejora de característica) | `GrowthChamber` |
| `gifts` (Dones) | `GiftsChamber` |
| `gear` (Equipo) | `GearChamber` |
| `spells` (Conjuros) | `SpellClassSection`, una por clase que lanza |
| `identity` (Identidad) | `IdentityChamber` |

Piezas compartidas: `SubChoice` (lista de una sub-elección: senda, rama), `VariantChoices`
(las preguntas de linaje/conjuros que una fuente abre), `SizeChoice`, `ChamberArrows`
y `ForgeField`. El **orden** de las cámaras y sus reglas está en `lib/chambers.ts`, no en
el componente.

Convenciones al tocar una cámara:
- Los tipos de las props salen de los componentes hijos (`ComponentProps<typeof X>["prop"]`)
  para no duplicarlos. Ojo: indexar una prop **opcional** agrega `undefined`, y con
  `exactOptionalPropertyTypes` hay que quitarlo (`Exclude<…, undefined>`).
- Un cambio de estructura no debe cambiar comportamiento. El CI es el único lugar donde
  corren las pruebas (ver abajo) y cada cámara se probó recorriéndola en su preview.
- Lo que queda en `Forge()` es sobre todo lógica de estado (~1100 líneas). Partirla en
  hooks es posible pero más riesgoso; no se hizo.

## Panel de información y texto de reglas

Elegir o hacer clic en un conjuro, objeto, trasfondo, especie, clase, condición, etc. abre
un panel a la izquierda con **el texto completo de los libros**, y cada nombre dentro de
ese texto (una condición, un conjuro, un objeto) es un vínculo que abre su propia entrada.

- **Datos:** `apps/web/public/rules/<tipo>.json` (~7 MB en 18 archivos), se pide cada
  archivo la primera vez que hace falta. Salen de los datos 5etools que trae Plutonium.
  Los registros se indexan por `nombre|fuente` en minúsculas; subclase
  `nombre|clase|fuente`; subraza `nombre|especie|fuente`; rasgos de clase y subclase
  incluyen clase, nivel y fuente.
- **Regenerarlos:** `node scripts/build-rules-text.mjs <data-de-plutonium> <salida>`. El
  directorio de datos está en la VM de Foundry
  (`/home/foundry/data-b/Data/modules/plutonium/data`); se corre allá por ssh en solo
  lectura y se copia el resultado a `apps/web/public/rules/`. El extractor resuelve las
  copias (`_copy` con `_mod`), sintetiza los rasgos de las subclases que no los listan y
  deja afuera el texto de ambientación (*fluff*).
- **Código:** `lib/rules-text.ts` (carga y búsqueda, prefiere los libros de la edición),
  `lib/rules-markup.ts` (lee las etiquetas `{@…}`), `lib/rules-meta.ts` (las líneas de
  datos: nivel, alcance, daño, precio…), y `components/info/` (`InfoProvider`/`useInfo`,
  `InfoPanel`, `RulesBody`, `InfoLink`).
- **Se abre solo con una elección o un clic**, nunca al pasar el mouse. Es un panel
  fijo a la izquierda desde 1500 px y una hoja inferior en pantallas más chicas.
- Pruebas: `test/rules-markup.test.ts` (analizador, búsqueda y que no falten datos:
  ninguna subclase sin rasgos, razas y trasfondos copiados con su texto).
- Lo que **no** es un hueco: 474 objetos y 161 idiomas no tienen texto en los libros
  (un ábaco son solo peso y precio). El panel muestra sus datos o lo aclara.

## Registro en vivo y Códice

- `LiveSheet` crece hacia la derecha en secciones de 440 px con desplazamiento
  horizontal; los rasgos de especie y conjuros que ya tenés son vínculos al panel.
- El estante del Códice (`codex/shelf/`) muestra tres tomos a la vez y **se navega con
  las flechas de los costados** (o el teclado). No hay otra lista.

## Cómo se verifica

- **Todo test corre en GitHub**, no en la máquina local: el job `verify` de
  `.github/workflows/verify.yml` (entorno, paquetes, la web con `web:verify` —tipos,
  pruebas y build—, y las pruebas de contratos, API, Worker, módulo de Foundry, dominio e
  índices). Antes de mergear, `verify` tiene que estar en verde.
- Cada PR tiene su preview de Vercel. La URL sale de los *deployments* de GitHub
  (`gh api repos/<repo>/deployments?sha=<sha>`).
- Para cambios visibles se recorre la preview con un navegador automatizado y se mira la
  captura **contra lo que se pidió**, no solo contra "no hay errores". Las flechas del
  estante estuvieron un PR entero invisibles (fondo con `bg-[var(--x)]/90`, que Tailwind
  no genera) y ninguna prueba lo notó.
- Los PR los mergea el dueño (o lo autoriza en el chat); ramas por tema y squash.

## Decisiones vigentes

- **Sin modo framework de React Router.** El front es una SPA de cinco rutas; pre-renderizar
  solo ayudaría a la portada y se haría aparte si hiciera falta.
- **Migración de Vercel a Cloudflare: en pausa**, por decisión del dueño. El plan está en
  [`MIGRACION-CLOUDFLARE.md`](./MIGRACION-CLOUDFLARE.md); no se toca hosting ni DNS.
- **El módulo de Foundry cambia de versión** en la próxima actualización y se redirige
  entonces; nada del front debe depender de la URL actual del manifiesto.
- **La subraza sí cruza a Foundry:** `race.subrace` va en el payload y el módulo importa
  la subraza como entidad completa.
- **Producto público y universal:** hoy exporta a Foundry, JSON y PDF; Roll20 y D&D Beyond
  están latentes en `lib/export-targets.ts`. El nombre y el dominio de la herramienta
  pública siguen sin decidirse.

## Pendientes que no se hacen por ahora

Decididos por el dueño: el ID de GM del sidecar (`FOUNDRY_GM_USER_ID`), el actor de
prueba "Thermos" en mesa-ivan y el selector de rol. No se retoman sin que lo pida.
