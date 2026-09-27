import type { ChatLine, ServerMessage } from '@wous/contracts';

/**
 * Una entrada del registro que ve la persona: un mensaje o el separador de
 * una sala nueva. `recibido` es la hora local de llegada (la tira del chat
 * desvanece cada línea a partir de ahí).
 */
export type ChatEntry =
  | {
      kind: 'line';
      key: string;
      line: ChatLine;
      mine: boolean;
      /** Sala donde se dijo («plaza:01»): solo lo de la sala actual se puede reportar. */
      room: string;
      recibido: number;
    }
  | { kind: 'room'; key: string; name: string; room: string; recibido: number };

const MAX_ENTRIES = 80;

/**
 * El registro del chat del lado del cliente. No es el de la sala (ese vive
 * en el servidor unos minutos): es lo que esta persona alcanzó a ver. Al
 * cambiar de sala deja un separador, y lo de la sala anterior ya no se puede
 * reportar desde aquí porque la sala nueva no conoce esos mensajes.
 */
export class ChatLog {
  private list: ChatEntry[] = [];
  private room: string | null = null;
  private selfId: string | null = null;

  constructor(private readonly clock: () => number = () => Date.now()) {}

  /** Arreglo nuevo en cada cambio: el HUD compara por identidad. */
  get entries(): readonly ChatEntry[] {
    return this.list;
  }

  get currentRoom(): string | null {
    return this.room;
  }

  get self(): string | null {
    return this.selfId;
  }

  /** Aplica un mensaje del servidor; devuelve true si el registro cambió. */
  apply(message: ServerMessage): boolean {
    if (message.type === 'ROOM_SNAPSHOT') {
      const { room, selfId } = message.payload;
      const key = `${room.mapId}:${room.instance}`;
      this.selfId = selfId;
      if (this.room === key) return false;
      const hadRoom = this.room !== null;
      this.room = key;
      // La primera sala no necesita separador; las siguientes sí.
      if (!hadRoom) return false;
      this.push({
        kind: 'room',
        key: `sala:${key}:${this.clock()}`,
        name: room.name,
        room: key,
        recibido: this.clock(),
      });
      return true;
    }
    if (message.type === 'CHAT_MESSAGE' && this.room) {
      const line = message.payload.message;
      if (this.list.some((e) => e.kind === 'line' && e.line.id === line.id)) return false;
      this.push({
        kind: 'line',
        key: line.id,
        line,
        mine: line.from === this.selfId,
        room: this.room,
        recibido: this.clock(),
      });
      return true;
    }
    return false;
  }

  /** Una línea propia sin servidor (banco de desarrollo). */
  local(line: ChatLine): void {
    this.room ??= 'local';
    this.selfId = line.from;
    this.push({
      kind: 'line',
      key: line.id,
      line,
      mine: true,
      room: this.room,
      recibido: this.clock(),
    });
  }

  private push(entry: ChatEntry): void {
    this.list = [...this.list, entry].slice(-MAX_ENTRIES);
  }
}
