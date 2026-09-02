# Bertini's Vault API

> **Legado, a retirar. No construir sobre esto.**
>
> Este servicio existía para servir contenido al builder. Se midió y se decidió
> lo contrario: el índice de navegación viaja con la app (47 KB gzip) y el
> detalle completo va como assets estáticos, así que **ningún servidor sirve
> contenido**. El único backend es `apps/worker`, que guarda una build y la
> devuelve por código.
>
> Se conserva porque `packages/data-engine` todavía lo acompaña y porque
> `bertinis-5e-api` sirvió como volcado fijado de 5etools para build time.
> Retirarlo está en `ARCHITECTURE-PLAN.md`, sección *State of the migration*.

Backend/BFF del proyecto.

Responsabilidades previstas:

- normalizar y exponer datos del builder;
- cachear y versionar datasets provenientes de 5etools;
- servir drafts, personajes y exportaciones;
- desacoplar el frontend de fuentes externas y de formatos de Foundry.

Estado actual:

- servicio TypeScript compilable dentro del workspace;
- endpoint `GET /health`;
- endpoints semanticos de datasets:
  - `/datasets/classes`
  - `/datasets/races`
  - `/datasets/backgrounds`
  - `/datasets/feats`
  - `/datasets/equipment`
  - `/datasets/spells`
  - `/datasets/builder-options`
- proxy selectivo `GET /upstream/json?path=...` con cache en memoria;
- servidor exportable via `createApiServer()` para pruebas e integraciones;
- smoke tests reales para:
  - health
  - builder-options
  - spells
  - equipment
  - rechazo de `upstreamPath` no permitido
  - validacion de `/upstream/json`
  - 404 consistente para rutas desconocidas

Notas de integracion:

- `GET /datasets/classes?source=local|upstream|hybrid`
- `GET /datasets/races?source=local|upstream|hybrid`
- `GET /datasets/backgrounds?source=local|upstream|hybrid`
- `GET /datasets/feats?source=local|upstream|hybrid`
- `GET /datasets/equipment?source=local|upstream|hybrid`
- `GET /datasets/spells?source=local|upstream|hybrid`
- `upstreamPath` es configurable por query string
- variables soportadas:
  - `BERTINIS_5E_UPSTREAM_CLASSES_PATH`
  - `BERTINIS_5E_UPSTREAM_RACES_PATH`
  - `BERTINIS_5E_UPSTREAM_BACKGROUNDS_PATH`
  - `BERTINIS_5E_UPSTREAM_FEATS_PATH`
  - `BERTINIS_5E_UPSTREAM_EQUIPMENT_PATH`
  - `BERTINIS_5E_UPSTREAM_SPELLS_PATH`

`/datasets/equipment` devuelve `gear`, `armor` y `weapons`.

Comandos utiles:

```bash
corepack pnpm install
corepack pnpm --filter @bertinis-vault/api dev
corepack pnpm --filter @bertinis-vault/api test
```
