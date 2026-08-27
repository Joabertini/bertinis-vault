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

- [ ] **Aplicar el kit inicial.** `starting-equipment` no era API renombrada
      como decía el triaje: el Faro **imprime** el equipo de clase como texto y
      el jugador tiene que buscar cada objeto a mano en la mochila. La suite
      prueba que entre al personaje con su cantidad, respetando las elecciones
      ("greataxe **o** battleaxe") y la alternativa de oro inicial.
- [ ] **Multiclase.** La Forja asume una clase. Además `deriveCharacterBuild`
      usa `classes[0]`, así que arreglarlo del lado del front no alcanza —
      Guerrero 5 / Mago 3 da 68 PG en vez de ~58.
- [ ] **Maestría de armas.** El Faro muestra la maestría de un arma pero no deja
      elegirla. Bloqueado además porque no se escribe al actor.
- [ ] **Expertise.** Nunca tuvo test. `normalizedProficiencyKindSchema` no tiene
      el kind, así que hoy se elegiría algo que nunca llega al payload.
- [ ] **Smoke test de la Forja** que reemplace a `builder-page.test.tsx`.
- [ ] **Cortar el bundle.** 2.03 MB, 312 kB gzip, en un solo chunk.
- [ ] **Export/importar el Códice.** Los personajes viven sólo en `localStorage`.
      Se pierden al limpiar el navegador, en incógnito, o en otra máquina.

### Para seguir trabajando en el front

`corepack pnpm web:dev` levanta en `127.0.0.1:4173`. Los paquetes resuelven a su
`src/`, así que tocar `packages/domain` se ve sin reconstruir. Antes de un PR:
`corepack pnpm web:verify` y `corepack pnpm --filter @bertinis-vault/web probe`.

Para cambiar el aspecto: un color o una face es `styles/`; una receta repetida es
`styles/recipes.ts`; lo que aparece una sola vez sigue inline en su componente,
que es donde se lee mejor.
