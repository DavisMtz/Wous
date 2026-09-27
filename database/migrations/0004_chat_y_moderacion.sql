-- Migración 0004 · Bloqueos, reportes y moderación básica (Fase 7, §18, ADR-0010).
-- Aditiva: el Worker anterior sigue funcionando con estas tablas presentes.
--
-- El chat NO se guarda aquí: vive unos minutos en el storage de cada sala y
-- solo el mensaje reportado (con su contexto mínimo) llega a `reports`.

-- Silencio de moderación: hasta cuándo no puede escribir en el chat (epoch ms).
ALTER TABLE accounts ADD COLUMN chat_muted_until INTEGER;

-- Un bloqueo por dirección: A puede bloquear a B y B a A a la vez, y quitar
-- uno no toca el otro (por eso no vive en `friendships`, ver ADR-0010).
CREATE TABLE blocks (
  blocker_account_id  TEXT    NOT NULL REFERENCES accounts (id),
  blocked_account_id  TEXT    NOT NULL REFERENCES accounts (id),
  created_at          INTEGER NOT NULL,
  PRIMARY KEY (blocker_account_id, blocked_account_id),
  CHECK (blocker_account_id <> blocked_account_id)
) STRICT, WITHOUT ROWID;

CREATE INDEX idx_blocks_blocked ON blocks (blocked_account_id, blocker_account_id);

-- Reportes con la evidencia que la sala tenía en ese momento (nunca el texto
-- que diga el cliente). `evidence_json` guarda el mensaje reportado y el
-- contexto mínimo; se revisan con scripts/moderacion.
CREATE TABLE reports (
  id                     TEXT    PRIMARY KEY,
  reporter_account_id    TEXT    NOT NULL REFERENCES accounts (id),
  reporter_character_id  TEXT    NOT NULL,
  target_account_id      TEXT    NOT NULL REFERENCES accounts (id),
  target_character_id    TEXT    NOT NULL,
  reason                 TEXT    NOT NULL
    CHECK (reason IN ('HARASSMENT', 'HATE', 'SEXUAL', 'SPAM', 'IMPERSONATION', 'OTHER')),
  note                   TEXT,
  message_id             TEXT,
  room                   TEXT    NOT NULL,
  evidence_json          TEXT    NOT NULL,
  status                 TEXT    NOT NULL DEFAULT 'OPEN'
    CHECK (status IN ('OPEN', 'ACTIONED', 'DISMISSED')),
  created_at             INTEGER NOT NULL,
  resolved_at            INTEGER,
  resolution             TEXT
) STRICT;

CREATE INDEX idx_reports_status ON reports (status, created_at);
CREATE INDEX idx_reports_target ON reports (target_account_id, created_at);
CREATE INDEX idx_reports_pair ON reports (reporter_account_id, target_account_id, created_at);
