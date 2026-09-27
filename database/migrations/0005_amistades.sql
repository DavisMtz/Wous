-- Migración 0005 · Amistades y tope de avisos sociales (Fase 8, §20, ADR-0011).
-- Aditiva: el Worker anterior sigue funcionando con estas tablas presentes.
--
-- Una fila por par de cuentas, sin importar quién pidió: `account_low` es la
-- menor de las dos y el UNIQUE las junta. `requester_id`/`addressee_id` dicen
-- quién pidió en la vuelta actual; `round` sube cada vez que el par vuelve a
-- empezar y va en la clave de deduplicación del correo. Los bloqueos NO
-- viven aquí (ADR-0010): crear uno deja la fila en REMOVED.

CREATE TABLE friendships (
  id            TEXT    PRIMARY KEY,
  account_low   TEXT    NOT NULL REFERENCES accounts (id),
  account_high  TEXT    NOT NULL REFERENCES accounts (id),
  requester_id  TEXT    NOT NULL REFERENCES accounts (id),
  addressee_id  TEXT    NOT NULL REFERENCES accounts (id),
  status        TEXT    NOT NULL CHECK (status IN ('PENDING', 'ACCEPTED', 'REMOVED')),
  round         INTEGER NOT NULL DEFAULT 1,
  -- Se mandó con quien la recibe bloqueando a quien la manda: nunca se le
  -- muestra y no avisa por correo; quien la mandó la ve pendiente (ADR-0011).
  hidden        INTEGER NOT NULL DEFAULT 0 CHECK (hidden IN (0, 1)),
  -- Inicio de la vuelta actual (cuándo se mandó la solicitud).
  created_at    INTEGER NOT NULL,
  updated_at    INTEGER NOT NULL,
  accepted_at   INTEGER,
  ended_at      INTEGER,
  ended_reason  TEXT    CHECK (ended_reason IN ('REJECTED', 'CANCELLED', 'REMOVED', 'BLOCKED')),
  UNIQUE (account_low, account_high),
  CHECK (account_low < account_high),
  CHECK (
    (requester_id = account_low AND addressee_id = account_high)
    OR (requester_id = account_high AND addressee_id = account_low)
  )
) STRICT;

-- Las listas de una persona (lo que pidió y lo que le pidieron) y los topes.
CREATE INDEX idx_friendships_requester ON friendships (requester_id, status);
CREATE INDEX idx_friendships_addressee ON friendships (addressee_id, status);

-- Avisos que recibió una cuenta por hora de envío: el tope diario de correo
-- social por destinatario los cuenta sin recorrer el outbox.
CREATE INDEX idx_outbox_account_sent ON notification_outbox (account_id, sent_at);
