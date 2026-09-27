import { MOVEMENT, NETWORK } from '@wous/config';
import type {
  AppearanceInput,
  ChatLine,
  Emote,
  ErrorPayload,
  Facing,
  PlayerStateView,
  PlayerView,
  RoomRef,
  RoomTransferMessage,
  ServerMessage,
} from '@wous/contracts';
import { type CollisionGrid, stepMovement } from '@wous/game-core';

export type Sample = {
  /** Hora del servidor del estado. */
  t: number;
  x: number;
  y: number;
  facing: Facing;
  moveX: number;
  moveY: number;
};

export type RemotePlayer = {
  id: string;
  displayName: string;
  appearance: AppearanceInput;
  samples: Sample[];
  /** Se le cayó la conexión y la sala le guarda el lugar (§17). */
  away: boolean;
};

export type RenderedRemote = {
  x: number;
  y: number;
  facing: Facing;
  moving: boolean;
  away: boolean;
};

/** A dónde te lleva el portal que la sala aceptó (mientras se vuelve a entrar). */
export type Transfer = RoomTransferMessage['payload']['to'];

/** Estado propio que manda el servidor: con él se corrige la predicción. */
export type SelfState = { x: number; y: number; seq: number };

/** Un error de la sala y el pedido que lo causó (`about`), si lo dijo. */
export type RoomError = Pick<ErrorPayload, 'code' | 'about' | 'retryAfterMs'>;

/** Un gesto que alguien hizo (la escena lo pinta sobre su cabeza). */
export type Gesture = { id: string; emote: Emote };

type Listener = () => void;

/** Muestras que se guardan por jugador (≈1 s a 15 Hz). */
const MAX_SAMPLES = 16;
/** Lo más que se extrapola un remoto sin estados nuevos. */
const MAX_EXTRAPOLATION_MS = 150;

/**
 * Lo que el cliente sabe de la sala: quién está y dónde lo vio el servidor.
 * Los remotos se dibujan un poco en el pasado (§14: ~100 ms) interpolando
 * entre estados autoritativos; si no hay estado nuevo, se extrapola poco y
 * con colisión. La escena lo lee cada cuadro; nunca le escribe.
 */
export class RoomState {
  room: RoomRef | null = null;
  selfId: string | null = null;
  /** Posición autoritativa propia al entrar (snapshot): la escena salta ahí. */
  spawn: PlayerView | null = null;
  readonly remotes = new Map<string, RemotePlayer>();
  /** Estados propios pendientes de que la escena los use para corregir. */
  private readonly selfStates: SelfState[] = [];
  /** Errores de la sala sin atender (la escena reacciona a los del portal). */
  private readonly errors: RoomError[] = [];
  /** Lo dicho y los gestos que la escena aún no pinta. */
  private readonly said: ChatLine[] = [];
  private readonly gestures: Gesture[] = [];
  /** Presentes que bloqueaste (solo lo sabe quien bloquea, ADR-0010). */
  readonly blocked = new Set<string>();
  /**
   * Tus amigos, por personaje (ADR-0011). No viene de la sala sino de tu
   * lista: sobrevive a los snapshots y a los cambios de sala.
   */
  readonly friends = new Set<string>();
  /** El portal aceptado, hasta que llega la sala nueva. */
  transfer: Transfer | null = null;
  /** local − servidor, el menor visto (la muestra con menos latencia). */
  private offset: number | null = null;
  private readonly listeners = new Set<Listener>();
  /** Cambia cuando alguien llega o se va (la escena crea o quita sprites). */
  version = 0;

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private changed(): void {
    this.version += 1;
    for (const listener of this.listeners) listener();
  }

  /** Reemplaza quiénes son tus amigos; la escena les pone su marca en la etiqueta. */
  setFriends(characterIds: Iterable<string>): void {
    const next = new Set(characterIds);
    if (next.size === this.friends.size && [...next].every((id) => this.friends.has(id))) return;
    this.friends.clear();
    for (const id of next) this.friends.add(id);
    this.changed();
  }

  /** Aplica un mensaje del servidor. `receivedAt` en el reloj local (performance.now). */
  apply(message: ServerMessage, receivedAt: number): void {
    switch (message.type) {
      case 'ROOM_SNAPSHOT': {
        const { room, selfId, players, serverTime } = message.payload;
        this.observeClock(serverTime, receivedAt);
        this.room = room;
        this.selfId = selfId;
        this.transfer = null;
        this.remotes.clear();
        this.selfStates.length = 0;
        this.errors.length = 0;
        this.said.length = 0;
        this.gestures.length = 0;
        this.blocked.clear();
        for (const id of message.payload.blocked ?? []) this.blocked.add(id);
        for (const p of players) {
          if (p.id === selfId) this.spawn = p;
          else this.remotes.set(p.id, fromView(p, serverTime));
        }
        this.changed();
        return;
      }
      case 'PLAYER_JOINED': {
        const p = message.payload.player;
        if (p.id === this.selfId) return;
        const t = this.serverNow(receivedAt);
        this.remotes.set(p.id, fromView(p, t));
        this.changed();
        return;
      }
      case 'PLAYER_LEFT': {
        this.blocked.delete(message.payload.id);
        if (this.remotes.delete(message.payload.id)) this.changed();
        return;
      }
      case 'CHAT_MESSAGE': {
        this.said.push(message.payload.message);
        if (this.said.length > 32) this.said.shift();
        return;
      }
      case 'EMOTE_PLAYED': {
        this.gestures.push(message.payload);
        if (this.gestures.length > 32) this.gestures.shift();
        return;
      }
      case 'PLAYER_BLOCKED': {
        const { characterId, blocked } = message.payload;
        if (blocked === this.blocked.has(characterId)) return;
        if (blocked) this.blocked.add(characterId);
        else this.blocked.delete(characterId);
        this.changed();
        return;
      }
      case 'PLAYER_STATE': {
        this.observeClock(message.payload.serverTime, receivedAt);
        for (const state of message.payload.states) this.applyState(state);
        return;
      }
      case 'ROOM_TRANSFER': {
        this.transfer = message.payload.to;
        this.changed();
        return;
      }
      case 'ERROR': {
        const { code, about, retryAfterMs } = message.payload;
        this.errors.push({
          code,
          ...(about !== undefined ? { about } : {}),
          ...(retryAfterMs !== undefined ? { retryAfterMs } : {}),
        });
        if (this.errors.length > 8) this.errors.shift();
        return;
      }
      default:
        return;
    }
  }

  /** Errores de la sala llegados desde la última vez (y se vacían). */
  takeErrors(): RoomError[] {
    return this.errors.splice(0, this.errors.length);
  }

  /** Lo dicho desde la última vez (la escena cuelga los globos). */
  takeSaid(): ChatLine[] {
    return this.said.splice(0, this.said.length);
  }

  /** Gestos desde la última vez. */
  takeGestures(): Gesture[] {
    return this.gestures.splice(0, this.gestures.length);
  }

  private applyState(state: PlayerStateView): void {
    if (state.id === this.selfId) {
      this.selfStates.push({ x: state.x, y: state.y, seq: state.seq });
      return;
    }
    const remote = this.remotes.get(state.id);
    if (!remote) return;
    remote.away = state.away === true;
    const last = remote.samples[remote.samples.length - 1];
    if (last && state.t < last.t) return;
    remote.samples.push({
      t: state.t,
      x: state.x,
      y: state.y,
      facing: state.facing,
      moveX: state.moveX,
      moveY: state.moveY,
    });
    if (remote.samples.length > MAX_SAMPLES) remote.samples.shift();
  }

  /** Estados propios llegados desde la última vez (y se vacían). */
  takeSelfStates(): SelfState[] {
    return this.selfStates.splice(0, this.selfStates.length);
  }

  /** Consume el punto de entrada (la escena salta ahí una sola vez por snapshot). */
  takeSpawn(): PlayerView | null {
    const spawn = this.spawn;
    this.spawn = null;
    return spawn;
  }

  private observeClock(serverTime: number, receivedAt: number): void {
    const offset = receivedAt - serverTime;
    // El menor desfase es la muestra que llegó más rápido; se deja subir
    // despacio por si los relojes derivan.
    this.offset = this.offset === null ? offset : Math.min(offset, this.offset + 0.5);
  }

  /** Hora del servidor estimada para un instante local. */
  serverNow(localNow: number): number {
    return this.offset === null ? localNow : localNow - this.offset;
  }

  /** Dónde dibujar a un remoto ahora (interpolado ~100 ms en el pasado). */
  render(remote: RemotePlayer, localNow: number, grid: CollisionGrid): RenderedRemote | null {
    const samples = remote.samples;
    const first = samples[0];
    const last = samples[samples.length - 1];
    if (!first || !last) return null;
    const t = this.serverNow(localNow) - NETWORK.interpolationDelayMs;

    const away = remote.away;
    if (t <= first.t) return still(first, away);
    if (t >= last.t) {
      const moving = last.moveX !== 0 || last.moveY !== 0;
      if (!moving) return still(last, away);
      const dt = Math.min(t - last.t, MAX_EXTRAPOLATION_MS);
      const p = stepMovement(last, { x: last.moveX, y: last.moveY }, dt, grid);
      return { x: p.x, y: p.y, facing: last.facing, moving: true, away };
    }
    for (let i = samples.length - 1; i > 0; i--) {
      const a = samples[i - 1] as Sample;
      const b = samples[i] as Sample;
      if (t >= a.t && t <= b.t) {
        const k = b.t === a.t ? 1 : (t - a.t) / (b.t - a.t);
        const x = a.x + (b.x - a.x) * k;
        const y = a.y + (b.y - a.y) * k;
        const speed = Math.hypot(b.x - a.x, b.y - a.y) / Math.max(1, b.t - a.t);
        return {
          x,
          y,
          facing: b.facing,
          moving:
            speed > (MOVEMENT.speedTilesPerSecond / 1000) * 0.2 || a.moveX !== 0 || a.moveY !== 0,
          away,
        };
      }
    }
    return still(last, away);
  }
}

function fromView(p: PlayerView, t: number): RemotePlayer {
  return {
    id: p.id,
    displayName: p.displayName,
    appearance: p.appearance,
    samples: [{ t, x: p.x, y: p.y, facing: p.facing, moveX: p.moveX, moveY: p.moveY }],
    away: p.away === true,
  };
}

function still(s: Sample, away: boolean): RenderedRemote {
  return { x: s.x, y: s.y, facing: s.facing, moving: false, away };
}
