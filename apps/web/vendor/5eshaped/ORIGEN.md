# De dónde salen estos archivos

La hoja de personaje que el Vault dibuja **no es nuestra**. Es la *5e Shaped
character sheet* de roll20.

- **Autor:** Mark Lenser (Kryx en roll20). El script lo hizo Lucian.
- **Origen:** el repositorio `Roll20/roll20-character-sheets`, carpeta
  `5eShaped`. Copia local tomada el 2026-09-06.
- **Versión:** la que declara `sheet.json` (`1695962898`), marcada
  `"legacy": true` por roll20.
- **Edición:** 2014. No tiene inspiración heroica, ni maestría de armas, ni
  especies — o sea, **no sirve para un personaje 2024**, y por eso
  `CharacterSheet.tsx` no se la ofrece.

## Licencia

Ninguna de las dos copias trae archivo de licencia. El repositorio de origen es
público y está pensado para que la comunidad use y modifique las hojas, pero
eso no es una licencia escrita: si esto alguna vez sale del uso interno, hay
que pedirle permiso al autor o reemplazar la hoja.

Los archivos están acá **sin modificar**. Todo lo que hay que cambiarles para
que rendericen fuera de roll20 lo hace `scripts/build-shaped-sheet.mjs` al
construir, así que actualizar la hoja es sobrescribir estos archivos y volver a
correr el build.

## Qué es cada archivo

| Archivo | Qué es |
|---|---|
| `5eShaped.html` | La hoja. Un formulario de roll20: `attr_*` para los datos, `data-i18n` para los rótulos, `<fieldset class="repeating_*">` para las listas. |
| `5eShaped.css` | Su hoja de estilos, escrita contra los nombres de clase **con** el prefijo `sheet-` que roll20 agrega al subirla. |
| `labels-es.json` | Traducción al español de roll20. 1022 claves, 199 traducidas de verdad. |
| `labels-en.json` | La misma en inglés, que es el piso cuando el español no está. |
| `sheet.json` | El manifiesto de roll20, tal cual. Autoría y versión salen de acá. |

Las imágenes de fondo las pide la CSS a `gistcdn.githack.com`, que es donde el
autor las publicó. No están acá.
