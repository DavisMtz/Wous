# ADR-0006 · Tokens: solo HMAC en D1; el enlace del correo, cifrado en el outbox

- **Estado:** aceptado · 2026-09-26
- **Contexto:** §6 exige guardar solo el hash de los tokens de verificación y reset. Pero §7 manda
  los correos por outbox → cola → consumidor, con reintentos y un barrido que rescata filas
  `PENDING`. El consumidor necesita el token en claro para armar `verificationUrl`/`resetUrl`, y
  el rescate puede ocurrir minutos después de la petición original.

## Decisión

1. **Tokens:** 32 bytes de `crypto.getRandomValues` en base64url (256 bits).
   En D1 se guarda `HMAC-SHA256(pepper, token)`:
   - sesiones con `SESSION_PEPPER`;
   - verificación y reset con `TOKEN_PEPPER`.
   Una copia de la base sin el pepper (secreto del Worker) no permite usar ni probar tokens.
2. **Outbox:** la fila guarda los parámetros no secretos en `payload_json` y el token en
   `secret_enc`, **cifrado con AES-256-GCM** (IV aleatorio de 12 bytes) con una llave derivada por
   HKDF-SHA256 de `TOKEN_PEPPER` y la etiqueta `wous/outbox-secret/v1`.
3. `secret_enc` se pone a `NULL` en cuanto el correo queda `SENT` o `FAILED`. El token además
   caduca solo (30 min verificación, 20 min reset).
4. El mensaje de la cola lleva **solo el ID del outbox**, nunca el token.

## Alternativas descartadas

- **Token solo en el mensaje de la cola:** el barrido no podría rescatar una fila cuyo envío a la
  cola falló, y los mensajes de la cola se pueden inspeccionar desde el panel.
- **Regenerar el token al rescatar:** invalida enlaces que quizá ya llegaron y complica la
  deduplicación (`verify:<cuenta>:<token>`).

## Consecuencias

- Rotar `TOKEN_PEPPER` invalida enlaces pendientes y hace indescifrables los `secret_enc` que
  queden: el consumidor los marca `FAILED` y el usuario pide otro enlace.
- La deduplicación usa el ID del token (`verify:<accountId>:<tokenId>`), nunca su valor.
