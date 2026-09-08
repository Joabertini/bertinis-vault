# Códigos

Un código es la dirección de un personaje. Se dicta en una mesa, se tipea en
Foundry, se pega en un chat. También es la única credencial: quien lo tiene,
abre el personaje.

Este documento afirma cómo es hoy y por qué. Lo que se decidió y cuándo está en
`RUTA-POST-BETA.md`.

## La forma

Ocho caracteres, letra y número alternados, mostrados en dos grupos de cuatro:

```
A7K2-M9X4
```

Las posiciones impares son letras, las pares son dígitos. Siempre.

**Eso es lo que hace que dictarlo funcione.** Los pares que se confunden —O y 0,
I y 1, S y 5, B y 8— sólo son ambiguos cuando una posición puede tener las dos
cosas. Fijando el tipo por posición, cada uno se resuelve solo: en casilla de
letra un `0` sólo pudo haber sido una O, y en casilla de dígito una `O` sólo
pudo haber sido un 0. `normalizeCode` hace exactamente esa corrección.

El esquema anterior resolvía lo mismo **borrando** I, L, O y U de un alfabeto
base32. Éste lo resuelve por contexto y recupera las cuatro letras.

## El tamaño, y lo que cuesta

| esquema | combinaciones | bits |
|---|---|---|
| 8 alternados (el de ahora) | 4.569.760.000 | 32,1 |
| 36⁸ sin alternar | 2.821.109.907.456 | 41,4 |
| 10 base32 (el anterior) | 1.125.899.906.842.624 | 50,0 |

Alternar no es gratis: cuesta 617 veces contra usar las 36 posiciones libres, y
el esquema de ahora es 246.381 veces más chico que el que reemplaza.

Para **colisiones** sobra: con cien mil personajes guardados, la probabilidad de
que dos códigos nuevos choquen alguna vez es de una en cuatrocientas cincuenta;
`handleCreate` igual comprueba antes de escribir, porque una colisión silenciosa
destruye el personaje de otro.

Para **enumeración** no sobra, y ahí está el límite de tasa. Con diez mil
personajes guardados un código es un acierto cada 457.000 intentos: décadas a
unos pocos intentos por minuto, unas dos horas a cincuenta por segundo. La
diferencia entre esos dos números es el limitador, no el alfabeto.

## El límite de tasa

Treinta fallos por minuto y por IP, contados en el borde de Cloudflare
(`[[ratelimits]]` en `wrangler.toml`).

**Sólo cuenta las lecturas que fallaron.** Un DJ que abre treinta personajes
antes de una sesión está haciendo aquello para lo que existe el almacén; el que
prueba treinta códigos que no existen, no.

Se cuenta en el borde y no en KV a propósito: un contador en KV gastaría una de
las mil escrituras diarias del plan en cada intento fallido, y la forma más
barata de tirar el almacén abajo sería pedirle códigos inexistentes.

## Un código por personaje

Antes cada envío acuñaba uno nuevo. Mandar el mismo personaje dos veces dejaba
dos códigos vivos, y el que el jugador tenía anotado era el que se le hubiera
quedado — que podía ser el de la versión de anteayer.

Ahora el código es del personaje. El Códice guarda, al lado del estado y nunca
adentro, dos cosas:

- **el código**, que es público y para eso está;
- **el token de escritura**, 128 bits, que nunca sale de ese Códice y de la
  cuenta de quien lo tiene.

Publicar de nuevo manda los dos y reemplaza en el lugar. Sin el token el
almacén contesta 403, que es lo que impide que tener un código sea permiso para
borrar el personaje de otro.

Van al lado del estado y no adentro por una razón concreta: **el estado se le
entrega a cualquiera que abra el código.** Un token de escritura ahí estaría
impreso sobre lo que protege.

### Lo que ese cambio arrastró

- **Un código con dueño no caduca.** El código es el nombre del personaje ahora,
  y un nombre que deja de funcionar noventa días después de la última vez que
  alguien lo miró no es un nombre. Los códigos acuñados antes de que existiera
  el dueño siguen caducando, y leerlos sigue empujando su vencimiento.
- **El token se sincroniza con la cuenta** (`share_code`, `share_token` en la
  tabla `character`). Sin eso, entrar desde el teléfono y compartir el mismo
  personaje acuñaría un segundo código, y el primero —el que está anotado en la
  ficha de alguien— quedaría apuntando a una versión vieja.
- **Un código muerto se reemplaza, no se reporta.** Si el almacén contesta 404 a
  un reemplazo, el front publica de nuevo y acuña uno nuevo: el código viejo ya
  estaba muerto cuando apretaron el botón. Un 403 no: ahí el código está vivo y
  es de otro, y publicarlo en otro lado escondería eso.

## Los códigos viejos

Diez caracteres de base32 de Crockford, sin I, L, O ni U. Siguen resolviendo.

La longitud es lo que distingue los dos esquemas: ocho nunca es un código viejo
y diez nunca es uno nuevo, así que `normalizeCode` mira el largo y aplica la
corrección que corresponde. No hay ambigüedad y no hay que marcar nada.

Están escritos en fichas de papel y guardados en mundos de Foundry. Un cambio de
esquema no es razón para que dejen de abrir.
