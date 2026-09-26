import { env } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';

const NOW = 1_790_000_000_000;

function insertAccount(id: string, email: string, username: string) {
  return env.DB.prepare(
    `INSERT INTO accounts (id, email, email_normalized, username, username_normalized,
       password_hash, status, terms_version, terms_accepted_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 'x', 'PENDING_EMAIL', '2026-01', ?, ?, ?)`,
  )
    .bind(id, email, email.toLowerCase(), username, username.toLowerCase(), NOW, NOW, NOW)
    .run();
}

describe('D1 con la migración 0001', () => {
  it('escribe y lee una cuenta', async () => {
    await insertAccount('acc_01J8ZQ4Y7V3M2N6P8R0S1T2V3W', 'Ana@Example.com', 'Ana');
    const row = await env.DB.prepare('SELECT username, status FROM accounts WHERE id = ?')
      .bind('acc_01J8ZQ4Y7V3M2N6P8R0S1T2V3W')
      .first<{ username: string; status: string }>();
    expect(row).toEqual({ username: 'Ana', status: 'PENDING_EMAIL' });
  });

  it('impide dos cuentas con el mismo correo normalizado', async () => {
    await insertAccount('acc_01J8ZQ4Y7V3M2N6P8R0S1T2V3X', 'bob@example.com', 'bob');
    await expect(
      insertAccount('acc_01J8ZQ4Y7V3M2N6P8R0S1T2V3Y', 'BOB@example.com', 'bob2'),
    ).rejects.toThrow(/UNIQUE/);
  });

  it('rechaza un estado de cuenta desconocido', async () => {
    await expect(
      env.DB.prepare(
        `INSERT INTO accounts (id, email, email_normalized, username, username_normalized,
           password_hash, status, terms_version, terms_accepted_at, created_at, updated_at)
         VALUES ('acc_x', 'c@x.com', 'c@x.com', 'c', 'c', 'x', 'ADMIN', '2026-01', 1, 1, 1)`,
      ).run(),
    ).rejects.toThrow(/CHECK/);
  });

  it('la dedupe_key del outbox es única cuando existe y libre cuando es nula', async () => {
    const insert = (id: string, key: string | null) =>
      env.DB.prepare(
        `INSERT INTO notification_outbox (id, type, dedupe_key, payload_json, status,
           available_at, created_at) VALUES (?, 'EMAIL_VERIFY', ?, '{}', 'PENDING', ?, ?)`,
      )
        .bind(id, key, NOW, NOW)
        .run();
    await insert('obx_1', 'verify:acc_1:vrt_1');
    await expect(insert('obx_2', 'verify:acc_1:vrt_1')).rejects.toThrow(/UNIQUE/);
    await insert('obx_3', null);
    await insert('obx_4', null);
  });
});
