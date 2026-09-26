import { env } from 'cloudflare:workers';
import type { AppearanceInput, CharacterView, ErrorEnvelope } from '@wous/contracts';
import { describe, expect, it } from 'vitest';
import { call, postJson } from './helpers.ts';
import { createVerifiedUser, currentSession } from './support.ts';

const APPEARANCE: AppearanceInput = {
  body: 'b',
  skinTone: 'piel-4',
  hair: 'coleta',
  hairColor: 'rosa',
  top: 'chamarra.azul',
  bottom: 'falda.negro',
  shoes: 'tenis.rojo',
  accessory: 'lentes.negro',
};

function create(cookie: string, body: unknown) {
  return postJson('/api/v1/characters', body, { headers: { Cookie: cookie } });
}

async function errorOf(res: Response) {
  return ((await res.json()) as ErrorEnvelope).error;
}

async function characterCount(accountId: string) {
  const row = await env.DB.prepare('SELECT COUNT(*) AS n FROM characters WHERE account_id = ?')
    .bind(accountId)
    .first<{ n: number }>();
  return row?.n ?? 0;
}

describe('POST /api/v1/characters', () => {
  it('sin sesión no se crea nada', async () => {
    const res = await postJson('/api/v1/characters', {
      displayName: 'Nadie',
      appearance: APPEARANCE,
    });
    expect(res.status).toBe(401);
    expect((await errorOf(res)).code).toBe('AUTH_REQUIRED');
  });

  it('una cuenta ACTIVE crea su personaje y la sesión lo trae de vuelta', async () => {
    const user = await createVerifiedUser();
    const res = await create(user.cookie, { displayName: ' Ana  Lucía ', appearance: APPEARANCE });
    expect(res.status).toBe(201);
    const { data } = (await res.json()) as { data: CharacterView };
    expect(data.displayName).toBe('Ana Lucía');
    expect(data.id).toMatch(/^chr_/);

    // «Recarga conserva apariencia»: lo que se lee después es lo guardado.
    const me = await call('/api/v1/characters/me', { headers: { Cookie: user.cookie } });
    expect(((await me.json()) as { data: CharacterView }).data.appearance).toEqual(APPEARANCE);
    const session = await currentSession(user.cookie);
    expect(session.body.data?.hasCharacter).toBe(true);
    expect(session.body.data?.character?.appearance).toEqual(APPEARANCE);
  });

  it('solo un personaje por cuenta', async () => {
    const user = await createVerifiedUser();
    expect(
      (await create(user.cookie, { displayName: 'Primero', appearance: APPEARANCE })).status,
    ).toBe(201);
    const again = await create(user.cookie, { displayName: 'Segundo', appearance: APPEARANCE });
    expect(again.status).toBe(409);
    expect((await errorOf(again)).code).toBe('CHARACTER_EXISTS');
    expect(await characterCount(user.accountId)).toBe(1);
  });

  it('rechaza assets arbitrarios, piezas cruzadas y fuera del set inicial', async () => {
    const user = await createVerifiedUser();
    for (const bad of [
      { top: 'https://evil.example/skin.png' },
      { top: 'jogger.negro' },
      { shoes: 'botas.negro' },
      { hair: 'chino', accessory: 'gorra.rojo' },
    ]) {
      const res = await create(user.cookie, {
        displayName: 'Probando',
        appearance: { ...APPEARANCE, ...bad },
      });
      expect(res.status).toBe(400);
      const error = await errorOf(res);
      expect(error.code).toBe('INVALID_APPEARANCE');
      expect(Object.keys(error.fields ?? {})[0]).toMatch(/^appearance\./);
    }
    // Un id que ni siquiera cumple el enum lo para el contrato.
    const res = await create(user.cookie, {
      displayName: 'Probando',
      appearance: { ...APPEARANCE, skinTone: 'piel-99' },
    });
    expect((await errorOf(res)).code).toBe('INVALID_REQUEST');
    expect(await characterCount(user.accountId)).toBe(0);
  });

  it('rechaza nombres reservados aunque lleven acentos o espacios', async () => {
    const user = await createVerifiedUser();
    for (const displayName of ['Ádmin', 'W o u s', 'Moderadora']) {
      const res = await create(user.cookie, { displayName, appearance: APPEARANCE });
      expect((await errorOf(res)).code).toBe('INVALID_DISPLAY_NAME');
    }
  });

  it('una cuenta suspendida no crea personaje', async () => {
    const user = await createVerifiedUser();
    await env.DB.prepare("UPDATE accounts SET status = 'SUSPENDED' WHERE id = ?")
      .bind(user.accountId)
      .run();
    const res = await create(user.cookie, { displayName: 'Probando', appearance: APPEARANCE });
    expect(res.status).toBe(403);
    expect((await errorOf(res)).code).toBe('ACCOUNT_SUSPENDED');
  });

  it('GET /me sin personaje dice CHARACTER_REQUIRED', async () => {
    const user = await createVerifiedUser();
    const res = await call('/api/v1/characters/me', { headers: { Cookie: user.cookie } });
    expect(res.status).toBe(403);
    expect((await errorOf(res)).code).toBe('CHARACTER_REQUIRED');
  });
});
