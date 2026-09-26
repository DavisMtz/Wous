# Wous

Mundo social online 2D en pixel art con personajes humanos: te registras, creas tu personaje,
entras a una plaza compartida, caminas, chateas y ves a los demás en tiempo real.

- **Plan técnico:** [`PLAN_CONSTRUCCION_WOUS.md`](PLAN_CONSTRUCCION_WOUS.md)
- **Decisiones:** [`docs/adr/`](docs/adr)
- **Guía para agentes:** [`CLAUDE.md`](CLAUDE.md)

## Stack

React + Phaser + Vite en el cliente; Cloudflare Workers, Durable Objects, D1, R2 y Queues en el
servidor; Brevo para el correo transaccional. Monorepo con pnpm.

```
apps/web         cliente (React + Phaser)
apps/worker      API, WebSocket, Durable Objects y consumidor de correo
packages/*       contratos, configuración y núcleo del juego compartidos
database/        migraciones D1
docs/            ADR, protocolo y runbooks
e2e/             pruebas de extremo a extremo (Playwright)
```

## Desarrollo

Requiere Node 24 y pnpm 12.

```bash
pnpm install
pnpm db:migrate:local
pnpm dev            # http://localhost:5173
pnpm test
```
