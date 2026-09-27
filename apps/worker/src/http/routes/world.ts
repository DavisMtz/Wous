import { RATE_LIMITS } from '@wous/config';
import { Hono } from 'hono';
import { readSessionCookie, resolveSession } from '../../auth/sessions.ts';
import { findCharacterByAccount } from '../../characters/characters.ts';
import { identityRateKey } from '../../security/rate-limit.ts';
import { claimPresence } from '../../world/location.ts';
import {
  directoryObjectName,
  encodeIdentity,
  IDENTITY_HEADER,
  type RoomIdentity,
  roomObjectName,
} from '../../world/players.ts';
import type { AppHono } from '../types.ts';

/**
 * `GET /ws/world` (§12). El navegador no puede leer el status de un upgrade
 * fallido, así que aquí se responde con HTTP simple: el cliente que no llega a
 * abrir consulta /auth/session para saber si fue la sesión o la red.
 *
 * 1. Origin exacto (esta ruta vive fuera de /api: el guardia no la cubre).
 * 2. Cookie de sesión válida y cuenta ACTIVE.
 * 3. Personaje creado.
 * 4. Turno de presencia nuevo y sala guardada en D1 (ADR-0009): la sala NO
 *    viene de la petición. Query, cabeceras o cuerpo no cambian el destino.
 * 5. El directorio de esa sala elige instancia (y el punto de llegada si
 *    vienes de un portal); la petición se reenvía al Durable Object con
 *    cabeceras NUEVAS: nada del cliente llega tal cual.
 */
export const worldRoutes = new Hono<AppHono>().get('/world', async (c) => {
  const log = c.get('log');
  if (c.req.header('Upgrade')?.toLowerCase() !== 'websocket') {
    return c.text('Se esperaba una conexión WebSocket.', 426);
  }
  const origin = c.req.header('Origin');
  if (!origin || origin !== c.get('config').origin) {
    log.warn('world.origin_rejected', { origin: origin ?? null });
    return c.text('Origen no permitido.', 403);
  }

  const { clock, rateLimiter } = c.get('deps');
  const session = await resolveSession(c.env, clock, readSessionCookie(c), (p) =>
    c.executionCtx.waitUntil(p),
  );
  if (!session) return c.text('Inicia sesión para entrar.', 401);
  if (session.account.status !== 'ACTIVE') return c.text('Tu cuenta no está activa.', 403);

  const character = await findCharacterByAccount(c.env.DB, session.account.id);
  if (!character) return c.text('Primero arma tu personaje.', 409);

  const decision = await rateLimiter.hit(
    await identityRateKey(c.env, 'world', session.account.id),
    RATE_LIMITS.worldConnectPerAccount,
  );
  if (!decision.allowed) {
    log.warn('world.rate_limited', { accountId: session.account.id });
    return c.text('Demasiadas conexiones seguidas. Espera un momento.', 429);
  }

  const claim = await claimPresence(c.env.DB, character.id, session.account.id);
  if (!claim) return c.text('Primero arma tu personaje.', 409);
  const { mapId, epoch, chatMutedUntil } = claim;
  const now = clock.now();
  const limits = c.get('config').roomCapacity;
  const directory = c.env.ROOM_DIRECTORY.get(
    c.env.ROOM_DIRECTORY.idFromName(directoryObjectName(mapId)),
  );
  const { instance, spawn } = await directory.assign(character.id, limits);

  const identity: RoomIdentity = {
    characterId: character.id,
    accountId: session.account.id,
    sessionId: session.sessionId,
    displayName: character.displayName,
    appearance: character.appearance,
    mapId,
    instance,
    epoch,
    ...(spawn ? { spawn } : {}),
    ...(chatMutedUntil !== null && chatMutedUntil > now ? { mutedUntil: chatMutedUntil } : {}),
    softLimit: limits.softLimit,
    hardLimit: limits.hardLimit,
  };
  const room = c.env.ROOM.get(c.env.ROOM.idFromName(roomObjectName(mapId, instance)));
  log.info('world.connect', {
    characterId: character.id,
    map: mapId,
    instance,
    epoch,
    arrival: spawn ?? null,
  });
  return room.fetch(
    new Request('https://sala.wous.internal/entrar', {
      headers: { Upgrade: 'websocket', [IDENTITY_HEADER]: encodeIdentity(identity) },
    }),
  );
});
