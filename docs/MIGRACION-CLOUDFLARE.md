# Migración del front de Vercel a Cloudflare

> **Estado: PLAN. Nada de esto está aplicado.** Cambiar el hosting toca producción
> (`alba.bertinilabs.xyz`), así que cada paso con efecto espera un OK explícito.

Escrito el 2026-11-11 sobre `main`, a partir de lo que el repo dice y de lo que midió
`docs/DEPLOY.md`. Lo que no se pudo comprobar desde el repo está marcado **[verificar]**.

## Por qué

- **Un solo proveedor.** El Worker (`api.bertinilabs.xyz`), KV, D1 y el DNS de
  `bertinilabs.xyz` ya están en Cloudflare. El front es lo único en Vercel, y la
  zona tiene un registro `*` A apuntando a Vercel que ya obligó a declarar
  `api.bertinilabs.xyz` como custom domain a propósito (ver `wrangler.toml`).
- **Costo.** El plan Workers Paid ($5) ya está pagado. Servir archivos estáticos desde
  un Worker no cobra por petición ni por ancho de banda. Cuánto se ahorra al dar de
  baja Vercel depende de qué plan tenga hoy **[verificar en el panel de Vercel]**.
- **Un deploy en vez de dos.** Hoy el front sale al hacer merge (Vercel) y el Worker
  "a mano"; `DEPLOY.md` ya documenta que el orden importa y que equivocarlo rompe
  publicar para todos. En un solo flujo de GitHub Actions el orden queda escrito.

## Lo que NO hace falta (decisión sobre el plan anterior)

El plan inicial hablaba de pasar a **React Router en modo framework con
pre-renderizado**. Medido, no hace falta: el front es una SPA de Vite con cinco
rutas, y Workers sirve una SPA tal cual. Migrar a modo framework sería reescribir el
enrutado y el build sin ningún beneficio que justifique el riesgo. Pre-renderizar solo
ayudaría a `/` (SEO y primer pintado); si algún día interesa, se hace después y por
separado.

## Qué se traduce de `vercel.json`

| Vercel hoy | Cloudflare |
|---|---|
| `outputDirectory: apps/web/dist` | `[assets] directory = "./dist"` en un `wrangler.toml` nuevo de `apps/web` |
| rewrite `/(.*)` → `/index.html` | `not_found_handling = "single-page-application"` |
| `headers` (CSP, nosniff, DENY, Referrer, Permissions) | archivo `apps/web/public/_headers` |
| `Cache-Control: immutable` en `/assets/*` y `/fonts/*` | las mismas dos reglas en `_headers` |
| `buildCommand` (`packages:build`, `web:build`, `foundry:package`) | el mismo comando, en un job de GitHub Actions |
| Variables de entorno | ninguna: `VITE_VAULT_URL` ya vive en `.env.production` |
| Previews por PR | `wrangler versions upload`: una URL por PR (ver abajo) |

El router sigue funcionando: `/forge`, `/codex`, `/ritual` y `/tomo/:code` se
escriben "en frío" y caen en `index.html` por la regla de SPA.

## Lo que no cambia

1. `https://api.bertinilabs.xyz`: el Worker no se toca.
2. Sesión y OAuth: `COOKIE_DOMAIN = bertinilabs.xyz`, `AUTH_ORIGIN` y
   `ALLOWED_ORIGINS` dependen del **nombre** `alba.bertinilabs.xyz`, no del host.
   Mientras el nombre sea el mismo, no cambia nada en Discord ni en CORS.

**El módulo de Foundry ya no condiciona la migración.** El módulo cambia de versión
en la próxima actualización y se redirige entonces: la URL del manifiesto
(`/foundry/module.json`) y del zip pueden cambiar de lugar. Mientras tanto
`pnpm foundry:package` sigue en el build, para que lo que hoy está instalado
no se rompa antes de esa actualización.

## Fases

### 0. Medir (sin efecto)
- [ ] Confirmar en Vercel: plan, dominios asignados (¿solo `alba`?, ¿`www`/hub?) y si
      hay variables, redirects o protección de despliegue configuradas en el panel
      (lo que no está en `vercel.json`). **[verificar]**
- [ ] Listar los registros DNS de la zona `bertinilabs.xyz`: confirmar el `*` A y
      qué hosts lo usan. **[verificar]**
- [ ] Contar archivos y tamaño de `apps/web/dist` tras un build. Límites de Workers:
      25 MiB por archivo y 20.000 archivos por versión. Lo más grande hoy es
      `public/rules/item.json` (2,2 MB) dentro de 7,7 MB de `public/`; hay margen.

### 1. Construir en paralelo (sin tocar producción)
- [ ] `apps/web/wrangler.toml`: Worker `alba-web` con `[assets]` y la regla de SPA.
- [ ] `apps/web/public/_headers`: los headers de `vercel.json`, uno por uno.
- [ ] Job de GitHub Actions: build + `wrangler deploy` a **`alba-web.<cuenta>.workers.dev`**.
      Esa dirección es nueva y no la usa nadie; Vercel sigue sirviendo el dominio.
- [ ] Previews por PR con `wrangler versions upload`. **Ojo:** mis capturas de
      preview leen la URL del *deployment status* de GitHub que pone Vercel; hay que
      reproducir eso (la Action crea un deployment status con la URL) o dejaría de
      funcionar el flujo de revisar visualmente antes de mergear.
- [ ] Secretos de GitHub: `CLOUDFLARE_API_TOKEN` y `CLOUDFLARE_ACCOUNT_ID`. El token
      del túnel (Tunnel Edit + DNS Edit) **no** sirve tal cual: hace falta uno con
      *Workers Scripts Edit*. Lo crea el dueño; yo no manejo credenciales.

### 2. Comprobar equivalencia (sin efecto)
Contra la dirección `workers.dev`, antes de cualquier cambio de DNS:
- [ ] `/foundry/module.json` y `/foundry/bertinis-vault.zip` se sirven (el `diff`
      byte a byte solo importa hasta que salga la versión nueva del módulo).
- [ ] Rutas en frío: `/forge`, `/codex`, `/tomo/ABCD1234` devuelven `index.html` con 200.
- [ ] Los headers de seguridad y el `immutable` salen iguales (`curl -I` en ambos).
- [ ] Un recorrido completo del Faro (forja, sellar, código, importar en Foundry).

### 3. Cambio (requiere tu OK, ventana corta)
- [ ] Bajar el TTL del registro a 60 s un día antes.
- [ ] Quitar el `*` A hacia Vercel **solo para `alba`** y adjuntar `alba.bertinilabs.xyz`
      como *custom domain* del Worker. Cloudflare crea el registro y el certificado,
      igual que con `api.bertinilabs.xyz`.
- [ ] Comprobar: sitio, `/foundry/module.json`, un login con Discord, publicar un código.
- [ ] **Vuelta atrás:** volver a poner el registro hacia Vercel. Vercel queda intacto
      con su último deploy mientras dure la prueba.

### 4. Cierre (días después)
- [ ] Dar de baja el proyecto de Vercel (tras ~7 días sin incidentes) y el `*` A si ya
      nada lo usa.
- [ ] Actualizar `docs/DEPLOY.md`, `vercel.json` (borrar) y `scripts/build-foundry-package.mjs`
      si algún comentario nombra a Vercel.
- [ ] Opcional: mover el hub `www.bertinilabs.xyz` (repo `bertinilabs`) al mismo esquema.

## Riesgos y cómo se cubren

| Riesgo | Cobertura |
|---|---|
| Módulos ya instalados dejan de actualizar | El empaquetado sigue en el build hasta la versión nueva del módulo |
| Rutas 404 al recargar | Regla de SPA, probada en frío en fase 2 |
| Headers de seguridad perdidos | `_headers` copiado de `vercel.json`, verificado con `curl -I` |
| Sesión/Discord dejan de funcionar | El nombre del sitio no cambia; se prueba un login en fase 3 |
| Pierdo las previews con captura | La Action replica el deployment status (fase 1) |
| Un deploy malo del front | `wrangler rollback` a la versión anterior; además se puede volver al DNS de Vercel |
| Costos inesperados | Archivos estáticos sin cargo; el Worker de assets no se invoca por la regla de SPA |

## Lo que necesito que decidas

1. **¿Seguimos?** Yo recomiendo sí, sin pasar a modo framework (la ganancia real es un
   solo proveedor y un solo deploy, no el modo framework).
2. **Quién crea el token de Workers** para GitHub Actions (permiso *Workers Scripts
   Edit* sobre tu cuenta) y lo guarda como secreto del repo.
3. **¿El hub `www.bertinilabs.xyz` entra** en esta migración o queda como está?
