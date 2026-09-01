# Cuentas, y por qué el Códice deja de vivir en el navegador

El Códice siempre vivió en `localStorage`, que no es almacenamiento sino una
caché que el navegador tiene permiso de tirar. Una ventana privada, borrar
datos del sitio, otra máquina, el teléfono: en cualquiera de esos casos el
Códice está vacío. Un jugador que pasó una tarde armando un grupo tenía un
archivo de exportación y nada más.

Con cuenta, el Códice se sincroniza solo.

## Lo que se decidió, y por qué

**Entrar con Discord.** La gente para la que esto está hecho ya está ahí: una
mesa que juega D&D tiene un Discord, y el nombre y el avatar que el jugador usa
en esa mesa es el que va a reconocer en su propio Códice. Se pide solo
`identify` — no `email`, porque nada acá manda correo, y no `guilds`, porque en
qué servidores está alguien no es asunto de esta aplicación.

**Dos nombres bajo un dominio.** `alba.bertinilabs.xyz` es la página; la sirve
Vercel. `api.bertinilabs.xyz` es el Worker; nadie la escribe ni la ve. Comparten
`bertinilabs.xyz`, y esa es la razón: el navegador decide si dos direcciones son
"el mismo sitio" mirando el dominio registrable, y solo entre el mismo sitio
viaja la cookie de sesión.

En `vercel.app` y `workers.dev` sería una cookie de tercera parte. Safari y
Firefox la bloquean por defecto: el jugador entra, recarga, y volvió a estar
afuera. La alternativa es guardar el token en `localStorage` y mandarlo por
header, que funciona en todos lados y expone la credencial a cualquier XSS —
la diferencia entre "usaron tu sesión un rato" y "se llevaron tu cuenta".

**La cookie es `HttpOnly`.** JavaScript nunca ve el token, ni el nuestro ni el
que inyecte un atacante. Lo que se guarda en la base es el SHA-256 del token,
nunca el token: una base filtrada es entonces una base de hashes y no un cajón
de llaves que funcionan.

**El estado del personaje cruza sin leerse.** Un personaje es un estado del
builder, y ese estado cambia cada vez que el builder aprende una pregunta
nueva. Un servidor con opinión sobre su forma tendría que redesplegarse al
mismo tiempo que el front, o empezar a rechazar personajes sobre los que no
tiene nada que juzgar. Así que va como JSON y vuelve como JSON.

**Gana el sellado más tarde.** Es la única regla que no puede perder una
edición: quedarse siempre con lo que llega deshace el trabajo hecho desde
entonces, y quedarse siempre con lo guardado hace que sincronizar un personaje
editado no haga nada. La función es una sola —`mergeByNewest` en el contrato— y
corre en el navegador y en el Worker, porque una regla de merge que existe dos
veces es una regla que en algún momento se contradice.

**Borrar se dice aparte.** Un merge que solo suma no puede expresar una
baja, así que el `sync` lleva `burned`. Sin eso, borrar un personaje en una
máquina y sincronizar lo trae de vuelta del servidor, y parece que la
aplicación lo resucitó.

## Las rutas

| Ruta | Qué hace |
| --- | --- |
| `GET /auth/discord/start?redirect=/ruta` | Manda a Discord. `redirect` solo acepta una ruta de este sitio |
| `GET /auth/discord/callback` | Vuelve de Discord, crea la cuenta si es la primera vez, deja la cookie |
| `GET /auth/me` | Quién está adentro, o `null`. Nadie adentro es una respuesta, no un error |
| `POST /auth/logout` | Olvida la sesión de los dos lados |
| `POST /codex/sync` | Acá está lo que tiene esta máquina; devolvé lo que tiene la cuenta |

Un despliegue sin base de datos y sin aplicación de Discord sigue siendo un
almacén de builds perfectamente bueno, así que las rutas de cuenta se conectan
solo cuando está todo lo que necesitan y responden 501 cuando no.

## Lo que falta hacer a mano

Nada de esto lo puede hacer el repositorio por sí solo.

1. **La aplicación de Discord.** En el portal de desarrolladores: aplicación
   nueva, OAuth2, agregar la URL de redirección
   `https://api.bertinilabs.xyz/auth/discord/callback`. De ahí salen el client
   id y el secret.

2. **La base.**

   ```
   wrangler d1 create alba
   ```

   Poner el `database_id` que devuelve en `apps/worker/wrangler.toml`,
   descomentar el bloque, y aplicar el esquema:

   ```
   wrangler d1 migrations apply alba --remote
   ```

3. **Las variables y el secreto.** `DISCORD_CLIENT_ID`, `APP_ORIGIN` y
   `COOKIE_DOMAIN` van en `wrangler.toml`; el secreto no va nunca en un archivo:

   ```
   wrangler secret put DISCORD_CLIENT_SECRET
   ```

4. **Los nombres.** `alba.bertinilabs.xyz` apuntando al proyecto de Vercel, y
   `api.bertinilabs.xyz` como ruta del Worker.

   **`ALLOWED_ORIGINS` tiene que dejar de ser `*`.** No es cosmético: `*` está
   bien para el almacén de builds —ahí el código *es* la credencial— y está
   exactamente mal para una sesión, porque "cualquier origen puede mandar la
   cookie de este usuario" es la forma de un CSRF. Con `*`, las rutas de cuenta
   responden 403 en vez de fallar en silencio: la versión callada sería que
   todas contesten "no hay nadie adentro" y parezca un login roto en vez de una
   variable sin poner.

5. **`VITE_VAULT_URL` en Vercel** apuntando a `https://api.bertinilabs.xyz`.
   Es la misma variable que ya usa el código de importación; sin ella el front
   le pega al Worker de desarrollo y no encuentra ninguna cuenta.

Hasta que estén, el builder funciona como hasta ahora: el Códice local y el
código de importación de noventa días. La insignia de cuenta directamente no
aparece — un almacén sin cuentas responde 501 y ofrecer entrar sería ofrecer
algo que no existe.

## En el front

La insignia vive en la cabecera del Códice, chiquita a propósito. El estante
funciona deslogueado y siempre funcionó: la cuenta es una oferta —llevate esto
a otra máquina— y no una puerta.

Sincroniza sola, y ahí está la trampa: adoptar la respuesta del servidor cambia
el Códice, así que un hook que sincroniza cuando el Códice cambia sincroniza
para siempre. Lo que se compara es una **firma** —los ids, sus fechas de sellado
y las bajas pendientes— y se anota con la respuesta, no con lo que se mandó.

Todo falla en silencio a propósito. El Códice es local primero: un jugador sin
red sigue teniendo sus personajes, y un cartel rojo sobre un estante que
funciona miente sobre qué está roto. Una sesión vencida tampoco es un error que
gritar — son treinta días que se terminaron — así que la insignia vuelve a
ofrecer entrar.
