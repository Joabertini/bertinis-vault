# Faro del Alba — el front

El builder de personajes. Vite + React 19 + react-router + Tailwind +
framer-motion + zustand. Todo se resuelve en el cliente contra el índice de
5etools bundleado; el Worker sólo guarda y devuelve builds por código.

## Las cuatro salas

| Ruta | Archivo | Qué hace |
|---|---|---|
| `/` | `routes/Gate.tsx` | El umbral. Elegís edición 2014 o 2024, que decide qué libros son legales. |
| `/forge` | `routes/Forge.tsx` | La Fragua: nueve cámaras. El orden lo arma `lib/chambers.ts` según cuánto D&D sabés. |
| `/codex` | `routes/Codex.tsx` | El estante de personajes sellados. |
| `/ritual` | `routes/Ritual.tsx` | El export. Foundry, JSON y hoja imprimible cruzan; D&D Beyond y Roll20 están dormidos y dicen por qué. |

## Correrlo

```
corepack pnpm web:dev        # 127.0.0.1:4173
```

Los paquetes `@bertinis-vault/*` resuelven a su `src/`, así que tocar
`packages/domain` se ve sin reconstruir nada.

Antes de un PR:

```
corepack pnpm web:verify
corepack pnpm --filter @bertinis-vault/web probe
```

## Tocar el aspecto

- Un color o una tipografía: `src/styles/`.
- Una receta que se repite tres veces o más **y** carga una decisión: `src/styles/recipes.ts`.
  Ahí arriba está el **piso de contraste** medido — leerlo antes de atenuar nada.
- Lo que aparece una sola vez sigue inline en su componente, que es donde se lee mejor.
- Una regla de D&D que explica un panel va en un `<RuleNote>`, no en un párrafo
  debajo del label.

## Sondas

Para medir algo contra los datos reales sin montar un test:

```
corepack pnpm exec vite build --ssr probes/X.ts --outDir .probe && node .probe/X.js
```

## Dónde está lo demás

El estado vivo del proyecto vive en `docs/` del repo: `AI-HANDOFF.md`,
`AUDITORIA-CREACION.md`, `MIGRACION-FRONT.md`, `CHARACTER-MODEL-GAPS.md`.
