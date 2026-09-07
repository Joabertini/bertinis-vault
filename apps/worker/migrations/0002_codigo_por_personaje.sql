-- Un personaje, un código.
--
-- Antes cada envío acuñaba un código nuevo: mandar el mismo personaje dos veces
-- dejaba dos códigos vivos y el que el jugador tenía anotado era el que se le
-- hubiera quedado. Ahora el código es del personaje, y para volver a escribir
-- en él hace falta el secreto con el que se publicó.
--
-- Las dos columnas van acá y no dentro de `state` porque `state` viaja al
-- almacén en cada publicación y se le entrega a cualquiera que abra el código:
-- un token de escritura ahí estaría impreso sobre lo que protege.
--
-- Nulas para todo personaje que todavía no se compartió, que son casi todos.

alter table character add column share_code text;
alter table character add column share_token text;

-- Un código apunta a un solo personaje dentro de una cuenta. No es único entre
-- cuentas: dos personas pueden quedarse una copia del mismo tomo compartido, y
-- cada copia es suya con su propio código.
create unique index if not exists character_share_code
  on character (account_id, share_code)
  where share_code is not null;
