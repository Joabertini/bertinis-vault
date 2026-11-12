# @bertinis-vault/forge

Las reglas del constructor: estado, derivación, opciones, conjuros, equipo,
exportación. Es lo que la web y el descargable ejecutan por igual.

- Sin navegador y sin Node. `tsconfig.json` compila con `lib: ["ES2022"]` y sin
  tipos de DOM, así que un `window` o un `fetch` acá no compila.
- Se importa por archivo: `@bertinis-vault/forge/spells`.
- `apps/web/src/lib/<archivo>.ts` reexporta cada módulo, por eso la web sigue
  importando de `@/lib/...`.
- Sus tests viven por ahora en `apps/web/test`.

Ver `docs/PORTABILIDAD.md`.
