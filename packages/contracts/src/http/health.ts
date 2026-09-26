import { z } from 'zod';

export const AppEnv = z.enum(['local', 'staging', 'production']);
export type AppEnv = z.infer<typeof AppEnv>;

export const DependencyStatus = z.enum(['ok', 'degraded', 'down', 'not_configured']);
export type DependencyStatus = z.infer<typeof DependencyStatus>;

export const DependencyCheck = z.object({
  status: DependencyStatus,
  latencyMs: z.number().nonnegative().optional(),
  /** Descripción corta y segura: nunca valores de secretos ni cadenas de conexión. */
  detail: z.string().optional(),
});
export type DependencyCheck = z.infer<typeof DependencyCheck>;

export const HealthResponse = z.object({
  status: z.enum(['ok', 'degraded']),
  service: z.literal('wous'),
  environment: AppEnv,
  version: z.string(),
  serverTime: z.number().int(),
  checks: z.record(z.string(), DependencyCheck),
});
export type HealthResponse = z.infer<typeof HealthResponse>;
