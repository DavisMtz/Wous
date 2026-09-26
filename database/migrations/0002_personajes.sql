-- Migración 0002 · Personajes y su apariencia (Fase 3, §8 y §10 del plan).
-- MVP: un personaje por cuenta (UNIQUE account_id); el esquema deja abierta
-- una migración futura a varios personajes. Los IDs de apariencia apuntan al
-- catálogo versionado de @wous/contracts; el servidor los valida al escribir.

CREATE TABLE characters (
  id            TEXT    PRIMARY KEY,
  account_id    TEXT    NOT NULL UNIQUE REFERENCES accounts (id),
  display_name  TEXT    NOT NULL,
  created_at    INTEGER NOT NULL,
  updated_at    INTEGER NOT NULL,
  last_room_id  TEXT
) STRICT;

CREATE TABLE character_appearance (
  character_id   TEXT    PRIMARY KEY REFERENCES characters (id),
  body_id        TEXT    NOT NULL,
  skin_tone_id   TEXT    NOT NULL,
  hair_id        TEXT    NOT NULL,
  hair_color_id  TEXT    NOT NULL,
  top_id         TEXT    NOT NULL,
  bottom_id      TEXT    NOT NULL,
  shoes_id       TEXT    NOT NULL,
  accessory_id   TEXT,
  updated_at     INTEGER NOT NULL
) STRICT;
