// Banco de Argon2id para ADR-0005. Se despliega como Worker aparte
// (`wous-bench-argon2`), se mide desde fuera y se borra. No forma parte de Wous.
import Argon2, { Argon2Type, Argon2Version } from '@phi-ag/argon2';
import wasm from '@phi-ag/argon2/argon2.wasm';

let argon2: Argon2 | undefined;

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === '/noop') return new Response('ok');

    argon2 ??= new Argon2(await WebAssembly.instantiate(wasm));
    const memoryCost = Number(url.searchParams.get('m') ?? 19456);
    const timeCost = Number(url.searchParams.get('t') ?? 2);
    const parallelism = Number(url.searchParams.get('p') ?? 1);

    const { encoded } = argon2.hash('contraseña de prueba 1234', {
      memoryCost,
      timeCost,
      parallelism,
      hashLength: 32,
      type: Argon2Type.Argon2id,
      version: Argon2Version.Version13,
    });
    // Un hash + un verify: lo que cuesta un registro o un login.
    const ok = argon2.tryVerify(encoded, 'contraseña de prueba 1234').success;
    return Response.json({ ok, params: encoded.split('$')[3] });
  },
};
