-- Migración 0003 · Turno de presencia del personaje (Fase 6, ADR-0009).
-- `last_room_id` (0002) guarda la sala lógica donde está el personaje y solo
-- la cambia una sala al validar un portal. `presence_epoch` sube en cada
-- conexión al mundo: la sala solo puede mover al personaje si su turno sigue
-- siendo el vigente, y así nunca queda activo en dos salas.

ALTER TABLE characters ADD COLUMN presence_epoch INTEGER NOT NULL DEFAULT 0;
