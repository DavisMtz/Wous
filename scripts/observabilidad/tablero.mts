// Tablero de observabilidad de Wous (Fase 9, ADR-0012; §24 del plan): lo que
// vive en los logs y en las analíticas de Cloudflare, en una sola corrida. Lo
// que vive en D1 y en las salas (gente conectada, cuentas, reportes) está en la
// caseta (/caseta). Cómo leerlo y qué hacer: docs/runbooks/observabilidad.md.
//
// Uso (desde la raíz del repo, Node 24):
//   CLOUDFLARE_ACCOUNT_ID=… CLOUDFLARE_API_TOKEN=… \
//     node scripts/observabilidad/tablero.mts <staging|production> [--horas 24]
//
// El token necesita «Workers Observability: Read» y «Account Analytics: Read».
// Solo lee: no cambia nada en ningún entorno.
import { readFileSync } from 'node:fs';
import path from 'node:path';

const ENTORNOS = ['staging', 'production'] as const;
type Entorno = (typeof ENTORNOS)[number];
const HORA = 60 * 60 * 1000;
const API = 'https://api.cloudflare.com/client/v4';

function fallar(mensaje: string): never {
  console.error(`✗ ${mensaje}`);
  process.exit(1);
}

// ─── Argumentos y configuración ──────────────────────────────────────────

const [entornoArg, ...resto] = process.argv.slice(2);
if (!ENTORNOS.includes(entornoArg as Entorno)) {
  fallar('Uso: node scripts/observabilidad/tablero.mts <staging|production> [--horas 24]');
}
const entorno = entornoArg as Entorno;
const iHoras = resto.indexOf('--horas');
const horas = iHoras >= 0 ? Number(resto[iHoras + 1]) : 24;
// Workers Logs guarda hasta 7 días (3 en el plan gratuito).
if (!Number.isFinite(horas) || horas <= 0 || horas > 168) fallar('--horas va de 1 a 168.');

const cuenta = process.env.CLOUDFLARE_ACCOUNT_ID;
const token = process.env.CLOUDFLARE_API_TOKEN;
if (!cuenta || !token) fallar('Faltan CLOUDFLARE_ACCOUNT_ID y CLOUDFLARE_API_TOKEN en el entorno.');

/** wrangler.jsonc sin comentarios (respetando las cadenas, que llevan `//` en las URL). */
function leerJsonc(archivo: string): unknown {
  const texto = readFileSync(archivo, 'utf8');
  let out = '';
  let enCadena = false;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i] ?? '';
    if (enCadena) {
      out += c;
      if (c === '\\') out += texto[++i] ?? '';
      else if (c === '"') enCadena = false;
    } else if (c === '"') {
      enCadena = true;
      out += c;
    } else if (c === '/' && texto[i + 1] === '/') {
      while (i < texto.length && texto[i] !== '\n') i++;
      out += '\n';
    } else {
      out += c;
    }
  }
  return JSON.parse(out.replace(/,(\s*[}\]])/g, '$1'));
}

type WranglerEnv = { name: string; d1_databases: { database_name: string; database_id: string }[] };
const wrangler = leerJsonc(path.join(import.meta.dirname, '../../apps/worker/wrangler.jsonc')) as {
  env: Record<Entorno, WranglerEnv>;
};
const worker = wrangler.env[entorno].name;
const d1 = wrangler.env[entorno].d1_databases[0];

const hasta = Date.now();
const desde = hasta - horas * HORA;

// ─── Cloudflare ──────────────────────────────────────────────────────────

async function pedir<T>(ruta: string, cuerpo: unknown): Promise<T> {
  const res = await fetch(`${API}${ruta}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(cuerpo),
  });
  const json = (await res.json()) as { success?: boolean; errors?: unknown; data?: unknown };
  if (!res.ok || json.success === false) {
    throw new Error(`${res.status} ${JSON.stringify(json.errors ?? json).slice(0, 300)}`);
  }
  return json as T;
}

type Fila = Record<string, unknown>;

async function graphql(query: string): Promise<Fila> {
  const r = await pedir<{ data?: { viewer: { accounts: Fila[] } }; errors?: unknown }>('/graphql', {
    query,
    variables: {
      cuenta,
      desde: new Date(desde).toISOString(),
      hasta: new Date(hasta).toISOString(),
    },
  });
  if (r.errors) throw new Error(JSON.stringify(r.errors).slice(0, 300));
  return r.data?.viewer.accounts[0] ?? {};
}

type Agregado = { value: number; groups?: { key: string; value: string | number }[] };
type Calculo = { alias?: string; aggregates?: Agregado[] };

/** Workers Observability: cálculos sobre los logs estructurados del Worker. */
async function logs(
  calculations: Fila[],
  groupBys: Fila[],
  filtros: Fila[] = [],
  limit = 50,
): Promise<Calculo[]> {
  const r = await pedir<{ result: { calculations?: Calculo[] } }>(
    `/accounts/${cuenta}/workers/observability/telemetry/query`,
    {
      queryId: `tablero-${Date.now()}`,
      timeframe: { from: desde, to: hasta },
      view: 'calculations',
      limit,
      parameters: {
        // Cuántos grupos devuelve (por omisión, 10: se comía eventos).
        limit,
        datasets: ['cloudflare-workers'],
        filters: [
          { key: '$metadata.service', operation: 'eq', type: 'string', value: worker },
          ...filtros,
        ],
        calculations,
        groupBys,
      },
    },
  );
  return r.result.calculations ?? [];
}

async function eventosRecientes(nivel: 'warn' | 'error'): Promise<Fila[]> {
  const r = await pedir<{ result: { events?: { events?: Fila[] } } }>(
    `/accounts/${cuenta}/workers/observability/telemetry/query`,
    {
      queryId: `tablero-eventos-${nivel}`,
      timeframe: { from: desde, to: hasta },
      view: 'events',
      limit: 15,
      parameters: {
        datasets: ['cloudflare-workers'],
        filters: [
          { key: '$metadata.service', operation: 'eq', type: 'string', value: worker },
          { key: '$metadata.level', operation: 'eq', type: 'string', value: nivel },
        ],
      },
    },
  );
  return r.result.events?.events ?? [];
}

// ─── Formato ─────────────────────────────────────────────────────────────

const n = (v: unknown) =>
  typeof v === 'number' ? Math.round(v).toLocaleString('es-MX') : String(v ?? '—');
const ms = (us: unknown) => (typeof us === 'number' ? `${(us / 1000).toFixed(1)} ms` : '—');
const hora = (t: number) =>
  new Intl.DateTimeFormat('es-MX', { dateStyle: 'short', timeStyle: 'short' }).format(t);

async function seccion(titulo: string, cuerpo: () => Promise<void>) {
  console.log(`\n${titulo}`);
  try {
    await cuerpo();
  } catch (err) {
    console.log(`  (no disponible: ${err instanceof Error ? err.message : String(err)})`);
  }
}

function porGrupo(calculo: Calculo | undefined): Map<string, number> {
  const out = new Map<string, number>();
  for (const a of calculo?.aggregates ?? []) {
    out.set((a.groups ?? []).map((g) => String(g.value)).join(' · '), a.value);
  }
  return out;
}

// ─── Tablero ─────────────────────────────────────────────────────────────

console.log(`Wous · ${entorno} (${worker}) · últimas ${horas} h: ${hora(desde)} → ${hora(hasta)}`);

await seccion('Worker (analíticas)', async () => {
  const a = await graphql(`query ($cuenta: String!, $desde: Time!, $hasta: Time!) {
    viewer { accounts(filter: { accountTag: $cuenta }) {
      w: workersInvocationsAdaptive(limit: 20, filter: { datetime_geq: $desde, datetime_leq: $hasta, scriptName: "${worker}" }) {
        dimensions { status } sum { requests errors subrequests } quantiles { cpuTimeP50 cpuTimeP99 }
      }
    } } }`);
  for (const f of (a.w as Fila[] | undefined) ?? []) {
    const d = f.dimensions as Fila;
    const s = f.sum as Fila;
    const q = f.quantiles as Fila;
    console.log(
      `  ${String(d.status).padEnd(26)} peticiones ${n(s.requests)} · errores ${n(s.errors)} · CPU p50 ${ms(q.cpuTimeP50)} · p99 ${ms(q.cpuTimeP99)}`,
    );
  }
});

await seccion('HTTP por ruta (logs `http.request`, ms)', async () => {
  const calc = await logs(
    [
      { operator: 'count', alias: 'n' },
      { operator: 'median', key: 'durationMs', keyType: 'number', alias: 'mediana' },
      { operator: 'p95', key: 'durationMs', keyType: 'number', alias: 'p95' },
      { operator: 'p99', key: 'durationMs', keyType: 'number', alias: 'p99' },
    ],
    [{ type: 'string', value: 'path' }],
    [{ key: 'event', operation: 'eq', type: 'string', value: 'http.request' }],
    25,
  );
  const [cuantas, mediana, p95, p99] = calc.map(porGrupo);
  console.log(
    `  ${'ruta'.padEnd(34)}${'n'.padStart(7)}${'mediana'.padStart(9)}${'p95'.padStart(7)}${'p99'.padStart(7)}`,
  );
  for (const [ruta, total] of [...(cuantas ?? new Map())].sort((x, y) => y[1] - x[1])) {
    console.log(
      `  ${ruta.slice(0, 33).padEnd(34)}${n(total).padStart(7)}${n(mediana?.get(ruta)).padStart(9)}${n(p95?.get(ruta)).padStart(7)}${n(p99?.get(ruta)).padStart(7)}`,
    );
  }
  const estados = porGrupo(
    (
      await logs(
        [{ operator: 'count', alias: 'n' }],
        [{ type: 'number', value: 'status' }],
        [{ key: 'event', operation: 'eq', type: 'string', value: 'http.request' }],
      )
    )[0],
  );
  const lista = [...estados].sort((x, y) => Number(x[0]) - Number(y[0]));
  console.log(`  respuestas: ${lista.map(([s, c]) => `${s}: ${n(c)}`).join(' · ')}`);
});

await seccion('Durable Objects (analíticas)', async () => {
  const a = await graphql(`query ($cuenta: String!, $desde: Time!, $hasta: Time!) {
    viewer { accounts(filter: { accountTag: $cuenta }) {
      d: durableObjectsInvocationsAdaptiveGroups(limit: 20, filter: { datetime_geq: $desde, datetime_leq: $hasta, scriptName: "${worker}" }) {
        dimensions { status } sum { requests errors } quantiles { cpuTimeP50 cpuTimeP99 wallTimeP99 }
      }
    } } }`);
  for (const f of (a.d as Fila[] | undefined) ?? []) {
    const d = f.dimensions as Fila;
    const s = f.sum as Fila;
    const q = f.quantiles as Fila;
    console.log(
      `  ${String(d.status).padEnd(26)} peticiones ${n(s.requests)} · errores ${n(s.errors)} · CPU p50 ${ms(q.cpuTimeP50)} · p99 ${ms(q.cpuTimeP99)}`,
    );
  }
  console.log(
    '  (un WebSocket que se cierra cuenta como «error» del DO con clientDisconnected: es normal)',
  );
});

await seccion(`D1 (${d1?.database_name ?? '—'})`, async () => {
  const a = await graphql(`query ($cuenta: String!, $desde: Time!, $hasta: Time!) {
    viewer { accounts(filter: { accountTag: $cuenta }) {
      d: d1AnalyticsAdaptiveGroups(limit: 1, filter: { datetime_geq: $desde, datetime_leq: $hasta, databaseId: "${d1?.database_id ?? ''}" }) {
        sum { readQueries writeQueries rowsRead rowsWritten }
      }
    } } }`);
  const s = ((a.d as Fila[] | undefined)?.[0]?.sum as Fila | undefined) ?? {};
  console.log(
    `  lecturas ${n(s.readQueries ?? 0)} (${n(s.rowsRead ?? 0)} filas) · escrituras ${n(s.writeQueries ?? 0)} (${n(s.rowsWritten ?? 0)} filas)`,
  );
});

/** Los contadores del §24, desde los eventos estructurados. */
const CONTADORES: [string, string[]][] = [
  ['registros', ['auth.registered']],
  ['invitaciones rechazadas', ['auth.invitation_rejected']],
  ['correos encolados', ['email.enqueued']],
  ['correos enviados', ['email.sent']],
  ['correos que no salieron', ['email.delivery_failed']],
  ['correos omitidos', ['email.skipped']],
  ['reintentos de envío', ['email.send_retry']],
  ['correos a la DLQ', ['email.dead_lettered']],
  ['logins', ['auth.login_success']],
  ['logins fallidos', ['auth.login_failed']],
  ['conexiones al mundo', ['world.connect']],
  ['salidas de sala', ['room.left']],
  ['caídas (lugar guardado)', ['room.dropped']],
  ['cierres por faltas', ['room.policy_close']],
  ['flood de chat', ['room.chat_flood']],
  ['cruces fallidos', ['room.portal_failed', 'room.arrival_failed']],
  ['reportes', ['room.report']],
  ['sanciones desde la caseta', ['admin.sanction']],
  ['suspensiones levantadas', ['moderation.suspension_lifted']],
  ['Origin rechazado', ['world.origin_rejected', 'http.origin_rejected']],
];

await seccion('Eventos (logs)', async () => {
  const conteo = porGrupo(
    (
      await logs([{ operator: 'count', alias: 'n' }], [{ type: 'string', value: 'event' }], [], 200)
    )[0],
  );
  for (const [nombre, eventos] of CONTADORES) {
    const total = eventos.reduce((suma, e) => suma + (conteo.get(e) ?? 0), 0);
    console.log(`  ${nombre.padEnd(28)} ${n(total)}`);
  }
});

for (const nivel of ['error', 'warn'] as const) {
  await seccion(`Últimos ${nivel === 'error' ? 'errores' : 'avisos'}`, async () => {
    const eventos = await eventosRecientes(nivel);
    if (eventos.length === 0) console.log('  ninguno');
    for (const e of eventos) {
      const fuente = (e.source ?? {}) as Fila;
      const { level: _l, environment: _e, requestId: _r, ...campos } = fuente;
      console.log(`  ${hora(Number(e.timestamp))}  ${JSON.stringify(campos).slice(0, 220)}`);
    }
  });
}
