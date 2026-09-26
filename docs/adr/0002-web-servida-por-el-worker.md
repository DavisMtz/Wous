# ADR-0002 · La web la sirve el mismo Worker (Static Assets)

- **Estado:** aceptado · 2026-09-26
- **Contexto:** el plan separa `apps/web` y `apps/worker` pero no dice cómo se publica la web.
  La sesión viaja en una cookie `HttpOnly; SameSite=Lax` (§6) y el WebSocket autentica con esa
  misma cookie y valida `Origin` (§12).

## Decisión

El Worker publica `apps/web/dist` con **Workers Static Assets**:

```jsonc
"assets": {
  "directory": "../web/dist",
  "not_found_handling": "single-page-application",
  "run_worker_first": ["/api/*", "/ws/*"]
}
```

- Un solo origen por entorno: la cookie funciona sin CORS y `Origin` se compara contra
  `APP_ORIGIN` sin listas de excepciones.
- `/api/*` y `/ws/*` siempre pasan por el código del Worker; todo lo demás lo sirve la capa de
  assets, que es gratuita y no consume CPU del Worker.
- En desarrollo, Vite (5173) reenvía `/api` y `/ws` a `wrangler dev` (8787): el navegador sigue
  viendo un solo origen.

## Alternativas descartadas

- **Pages + Worker aparte:** dos orígenes, CORS con credenciales y una cookie `SameSite=None`.
- **Plugin de Vite de Cloudflare:** acopla la app web a la configuración del Worker; se puede
  reconsiderar si el doble servidor de desarrollo estorba.
