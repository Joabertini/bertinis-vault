# Portabilidad — qué de este repo puede correr fuera del navegador

Escrito el 2026-09-02. Es un documento que **afirma**: se mantiene.

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

Ejecutada el 2026-09-02 sobre `main` = #74.

### `packages/` — portable, los seis

Ningún paquete toca una API de navegador. Cero, no "casi cero".

| Paquete | Dependencias | Nota |
| --- | --- | --- |
| `contracts` | `zod` | Las formas que todos acuerdan |
| `vetools-ref` | — | La terna `{page, source, hash}` y las fuentes |
| `vetools-index` | `vetools-ref`, `contracts` | El índice de navegación, 47 KB gzip |
| `domain` | `contracts`, `data-engine` | Reglas 5e. Arrastra `data-engine`, que es legado |
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

### `apps/web/src/lib` — acá está el problema

De **42 archivos, 37 son lógica pura**: sin React, sin zustand, sin navegador.
Suman **10.699 líneas** de reglas de D&D 5e.

Sólo cinco están atados a la web:

| Archivo | Por qué |
| --- | --- |
| `vault-client.ts` | `fetch` contra el almacén |
| `account-client.ts` | `fetch` y sesión |
| `export-targets.ts` | Arma el HTML de la exportación |
| `vault-store.ts` | zustand |
| `codex-sync.ts` | Hook de React |

Los otros 37 —`spells.ts`, `improvements.ts`, `grants.ts`, `starting-kit.ts`,
`expertise.ts`, `weapon-mastery.ts`, `granted-spells.ts`,
`optional-features.ts`, `table-numbers.ts`, `derive.ts`, `playbook.ts`…— son
exactamente lo que el escritorio querría y hoy **no puede tomar, porque está
adentro de una app de React**. No por su código: por dónde vive.

## La regla

**Reglas nuevas de 5e van a un paquete, no a `apps/web/src/lib`.**

Un archivo de `lib/` que hoy es puro no puede volverse impuro: si necesitás
`fetch`, `localStorage` o un hook, la lógica va a una función pura y el
navegador se queda del lado del que llama.

Esto no es prolijidad. Es la diferencia entre que el descargable tome 10.699
líneas ya probadas o las vuelva a escribir.

## Lo que no se hace todavía

**Mudar `lib/` a un paquete no está hecho, y es a propósito.** Primero la
frontera escrita y medible; después la mudanza, que es mecánica y ruidosa. Al
revés —mover diez mil líneas y después escribir por qué— es el orden que dejó
la documentación en el estado que este documento existe para corregir.

Cuando se haga, `domain` es el destino natural para las reglas, y hace falta
sacarle antes la dependencia con `data-engine`.

## Lo que este producto explícitamente no hace

Corresponden al descargable, no acá: funcionamiento sin conexión, archivos
locales, paquetes de contenido instalables, IA local, y varios sistemas de
juego. La web hace 5e, en un navegador, con cuenta.
