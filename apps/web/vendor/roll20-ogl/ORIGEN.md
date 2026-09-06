# De dónde sale esta hoja

`captura-v4.21.html` es el `<body>` de una hoja de personaje de roll20, copiada
del navegador con el personaje abierto. No está reescrita ni recortada: es el
DOM tal cual lo entregó roll20.

- **Hoja:** *D&D 5E by Roll20* (la OGL), versión `4.21` — la declara
  `<input name="attr_version" value="4.21">` dentro del propio archivo.
- **Autor:** roll20. La hoja cita el SRD 5.0 bajo la OGL y su documentación
  está en `https://wiki.roll20.net/5th_Edition_OGL_by_Roll20`.
- **Copia tomada:** 2026-09-06, de una partida con el personaje *Gritko*
  cargado (Battle Master Fighter 9).

## Por qué una captura y no el repositorio

Esta hoja **no está** en `Roll20/roll20-character-sheets`. Ahí sólo quedaron sus
imágenes: el HTML y la CSS nunca fueron públicos. Lo comprobado, para que nadie
lo vuelva a buscar:

- El árbol de `master` no tiene ningún `.css` ni `.html` bajo
  `5th Edition OGL by Roll20/`, sólo `images/`.
- El último commit que tocó esa carpeta (`00cc37d`) borra las imágenes; el padre
  (`aa7aef5`) tampoco tiene código.
- La búsqueda de código de GitHub no devuelve nada para clases propias de la
  4.21 (`printable-pc-sheet`, `repeating_kingdom-feats`).

Por eso el punto de partida es el DOM renderizado y no el fuente.

## Qué le falta: la hoja de estilos

**`sheet.css` no está acá y sin ella la hoja se dibuja como una columna de
campos sin formato.** No se puede sacar de ningún repositorio público (ver
arriba) y `app.roll20.net` responde 403 sin sesión.

Sale del mismo navegador de donde salió la captura: con la hoja abierta, en la
consola de DevTools,

```js
copy([...document.styleSheets]
  .flatMap(s => { try { return [...s.cssRules] } catch { return [] } })
  .map(r => r.cssText).join("\n"))
```

y lo pegado se guarda como `apps/web/vendor/roll20-ogl/sheet.css`. Mientras no
esté, `scripts/build-ogl-sheet.mjs` avisa y emite una CSS vacía.

## Qué hace el build con esto

La captura ya viene con **todo lo que roll20 hace en vivo**: los rótulos
`data-i18n` ya tienen su texto en español, las listas repetidas ya están
expandidas en `.repcontainer > .repitem`, y las clases vienen **sin** el prefijo
`sheet-`. O sea que no hay que traducir, ni clonar plantillas, ni prefijar nada
— los tres pasos que sí necesitaba la hoja Shaped.

Lo único que hace `scripts/build-ogl-sheet.mjs` es recortar el `.charsheet` del
resto de la ventana de roll20 (barra de macros, diálogo) y sacar el `<script>`.
Los datos los escribe `ogl-render.ts` al vuelo, encima de los de Gritko.

## Licencia

No hay archivo de licencia porque no hay repositorio del que venga. La hoja es
código de roll20 y el personaje es de una partida propia. Esto vale para uso
interno; si el Vault se publica con la hoja adentro hay que pedir permiso a
roll20 o reemplazarla.
