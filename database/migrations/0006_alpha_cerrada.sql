-- Migración 0006 · Alpha cerrada: caseta, invitaciones y suspensiones con fin (Fase 9, ADR-0012).
-- Aditiva: el Worker anterior sigue funcionando con estas tablas y columnas presentes.

-- Quién atiende la caseta. Solo el script de moderación escribe aquí: la web
-- no tiene ninguna forma de dar ni quitar el rol.
CREATE TABLE staff (
  account_id  TEXT    PRIMARY KEY REFERENCES accounts (id),
  role        TEXT    NOT NULL CHECK (role IN ('ADMIN')),
  granted_at  INTEGER NOT NULL,
  note        TEXT
) STRICT;

-- Invitaciones de la alpha cerrada. El código nunca se guarda en claro:
-- `code_hash` (HMAC con TOKEN_PEPPER) para encontrarlo al registrarse y
-- `code_enc` (AES-GCM) para que la caseta pueda volver a mostrarlo.
CREATE TABLE invitations (
  id          TEXT    PRIMARY KEY,
  code_hash   TEXT    NOT NULL UNIQUE,
  code_enc    TEXT    NOT NULL,
  label       TEXT    NOT NULL,
  max_uses    INTEGER NOT NULL CHECK (max_uses BETWEEN 1 AND 500),
  uses        INTEGER NOT NULL DEFAULT 0 CHECK (uses >= 0),
  expires_at  INTEGER,
  revoked_at  INTEGER,
  created_by  TEXT    REFERENCES accounts (id),
  created_at  INTEGER NOT NULL,
  CHECK (uses <= max_uses)
) STRICT;

CREATE INDEX idx_invitations_created ON invitations (created_at);

-- Con qué invitación entró cada cuenta (NULL: registro abierto o anterior a la alpha cerrada).
ALTER TABLE accounts ADD COLUMN invitation_id TEXT REFERENCES invitations (id);

-- Fin de una suspensión (epoch ms). Con status SUSPENDED, NULL = indefinida.
ALTER TABLE accounts ADD COLUMN suspended_until INTEGER;

-- El tablero de la caseta cuenta por fecha sin recorrer las tablas.
CREATE INDEX idx_accounts_created ON accounts (created_at);
CREATE INDEX idx_sessions_seen ON sessions (last_seen_at);
CREATE INDEX idx_accounts_invitation ON accounts (invitation_id) WHERE invitation_id IS NOT NULL;
-- El cron que levanta las suspensiones vencidas.
CREATE INDEX idx_accounts_suspended ON accounts (suspended_until) WHERE status = 'SUSPENDED';
