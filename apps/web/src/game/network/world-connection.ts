import { NETWORK } from '@wous/config';
import { ServerMessage, WS_CLOSE, WS_PING_TEXT, WS_PROTOCOL_VERSION } from '@wous/contracts';
import type { GameInput } from '@wous/game-core';

/** Estados de la conexión (§17). `ENDED` no reintenta: hace falta que la persona decida. */
export type ConnectionStatus = 'OFFLINE' | 'CONNECTING' | 'ONLINE' | 'RECONNECTING' | 'ENDED';

export type EndReason =
  /** La sesión ya no vale: hay que volver a entrar. */
  | 'AUTH_REQUIRED'
  /** La cuenta no tiene personaje (o ya no). */
  | 'CHARACTER_REQUIRED'
  /** Se abrió la plaza en otra pestaña o dispositivo. */
  | 'REPLACED'
  /** El servidor cambió de versión o cerró por mensajes inválidos. */
  | 'UPDATE_REQUIRED';

/** Lo mínimo de un WebSocket que usa la conexión (en pruebas, un doble). */
export type SocketLike = {
  readonly readyState: number;
  send(data: string): void;
  close(code?: number, reason?: string): void;
  onopen: ((ev: unknown) => void) | null;
  onmessage: ((ev: { data: unknown }) => void) | null;
  onclose: ((ev: { code: number; reason: string }) => void) | null;
  onerror: ((ev: unknown) => void) | null;
};

export type SessionCheck = 'ok' | 'auth' | 'no-character' | 'network';

export type WorldConnectionOptions = {
  url: string;
  onMessage(message: ServerMessage): void;
  onStatus(status: ConnectionStatus, reason?: EndReason): void;
  createSocket?: (url: string) => SocketLike;
  /** ¿Por qué no abrió? La respuesta HTTP del upgrade no es legible desde el navegador. */
  checkSession?: () => Promise<SessionCheck>;
  timers?: {
    setTimeout(fn: () => void, ms: number): unknown;
    clearTimeout(id: unknown): void;
    setInterval(fn: () => void, ms: number): unknown;
    clearInterval(id: unknown): void;
  };
  random?: () => number;
};

const OPEN = 1;

/**
 * El cable con la sala. Abre, mantiene vivo con el ping de auto-respuesta,
 * traduce `GameInput` a PLAYER_INPUT (solo intención) y reconecta con espera
 * creciente y azar. Cuando el cierre dice que reintentar no sirve (sesión,
 * otra pestaña, versión), se detiene en ENDED con el motivo.
 */
export class WorldConnection {
  private socket: SocketLike | null = null;
  private status: ConnectionStatus = 'OFFLINE';
  private attempts = 0;
  private stopped = true;
  private opened = false;
  private retryTimer: unknown = null;
  private pingTimer: unknown = null;
  private readonly timers: NonNullable<WorldConnectionOptions['timers']>;

  constructor(private readonly o: WorldConnectionOptions) {
    this.timers = o.timers ?? {
      setTimeout: (fn, ms) => setTimeout(fn, ms),
      clearTimeout: (id) => clearTimeout(id as number),
      setInterval: (fn, ms) => setInterval(fn, ms),
      clearInterval: (id) => clearInterval(id as number),
    };
  }

  get current(): ConnectionStatus {
    return this.status;
  }

  start(): void {
    if (!this.stopped) return;
    this.stopped = false;
    this.attempts = 0;
    this.open('CONNECTING');
  }

  /** Salir de la plaza: se cierra de verdad y no se reintenta. */
  stop(): void {
    this.stopped = true;
    this.clearTimers();
    const socket = this.socket;
    this.socket = null;
    if (socket) {
      socket.onclose = null;
      try {
        socket.close(1000, 'salir');
      } catch {
        // Ya cerrado.
      }
    }
    this.setStatus('OFFLINE');
  }

  /** Reintentar ya (volvió la red, la pestaña volvió a primer plano). */
  retryNow(): void {
    if (this.stopped || this.status !== 'RECONNECTING') return;
    this.clearTimers();
    this.open('RECONNECTING');
  }

  /** Manda la intención. Sin conexión abierta no se encola: la sala no guarda pasado. */
  send(input: GameInput): boolean {
    const socket = this.socket;
    if (!socket || this.status !== 'ONLINE' || socket.readyState !== OPEN) return false;
    socket.send(
      JSON.stringify({
        v: WS_PROTOCOL_VERSION,
        type: 'PLAYER_INPUT',
        seq: input.seq,
        payload: { moveX: input.moveX, moveY: input.moveY },
      }),
    );
    return true;
  }

  private open(status: 'CONNECTING' | 'RECONNECTING'): void {
    this.setStatus(status);
    this.opened = false;
    let socket: SocketLike;
    try {
      socket = (this.o.createSocket ?? ((url) => new WebSocket(url) as unknown as SocketLike))(
        this.o.url,
      );
    } catch {
      this.scheduleRetry();
      return;
    }
    this.socket = socket;
    socket.onopen = () => {
      if (socket !== this.socket) return;
      this.opened = true;
      this.attempts = 0;
      this.setStatus('ONLINE');
      this.pingTimer = this.timers.setInterval(() => {
        if (socket.readyState === OPEN) socket.send(WS_PING_TEXT);
      }, NETWORK.pingIntervalMs);
    };
    socket.onmessage = (ev) => {
      if (socket !== this.socket || typeof ev.data !== 'string') return;
      let raw: unknown;
      try {
        raw = JSON.parse(ev.data);
      } catch {
        return;
      }
      const parsed = ServerMessage.safeParse(raw);
      if (parsed.success && parsed.data.type !== 'PONG') this.o.onMessage(parsed.data);
    };
    socket.onerror = () => {
      // Siempre llega un close después; ahí se decide.
    };
    socket.onclose = (ev) => {
      if (socket !== this.socket) return;
      this.socket = null;
      this.clearTimers();
      if (this.stopped) return;
      void this.afterClose(ev.code, this.opened);
    };
  }

  private async afterClose(code: number, wasOpen: boolean): Promise<void> {
    switch (code) {
      case WS_CLOSE.REPLACED:
        return this.end('REPLACED');
      case WS_CLOSE.SESSION_ENDED:
        return this.end('AUTH_REQUIRED');
      case WS_CLOSE.POLICY:
        return this.end('UPDATE_REQUIRED');
      default:
        break;
    }
    if (!wasOpen && this.o.checkSession) {
      const check = await this.o.checkSession();
      if (this.stopped) return;
      if (check === 'auth') return this.end('AUTH_REQUIRED');
      if (check === 'no-character') return this.end('CHARACTER_REQUIRED');
    }
    this.scheduleRetry();
  }

  private scheduleRetry(): void {
    if (this.stopped) return;
    const { baseMs, maxMs } = NETWORK.reconnect;
    const ceiling = Math.min(maxMs, baseMs * 2 ** this.attempts);
    const delay = Math.round(ceiling * (0.5 + (this.o.random ?? Math.random)() * 0.5));
    this.attempts += 1;
    this.setStatus('RECONNECTING');
    this.retryTimer = this.timers.setTimeout(() => {
      this.retryTimer = null;
      if (!this.stopped) this.open('RECONNECTING');
    }, delay);
  }

  private end(reason: EndReason): void {
    this.stopped = true;
    this.clearTimers();
    this.setStatus('ENDED', reason);
  }

  private clearTimers(): void {
    if (this.retryTimer !== null) this.timers.clearTimeout(this.retryTimer);
    if (this.pingTimer !== null) this.timers.clearInterval(this.pingTimer);
    this.retryTimer = null;
    this.pingTimer = null;
  }

  private setStatus(status: ConnectionStatus, reason?: EndReason): void {
    if (status === this.status && status !== 'ENDED') return;
    this.status = status;
    this.o.onStatus(status, reason);
  }
}

/** Pregunta al servidor por qué no se pudo entrar. */
export async function checkSessionOverHttp(): Promise<SessionCheck> {
  try {
    const res = await fetch('/api/v1/auth/session', { credentials: 'same-origin' });
    if (res.status === 401) return 'auth';
    if (!res.ok) return 'network';
    const body = (await res.json()) as { data?: { hasCharacter?: boolean } };
    return body.data?.hasCharacter === false ? 'no-character' : 'ok';
  } catch {
    return 'network';
  }
}

/** URL del mundo en el mismo origen (ws:// en local, wss:// desplegado). */
export function worldUrl(location: Location = window.location): string {
  const scheme = location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${scheme}//${location.host}/ws/world`;
}
