import Argon2, { Argon2Type, Argon2Version } from '@phi-ag/argon2';
import wasm from '@phi-ag/argon2/argon2.wasm';

/**
 * Hash de contraseñas con Argon2id (§6, ADR-0005). La implementación es WASM
 * importado de forma estática: Workers no permite compilar WASM en runtime.
 */

/** Parámetros vigentes. Cambiarlos provoca rehash transparente en el login. */
export const ARGON2_PARAMS = {
  memoryCost: 19_456, // KiB = 19 MiB (mínimo OWASP para Argon2id)
  timeCost: 2,
  parallelism: 1,
  hashLength: 32,
} as const;

export interface PasswordHasher {
  hash(password: string): Promise<string>;
  verify(encoded: string, password: string): Promise<boolean>;
  /** ¿El hash se hizo con parámetros distintos a los vigentes? */
  needsRehash(encoded: string): boolean;
  /**
   * Gasta el mismo tiempo que un verify real contra un hash ficticio: se usa
   * cuando la cuenta no existe, para no revelarlo por tiempo de respuesta.
   */
  burn(password: string): Promise<void>;
}

let argon2: Promise<Argon2> | undefined;

function getArgon2(): Promise<Argon2> {
  argon2 ??= WebAssembly.instantiate(wasm).then((instance) => new Argon2(instance));
  return argon2;
}

let dummyHash: Promise<string> | undefined;

const PARAMS_PATTERN = /^\$argon2id\$v=19\$m=(\d+),t=(\d+),p=(\d+)\$/;

export const argon2idHasher: PasswordHasher = {
  async hash(password) {
    const a = await getArgon2();
    return a.hash(password, {
      ...ARGON2_PARAMS,
      type: Argon2Type.Argon2id,
      version: Argon2Version.Version13,
    }).encoded;
  },

  async verify(encoded, password) {
    const a = await getArgon2();
    return a.tryVerify(encoded, password, Argon2Type.Argon2id).success;
  },

  needsRehash(encoded) {
    const match = PARAMS_PATTERN.exec(encoded);
    if (!match) return true;
    const [, m, t, p] = match;
    return (
      Number(m) !== ARGON2_PARAMS.memoryCost ||
      Number(t) !== ARGON2_PARAMS.timeCost ||
      Number(p) !== ARGON2_PARAMS.parallelism
    );
  },

  async burn(password) {
    dummyHash ??= this.hash(crypto.randomUUID());
    await this.verify(await dummyHash, password);
  },
};
