import { CHAT } from '@wous/config';
import { z } from 'zod';

/**
 * Chat, gestos y reportes (§18, §19). El saneado vive aquí para que el
 * servidor (que manda) y el cliente (que cuenta letras mientras escribes)
 * usen la misma regla. El texto NUNCA se escapa como HTML: viaja como string
 * en JSON y se pinta como nodo de texto (React) o en canvas (Phaser). Un
 * «<script>» se lee tal cual y no se ejecuta en ningún lado.
 */

/** Gestos permitidos (§19). El cliente pide un ID; nunca manda asset ni animación. */
export const EMOTE_IDS = ['wave', 'laugh', 'heart', 'thumbs_up'] as const;
export const Emote = z.enum(EMOTE_IDS);
export type Emote = z.infer<typeof Emote>;

/** Motivos de un reporte. El texto que ve la persona vive en la interfaz. */
export const REPORT_REASONS = [
  'HARASSMENT',
  'HATE',
  'SEXUAL',
  'SPAM',
  'IMPERSONATION',
  'OTHER',
] as const;
export const ReportReason = z.enum(REPORT_REASONS);
export type ReportReason = z.infer<typeof ReportReason>;

export type ChatRejection = 'EMPTY' | 'TOO_LONG';
export type SanitizedChat = { ok: true; text: string } | { ok: false; reason: ChatRejection };

/**
 * Invisibles que se quitan: formato (Cf) salvo el ZWJ de los emojis
 * compuestos, privados, sustitutos sueltos y no-caracteres. Los rellenos
 * Hangul y el braille en blanco se ven como espacio: se tratan como tal.
 */
const FORMAT_EXCEPT_ZWJ = /(?!‍)\p{Cf}/gu;
const PRIVATE_OR_BROKEN = /[\p{Co}﷐-﷯￾￿]|[\uD800-\uDFFF]/gu;
const CONTROLS = /\p{Cc}/gu;
const BLANKS = /[\sᅟᅠ⠀ㅤﾠ]+/gu;
const ZWJ_RUNS = /‍{2,}/gu;
/** Deja pasar las primeras marcas combinantes de una letra y tira el resto. */
const MARK_RUNS = new RegExp(`(\\p{M}{${CHAT.maxCombiningMarks}})\\p{M}+`, 'gu');
/** Al menos algo que se vea: letra, número, puntuación o símbolo (emoji incluido). */
const VISIBLE = /[\p{L}\p{N}\p{P}\p{S}]/u;

/** Cuántos caracteres cuenta el límite (code points, no unidades UTF-16). */
export function chatLength(text: string): number {
  let n = 0;
  for (const _ of text) n += 1;
  return n;
}

export function sanitizeChat(raw: string, maxChars: number = CHAT.maxChars): SanitizedChat {
  const text = raw
    .normalize('NFC')
    .replace(PRIVATE_OR_BROKEN, '')
    .replace(FORMAT_EXCEPT_ZWJ, '')
    .replace(CONTROLS, ' ')
    .replace(MARK_RUNS, '$1')
    .replace(ZWJ_RUNS, '‍')
    .replace(BLANKS, ' ')
    .trim()
    .normalize('NFC');
  if (!VISIBLE.test(text)) return { ok: false, reason: 'EMPTY' };
  if (chatLength(text) > maxChars) return { ok: false, reason: 'TOO_LONG' };
  return { ok: true, text };
}
