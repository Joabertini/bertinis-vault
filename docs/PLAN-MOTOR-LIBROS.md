# Motor de libros — plan de creación e implementación (2026-11-19)

Un usuario sube el PDF de un libro. El motor lo lee, lo convierte a datos que el
constructor ya entiende y se los devuelve. **El libro y el resultado nunca se
guardan en nuestros servidores. No usa IA: es un motor de procesamiento de
texto, con reglas, diccionarios y tests.**

## 1. Qué medí en el corpus real

Corpus: `Downloads\D&D\libros\Core y suplementos` (9 PDF, 683 MB). Sondeo con
`pdfinfo`, `pdftotext` y `pdffonts`, sin correr nada pesado.

| Libro | Págs | Capa de texto | Problema medido |
|---|---|---|---|
| PHB (EN, 150 dpi) | 322 | OCR de escáner (Kodak) | ruido OCR: "IlIusion", "Cirele", "Fali", "Continuai" |
| Monsters Manual (EN) | 354 | sí | pendiente de revisar |
| Manual de monstruos (ES) | 354 | OCR (ilovepdf) | pendiente de revisar |
| Manual del DM completo (ES) | 325 | OCR (Paper Capture) | pendiente de revisar |
| Manual del Jugador (ES, 2014) | 324 | OCR (Acrobat) | páginas con imagen de fondo a 215 ppi |
| Manual del Jugador 2024 (ES) | 388 | sí | saltos de línea sueltos; con `-enc UTF-8` los acentos salen bien |
| Tasha's (EN) | 194 | texto con letras separadas | "a n i m a l", "fi n d", "i n life", guiones de corte (`crum-` / `bling`) |
| Xanathar's (EN) | 195 | sí | pendiente de revisar |
| Volo's — Maps (EN) | 14 | **ninguna** | solo mapas: el motor detecta "sin texto" y avisa |

Conclusiones que mandan en el diseño:

1. **Todas las páginas van a dos o tres columnas** y las listas (conjuros por clase) mezclan columnas al extraer en orden de lectura. Hay que extraer con coordenadas y reconstruir columnas.
2. **El texto es sucio** (OCR, letras separadas, guiones de corte). Se limpia con reglas y diccionarios, no con IA (ver §4, etapa 2).
3. **El formato de salida ya existe**: el constructor lee JSON estilo 5etools, con claves `"nombre|FUENTE"` (ej. `"air bubble|aag"` con `level`, `school`, `time`, `range`, `components`, `duration`, `entries`). El motor produce ese mismo formato; el constructor no cambia.
4. **Hay verdad de referencia** para los libros en inglés: `apps/web/public/rules/*.json` ya trae sus conjuros, dotes y rasgos. Sirve para medir el motor sin corregir nada a mano.
5. **Los libros en español traen el vocabulario oficial** (nombres de conjuros, clases, estados). El motor lo extrae como tabla EN↔ES para usar de glosario.

## 2. Dónde vive y por qué nada se guarda

**Decisión: el motor es un paquete TypeScript puro que corre en el navegador del usuario.** No hay servidor en el medio.

```
navegador del usuario
─────────────────────
PDF (nunca sale del dispositivo)
 └ pdf.js en un Web Worker → texto con coordenadas por página
    └ reconstrucción: columnas, orden, limpieza
       └ clasificación de página
          └ segmentación en entradas
             └ analizadores por tipo (perfiles es / en)
                └ validación (zod, contracts) + informe de calidad
                   └ IndexedDB del usuario  +  descarga .json / .xml
```

- **Cloudflare / Supabase:** el motor no los necesita, porque no hay IA que alojar ni nada que guardar. Un Worker tampoco podría recibir un PDF de 80–180 MB (límites de memoria y CPU). Como el paquete es puro, si más adelante se quiere correrlo del lado del servidor (por ejemplo por lotes en una VM), es el mismo código, sin cambios.
- Resultado guardado **solo en el dispositivo** (IndexedDB) y exportable. Se verifica con un test que durante una importación no sale ninguna solicitud de red con contenido del libro.

## 3. Esquema de salida

```json
{ "source": { "id": "USR-xxxx", "nombre": "…", "idioma": "es|en",
              "edicion": "2014|2024", "pdfSha256": "…" },
  "spell": { "bola de fuego|USR-xxxx": { … igual que public/rules/spell.json … } },
  "feat": {}, "classFeature": {}, "subclass": {}, "background": {}, "race": {}, "item": {}, "monster": {} }
```

El constructor carga estos paquetes como una fuente más (`vetools-ref`:
registrar fuente de usuario). `pdfSha256` identifica el libro sin guardarlo.

## 4. Etapas del motor (todas deterministas)

1. **Ingesta.** `pdf.js` en un Web Worker. Por página: bloques de texto con `x, y, tamaño de fuente, fuente`.
2. **Reconstrucción y limpieza.**
   - Columnas por histograma de `x`; orden de lectura; quitar encabezados y pies repetidos.
   - Letras separadas ("a n i m a l"): se unen con un diccionario de palabras del idioma y, si falta, del vocabulario de las reglas (`public/rules`).
   - Guiones de corte (`crum-` / `bling`): se unen si la palabra resultante está en el diccionario.
   - Ruido de OCR: tabla de confusiones típicas (`I`↔`l`↔`1`, `rn`↔`m`, `ci`↔`o`, `c`↔`e`: "Cirele"→"Circle", "Fali"→"Fall") aplicada solo cuando la palabra corregida está en el diccionario o en la lista de nombres conocidos. Para los nombres de conjuros y objetos se usa coincidencia aproximada (distancia de edición) contra el índice del constructor.
   - Lo que no se pueda resolver con certeza **no se inventa**: se deja tal cual y la entrada queda marcada como dudosa.
3. **Clasificación de página** por reglas: texto corrido, lista de conjuros, tabla, ficha de monstruo, sin texto (se avisa y se salta).
4. **Segmentación en entradas.** Por tamaño y estilo de fuente de los títulos y por marcas fijas: conjuro (`Nivel/Level … escuela` + `Tiempo de lanzamiento/Casting Time`), monstruo (`Clase de Armadura/Armor Class`), dote (`Prerrequisito/Prerequisite`), rasgo de clase (`Nivel N:`).
5. **Análisis por tipo.** Un analizador por tipo, con un perfil de etiquetas por idioma (`es`, `en`) y una gramática para cada bloque: cabecera de conjuro, ficha de monstruo, tablas de equipo, listas de rasgos por nivel. La prosa se convierte en `entries` por reglas de párrafos y subtítulos.
6. **Validación.** zod desde `packages/contracts`; los nombres se cruzan con el índice base para generar las etiquetas `{@spell …}`/`{@condition …}`; deduplicar por `nombre|fuente`; cada entrada lleva `confianza` y la lista de campos dudosos.
7. **Informe de calidad.** Qué se leyó, qué se saltó, qué quedó dudoso, para revisar en pantalla.
8. **Salida.** IndexedDB + descarga `.json`, y exportador `.xml` estilo Aurora Builder (P7).

## 5. Fases, entregables y criterio de salida

Todo corre en CI o en la VM, no en la PC del dueño.

| Fase | Entregable | Sale cuando |
|---|---|---|
| **P0 Banco de pruebas** | `packages/book-engine/` con arnés que corre un PDF y compara con `public/rules`; informe por libro | mide precisión y recobrado de nombres y campos en PHB EN, Xanathar's y Tasha's |
| **P1 Reconstrucción y limpieza** | etapas 1–3 con tests sobre páginas reales de los 9 libros | columnas y orden correctos en ≥98 % de las páginas muestreadas; Volo's detectado como "sin texto"; ruido de OCR y letras separadas corregidos en las muestras |
| **P2 Conjuros de punta a punta** | conjuros EN y ES → paquete → el constructor los ofrece | ≥98 % de los conjuros de PHB/XGE/TCE coinciden con la referencia en nombre, nivel, escuela, alcance, componentes y duración |
| **P3 Dotes, rasgos, subclases, trasfondos, especies** | analizadores y validación | ≥95 % de coincidencia en nombre y texto normalizado; el resto marcado como dudoso |
| **P4 Objetos y monstruos** | tablas de equipo y fichas | ≥95 % en campos numéricos (CA, PG, CR, precio, peso) |
| **P5 Pantalla de importar** | subir libro, progreso, informe, ver/corregir dudosos, IndexedDB, descarga | un usuario sube un PDF de punta a punta sin intervención |
| **P6 Prueba de privacidad** | test automático | durante una importación no sale ninguna solicitud de red con contenido del libro y no queda nada fuera del IndexedDB del usuario |
| **P7 Exportar XML (Aurora)** | exportador desde el esquema propio | un paquete exportado abre sin errores en Aurora Builder |
| **P8 Glosario EN↔ES** | tabla de nombres oficiales sacada de los libros en español | cubre conjuros, clases, estados y habilidades de MP ES y MP 2024 |

## 6. Mis decisiones (para corregir)

- Sin IA y sin servidor: el motor es un paquete TypeScript puro que corre en el navegador.
- Formato de salida = el JSON que el constructor ya lee; Aurora XML es solo un exportador.
- El ruido de OCR se corrige con diccionarios, tabla de confusiones y coincidencia aproximada contra los nombres del índice; lo que no se resuelve queda marcado, no se adivina.
- Libros solo-imagen (Volo's Maps): se detectan y se avisan; sin OCR propio en esta versión.
- Un libro = una fuente de usuario `USR-<hash>`; se pueden cargar varios.

## 7. Riesgos

- **OCR muy sucio** (PHB EN a 150 dpi): sin IA la tasa de entradas dudosas puede ser más alta. Se mide en P0 y P1 antes de seguir; la pantalla de importar (P5) deja corregir a mano lo dudoso.
- **Variedad de diseños entre libros:** cada libro nuevo puede traer una maqueta distinta. Los analizadores se escriben contra el corpus de 9 libros y se amplían con cada libro nuevo.
- **Una importación larga** en el navegador: se procesa por entradas con reanudación, para no perder lo hecho si se cierra la pestaña.
