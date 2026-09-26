-- Migración 0001 · Identidad, sesiones, correo y auditoría (WOU-004, §8 del plan).
-- Forward-only. Tiempos en epoch milisegundos UTC (ADR-0004).
-- Los tokens (sesión, verificación, reset) se guardan SOLO como hash (ADR-0006).

CREATE TABLE accounts (
  id                    TEXT    PRIMARY KEY,
  email                 TEXT    NOT NULL,
  email_normalized      TEXT    NOT NULL UNIQUE,
  username              TEXT    NOT NULL,
  username_normalized   TEXT    NOT NULL UNIQUE,
  password_hash         TEXT    NOT NULL,
  status                TEXT    NOT NULL
    CHECK (status IN ('PENDING_EMAIL', 'ACTIVE', 'SUSPENDED', 'BANNED', 'DELETED')),
  email_verified_at     INTEGER,
  email_deliverability  TEXT    NOT NULL DEFAULT 'UNKNOWN'
    CHECK (email_deliverability IN ('UNKNOWN', 'OK', 'SOFT_BOUNCE', 'UNDELIVERABLE')),
  terms_version         TEXT    NOT NULL,
  terms_accepted_at     INTEGER NOT NULL,
  created_at            INTEGER NOT NULL,
  updated_at            INTEGER NOT NULL
) STRICT;

CREATE TABLE sessions (
  id                  TEXT    PRIMARY KEY,
  account_id          TEXT    NOT NULL REFERENCES accounts (id),
  token_hash          TEXT    NOT NULL UNIQUE,
  created_at          INTEGER NOT NULL,
  last_seen_at        INTEGER NOT NULL,
  expires_at          INTEGER NOT NULL,
  revoked_at          INTEGER,
  user_agent_summary  TEXT
) STRICT;

CREATE INDEX idx_sessions_account ON sessions (account_id, revoked_at);
CREATE INDEX idx_sessions_expires ON sessions (expires_at);

CREATE TABLE email_verification_tokens (
  id          TEXT    PRIMARY KEY,
  account_id  TEXT    NOT NULL REFERENCES accounts (id),
  token_hash  TEXT    NOT NULL UNIQUE,
  expires_at  INTEGER NOT NULL,
  used_at     INTEGER,
  created_at  INTEGER NOT NULL
) STRICT;

-- Cooldown y tope diario del reenvío: tokens de una cuenta por fecha de creación.
CREATE INDEX idx_verification_account ON email_verification_tokens (account_id, created_at);

CREATE TABLE password_reset_tokens (
  id          TEXT    PRIMARY KEY,
  account_id  TEXT    NOT NULL REFERENCES accounts (id),
  token_hash  TEXT    NOT NULL UNIQUE,
  expires_at  INTEGER NOT NULL,
  used_at     INTEGER,
  created_at  INTEGER NOT NULL
) STRICT;

CREATE INDEX idx_reset_account ON password_reset_tokens (account_id, created_at);

CREATE TABLE notification_preferences (
  account_id             TEXT    PRIMARY KEY REFERENCES accounts (id),
  friend_request_email   INTEGER NOT NULL DEFAULT 1 CHECK (friend_request_email IN (0, 1)),
  friend_accepted_email  INTEGER NOT NULL DEFAULT 1 CHECK (friend_accepted_email IN (0, 1)),
  marketing_email        INTEGER NOT NULL DEFAULT 0 CHECK (marketing_email IN (0, 1)),
  updated_at             INTEGER NOT NULL
) STRICT;

CREATE TABLE notification_outbox (
  id                   TEXT    PRIMARY KEY,
  account_id           TEXT    REFERENCES accounts (id),
  type                 TEXT    NOT NULL,
  dedupe_key           TEXT,
  payload_json         TEXT    NOT NULL,
  -- Token de un solo uso cifrado (AES-GCM); se borra en cuanto el correo sale (ADR-0006).
  secret_enc           TEXT,
  status               TEXT    NOT NULL
    CHECK (status IN ('PENDING', 'QUEUED', 'PROCESSING', 'SENT', 'FAILED')),
  attempts             INTEGER NOT NULL DEFAULT 0,
  available_at         INTEGER NOT NULL,
  created_at           INTEGER NOT NULL,
  queued_at            INTEGER,
  sent_at              INTEGER,
  provider_message_id  TEXT,
  last_error           TEXT
) STRICT;

CREATE UNIQUE INDEX uq_outbox_dedupe ON notification_outbox (dedupe_key)
  WHERE dedupe_key IS NOT NULL;
-- Barrido de pendientes: status + available_at, sin recorrer la tabla.
CREATE INDEX idx_outbox_status ON notification_outbox (status, available_at);
-- El webhook de Brevo llega con el message-id del proveedor.
CREATE INDEX idx_outbox_provider ON notification_outbox (provider_message_id)
  WHERE provider_message_id IS NOT NULL;

CREATE TABLE email_delivery_events (
  id                   TEXT    PRIMARY KEY,
  outbox_id            TEXT    REFERENCES notification_outbox (id),
  provider_message_id  TEXT,
  -- Huella del evento del proveedor: deduplica reintentos del webhook.
  provider_event_id    TEXT    UNIQUE,
  event_type           TEXT    NOT NULL,
  occurred_at          INTEGER NOT NULL,
  created_at           INTEGER NOT NULL,
  metadata_json        TEXT
) STRICT;

CREATE INDEX idx_delivery_outbox ON email_delivery_events (outbox_id);

CREATE TABLE audit_log (
  id                TEXT    PRIMARY KEY,
  actor_account_id  TEXT,
  action            TEXT    NOT NULL,
  target_type       TEXT    NOT NULL,
  target_id         TEXT    NOT NULL,
  reason            TEXT,
  metadata_json     TEXT,
  created_at        INTEGER NOT NULL
) STRICT;

CREATE INDEX idx_audit_target ON audit_log (target_type, target_id, created_at);
