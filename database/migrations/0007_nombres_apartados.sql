-- Migración 0007 · Nombres apartados (Fase 9, ADR-0012).
-- Aditiva: el Worker anterior no la lee y sigue funcionando.
--
-- Registrarse con un correo que ya tenía cuenta no crea nada (la respuesta es
-- la misma), pero el nombre elegido queda apartado igual que si la cuenta se
-- hubiera creado. Sin esto, preguntar después por ese nombre decía si el
-- correo ya estaba registrado. Un nombre apartado no se libera.
CREATE TABLE username_holds (
  username_normalized  TEXT    PRIMARY KEY,
  created_at           INTEGER NOT NULL
) STRICT;
