import { AppError } from '../http/errors.ts';

/** Errores de identidad con códigos estables (§32). Mensajes para personas. */
export const AuthErrors = {
  authRequired: () => new AppError('AUTH_REQUIRED', 401, 'Inicia sesión para continuar.'),
  turnstileFailed: () =>
    new AppError(
      'TURNSTILE_FAILED',
      400,
      'No pudimos comprobar que eres una persona. Inténtalo otra vez.',
    ),
  invalidCredentials: () =>
    new AppError('INVALID_CREDENTIALS', 401, 'El usuario o la contraseña no coinciden.'),
  emailNotVerified: () =>
    new AppError('EMAIL_NOT_VERIFIED', 403, 'Confirma tu correo antes de entrar.'),
  accountNotActive: () =>
    new AppError('ACCOUNT_NOT_ACTIVE', 403, 'Tu cuenta no puede entrar ahora mismo.'),
  /**
   * Con fin conocido, `retryAfterSeconds` dice cuánto falta (ADR-0012). Solo se
   * responde después de verificar la contraseña: no delata nada a nadie más.
   */
  accountSuspended: (retryAfterSeconds?: number) =>
    new AppError(
      'ACCOUNT_SUSPENDED',
      403,
      'Tu cuenta está suspendida temporalmente.',
      retryAfterSeconds !== undefined ? { retryAfterSeconds } : {},
    ),
  accountBanned: () => new AppError('ACCOUNT_BANNED', 403, 'Tu cuenta fue cerrada.'),
  invalidUsername: (message: string) =>
    new AppError('INVALID_USERNAME', 400, message, { fields: { username: message } }),
  usernameTaken: () =>
    new AppError('USERNAME_TAKEN', 409, 'Ese nombre de usuario ya está ocupado.', {
      fields: { username: 'Ese nombre de usuario ya está ocupado.' },
    }),
  weakPassword: (message: string) =>
    new AppError('WEAK_PASSWORD', 400, message, { fields: { password: message } }),
  termsNotAccepted: () =>
    new AppError('TERMS_NOT_ACCEPTED', 400, 'Acepta las condiciones vigentes para continuar.'),
  tokenInvalid: () =>
    new AppError('TOKEN_INVALID', 400, 'Este enlace ya no es válido. Pide uno nuevo.'),
  /** Mismo mensaje si no existe, venció, se agotó o la revocaron (ADR-0012). */
  invitationInvalid: () => {
    const message = 'Esa invitación no sirve: revisa el código o pide otra.';
    return new AppError('INVITATION_INVALID', 400, message, {
      fields: { invitationCode: message },
    });
  },
} as const;
