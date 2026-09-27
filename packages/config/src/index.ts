/**
 * Valores configurables de Wous. Un solo lugar para los números del plan:
 * nada de límites, expiraciones o capacidades escritos a mano en el código.
 * Todos los tiempos van en milisegundos (ADR-0004).
 */

const SECOND = 1_000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export const TIME = { SECOND, MINUTE, HOUR, DAY } as const;

export const API_VERSION = 'v1';
export const API_PREFIX = `/api/${API_VERSION}`;

/** Límites de las peticiones HTTP. */
export const HTTP_LIMITS = {
  /** Tamaño máximo de un cuerpo JSON aceptado por la API. */
  maxJsonBytes: 16 * 1024,
  /** Tamaño máximo de un webhook entrante (Brevo puede agrupar eventos). */
  maxWebhookBytes: 256 * 1024,
} as const;

/** Identidad, tokens y sesiones (§6). */
export const AUTH = {
  verificationTokenTtlMs: 30 * MINUTE,
  passwordResetTokenTtlMs: 20 * MINUTE,
  sessionTtlMs: 30 * DAY,
  /** `last_seen_at` se escribe como máximo cada este intervalo, no en cada petición. */
  sessionTouchIntervalMs: 15 * MINUTE,
  resendVerificationCooldownMs: 60 * SECOND,
  resendVerificationMaxPerDay: 5,
  /** Bytes aleatorios de los tokens de sesión, verificación y reset (256 bits). */
  tokenBytes: 32,
  termsVersion: '2026-01',
} as const;

/** Políticas de nombre de usuario y contraseña. */
export const ACCOUNT_POLICY = {
  usernameMinLength: 3,
  usernameMaxLength: 20,
  passwordMinLength: 10,
  passwordMaxLength: 128,
  emailMaxLength: 254,
} as const;

/** Ventana deslizante simple: `limit` eventos por `windowMs`. */
export type RateLimitRule = { readonly limit: number; readonly windowMs: number };

/** Límites de abuso para endpoints sensibles (§23). */
export const RATE_LIMITS = {
  registerPerIp: { limit: 5, windowMs: 15 * MINUTE },
  registerPerEmail: { limit: 3, windowMs: HOUR },
  loginPerIp: { limit: 10, windowMs: 10 * MINUTE },
  loginPerAccount: { limit: 10, windowMs: 15 * MINUTE },
  forgotPasswordPerIp: { limit: 5, windowMs: HOUR },
  forgotPasswordPerEmail: { limit: 3, windowMs: HOUR },
  resendVerificationPerIp: { limit: 10, windowMs: HOUR },
  resetPasswordPerIp: { limit: 10, windowMs: 15 * MINUTE },
  verifyEmailPerIp: { limit: 20, windowMs: 15 * MINUTE },
  /** Conexiones al mundo: cubre tormentas de reconexión y pestañas en bucle. */
  worldConnectPerAccount: { limit: 30, windowMs: MINUTE },
} as const satisfies Record<string, RateLimitRule>;

/** Cola de correo y outbox (§7). */
export const EMAIL = {
  /** Reintentos de la cola antes de ir a la DLQ (coincide con wrangler.jsonc). */
  maxQueueRetries: 5,
  /** Un outbox PENDING más viejo que esto lo rescata el barrido programado. */
  sweepPendingAfterMs: 2 * MINUTE,
  /** Máximo de filas que rescata el barrido en una pasada. */
  sweepBatchSize: 50,
} as const;

/** Movimiento autoritativo (§14). Unidades: tiles del mapa y milisegundos. */
export const MOVEMENT = {
  /** Velocidad al caminar, en tiles por segundo. */
  speedTilesPerSecond: 4.2,
  /** Tope de tiempo que se simula de un solo paso (§14: ~150 ms). */
  maxStepMs: 150,
  /** Huella de los pies para la colisión, en tiles (mitad del ancho y del alto). */
  footprint: { halfWidth: 0.3, halfHeight: 0.16 },
  /** Por debajo de esta magnitud, la palanca cuenta como suelta. */
  deadZone: 0.12,
} as const;

/** Cadencia de red del cliente (§14). Se ajusta tras medir. */
export const NETWORK = {
  /** Envío de entrada mientras hay movimiento. */
  inputSendHz: 12,
  /** Búfer de interpolación de jugadores remotos. */
  interpolationDelayMs: 100,
  /** La sala junta los estados y los manda en lotes a este ritmo, solo mientras alguien se mueve. */
  stateFlushMs: 66,
  /** El cliente manda el ping de auto-respuesta con este ritmo. */
  pingIntervalMs: 20_000,
  /**
   * Sin ping ni mensajes en esta ventana, la presencia expira (§17). Holgada a
   * propósito: con la pestaña en segundo plano Chrome deja los temporizadores
   * a uno por minuto y el ping de 20 s se vuelve de 60.
   */
  staleAfterMs: 120_000,
  /** Inputs por segundo tolerados por socket (12 Hz más los cambios de dirección). */
  maxInputsPerSecond: 40,
  /** Faltas (mensajes inválidos o de más) antes de cerrar el socket (§23). */
  maxStrikes: 20,
  /** Reconexión con espera creciente y azar (§17). */
  reconnect: { baseMs: 600, maxMs: 10_000 },
  /**
   * Ventana de gracia (§17): si la conexión se cae sin despedirse, la sala le
   * guarda el lugar este tiempo. Los demás lo ven quieto y, si vuelve, sigue
   * donde estaba en vez de reaparecer en la entrada.
   */
  graceAfterDropMs: 30_000,
} as const;

/** Portales y cambio de sala (§16). */
export const PORTALS = {
  /** Entre dos intentos de cruzar, como mínimo (más seguido cuenta como falta). */
  minIntervalMs: 700,
  /** Lo que la sala de destino espera a quien cruzó antes de olvidar su punto de llegada. */
  arrivalTtlMs: 30_000,
} as const;

/** Capacidad por instancia de sala (§13). */
export const ROOM_CAPACITY = { softLimit: 35, hardLimit: 45 } as const;

/** Chat de sala (§18). */
export const CHAT = {
  /** Largo máximo de un mensaje ya saneado, en caracteres (code points). */
  maxChars: 120,
  /** Lo más que puede traer el cable antes de sanear (espacios o marcas de más). */
  maxRawChars: 400,
  /** Flood (§18: 5 mensajes / 10 s), ventana deslizante por conexión. */
  rate: { limit: 5, windowMs: 10 * SECOND },
  /** El mismo texto otra vez dentro de esta ventana se rechaza. */
  repeatWindowMs: 20 * SECOND,
  /** Marcas combinantes seguidas sobre una misma letra (corta el texto «zalgo»). */
  maxCombiningMarks: 3,
  /**
   * Ventana reciente de la sala: la evidencia de los reportes sale de aquí.
   * Vive en el storage de la sala, no en D1, y se borra al vaciarse la sala.
   */
  recent: { max: 60, ttlMs: 10 * MINUTE },
  /** Cuánto se ve un globo de chat sobre la cabeza (más un poco por letra). */
  bubbleMs: 4_500,
  bubblePerCharMs: 45,
} as const;

/** Gestos (§19). */
export const EMOTE = {
  /** Entre dos gestos de la misma persona, como mínimo. */
  cooldownMs: 1_200,
  /** Lo que dura un gesto sobre la cabeza. */
  showMs: 1_800,
} as const;

/** Bloqueos, reportes y moderación básica (§18, ADR-0010). */
export const SOCIAL = {
  /** Bloquear, desbloquear y reportar, por minuto y por conexión. */
  actionsPerMinute: 12,
  maxBlocksPerAccount: 500,
  /** Un reporte de la misma persona a la misma persona cada tanto. */
  reportCooldownMs: 10 * MINUTE,
  /** Contexto de un reporte: mensajes de la sala antes del reportado. */
  reportContext: { messages: 10, windowMs: 2 * MINUTE },
  /** Mensajes de la persona reportada que acompañan un reporte sin mensaje elegido. */
  reportTargetMessages: 5,
  reportNoteMaxChars: 280,
  /**
   * Cada tanto la sala revisa en D1 a quien está conectado: cuenta activa,
   * sesión vigente y silencio de moderación. Suspender o cerrar sesión en todos
   * lados saca a la persona en este plazo como máximo.
   */
  recheckMs: 60 * SECOND,
} as const;
