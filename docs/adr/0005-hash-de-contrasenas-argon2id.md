# ADR-0005 · Hash de contraseñas: Argon2id en WASM (medido)

- **Estado:** aceptado · 2026-09-26
- **Contexto:** §6 pide Argon2id compatible con Workers **medido con benchmarks reales**, y un
  esquema de Web Crypto documentado si no fuera viable.

## Por qué no PBKDF2

Web Crypto de Workers tiene PBKDF2, pero **workerd rechaza más de 100 000 iteraciones** (límite
duro del runtime, no de CPU). OWASP pide 600 000 para PBKDF2-SHA256: inalcanzable aquí.

## Implementación

`@phi-ag/argon2` 0.5.28: build mínimo de Argon2 en WASM con SIMD (28 KB). Se importa el `.wasm`
de forma estática (`import wasm from '@phi-ag/argon2/argon2.wasm'`), que es lo único que Workers
permite: el runtime prohíbe compilar WASM a partir de bytes en tiempo de ejecución. La instancia
se crea una vez por isolate.

## Medición (2026-09-26, Worker desplegado en la cuenta de producción)

Worker aislado `wous-bench-argon2` (código en `apps/worker/bench/argon2`), una petición =
**1 hash + 1 verify** (lo que cuesta un registro o un login). CPU leído de `wrangler tail`;
latencia medida desde fuera (10 peticiones tras 2 de calentamiento), porque dentro del Worker
`Date.now()` no avanza durante cómputo síncrono.

| Parámetros | CPU (hash+verify) | Latencia extra sobre `/noop` (mediana) |
| --- | --- | --- |
| m=19 MiB, t=2, p=1 (OWASP) | 46–65 ms | +55 ms |
| m=46 MiB, t=1, p=1 (OWASP alt.) | — | +90 ms |
| m=64 MiB, t=3, p=1 | 284–407 ms | +311 ms |
| m=64 MiB, t=3, p=4 (RFC 9106) | — | +328 ms |

## Decisión

**Argon2id, m=19 456 KiB, t=2, p=1, 32 bytes**, versión 0x13, sal de 16 bytes aleatorios.

- ~25–30 ms de CPU por operación: holgado frente al límite de 30 s de Workers Paid y barato en
  la cuota mensual (30 M CPU-ms incluidos ≈ 1 M de logins).
- 64 MiB costaría 6× más CPU por login y acerca cada petición al tope de 128 MB de memoria del
  isolate sin una ganancia proporcional para el perfil de amenaza de un juego social.

## Consecuencias

- El hash guarda sus parámetros (`$argon2id$v=19$m=…,t=…,p=…$`). Si se cambian, el login
  detecta `needsRehash` y re-hashea con la contraseña recién verificada: migración transparente.
- Cuando la cuenta no existe, el login gasta un verify contra un hash ficticio (`burn`) para no
  revelar la existencia por tiempo de respuesta.
- El límite de intentos (RateLimitDO) sigue siendo la defensa principal contra fuerza bruta en
  línea; el hash protege ante una fuga de la base.
