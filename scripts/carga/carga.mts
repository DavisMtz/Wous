// Pruebas de carga de Wous (Fase 9, ADR-0012; §27 del plan): bots que entran a
// la sala por el mismo camino que un navegador —WebSocket con cookie y Origin,
// el Worker, el directorio y la sala— y miden lo que el plan pide medir:
// input→broadcast, mensajes por persona, reconexiones y errores. La CPU del
// Durable Object y el consumo de D1 salen de las analíticas de Cloudflare.
//
// Uso (desde la raíz del repo, Node 24):
//   node scripts/carga/carga.mts <local|staging> --bots 25 [--segundos 90]
//        [--mapa plaza|cafe] [--salida resultado.json] [--sin-analiticas]
//
// Los bots son cuentas `carga_###` (prefijo reservado) ya ACTIVE y con
// personaje, sembradas en D1 con `wrangler d1 execute`; su sesión se acuña con
// el SESSION_PEPPER del entorno: WOUS_SESSION_PEPPER, o apps/worker/.dev.vars
// (local), o apps/worker/secrets.staging.json (staging). NUNCA corre contra
// producción. Al terminar se cierran sus sesiones.
//
// Con los límites reales el directorio abre otra instancia al pasar de 35
// personas; para medir 45 en UNA sala, staging se despliega un rato con
// ROOM_SOFT_LIMIT=45 (docs/carga/README.md).
import { spawnSync } from 'node:child_process';
import { createHmac, randomBytes } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { NETWORK } from '../../packages/config/src/index.ts';
import {
  BODY_IDS,
  EMOTE_IDS,
  HAIR_COLOR_IDS,
  HAIR_IDS,
  resolveAppearance,
  SKIN_TONE_IDS,
  starterItems,
  WS_PING_TEXT,
  WS_PONG_TEXT,
  WS_PROTOCOL_VERSION,
} from '../../packages/contracts/src/index.ts';

const RAIZ = path.join(import.meta.dirname, '../..');
const WORKER = path.join(RAIZ, 'apps/worker');
const WRANGLER = path.join(WORKER, 'node_modules/wrangler/bin/wrangler.js');

function fallar(mensaje: string): never {
  console.error(`✗ ${mensaje}`);
  process.exit(1);
}

// ─── Argumentos ──────────────────────────────────────────────────────────

const argv = process.argv.slice(2);
const opcion = (nombre: string) => {
  const i = argv.indexOf(`--${nombre}`);
  return i >= 0 ? argv[i + 1] : undefined;
};
const bandera = (nombre: string) => argv.includes(`--${nombre}`);

type Objetivo = 'local' | 'staging';
const objetivo = argv[0] as Objetivo;
if (objetivo !== 'local' && objetivo !== 'staging') {
  fallar('Uso: node scripts/carga/carga.mts <local|staging> --bots N [--segundos 90]');
}
const BOTS = Number(opcion('bots') ?? 10);
const SEGUNDOS = Number(opcion('segundos') ?? 90);
const MAPA = opcion('mapa') ?? 'plaza';
if (!Number.isInteger(BOTS) || BOTS < 1 || BOTS > 200) fallar('--bots va de 1 a 200.');
if (!Number.isFinite(SEGUNDOS) || SEGUNDOS < 10 || SEGUNDOS > 900)
  fallar('--segundos va de 10 a 900.');
if (MAPA !== 'plaza' && MAPA !== 'cafe') fallar('--mapa es plaza o cafe.');

const CONFIG: Record<Objetivo, { base: string; origin: string; d1: string[]; worker: string }> = {
  local: {
    base: 'http://localhost:8787',
    origin: 'http://localhost:5173',
    d1: ['--local'],
    worker: 'wous-local',
  },
  staging: {
    base: 'https://wous-staging.logidma.workers.dev',
    origin: 'https://wous-staging.logidma.workers.dev',
    d1: ['--remote', '--env', 'staging'],
    worker: 'wous-staging',
  },
};
const cfg = CONFIG[objetivo];

/** El pepper de sesiones del entorno: sin él no se puede acuñar una sesión que el Worker acepte. */
function sessionPepper(): string {
  if (process.env.WOUS_SESSION_PEPPER) return process.env.WOUS_SESSION_PEPPER;
  if (objetivo === 'local') {
    const archivo = path.join(WORKER, '.dev.vars');
    if (existsSync(archivo)) {
      const linea = readFileSync(archivo, 'utf8')
        .split('\n')
        .find((l) => l.startsWith('SESSION_PEPPER='));
      if (linea) return linea.slice('SESSION_PEPPER='.length).trim();
    }
  } else {
    const archivo = path.join(WORKER, 'secrets.staging.json');
    if (existsSync(archivo)) {
      const secretos = JSON.parse(readFileSync(archivo, 'utf8')) as { SESSION_PEPPER?: string };
      if (secretos.SESSION_PEPPER) return secretos.SESSION_PEPPER;
    }
  }
  fallar('No encontré SESSION_PEPPER (WOUS_SESSION_PEPPER, .dev.vars o secrets.staging.json).');
}
const PEPPER = sessionPepper();

// ─── Siembra en D1 ───────────────────────────────────────────────────────

function d1(args: string[]): string {
  const r = spawnSync(
    process.execPath,
    [WRANGLER, 'd1', 'execute', 'DB', ...cfg.d1, '-y', ...args],
    {
      cwd: WORKER,
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
    },
  );
  if (r.status !== 0) fallar(`wrangler falló:\n${r.stderr || r.stdout}`);
  return r.stdout;
}

function sqlTexto(v: string | null): string {
  return v === null ? 'NULL' : `'${v.replaceAll("'", "''")}'`;
}

const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
function ulid(t: number): string {
  let tiempo = '';
  let resto = t;
  for (let i = 0; i < 10; i++) {
    tiempo = CROCKFORD.charAt(resto % 32) + tiempo;
    resto = Math.floor(resto / 32);
  }
  let azar = '';
  for (const b of randomBytes(16)) azar += CROCKFORD.charAt(b & 31);
  return tiempo + azar;
}

const al = <T,>(lista: readonly T[]): T => lista[Math.floor(Math.random() * lista.length)] as T;

/** Una apariencia del set inicial, validada contra el catálogo (sin gorra: no choca con peinados). */
function apariencia() {
  for (;;) {
    const input = {
      body: al(BODY_IDS),
      skinTone: al(SKIN_TONE_IDS),
      hair: al(HAIR_IDS),
      hairColor: al(HAIR_COLOR_IDS),
      top: al(starterItems('top')).id,
      bottom: al(starterItems('bottom')).id,
      shoes: al(starterItems('shoes')).id,
      accessory: null,
    };
    if (resolveAppearance(input).ok) return input;
  }
}

type Bot = { i: number; cuenta: string; personaje: string; sesion: string; token: string };

/**
 * Cuentas `carga_###` con personaje (se reutilizan de una corrida a otra) y
 * una sesión nueva para cada bot. El hash de contraseña tiene forma válida
 * pero ninguna contraseña lo cumple: nadie entra como bot por el login.
 */
function sembrar(): Bot[] {
  const ahora = Date.now();
  const expira = ahora + 3 * 60 * 60 * 1000;
  const sql: string[] = [];
  const bots: Bot[] = [];
  for (let i = 1; i <= BOTS; i++) {
    const n = String(i).padStart(3, '0');
    const sufijo = String(i).padStart(19, '0');
    const cuenta = `acc_01CARGA${sufijo}`;
    const personaje = `chr_01CARGA${sufijo}`;
    const sesion = `ses_${ulid(ahora)}`;
    const token = randomBytes(32).toString('base64url');
    const hash = createHmac('sha256', PEPPER).update(`session:${token}`).digest('base64url');
    const pwd = `$argon2id$v=19$m=19456,t=2,p=1$${randomBytes(16).toString('base64').replace(/=+$/, '')}$${randomBytes(32).toString('base64').replace(/=+$/, '')}`;
    const a = apariencia();
    sql.push(
      `INSERT INTO accounts (id, email, email_normalized, username, username_normalized,
         password_hash, status, email_verified_at, terms_version, terms_accepted_at, created_at,
         updated_at)
       VALUES ('${cuenta}', 'carga_${n}@carga.invalid', 'carga_${n}@carga.invalid', 'carga_${n}',
         'carga_${n}', ${sqlTexto(pwd)}, 'ACTIVE', ${ahora}, '2026-01', ${ahora}, ${ahora}, ${ahora})
       ON CONFLICT (id) DO UPDATE SET status = 'ACTIVE', suspended_until = NULL,
         chat_muted_until = NULL, updated_at = excluded.updated_at;`,
      `INSERT INTO characters (id, account_id, display_name, created_at, updated_at, last_room_id)
       VALUES ('${personaje}', '${cuenta}', 'Carga ${n}', ${ahora}, ${ahora}, '${MAPA}')
       ON CONFLICT (id) DO UPDATE SET last_room_id = excluded.last_room_id;`,
      `INSERT INTO character_appearance (character_id, body_id, skin_tone_id, hair_id,
         hair_color_id, top_id, bottom_id, shoes_id, accessory_id, updated_at)
       VALUES ('${personaje}', '${a.body}', '${a.skinTone}', '${a.hair}', '${a.hairColor}',
         '${a.top}', '${a.bottom}', '${a.shoes}', NULL, ${ahora})
       ON CONFLICT (character_id) DO NOTHING;`,
      `INSERT INTO sessions (id, account_id, token_hash, created_at, last_seen_at, expires_at,
         user_agent_summary)
       VALUES ('${sesion}', '${cuenta}', '${hash}', ${ahora}, ${ahora}, ${expira}, 'Carga');`,
    );
    bots.push({ i, cuenta, personaje, sesion, token });
  }
  const dir = mkdtempSync(path.join(tmpdir(), 'wous-carga-'));
  const archivo = path.join(dir, 'sembrar.sql');
  writeFileSync(archivo, sql.join('\n'));
  try {
    d1(['--file', archivo]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
  return bots;
}

function cerrarSesiones(bots: Bot[]): void {
  const ids = bots.map((b) => `'${b.sesion}'`).join(', ');
  d1(['--command', `UPDATE sessions SET revoked_at = ${Date.now()} WHERE id IN (${ids})`]);
}

// ─── Medidas ─────────────────────────────────────────────────────────────

function percentil(valores: number[], p: number): number | null {
  if (valores.length === 0) return null;
  const orden = [...valores].sort((a, b) => a - b);
  const i = Math.min(orden.length - 1, Math.max(0, Math.ceil((p / 100) * orden.length) - 1));
  return orden[i] ?? null;
}

const medidas = {
  latencias: [] as number[],
  rtts: [] as number[],
  entradas: [] as number[],
  errores: new Map<string, number>(),
  cierres: new Map<number, number>(),
  reconexiones: 0,
  fallosAlEntrar: 0,
  instancias: new Map<string, number>(),
};
const sumar = <K,>(mapa: Map<K, number>, clave: K) => mapa.set(clave, (mapa.get(clave) ?? 0) + 1);

// ─── Un bot ──────────────────────────────────────────────────────────────

type Mensaje = { type: string; payload: Record<string, unknown> };

const TICK = Math.round(1000 / NETWORK.inputSendHz);

class Jugador {
  ws: WebSocket | null = null;
  yo: string | null = null;
  seq = 0;
  /** Inputs mandados que todavía no vuelven en un PLAYER_STATE: seq → hora de envío. */
  pendientes = new Map<number, number>();
  recibidos = 0;
  bytes = 0;
  enviados = 0;
  moviendo = false;
  dir = { x: 0, y: 0 };
  hastaCambio = 0;
  proximaCharla = 0;
  proximoGesto = 0;
  pingEnviado = 0;
  vivo = true;
  temporizadores: ReturnType<typeof setInterval>[] = [];

  readonly bot: Bot;

  constructor(bot: Bot) {
    this.bot = bot;
  }

  conectar(): Promise<void> {
    const url = new URL('/ws/world', cfg.base);
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    const inicio = performance.now();
    return new Promise((resolve) => {
      // El WebSocket de Node (undici) acepta cabeceras; el tipo estándar no lo sabe.
      const ws = new WebSocket(url, {
        headers: { Origin: cfg.origin, Cookie: `__Host-wous_session=${this.bot.token}` },
      } as unknown as string[]);
      this.ws = ws;
      let entro = false;
      ws.addEventListener('message', (e) => {
        const texto = String(e.data);
        this.recibidos += 1;
        this.bytes += texto.length;
        if (texto === WS_PONG_TEXT) {
          if (this.pingEnviado) medidas.rtts.push(performance.now() - this.pingEnviado);
          this.pingEnviado = 0;
          return;
        }
        const m = JSON.parse(texto) as Mensaje;
        if (m.type === 'ROOM_SNAPSHOT' && !entro) {
          entro = true;
          this.yo = String(m.payload.selfId);
          const sala = m.payload.room as { mapId: string; instance: string };
          sumar(medidas.instancias, `${sala.mapId}:${sala.instance}`);
          medidas.entradas.push(performance.now() - inicio);
          resolve();
        } else if (m.type === 'PLAYER_STATE') this.estados(m);
        else if (m.type === 'ERROR') sumar(medidas.errores, String(m.payload.code));
      });
      ws.addEventListener('close', (e) => {
        this.ws = null;
        // Solo cuentan los cierres que no pidió la prueba.
        if (this.vivo) sumar(medidas.cierres, e.code);
        if (!entro) {
          medidas.fallosAlEntrar += 1;
          resolve();
          return;
        }
        if (this.vivo) {
          // Se cayó a media corrida: vuelve a entrar, como el cliente.
          medidas.reconexiones += 1;
          setTimeout(() => {
            if (this.vivo) void this.conectar();
          }, 1000);
        }
      });
    });
  }

  /** Mis propios estados de vuelta: input→broadcast, visto desde quien camina. */
  estados(m: Mensaje): void {
    const ahora = performance.now();
    for (const s of m.payload.states as { id: string; seq: number }[]) {
      if (s.id !== this.yo) continue;
      for (const [seq, enviado] of this.pendientes) {
        if (seq > s.seq) continue;
        if (seq === s.seq) medidas.latencias.push(ahora - enviado);
        this.pendientes.delete(seq);
      }
    }
  }

  mandar(mensaje: unknown): void {
    if (this.ws?.readyState !== WebSocket.OPEN) return;
    this.ws.send(typeof mensaje === 'string' ? mensaje : JSON.stringify(mensaje));
    this.enviados += 1;
  }

  /** Camina a 12 Hz un rato en una dirección, se para otro rato, y así. */
  paso(ahora: number): void {
    if (ahora >= this.hastaCambio) {
      this.moviendo = !this.moviendo;
      if (this.moviendo) {
        const angulo = Math.random() * Math.PI * 2;
        this.dir = {
          x: Math.round(Math.cos(angulo) * 100) / 100,
          y: Math.round(Math.sin(angulo) * 100) / 100,
        };
        this.hastaCambio = ahora + 800 + Math.random() * 1700;
      } else {
        this.dir = { x: 0, y: 0 };
        this.hastaCambio = ahora + 500 + Math.random() * 1500;
        this.input();
      }
    }
    if (this.moviendo) this.input();
    if (ahora >= this.proximaCharla) {
      this.proximaCharla = ahora + 25_000 + Math.random() * 20_000;
      this.mandar({
        v: WS_PROTOCOL_VERSION,
        type: 'CHAT_SEND',
        payload: { text: `prueba de carga ${this.bot.i} · ${Math.floor(ahora / 1000) % 1000}` },
      });
    }
    if (ahora >= this.proximoGesto) {
      this.proximoGesto = ahora + 15_000 + Math.random() * 15_000;
      this.mandar({
        v: WS_PROTOCOL_VERSION,
        type: 'EMOTE_PLAY',
        payload: { emote: al(EMOTE_IDS) },
      });
    }
  }

  input(): void {
    this.seq += 1;
    this.pendientes.set(this.seq, performance.now());
    this.mandar({
      v: WS_PROTOCOL_VERSION,
      type: 'PLAYER_INPUT',
      seq: this.seq,
      payload: { moveX: this.dir.x, moveY: this.dir.y },
    });
  }

  arrancar(): void {
    const ahora = performance.now();
    this.proximaCharla = ahora + Math.random() * 25_000;
    this.proximoGesto = ahora + Math.random() * 15_000;
    this.temporizadores.push(setInterval(() => this.paso(performance.now()), TICK));
    // El cliente hace ping cada 20 s; aquí cada 5 para tener muestras del RTT
    // (lo contesta el runtime sin despertar a la sala: no carga la prueba).
    this.temporizadores.push(
      setInterval(() => {
        this.pingEnviado = performance.now();
        this.mandar(WS_PING_TEXT);
      }, 5_000),
    );
  }

  cerrar(): void {
    this.vivo = false;
    for (const t of this.temporizadores) clearInterval(t);
    this.ws?.close(1000, 'fin de la prueba');
  }
}

// ─── Analíticas de Cloudflare (CPU del DO, D1) ───────────────────────────

async function analiticas(desde: number, hasta: number): Promise<Record<string, unknown> | null> {
  const cuenta = process.env.CLOUDFLARE_ACCOUNT_ID;
  const token = process.env.CLOUDFLARE_API_TOKEN;
  if (!cuenta || !token || objetivo === 'local') return null;
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  const ns = (await (
    await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${cuenta}/workers/durable_objects/namespaces?per_page=100`,
      { headers },
    )
  ).json()) as { result?: { id: string; script: string; class: string }[] };
  const sala = ns.result?.find((n) => n.script === cfg.worker && n.class === 'RoomDO')?.id ?? '';
  const wrangler = readFileSync(path.join(WORKER, 'wrangler.jsonc'), 'utf8');
  const base =
    /"database_name": "wous-staging",\s*"database_id": "([0-9a-f-]+)"/.exec(wrangler)?.[1] ?? '';
  const query = `query ($cuenta: String!, $desde: Time!, $hasta: Time!) {
    viewer { accounts(filter: { accountTag: $cuenta }) {
      invocaciones: durableObjectsInvocationsAdaptiveGroups(limit: 10, filter: {
        datetime_geq: $desde, datetime_leq: $hasta, namespaceId: "${sala}" }) {
        dimensions { status } sum { requests errors }
        quantiles { cpuTimeP50 cpuTimeP90 cpuTimeP99 wallTimeP50 wallTimeP99 }
      }
      periodico: durableObjectsPeriodicGroups(limit: 1, filter: {
        datetime_geq: $desde, datetime_leq: $hasta, namespaceId: "${sala}" }) {
        sum { cpuTime activeTime inboundWebsocketMsgCount outboundWebsocketMsgCount rowsRead rowsWritten }
      }
      d1: d1AnalyticsAdaptiveGroups(limit: 1, filter: {
        datetime_geq: $desde, datetime_leq: $hasta, databaseId: "${base}" }) {
        sum { readQueries writeQueries rowsRead rowsWritten }
      }
    } } }`;
  const res = await fetch('https://api.cloudflare.com/client/v4/graphql', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      query,
      variables: {
        cuenta,
        desde: new Date(desde).toISOString(),
        hasta: new Date(hasta).toISOString(),
      },
    }),
  });
  const json = (await res.json()) as {
    data?: { viewer: { accounts: Record<string, unknown>[] } };
    errors?: unknown;
  };
  if (json.errors) return { error: JSON.stringify(json.errors).slice(0, 300) };
  return json.data?.viewer.accounts[0] ?? null;
}

// ─── Corrida ─────────────────────────────────────────────────────────────

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));
const redondo = (v: number | null) => (v === null ? '—' : `${Math.round(v)} ms`);

console.log(`Carga en ${objetivo}: ${BOTS} bots en ${MAPA} durante ${SEGUNDOS} s`);
const bots = sembrar();
console.log(`✓ ${bots.length} cuentas carga_### listas con sesión nueva`);

const jugadores = bots.map((b) => new Jugador(b));
const inicio = Date.now();
// Entran de a poco, como gente de verdad (y sin tropezar con el límite de conexiones).
for (const j of jugadores) {
  await j.conectar();
  await esperar(60);
}
const dentro = jugadores.filter((j) => j.yo !== null);
console.log(
  `✓ entraron ${dentro.length} de ${BOTS} en ${Math.round((Date.now() - inicio) / 1000)} s`,
);
for (const j of dentro) j.arrancar();

// Las medidas cuentan desde que todos caminan.
const medirDesde = Date.now();
medidas.latencias.length = 0;
medidas.rtts.length = 0;
const base0 = new Map(
  dentro.map((j) => [j, { recibidos: j.recibidos, bytes: j.bytes, enviados: j.enviados }]),
);
await esperar(SEGUNDOS * 1000);
const medirHasta = Date.now();
const duracion = (medirHasta - medirDesde) / 1000;
const porBot = dentro.map((j) => {
  const b = base0.get(j) ?? { recibidos: 0, bytes: 0, enviados: 0 };
  return {
    recibidos: (j.recibidos - b.recibidos) / duracion,
    bytes: (j.bytes - b.bytes) / duracion,
    enviados: (j.enviados - b.enviados) / duracion,
  };
});
for (const j of jugadores) j.cerrar();
await esperar(1500);
cerrarSesiones(bots);

const media = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const resultado = {
  objetivo,
  mapa: MAPA,
  bots: BOTS,
  entraron: dentro.length,
  fallosAlEntrar: medidas.fallosAlEntrar,
  instancias: Object.fromEntries(medidas.instancias),
  segundosMedidos: Math.round(duracion),
  entrarMs: { p50: percentil(medidas.entradas, 50), p95: percentil(medidas.entradas, 95) },
  inputABroadcastMs: {
    muestras: medidas.latencias.length,
    p50: percentil(medidas.latencias, 50),
    p95: percentil(medidas.latencias, 95),
    p99: percentil(medidas.latencias, 99),
    max: percentil(medidas.latencias, 100),
  },
  rttPingMs: { p50: percentil(medidas.rtts, 50), p95: percentil(medidas.rtts, 95) },
  porPersonaPorSegundo: {
    mensajesRecibidos: Math.round(media(porBot.map((p) => p.recibidos)) * 10) / 10,
    kbRecibidos: Math.round((media(porBot.map((p) => p.bytes)) / 1024) * 10) / 10,
    mensajesEnviados: Math.round(media(porBot.map((p) => p.enviados)) * 10) / 10,
  },
  reconexiones: medidas.reconexiones,
  errores: Object.fromEntries(medidas.errores),
  cierres: Object.fromEntries(medidas.cierres),
  ventana: { desde: new Date(medirDesde).toISOString(), hasta: new Date(medirHasta).toISOString() },
  cloudflare: null as Record<string, unknown> | null,
};

console.log(`
Resultado (${resultado.segundosMedidos} s medidos, ${resultado.entraron} bots)
  instancias           ${JSON.stringify(resultado.instancias)}
  entrar (hasta el snapshot)  p50 ${redondo(resultado.entrarMs.p50)} · p95 ${redondo(resultado.entrarMs.p95)}
  input→broadcast      p50 ${redondo(resultado.inputABroadcastMs.p50)} · p95 ${redondo(resultado.inputABroadcastMs.p95)} · p99 ${redondo(resultado.inputABroadcastMs.p99)} · máx ${redondo(resultado.inputABroadcastMs.max)} (${resultado.inputABroadcastMs.muestras} muestras)
  RTT del ping         p50 ${redondo(resultado.rttPingMs.p50)} · p95 ${redondo(resultado.rttPingMs.p95)}
  por persona y seg.   recibe ${resultado.porPersonaPorSegundo.mensajesRecibidos} mensajes (${resultado.porPersonaPorSegundo.kbRecibidos} KB) · manda ${resultado.porPersonaPorSegundo.mensajesEnviados}
  reconexiones ${resultado.reconexiones} · fallos al entrar ${resultado.fallosAlEntrar}
  errores ${JSON.stringify(resultado.errores)} · cierres ${JSON.stringify(resultado.cierres)}`);

if (!bandera('sin-analiticas') && objetivo === 'staging') {
  // Las analíticas tardan un par de minutos en llegar.
  console.log('\nEsperando 150 s a que Cloudflare junte las analíticas…');
  await esperar(150_000);
  const minuto = 60_000;
  resultado.cloudflare = await analiticas(
    Math.floor(medirDesde / minuto) * minuto,
    Math.ceil(medirHasta / minuto) * minuto,
  );
  console.log(JSON.stringify(resultado.cloudflare, null, 2));
}

const salida = opcion('salida');
if (salida) {
  writeFileSync(salida, `${JSON.stringify(resultado, null, 2)}\n`);
  console.log(`\n✓ Resultado en ${salida}`);
}
