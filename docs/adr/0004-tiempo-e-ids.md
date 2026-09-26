# ADR-0004 · Tiempo en milisegundos e IDs `<prefijo>_<ULID>`

- **Estado:** aceptado · 2026-09-26
- **Contexto:** §9 pide IDs públicos no secuenciales y elegir UNA unidad de tiempo sin mezclar.

## Decisión

**Tiempo:** todo timestamp persistido o transmitido es **epoch en milisegundos UTC** (`INTEGER` en
D1, `number` en TS). Las constantes de `@wous/config` también están en ms. El reloj es siempre el
del servidor, detrás de la interfaz `Clock` para poder fijarlo en pruebas.

**IDs:** `<prefijo>_<ULID>`, por ejemplo `acc_01J8ZQ4Y7V3M2N6P8R0S1T2V3W`.

- ULID: 48 bits de tiempo + 80 bits aleatorios de `crypto.getRandomValues`, en base32 de Crockford.
  No es secuencial ni adivinable, y al ordenarse por tiempo mantiene los índices de D1 compactos.
- El prefijo hace legible el tipo de entidad en logs y evita confundir un ID de cuenta con uno de
  personaje; los esquemas de `@wous/contracts` lo validan.
- Prefijos: `acc` cuenta, `ses` sesión, `chr` personaje, `vrt` token de verificación,
  `prt` token de reset, `obx` outbox, `dle` evento de entrega, `aud` auditoría, `req` petición,
  `frn` amistad, `msg` mensaje, `evt` mensaje WebSocket.

Los **tokens secretos** (sesión, verificación, reset) NO son IDs: son 256 bits aleatorios en
base64url y en D1 solo se guarda su HMAC (ver ADR-0006).
