import { CHAT, type RateLimitRule, SOCIAL } from '@wous/config';
import type { AppearanceInput, ChatLine } from '@wous/contracts';

/**
 * El chat de una sala (§18), en funciones puras: la sala las llama y guarda
 * el resultado. Nada de esto toca D1.
 */

/**
 * Lo que la sala recuerda de cada mensaje, en su storage y solo unos minutos
 * (`CHAT.recent`). Lleva la cuenta de quien habló para el reporte; la cuenta
 * nunca sale hacia los clientes.
 */
export type ChatRecord = ChatLine & { acc: string };

export const CHAT_PREFIX = 'chat:';

export function toLine(record: ChatRecord): ChatLine {
  return {
    id: record.id,
    from: record.from,
    name: record.name,
    text: record.text,
    at: record.at,
  };
}

export type WindowCheck = { allowed: boolean; stamps: number[]; retryAfterMs: number };

/**
 * Ventana deslizante con las marcas de tiempo guardadas en el attachment.
 * Cuenta los intentos (aceptados o no): quien inunda carga a la sala igual.
 */
export function slidingWindow(
  stamps: readonly number[] | undefined,
  now: number,
  rule: RateLimitRule,
): WindowCheck {
  const recent = (stamps ?? []).filter((t) => now - t < rule.windowMs);
  if (recent.length >= rule.limit) {
    const oldest = Math.min(...recent);
    return { allowed: false, stamps: recent, retryAfterMs: oldest + rule.windowMs - now };
  }
  return { allowed: true, stamps: [...recent, now], retryAfterMs: 0 };
}

/**
 * Huella corta de un texto para notar que se repite sin guardarlo en el
 * attachment (tope de 2 KB). Ignora mayúsculas, espacios y puntuación: «hola»,
 * «Hola!!» y «h o l a» son el mismo mensaje. FNV-1a de 32 bits.
 */
export function textPrint(text: string): number {
  const core = text.toLocaleLowerCase('es-MX').replace(/[\s\p{P}]+/gu, '');
  let hash = 0x811c9dc5;
  for (let i = 0; i < core.length; i++) {
    hash ^= core.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash;
}

/** Quita de la ventana lo vencido y lo que sobra; devuelve los IDs que salieron. */
export function pruneRecent(recent: ChatRecord[], now: number): string[] {
  const dropped: string[] = [];
  while (recent.length > 0) {
    const oldest = recent[0] as ChatRecord;
    const expired = oldest.at < now - CHAT.recent.ttlMs;
    if (!expired && recent.length <= CHAT.recent.max) break;
    dropped.push(oldest.id);
    recent.shift();
  }
  return dropped;
}

export type ReportTarget = {
  characterId: string;
  accountId: string;
  displayName: string;
  appearance: AppearanceInput | null;
};

type EvidenceLine = { id: string; from: string; name: string; text: string; at: number };

/** Lo que queda guardado con el reporte (versión 1 de la forma). */
export type Evidence = {
  v: 1;
  capturedAt: number;
  target: { characterId: string; displayName: string; appearance: AppearanceInput | null };
  /** El mensaje reportado, tal como la sala lo repartió. */
  message: EvidenceLine | null;
  /** Se pidió un mensaje que ya salió de la ventana (se guarda solo su ID). */
  requestedMessageId?: string;
  /** Lo último que dijo la persona reportada (sin mensaje elegido). */
  targetMessages: EvidenceLine[];
  /** Conversación inmediatamente anterior, para entender el mensaje. */
  context: EvidenceLine[];
};

export type EvidenceResult =
  | { ok: true; evidence: Evidence }
  /** El mensaje existe pero lo dijo otra persona: un cliente alterado. */
  | { ok: false; reason: 'NOT_THEIRS' };

function evidenceLine(r: ChatRecord): EvidenceLine {
  return { id: r.id, from: r.from, name: r.name, text: r.text, at: r.at };
}

/**
 * Arma la evidencia de un reporte SOLO con lo que la sala repartió: el
 * cliente dice qué mensaje (por ID), nunca qué decía. El contexto es mínimo
 * (§18): unos cuantos mensajes antes, dentro de una ventana corta.
 */
export function buildEvidence(
  recent: readonly ChatRecord[],
  target: ReportTarget,
  messageId: string | undefined,
  now: number,
): EvidenceResult {
  const base = {
    v: 1 as const,
    capturedAt: now,
    target: {
      characterId: target.characterId,
      displayName: target.displayName,
      appearance: target.appearance,
    },
  };
  const index = messageId ? recent.findIndex((r) => r.id === messageId) : -1;
  const reported = index >= 0 ? (recent[index] as ChatRecord) : null;
  if (reported && reported.acc !== target.accountId) return { ok: false, reason: 'NOT_THEIRS' };

  const until = reported ? reported.at : now;
  const before = reported ? recent.slice(0, index) : recent;
  const context = before
    .filter((r) => r.at >= until - SOCIAL.reportContext.windowMs)
    .slice(-SOCIAL.reportContext.messages)
    .map(evidenceLine);
  const targetMessages = reported
    ? []
    : recent
        .filter((r) => r.acc === target.accountId)
        .slice(-SOCIAL.reportTargetMessages)
        .map(evidenceLine);

  return {
    ok: true,
    evidence: {
      ...base,
      message: reported ? evidenceLine(reported) : null,
      ...(messageId && !reported ? { requestedMessageId: messageId } : {}),
      targetMessages,
      context,
    },
  };
}
