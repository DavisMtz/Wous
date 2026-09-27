# Pruebas de carga

Fase 9 (§27, ADR-0012): la capacidad de una sala se **mide**, no se estima. El arnés es
`scripts/carga/carga.mts`: bots que entran a la sala por el mismo camino que un navegador
(WebSocket con cookie y `Origin`, el Worker, el directorio y la sala) y caminan, hablan y hacen
gestos con la cadencia real del cliente.

Resultados: [`2026-09-27-staging.md`](2026-09-27-staging.md).

## Qué mide

| Medida | De dónde sale |
| --- | --- |
| input→broadcast (p50, p95, p99, máx) | Cada bot anota cuándo manda un `PLAYER_INPUT` y cuándo le vuelve su propio `seq` en un `PLAYER_STATE`. Incluye la red de ida y vuelta y la espera del lote (`NETWORK.stateFlushMs`). |
| RTT del ping | El ping de auto-respuesta (lo contesta el runtime sin despertar a la sala): la red sola. |
| Mensajes y KB por persona por segundo | Lo que cada bot recibe y manda mientras todos caminan. |
| Entrar (hasta el snapshot) | Del `new WebSocket` al `ROOM_SNAPSHOT`: TLS, Worker, D1, directorio y sala. |
| Reconexiones, errores, cierres | Cierres que no pidió la prueba, `ERROR` por código. |
| CPU y duración del DO | GraphQL `durableObjectsInvocationsAdaptiveGroups` y `durableObjectsPeriodicGroups` del namespace `RoomDO`, en la ventana de la corrida. |
| D1 | GraphQL `d1AnalyticsAdaptiveGroups` de la base del entorno. |

## Cómo correrla

Requisitos: Node 24, `wrangler` con acceso a la cuenta (sesión o `CLOUDFLARE_API_TOKEN`) y el
`SESSION_PEPPER` del entorno: `WOUS_SESSION_PEPPER`, o `apps/worker/.dev.vars` (local), o
`apps/worker/secrets.staging.json` (staging). **Nunca contra producción** (el script no lo acepta).

```bash
# Local (wrangler dev en :8787)
node scripts/carga/carga.mts local --bots 10 --segundos 30

# Staging, con las analíticas de Cloudflare al final (espera 150 s a que lleguen)
CLOUDFLARE_ACCOUNT_ID=… CLOUDFLARE_API_TOKEN=… \
  node scripts/carga/carga.mts staging --bots 25 --segundos 60 --salida r25.json
```

- Los bots son cuentas `carga_001…` (prefijo reservado: nadie puede registrarlo), ya `ACTIVE`,
  con personaje, en la D1 del entorno. Se reutilizan entre corridas; cada corrida les acuña una
  sesión nueva y la cierra al terminar.
- Con los límites reales (35/45) el directorio abre otra instancia al pasar de 35: `--bots 105`
  mide tres salas llenas a la vez.
- **45 en una sola sala:** despliega staging un rato con el límite suave en 45 y vuelve a
  desplegar normal al acabar:

  ```bash
  cd apps/worker
  npx wrangler deploy --env staging --var ROOM_SOFT_LIMIT:45   # solo para la prueba
  # … la corrida …
  npx wrangler deploy --env staging                            # límites reales otra vez
  ```

- El token de las analíticas necesita «Account Analytics: Read».
