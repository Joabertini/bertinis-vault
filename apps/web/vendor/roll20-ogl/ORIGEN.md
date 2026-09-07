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

## La hoja de estilos

`sheet.css` está acá, sacada del mismo navegador que la captura el 2026-09-07.
Son 737 KB y no sale de ningún repositorio público (ver arriba): roll20 la
inyecta como un `<style>` sin archivo, y `app.roll20.net` responde 403 sin
sesión.

Cuelga todo de `.charsheet`, que es una de las clases del nodo raíz del recorte
(`<div class="charactersheet tab-pane charsheet …">`). Sus `url()` apuntan a
`app.roll20.net` en absoluto, así que las imágenes de fondo cargan sin
vendorizar nada.

**Para volver a sacarla**, con la hoja abierta y en la consola de DevTools, hay
que encontrar primero cuál de las hojas de estilo es — el índice cambia en cada
carga y las de otro origen tiran `SecurityError`:

```js
[...document.styleSheets].forEach((s, i) => {
  try {
    const hit = [...s.cssRules].filter(r => /charsheet|repcontainer/.test(r.selectorText ?? ""));
    if (hit.length) console.log(i, s.href ?? "(inline <style>)", hit.length);
  } catch (e) { console.log(i, s.href ?? "(inline)", "BLOQUEADA " + e.name); }
})
```

La nuestra es la inline con miles de reglas. Con ese índice,
`copy([...document.styleSheets[N].cssRules].map(r => r.cssText).join("\n"))`, y
lo pegado va tal cual en este archivo — **sin una línea de texto adelante**: un
`@import` sólo vale al principio de la hoja, y cualquier cosa antes se lleva
puestas las cuatro importaciones de fuentes.

Si el archivo no está, `scripts/build-ogl-sheet.mjs` avisa y emite una CSS
vacía; la hoja se dibuja como una columna de campos sin formato.

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
