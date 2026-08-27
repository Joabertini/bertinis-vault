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

### Pendiente, en orden

- [ ] **Reescribir cinco suites contra la API nueva.** `spell-counts`,
      `subclass-spells`, `feat-prerequisites`, `optional-features`,
      `starting-equipment` y `origin-abilities` prueban comportamiento que el
      Faro **sí tiene**, con otros nombres. No es portar funciones: es apuntar
      el test al módulo que hoy es dueño. Ver `test/pending/README.md`.
- [ ] **Multiclase.** Hueco real del Faro: la Forja asume una clase. Además
      `deriveCharacterBuild` usa `classes[0]`, así que arreglarlo del lado del
      front no alcanza — Guerrero 5 / Mago 3 da 68 PG en vez de ~58.
- [ ] **Maestría de armas.** El Faro muestra la maestría de un arma pero no deja
      elegirla. Bloqueado además porque no se escribe al actor.
- [ ] **Expertise.** Nunca tuvo test. `normalizedProficiencyKindSchema` no tiene
      el kind, así que hoy se elegiría algo que nunca llega al payload.
- [ ] **Smoke test de la Forja** que reemplace a `builder-page.test.tsx`, que se
      fue con el front viejo.
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
