import { DurableObject } from 'cloudflare:workers';

type InstanceInfo = { count: number; updatedAt: number };
/** Quien cruzó un portal hacia esta sala: dónde aparece y hasta cuándo se le espera. */
type Arrival = { spawn: string; until: number };
type DirectoryState = {
  instances: Record<string, InstanceInfo>;
  /** Dónde está cada personaje: quien se reconecta vuelve a su instancia. */
  presence: Record<string, string>;
  /** Llegadas por portal pendientes (ADR-0009). Se consumen al entrar. */
  arrivals?: Record<string, Arrival>;
};

const STATE_KEY = 'state';

/** «01», «02»… */
function instanceName(n: number): string {
  return String(n).padStart(2, '0');
}

/**
 * Asignación de instancias de UNA sala lógica (§13, `directory:plaza`). Las
 * salas le reportan su ocupación al entrar y salir alguien; el directorio
 * elige la primera instancia con espacio bajo el límite suave y abre otra
 * cuando todas se llenan. MVP: sin algoritmos sociales.
 *
 * También guarda el punto de llegada de quien cruza un portal hacia esta
 * sala: la sala de origen lo anota y la entrada lo consume. El cliente no
 * elige dónde aparece.
 */
export class RoomDirectoryDO extends DurableObject<Env> {
  async ping(): Promise<'pong'> {
    return 'pong';
  }

  private async read(): Promise<DirectoryState> {
    return (
      (await this.ctx.storage.get<DirectoryState>(STATE_KEY)) ?? { instances: {}, presence: {} }
    );
  }

  async assign(
    characterId: string,
    limits: { softLimit: number; hardLimit: number },
  ): Promise<{ instance: string; spawn?: string }> {
    const now = Date.now();
    const state = await this.read();
    // Vigente o vencida, una llegada anotada se consume (y se guarda el cambio).
    const hadArrival = Boolean(state.arrivals?.[characterId]);
    const arrival = this.takeArrival(state, characterId, now);
    const spawn = arrival ? { spawn: arrival.spawn } : {};

    const current = state.presence[characterId];
    // Quien ya está (otra pestaña, reconexión) vuelve a su instancia: la sala
    // lo reemplaza sin contarlo dos veces.
    if (current && state.instances[current]) {
      if (hadArrival) await this.ctx.storage.put(STATE_KEY, state);
      return { instance: current, ...spawn };
    }

    const names = Object.keys(state.instances).sort();
    const withRoom = names.find((name) => (state.instances[name]?.count ?? 0) < limits.softLimit);
    if (withRoom) {
      if (hadArrival) await this.ctx.storage.put(STATE_KEY, state);
      return { instance: withRoom, ...spawn };
    }

    // Todas llenas (o ninguna): la primera que no exista.
    let n = 1;
    while (state.instances[instanceName(n)]) n++;
    const instance = instanceName(n);
    state.instances[instance] = { count: 0, updatedAt: now };
    await this.ctx.storage.put(STATE_KEY, state);
    return { instance, ...spawn };
  }

  /** La sala de origen validó el portal: aquí se espera a esa persona un rato. */
  async expectArrival(characterId: string, spawn: string, until: number): Promise<void> {
    const state = await this.read();
    const arrivals = state.arrivals ?? {};
    // Las vencidas se barren aquí mismo: la lista nunca crece sin tope.
    const now = Date.now();
    for (const [id, a] of Object.entries(arrivals)) if (a.until < now) delete arrivals[id];
    arrivals[characterId] = { spawn, until };
    state.arrivals = arrivals;
    await this.ctx.storage.put(STATE_KEY, state);
  }

  /** Saca (y devuelve si sigue vigente) la llegada pendiente de alguien. */
  private takeArrival(state: DirectoryState, characterId: string, now: number): Arrival | null {
    const arrival = state.arrivals?.[characterId];
    if (!arrival || !state.arrivals) return null;
    delete state.arrivals[characterId];
    return arrival.until >= now ? arrival : null;
  }

  async report(
    instance: string,
    count: number,
    change: { joined?: string; left?: string },
    now: number,
  ): Promise<void> {
    const state = await this.read();
    state.instances[instance] = { count, updatedAt: now };
    if (change.joined) state.presence[change.joined] = instance;
    if (change.left && state.presence[change.left] === instance) delete state.presence[change.left];
    await this.ctx.storage.put(STATE_KEY, state);
  }

  /** En qué instancia está alguien ahora (o null): para avisarle a su sala (ADR-0011). */
  async whereIs(characterId: string): Promise<string | null> {
    const state = await this.read();
    return state.presence[characterId] ?? null;
  }

  /** Para pruebas y observabilidad: la ocupación que conoce el directorio. */
  async occupancy(): Promise<DirectoryState> {
    return this.read();
  }
}
