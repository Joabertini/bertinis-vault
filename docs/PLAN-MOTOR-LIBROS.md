# Motor de libros — plan de creación e implementación (2026-11-19)

Un usuario sube el PDF de un libro. El motor lo lee, lo convierte a datos que el
constructor ya entiende y se los devuelve. **El libro y el resultado nunca se
guardan en nuestros servidores.**

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
| Volo's — Maps (EN) | 14 | **ninguna** | solo mapas: el motor debe detectar "sin texto" y avisar |

Conclusiones que mandan en el diseño:

1. **Todas las páginas van a dos o tres columnas** y las listas (conjuros por clase) mezclan columnas al extraer en orden de lectura. Hace falta extraer con coordenadas y reconstruir columnas.
2. **El texto es sucio** (OCR, letras separadas, guiones de corte). Reglas fijas solas no alcanzan: hace falta un paso que repare y estructure.
3. **El formato de salida ya existe**: el constructor lee JSON estilo 5etools, con claves `"nombre|FUENTE"` (ej. `"air bubble|aag"` con `level`, `school`, `time`, `range`, `components`, `duration`, `entries`). El motor produce ese mismo formato; así el constructor no cambia.
4. **Hay verdad de referencia** para los libros en inglés: `apps/web/public/rules/*.json` ya trae sus conjuros, dotes y rasgos. Sirve para medir el motor sin corregir nada a mano.
5. **Los libros en español traen el vocabulario oficial** (nombres de conjuros, clases, estados). El motor lo extrae como tabla EN↔ES; sirve como glosario.

## 2. Dónde vive y por qué nada se guarda

**Decisión: el archivo se procesa en el navegador del usuario; un Worker de Cloudflare sin estado solo presta la IA.**

```
navegador                                   Worker Cloudflare (sin estado)
─────────                                   ─────────────────────────────
PDF (nunca sale)
 └ pdf.js en Web Worker
    └ texto con coordenadas por página
       └ columnas, encabezados, limpieza
          └ segmenta en entradas ───────────► /motor/estructurar  (texto de una entrada)
                                              └ Claude (Haiku 5.5) con esquema JSON
             ◄───────────────────────────────  └ devuelve JSON, no escribe nada
          └ valida con zod (contracts)
          └ IndexedDB del usuario  +  descarga .json / .xml
```

- El PDF **no se sube**. Al Worker solo viaja el texto de una entrada (unos cientos de palabras), nunca el archivo ni páginas completas.
- El Worker **no escribe en KV, R2, D1 ni Supabase** y no registra el cuerpo de las solicitudes. Se verifica con un test.
- **Por qué Cloudflare y no Supabase:** el Worker ya existe (`apps/worker`), ya exige sesión de Discord y Turnstile (#200–#203) y no tiene límite práctico para esto. Supabase solo aportaría almacenamiento, que no queremos. Un Worker no puede recibir un PDF de 80–180 MB (límite de memoria y de CPU), y por eso el archivo se lee en el navegador.
- Resultado guardado **solo en el dispositivo** (IndexedDB) y exportable. Si el usuario borra el sitio, lo exporta antes o vuelve a subir el libro.

## 3. Esquema de salida

```json
{ "source": { "id": "USR-xxxx", "nombre": "…", "idioma": "es|en",
              "edicion": "2014|2024", "pdfSha256": "…" },
  "spell": { "bola de fuego|USR-xxxx": { … igual que public/rules/spell.json … } },
  "feat": {}, "classFeature": {}, "subclass": {}, "background": {}, "race": {}, "item": {}, "monster": {} }
```

El constructor carga estos paquetes como una fuente más (`vetools-ref`:
registrar fuente de usuario). `pdfSha256` identifica el libro sin guardarlo.

## 4. Etapas del motor

1. **Ingesta.** `pdf.js` en un Web Worker. Por página: bloques de texto con `x, y, tamaño de fuente, fuente`.
2. **Reconstrucción.** Detectar columnas por histograma de `x`; orden de lectura; unir letras separadas ("a n i m a l" → "animal"), cerrar guiones de corte, quitar encabezados y pies de página repetidos.
3. **Clasificación de página** por reglas: texto corrido, lista de conjuros, tabla, ficha de monstruo, imagen sin texto (se avisa y se salta).
4. **Segmentación en entradas.** Por tamaño y estilo de fuente de los títulos y por marcas fijas: conjuro (`Nivel/Level … escuela` + `Tiempo de lanzamiento/Casting Time`), monstruo (`Clase de Armadura/Armor Class`), dote (`Prerrequisito/Prerequisite`), rasgo de clase (`Nivel N:`).
5. **Estructuración.** Dos caminos:
   - **Determinista** para lo rígido (cabecera de conjuro, ficha de monstruo, tablas de equipo): perfiles `es` y `en` con las etiquetas de cada idioma.
   - **IA con esquema** para prosa → `entries` anidadas y reparación de OCR; salida forzada a JSON Schema generado desde `packages/contracts`.
6. **Validación.** zod; los nombres se cruzan con el índice base para generar etiquetas `{@spell …}`/`{@condition …}`; deduplicar por `nombre|fuente`; cada entrada lleva `confianza` y lista de campos dudosos.
7. **Informe de calidad.** Qué se leyó, qué se saltó, qué quedó dudoso (para revisar en pantalla).
8. **Salida.** IndexedDB + descarga `.json`, y exportador `.xml` estilo Aurora Builder (fase 7).

## 5. Fases, entregables y criterio de salida

Todo corre en CI o en la VM, no en la PC del dueño.

| Fase | Entregable | Sale cuando |
|---|---|---|
| **P0 Banco de pruebas** | `packages/book-engine/` con arnés que corre un PDF y compara con `public/rules`; informe por libro | mide precisión/recobrado de nombres y campos en PHB EN, Xanathar's y Tasha's; fija el costo de IA por libro |
| **P1 Reconstrucción** | etapas 1–3 con tests sobre páginas reales de los 9 libros | columnas y orden correctos en ≥98 % de las páginas muestreadas; Volo's detectado como "sin texto" |
| **P2 Conjuros de punta a punta** | conjuros EN y ES → paquete → el constructor los ofrece | ≥98 % de los conjuros de PHB/XGE/TCE coinciden con la referencia en nombre, nivel, escuela, alcance, componentes, duración |
| **P3 Dotes, rasgos, subclases, trasfondos, especies** | estructuración con IA y validación | ≥95 % de coincidencia en nombre y texto normalizado; el resto marcado como dudoso |
| **P4 Objetos y monstruos** | tablas de equipo y fichas | ≥95 % en campos numéricos (CA, PG, CR, precio, peso) |
| **P5 Pantalla de importar** | subir libro, progreso, informe, ver/corregir dudosos, IndexedDB, descarga | un usuario sube un PDF de punta a punta sin intervención |
| **P6 Worker `/motor/estructurar`** | endpoint sin estado, sesión + Turnstile + límite por usuario | test: tras una importación no hay escrituras en ningún almacén ni registro del cuerpo |
| **P7 Exportar XML (Aurora)** | exportador desde el esquema propio | un paquete exportado abre sin errores en Aurora Builder |
| **P8 Glosario EN↔ES** | tabla de nombres oficiales sacada de los libros en español | cubre conjuros, clases, estados y habilidades de MP ES y MP 2024 |

## 6. Mis decisiones (para corregir)

- Procesar en el navegador y usar el Worker solo para IA, por el tamaño de los PDF y para que nada se guarde.
- Formato de salida = el JSON que el constructor ya lee; Aurora XML es solo un exportador.
- Modelo: Claude Haiku 5.5 para estructurar, con reintento en Sonnet 5.5 si falla la validación; el costo real se mide en P0.
- Libros solo-imagen (Volo's Maps): se detectan y se avisan; sin OCR propio en esta versión.
- Un libro = una fuente de usuario `USR-<hash>`; se pueden cargar varios.

## 7. Riesgos

- **OCR muy sucio** (PHB EN a 150 dpi): la IA repara, pero si el texto es ilegible la entrada queda marcada como dudosa y no se inventa.
- **Costo de IA por libro:** se mide en P0 antes de abrir la pantalla al público.
- **Una sesión de importación larga** en el navegador: se procesa por entradas con reanudación, para no perder lo hecho si se cierra la pestaña.
