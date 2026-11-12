# Portabilidad — qué de este repo puede correr fuera del navegador

Escrito el 2026-09-02, actualizado el 2026-11-12 con la mudanza de `lib`.

## Por qué existe

`Joabertini/Faro-del-alba` es el producto descargable — Tauri, local-first, con
su propio motor de reglas. Su `ADR-0001` fija cómo se relacionan los dos
productos:

> Convergence should happen through **explicit shared contracts and portable
> engines**, not through forced synchronization of entire applications.

Y su `ROADMAP.md` fija el principio que alcanza a este repositorio:

> **Web/Desktop reuse.** The rules/domain core must not depend on Tauri, React
> or browser APIs.

El primer hito de Faro incluye, textual, *"identify which Bertinis Vault
packages can become platform-independent"*. Esta página es esa respuesta,
medida.

La regla no se puede hacer cumplir desde el otro repositorio. Vive acá.

## La medición

Ejecutada el 2026-11-12 sobre `main` = #156.

### `packages/` — portable, los siete

Ningún paquete toca una API de navegador. Cero, no "casi cero".

| Paquete | Dependencias | Nota |
| --- | --- | --- |
| `contracts` | `zod` | Las formas que todos acuerdan |
| `vetools-ref` | — | La terna `{page, source, hash}` y las fuentes |
| `vetools-index` | `vetools-ref`, `contracts` | El índice de navegación, 47 KB gzip |
| `domain` | `contracts`, `data-engine` | Reglas 5e. Arrastra `data-engine`, que es legado |
| `forge` | `contracts`, `data-engine`, `domain`, `vetools-index`, `vetools-ref` | Las reglas del constructor: 53 archivos, 14.156 líneas |
| `data-engine` | — | Legado, a retirar |
| `foundry-exporter` | `contracts`, `data-engine`, `domain` | Legado, a retirar |

El comando que lo vuelve a medir. **Tiene que devolver vacío:**

```
grep -rnE "\b(window|document|navigator|localStorage|sessionStorage|caches)\.|\bfetch\(|\bXMLHttpRequest\b" \
  packages/*/src --include=*.ts | grep -vE ":[0-9]+: *(\*|//|/\*)"
```

El segundo `grep` descarta comentarios, y hace falta: en prosa aparecen "a
Foundry *document*" y, en los datos de D&D, `navigator's tools`. Un chequeo que
no los descarte da tres falsos positivos y enseña a ignorarlo.

`forge` además se compila sin tipos de DOM (`lib: ["ES2022"]`), así que ahí un
`window` o un `fetch` no llega al `grep`: no compila.

### `apps/web/src/lib` — lo que queda

Las reglas ya no viven acá. Los 51 archivos puros se mudaron a
`packages/forge`, y en su lugar quedó un reexporte de una línea, por eso la web
sigue importando de `@/lib/...`.

Quedan nueve archivos con código, todos atados a la web:

| Archivo | Por qué |
| --- | --- |
| `vault-client.ts` | `fetch` contra el almacén |
| `account-client.ts` | `fetch` y sesión |
| `export-targets.ts` | Arma el HTML de la exportación |
| `vault-store.ts` | zustand |
| `codex-sync.ts` | Hook de React |
| `share-link.ts` | `window.location` |
| `share.ts` | Publica con `vault-client` |
| `cover-image.ts` | Canvas y `fetch`; los límites y la validación están en `forge` |
| `rules-text.ts` | `fetch` de `/rules/<kind>.json`; los tipos están en `forge` |

## La regla

**Reglas nuevas de 5e van a `packages/forge`, no a `apps/web/src/lib`.**

Si una regla necesita `fetch`, `localStorage` o un hook, la lógica va a una
función pura en el paquete y el navegador se queda del lado del que llama.

Un archivo nuevo en `lib/` es código atado a la web, o un reexporte.

## Lo que no se hace todavía

- **Fusionar `forge` con `domain`.** Hace falta sacarle antes a `domain` la
  dependencia con `data-engine`.
- **Las transiciones de `vault-store`.** Qué cambia en el borrador con cada
  elección sigue dentro del store de zustand; es regla y tiene que pasar a
  `forge` como funciones puras.
- **Los tests.** Los de las reglas siguen en `apps/web/test`.

## Lo que este producto explícitamente no hace

Corresponden al descargable, no acá: funcionamiento sin conexión, archivos
locales, paquetes de contenido instalables, IA local, y varios sistemas de
juego. La web hace 5e, en un navegador, con cuenta.
