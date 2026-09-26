# ADR-0003 · Hono como router HTTP del Worker

- **Estado:** aceptado · 2026-09-26
- **Contexto:** §3 define el Worker como entrada HTTP, API y router de WebSockets; el plan no fija
  framework.

## Decisión

Hono 4. Pequeño, sin dependencias, tipado de extremo a extremo con `Bindings`/`Variables`,
middleware componible y pensado para Workers.

Reglas de uso:

- La validación runtime NO usa el validador de Hono sino los esquemas Zod de `@wous/contracts`,
  para que cliente y servidor compartan exactamente el mismo contrato (§1.11).
- Toda respuesta pasa por los helpers del sobre `{ data, requestId }` / `{ error, requestId }`
  (§32); ningún handler arma su JSON de error a mano.
- La lógica de dominio no importa Hono: los casos de uso reciben datos ya validados y
  dependencias (reloj, IDs, D1, proveedor de correo) inyectadas.
