import { DurableObject } from 'cloudflare:workers';

type InstanceInfo = { count: number; updatedAt: number };
type DirectoryState = {
  instances: Record<string, InstanceInfo>;
  /** Dónde está cada personaje: quien se reconecta vuelve a su instancia. */
  presence: Record<string, string>;
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
  ): Promise<{ instance: string }> {
    const state = await this.read();
    const current = state.presence[characterId];
    // Quien ya está (otra pestaña, reconexión) vuelve a su instancia: la sala
    // lo reemplaza sin contarlo dos veces.
    if (current && state.instances[current]) return { instance: current };

    const names = Object.keys(state.instances).sort();
    const withRoom = names.find((name) => (state.instances[name]?.count ?? 0) < limits.softLimit);
    if (withRoom) return { instance: withRoom };

    // Todas llenas (o ninguna): la primera que no exista.
    let n = 1;
    while (state.instances[instanceName(n)]) n++;
    const instance = instanceName(n);
    state.instances[instance] = { count: 0, updatedAt: Date.now() };
    await this.ctx.storage.put(STATE_KEY, state);
    return { instance };
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

  /** Para pruebas y observabilidad: la ocupación que conoce el directorio. */
  async occupancy(): Promise<DirectoryState> {
    return this.read();
  }
}
