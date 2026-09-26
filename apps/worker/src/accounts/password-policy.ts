/**
 * Política de contraseña del servidor (§6). La longitud mínima y máxima ya la
 * valida el contrato; aquí van las reglas que dependen de otros datos.
 */

const COMMON_PASSWORDS = new Set([
  '1234567890',
  '0123456789',
  '12345678910',
  'qwertyuiop',
  'contraseña',
  'contrasena',
  'contraseña123',
  'contrasena123',
  'password123',
  'password1234',
  'passw0rd123',
  'iloveyou123',
  'teamo12345',
  'qwerty12345',
  'abc1234567',
  'aaaaaaaaaa',
  'wous123456',
  'wouswouswous',
]);

export type PasswordProblem = 'COMMON' | 'REPEATED' | 'CONTAINS_IDENTITY';

export function checkPassword(
  password: string,
  identity: { username: string; email: string },
): PasswordProblem | null {
  const lower = password.toLowerCase();
  if (COMMON_PASSWORDS.has(lower)) return 'COMMON';
  if (new Set(password).size <= 2) return 'REPEATED';

  const emailLocal = identity.email.split('@')[0]?.toLowerCase() ?? '';
  const username = identity.username.toLowerCase();
  if (username.length >= 3 && lower.includes(username)) return 'CONTAINS_IDENTITY';
  if (emailLocal.length >= 4 && lower.includes(emailLocal)) return 'CONTAINS_IDENTITY';
  return null;
}

export const PASSWORD_PROBLEM_MESSAGES: Record<PasswordProblem, string> = {
  COMMON: 'Esa contraseña es de las más usadas. Elige otra.',
  REPEATED: 'Usa más variedad de caracteres.',
  CONTAINS_IDENTITY: 'No incluyas tu nombre de usuario ni tu correo.',
};
