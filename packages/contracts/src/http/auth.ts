import { z } from 'zod';
import { AccountStatus, StaffRole } from '../domain/account.ts';
import {
  EmailInput,
  OpaqueToken,
  PasswordInput,
  TurnstileToken,
  UsernameInput,
} from '../domain/identity.ts';
import { InvitationCodeInput } from '../domain/invitation.ts';
import { CharacterView } from './characters.ts';
import { AppEnv } from './health.ts';

/**
 * Cómo se abre una cuenta en cada entorno (ADR-0012): con registro abierto o
 * solo con invitación (alpha cerrada).
 */
export const RegistrationMode = z.enum(['open', 'invite']);
export type RegistrationMode = z.infer<typeof RegistrationMode>;

/** POST /api/v1/auth/register */
export const RegisterRequest = z.object({
  email: EmailInput,
  username: UsernameInput,
  password: PasswordInput,
  turnstileToken: TurnstileToken,
  termsVersion: z.string().min(1).max(20),
  /** Obligatorio con `registration: 'invite'`; con registro abierto se ignora. */
  invitationCode: InvitationCodeInput.optional(),
});
export type RegisterRequest = z.infer<typeof RegisterRequest>;

/**
 * Respuesta genérica: la misma exista o no el correo, para no permitir
 * enumerar cuentas (§6).
 */
export const PendingVerificationResponse = z.object({
  status: z.literal('PENDING_VERIFICATION'),
});
export type PendingVerificationResponse = z.infer<typeof PendingVerificationResponse>;

/** POST /api/v1/auth/verify-email — el token viaja en el cuerpo, nunca en un GET. */
export const VerifyEmailRequest = z.object({ token: OpaqueToken });
export type VerifyEmailRequest = z.infer<typeof VerifyEmailRequest>;

/** POST /api/v1/auth/resend-verification */
export const ResendVerificationRequest = z.object({
  email: EmailInput,
  turnstileToken: TurnstileToken,
});
export type ResendVerificationRequest = z.infer<typeof ResendVerificationRequest>;

/** POST /api/v1/auth/login — `login` acepta correo o nombre de usuario. */
export const LoginRequest = z.object({
  login: z.string().trim().min(3).max(254),
  password: z.string().min(1).max(128),
  turnstileToken: TurnstileToken,
});
export type LoginRequest = z.infer<typeof LoginRequest>;

/** POST /api/v1/auth/forgot-password */
export const ForgotPasswordRequest = z.object({
  email: EmailInput,
  turnstileToken: TurnstileToken,
});
export type ForgotPasswordRequest = z.infer<typeof ForgotPasswordRequest>;

/** POST /api/v1/auth/reset-password */
export const ResetPasswordRequest = z.object({
  token: OpaqueToken,
  password: PasswordInput,
});
export type ResetPasswordRequest = z.infer<typeof ResetPasswordRequest>;

/** Lo que el cliente sabe de la cuenta en sesión. Nunca hashes ni tokens. */
export const AccountView = z.object({
  id: z.string(),
  username: z.string(),
  email: z.string(),
  status: AccountStatus,
  createdAt: z.number().int(),
});
export type AccountView = z.infer<typeof AccountView>;

export const SessionResponse = z.object({
  account: AccountView,
  hasCharacter: z.boolean(),
  /** El personaje de la cuenta (uno por cuenta en el MVP), o null si aún no lo arma. */
  character: CharacterView.nullable(),
  /** Rol en la caseta (ADR-0012), o null para quien solo juega. */
  staffRole: StaffRole.nullable(),
});
export type SessionResponse = z.infer<typeof SessionResponse>;

/** GET /api/v1/config — configuración pública del cliente por entorno. */
export const ClientConfig = z.object({
  environment: AppEnv,
  turnstileSiteKey: z.string(),
  termsVersion: z.string(),
  /** Con `invite`, el registro pide código de invitación (alpha cerrada). */
  registration: RegistrationMode,
});
export type ClientConfig = z.infer<typeof ClientConfig>;
