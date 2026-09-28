// Moderación de Wous por terminal (Fase 7, ADR-0010; Fase 9, ADR-0012):
// revisar reportes, aplicar silencio, suspensión o cierre y dar o quitar el
// rol de la caseta, siempre con fila en audit_log. Habla con D1 por
// `wrangler d1 execute`, así que exige la sesión (o el token) de Cloudflare de
// quien despliega. El rol de la caseta SOLO se da aquí: la web no puede.
//
// Uso (desde la raíz del repo):
//   node scripts/moderacion/moderar.mts <entorno> <orden> [argumentos] [opciones]
//
//   entorno   local | staging | production
//   órdenes   reportes [--todos]
//             reporte <rpt_…>
//             silenciar <persona> <horas> --motivo "…" [--reporte rpt_…]
//             quitar-silencio <persona> --motivo "…"
//             suspender <persona> [--horas N] --motivo "…" [--reporte rpt_…]
//             banear <persona> --motivo "…" [--reporte rpt_…]
//             reactivar <persona> --motivo "…"
//             descartar <rpt_…> --motivo "…"
//             caseta
//             dar-caseta <persona> --motivo "…"
//             quitar-caseta <persona> --motivo "…"
//   persona   chr_…, acc_… o @usuario
//   opciones  --moderador <nombre> (si no, WOUS_MODERADOR o el usuario del sistema)
//
// La sala revisa a quien está conectado cada minuto: un silencio o una
// suspensión puestos aquí alcanzan a la persona en ese plazo (desde la
// caseta aplican en el acto). Una suspensión con --horas se levanta sola.
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { userInfo } from 'node:os';
import path from 'node:path';

const WORKER = path.join(import.meta.dirname, '../../apps/worker');
const WRANGLER = path.join(WORKER, 'node_modules/wrangler/bin/wrangler.js');
const ENTORNOS = ['local', 'staging', 'production'] as const;
type Entorno = (typeof ENTORNOS)[number];

const ULID_ID = /^(acc|chr|rpt)_[0-9A-HJKMNP-TV-Z]{26}$/;
const USUARIO = /^@?[A-Za-z0-9_]{3,20}$/;
const HORA = 60 * 60 * 1000;
const MOTIVOS: Record<string, string> = {
  HARASSMENT: 'Molestar',
  HATE: 'Odio',
  SEXUAL: 'Sexual',
  SPAM: 'Spam',
  IMPERSONATION: 'Suplantación',
  OTHER: 'Otro',
};

function fallar(mensaje: string): never {
  console.error(`✗ ${mensaje}`);
  process.exit(1);
}

// ─── Argumentos ───────────────────────────────────────────────────────────

const argv = process.argv.slice(2);
const opciones = new Map<string, string | true>();
const posicionales: string[] = [];
for (let i = 0; i < argv.length; i++) {
  const a = argv[i] ?? '';
  if (a.startsWith('--')) {
    const siguiente = argv[i + 1];
    if (siguiente !== undefined && !siguiente.startsWith('--')) {
      opciones.set(a.slice(2), siguiente);
      i++;
    } else {
      opciones.set(a.slice(2), true);
    }
  } else {
    posicionales.push(a);
  }
}
const [entornoArg, orden, ...resto] = posicionales;
if (!entornoArg || !orden) {
  fallar('Uso: node scripts/moderacion/moderar.mts <local|staging|production> <orden> …');
}
if (!ENTORNOS.includes(entornoArg as Entorno)) fallar(`Entorno desconocido: ${entornoArg}`);
const entorno = entornoArg as Entorno;

function opcionTexto(nombre: string): string | null {
  const v = opciones.get(nombre);
  return typeof v === 'string' ? v : null;
}

const moderador =
  opcionTexto('moderador') ?? process.env.WOUS_MODERADOR ?? userInfo().username ?? 'moderación';

// ─── SQL sin binds: todo valor pasa por aquí ─────────────────────────────

/** Texto libre a literal SQL: sin controles, comillas duplicadas. */
function texto(valor: string): string {
  const limpio = valor
    .normalize('NFC')
    .replace(/\p{Cc}/gu, ' ')
    .trim()
    .slice(0, 500);
  return `'${limpio.replaceAll("'", "''")}'`;
}

/** Un ID con forma de ULID, validado antes de tocar SQL. */
function id(valor: string, prefijo: 'acc' | 'chr' | 'rpt'): string {
  if (!ULID_ID.test(valor) || !valor.startsWith(`${prefijo}_`)) fallar(`ID inválido: ${valor}`);
  return `'${valor}'`;
}

const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
function ulid(ahora: number): string {
  let t = ahora;
  let tiempo = '';
  for (let i = 0; i < 10; i++) {
    tiempo = CROCKFORD.charAt(t % 32) + tiempo;
    t = Math.floor(t / 32);
  }
  const azar = randomBytes(16);
  let resto = '';
  for (const b of azar) resto += CROCKFORD.charAt(b % 32);
  return tiempo + resto;
}

// ─── wrangler ────────────────────────────────────────────────────────────

type Fila = Record<string, unknown>;

/** Corre SQL en la D1 del entorno y devuelve las filas del último SELECT. */
function d1(sql: string): Fila[] {
  const destino = entorno === 'local' ? ['--local'] : ['--remote', '--env', entorno];
  const r = spawnSync(
    process.execPath,
    [WRANGLER, 'd1', 'execute', 'DB', ...destino, '--json', '--command', sql],
    { cwd: WORKER, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 },
  );
  if (r.status !== 0) {
    fallar(`wrangler falló:\n${r.stderr || r.stdout}`);
  }
  const inicio = r.stdout.indexOf('[');
  if (inicio < 0) fallar(`Respuesta inesperada de wrangler:\n${r.stdout}`);
  const lotes = JSON.parse(r.stdout.slice(inicio)) as { results?: Fila[] }[];
  return lotes.at(-1)?.results ?? [];
}

/** A qué cuenta se refiere «persona» (chr_…, acc_… o @usuario). */
function cuentaDe(persona: string | undefined): { cuenta: string; nombre: string; estado: string } {
  if (!persona) fallar('Falta a quién (chr_…, acc_… o @usuario).');
  let where: string;
  if (persona.startsWith('chr_')) where = `c.id = ${id(persona, 'chr')}`;
  else if (persona.startsWith('acc_')) where = `a.id = ${id(persona, 'acc')}`;
  else if (USUARIO.test(persona))
    where = `a.username_normalized = ${texto(persona.replace(/^@/, '').toLowerCase())}`;
  else fallar(`No entiendo a quién: ${persona}`);
  const [fila] = d1(
    `SELECT a.id AS cuenta, a.username, a.status, c.display_name FROM accounts a
       LEFT JOIN characters c ON c.account_id = a.id WHERE ${where} LIMIT 1`,
  );
  if (!fila) fallar(`No existe: ${persona}`);
  const nombre = `${fila.display_name ?? '(sin personaje)'} (@${fila.username}, ${fila.status})`;
  return { cuenta: String(fila.cuenta), nombre, estado: String(fila.status) };
}

function motivoObligatorio(): string {
  const motivo = opcionTexto('motivo');
  if (!motivo) fallar('Falta --motivo "…": toda acción de moderación queda auditada.');
  return motivo;
}

/**
 * Fila de auditoría. Con `si` (condición sobre `accounts`), solo se escribe
 * si la cuenta la cumple: va ANTES del cambio, así no queda constancia de
 * algo que no pasó.
 */
function auditoria(
  accion: string,
  tipo: 'account' | 'report',
  objetivo: string,
  motivo: string,
  extra: Record<string, unknown>,
  ahora: number,
  si?: string,
): string {
  const metadata = JSON.stringify({ moderador, ...extra });
  const valores = `'aud_${ulid(ahora)}', NULL, ${texto(accion)}, '${tipo}', '${objetivo}',
    ${texto(motivo)}, ${texto(metadata)}, ${ahora}`;
  const columnas = `audit_log (id, actor_account_id, action, target_type, target_id, reason,
    metadata_json, created_at)`;
  return si
    ? `INSERT INTO ${columnas} SELECT ${valores} WHERE EXISTS (SELECT 1 FROM accounts WHERE ${si})`
    : `INSERT INTO ${columnas} VALUES (${valores})`;
}

/** Cierra el reporte que motivó la acción (si se dijo cuál). */
function cerrarReporte(resolucion: string, ahora: number): string {
  const reporte = opcionTexto('reporte');
  if (!reporte) return '';
  return `; UPDATE reports SET status = 'ACTIONED', resolved_at = ${ahora},
    resolution = ${texto(`${resolucion} · ${moderador}`)} WHERE id = ${id(reporte, 'rpt')}`;
}

function fecha(ms: unknown): string {
  return typeof ms === 'number'
    ? new Intl.DateTimeFormat('es-MX', { dateStyle: 'short', timeStyle: 'short' }).format(ms)
    : '—';
}

// ─── Órdenes ─────────────────────────────────────────────────────────────

const ahora = Date.now();

switch (orden) {
  case 'reportes': {
    const filtro = opciones.has('todos') ? '' : "WHERE r.status = 'OPEN'";
    const filas = d1(
      `SELECT r.id, r.created_at, r.reason, r.status, r.room, r.target_character_id,
              t.display_name AS reportado, rp.display_name AS reporta,
              json_extract(r.evidence_json, '$.message.text') AS mensaje,
              (SELECT COUNT(*) FROM reports o WHERE o.target_account_id = r.target_account_id
                 AND o.status = 'OPEN') AS abiertos
         FROM reports r
         LEFT JOIN characters t ON t.id = r.target_character_id
         LEFT JOIN characters rp ON rp.id = r.reporter_character_id
         ${filtro} ORDER BY r.created_at DESC LIMIT 50`,
    );
    if (filas.length === 0) {
      console.log('Sin reportes abiertos.');
      break;
    }
    for (const f of filas) {
      const mensaje = typeof f.mensaje === 'string' ? `«${f.mensaje}»` : '(sin mensaje elegido)';
      console.log(
        `${f.id}  ${fecha(f.created_at)}  ${MOTIVOS[String(f.reason)] ?? f.reason}  ${f.status}\n` +
          `   ${f.reportado} (${f.target_character_id}) · ${f.abiertos} abierto(s) · ${f.room}\n` +
          `   lo reporta ${f.reporta} · ${mensaje}\n`,
      );
    }
    break;
  }

  case 'reporte': {
    const [f] = d1(`SELECT * FROM reports WHERE id = ${id(resto[0] ?? '', 'rpt')}`);
    if (!f) fallar('No existe ese reporte.');
    const evidencia = JSON.parse(String(f.evidence_json)) as {
      target: { displayName: string; characterId: string };
      message: { text: string; at: number } | null;
      targetMessages: { text: string; at: number }[];
      context: { name: string; text: string; at: number }[];
    };
    console.log(`${f.id} · ${MOTIVOS[String(f.reason)] ?? f.reason} · ${f.status} · ${f.room}`);
    console.log(`Reportado: ${evidencia.target.displayName} (${evidencia.target.characterId})`);
    console.log(`Cuándo: ${fecha(f.created_at)}${f.note ? `\nNota: «${f.note}»` : ''}`);
    if (evidencia.context.length > 0) {
      console.log('\nAntes:');
      for (const l of evidencia.context) console.log(`  ${fecha(l.at)}  ${l.name}: ${l.text}`);
    }
    if (evidencia.message) {
      console.log(
        `\nMensaje reportado (${fecha(evidencia.message.at)}):\n  «${evidencia.message.text}»`,
      );
    }
    if (evidencia.targetMessages.length > 0) {
      console.log('\nLo último que dijo:');
      for (const l of evidencia.targetMessages) console.log(`  ${fecha(l.at)}  ${l.text}`);
    }
    if (f.resolution) console.log(`\nResolución: ${f.resolution} (${fecha(f.resolved_at)})`);
    break;
  }

  case 'silenciar': {
    const { cuenta, nombre } = cuentaDe(resto[0]);
    const horas = Number(resto[1]);
    if (!Number.isFinite(horas) || horas <= 0 || horas > 24 * 90) {
      fallar('Las horas van de más de 0 a 2160 (90 días).');
    }
    const motivo = motivoObligatorio();
    const hasta = ahora + Math.round(horas * HORA);
    d1(
      `UPDATE accounts SET chat_muted_until = ${hasta}, updated_at = ${ahora} WHERE id = '${cuenta}'; ` +
        auditoria('CHAT_MUTED', 'account', cuenta, motivo, { horas, hasta }, ahora) +
        cerrarReporte(`Silencio de ${horas} h`, ahora),
    );
    console.log(`✓ ${nombre} no puede escribir en el chat hasta el ${fecha(hasta)}`);
    break;
  }

  case 'quitar-silencio': {
    const { cuenta, nombre } = cuentaDe(resto[0]);
    const motivo = motivoObligatorio();
    d1(
      `UPDATE accounts SET chat_muted_until = NULL, updated_at = ${ahora} WHERE id = '${cuenta}'; ` +
        auditoria('CHAT_UNMUTED', 'account', cuenta, motivo, {}, ahora),
    );
    console.log(`✓ ${nombre} ya puede escribir.`);
    break;
  }

  case 'suspender':
  case 'banear': {
    const { cuenta, nombre, estado: antes } = cuentaDe(resto[0]);
    const motivo = motivoObligatorio();
    const estado = orden === 'suspender' ? 'SUSPENDED' : 'BANNED';
    // Igual que la caseta: se suspende una cuenta activa (o ya suspendida, para
    // cambiarle el fin); cerrar vale para todo menos lo ya cerrado o borrado.
    // Suspender una cerrada o sin correo confirmado la reabriría al vencer.
    const desde =
      orden === 'suspender' ? ['ACTIVE', 'SUSPENDED'] : ['ACTIVE', 'SUSPENDED', 'PENDING_EMAIL'];
    if (!desde.includes(antes)) {
      fallar(
        orden === 'suspender'
          ? `Solo se suspende una cuenta activa o suspendida; esta está ${antes}.`
          : `Esa cuenta ya está ${antes}.`,
      );
    }
    const condicion = `id = '${cuenta}' AND status IN (${desde.map((e) => `'${e}'`).join(', ')})`;
    // Suspender con --horas se levanta solo al vencer (ADR-0012); sin horas, hasta reactivar.
    const horasTexto = opcionTexto('horas');
    const horas = orden === 'suspender' && horasTexto !== null ? Number(horasTexto) : null;
    if (horas !== null && (!Number.isFinite(horas) || horas <= 0 || horas > 24 * 90)) {
      fallar('Las horas van de más de 0 a 2160 (90 días).');
    }
    const hasta = horas !== null ? ahora + Math.round(horas * HORA) : null;
    const [despues] = d1(
      `${auditoria(
        orden === 'suspender' ? 'ACCOUNT_SUSPENDED' : 'ACCOUNT_BANNED',
        'account',
        cuenta,
        motivo,
        hasta !== null ? { horas, hasta } : {},
        ahora,
        condicion,
      )}; ` +
        `UPDATE accounts SET status = '${estado}', suspended_until = ${hasta ?? 'NULL'},
           updated_at = ${ahora} WHERE ${condicion}; ` +
        `UPDATE sessions SET revoked_at = ${ahora} WHERE account_id = '${cuenta}' AND revoked_at IS NULL` +
        cerrarReporte(orden === 'suspender' ? 'Suspensión' : 'Cuenta cerrada', ahora) +
        `; SELECT status FROM accounts WHERE id = '${cuenta}'`,
    );
    // Otra persona pudo cambiarla entre la consulta y el cambio.
    if (despues?.status !== estado) fallar(`No cambió: la cuenta quedó ${despues?.status ?? '—'}.`);
    console.log(
      `✓ ${nombre}: ${estado}${hasta !== null ? ` hasta el ${fecha(hasta)}` : ''}. ` +
        'Sus sesiones se cerraron; si está en una sala, sale en menos de un minuto.',
    );
    break;
  }

  case 'reactivar': {
    const { cuenta, nombre, estado: antes } = cuentaDe(resto[0]);
    const motivo = motivoObligatorio();
    if (antes !== 'SUSPENDED')
      fallar(`Solo se reactiva una cuenta suspendida; esta está ${antes}.`);
    // Sin correo confirmado vuelve a esperar la confirmación, no a ACTIVE.
    const condicion = `id = '${cuenta}' AND status = 'SUSPENDED'`;
    const [despues] = d1(
      `${auditoria('ACCOUNT_REINSTATED', 'account', cuenta, motivo, {}, ahora, condicion)}; ` +
        `UPDATE accounts SET status = CASE WHEN email_verified_at IS NULL THEN 'PENDING_EMAIL'
           ELSE 'ACTIVE' END, suspended_until = NULL, updated_at = ${ahora} WHERE ${condicion}; ` +
        `SELECT status FROM accounts WHERE id = '${cuenta}'`,
    );
    console.log(`✓ ${nombre}: ahora ${despues?.status ?? '—'} (una cerrada no se reabre así).`);
    break;
  }

  case 'caseta': {
    const filas = d1(
      `SELECT s.role, s.granted_at, a.username, a.status, c.display_name FROM staff s
         JOIN accounts a ON a.id = s.account_id
         LEFT JOIN characters c ON c.account_id = a.id ORDER BY s.granted_at`,
    );
    if (filas.length === 0) console.log('Nadie atiende la caseta todavía.');
    for (const f of filas) {
      console.log(
        `@${f.username} (${f.display_name ?? 'sin personaje'}, ${f.status}) · ${f.role} desde el ${fecha(f.granted_at)}`,
      );
    }
    break;
  }

  case 'dar-caseta': {
    const { cuenta, nombre } = cuentaDe(resto[0]);
    const motivo = motivoObligatorio();
    d1(
      `INSERT INTO staff (account_id, role, granted_at, note)
         VALUES ('${cuenta}', 'ADMIN', ${ahora}, ${texto(motivo)})
         ON CONFLICT (account_id) DO NOTHING; ` +
        auditoria('STAFF_GRANTED', 'account', cuenta, motivo, { rol: 'ADMIN' }, ahora),
    );
    console.log(`✓ ${nombre} ya atiende la caseta (/caseta). Aplica en su próxima petición.`);
    break;
  }

  case 'quitar-caseta': {
    const { cuenta, nombre } = cuentaDe(resto[0]);
    const motivo = motivoObligatorio();
    d1(
      `DELETE FROM staff WHERE account_id = '${cuenta}'; ` +
        auditoria('STAFF_REVOKED', 'account', cuenta, motivo, {}, ahora),
    );
    console.log(`✓ ${nombre} ya no atiende la caseta.`);
    break;
  }

  case 'descartar': {
    const reporte = resto[0] ?? '';
    const motivo = motivoObligatorio();
    d1(
      `UPDATE reports SET status = 'DISMISSED', resolved_at = ${ahora},
         resolution = ${texto(`Descartado · ${moderador}`)} WHERE id = ${id(reporte, 'rpt')}; ` +
        auditoria('REPORT_DISMISSED', 'report', reporte, motivo, {}, ahora),
    );
    console.log(`✓ ${reporte} descartado.`);
    break;
  }

  default:
    fallar(`Orden desconocida: ${orden}`);
}
