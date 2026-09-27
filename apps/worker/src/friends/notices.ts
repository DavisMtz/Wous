import { EMAIL, TIME } from '@wous/config';
import { OutboxPayloads, type SocialType } from '../email/catalog.ts';

/**
 * Lo que se revisa de un aviso social justo antes de mandarlo (ADR-0011).
 * Devuelve por qué NO debe salir, o null si sigue valiendo.
 *
 * - La amistad sigue como cuando se encoló: la solicitud pendiente y visible
 *   (nadie la canceló, rechazó ni bloqueó) o la amistad aceptada en esa vuelta.
 * - La persona no pasó del tope diario de avisos sociales, vengan de quien
 *   vengan: su bandeja no se llena aunque la busquen muchas cuentas.
 */
export async function socialNoticeProblem(
  db: D1Database,
  type: SocialType,
  rawPayload: unknown,
  accountId: string,
  now: number,
): Promise<string | null> {
  const payload = OutboxPayloads[type].safeParse(rawPayload);
  if (!payload.success) return 'payload inválido';
  const { friendshipId, round } = payload.data;

  const [friendship, sent] = await db.batch<Record<string, unknown>>([
    db
      .prepare(
        `SELECT status, round, hidden, requester_id, addressee_id FROM friendships WHERE id = ?`,
      )
      .bind(friendshipId),
    db
      .prepare(
        `SELECT COUNT(*) AS n FROM notification_outbox
          WHERE account_id = ? AND sent_at > ? AND type IN ('FRIEND_REQUEST', 'FRIEND_ACCEPTED')`,
      )
      .bind(accountId, now - TIME.DAY),
  ]);
  const row = friendship?.results[0] as
    | { status: string; round: number; hidden: number; requester_id: string; addressee_id: string }
    | undefined;
  const stillApplies =
    row !== undefined &&
    row.round === round &&
    (type === 'FRIEND_REQUEST'
      ? row.status === 'PENDING' && row.hidden === 0 && row.addressee_id === accountId
      : row.status === 'ACCEPTED' && row.requester_id === accountId);
  if (!stillApplies) return 'la amistad ya cambió';

  const n = Number(sent?.results[0]?.n ?? 0);
  if (n >= EMAIL.socialPerRecipientPerDay) return 'tope diario de avisos sociales';
  return null;
}
