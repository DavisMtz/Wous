/**
 * Primitivas criptográficas sobre Web Crypto. Nada de criptografía propia
 * (§6): HMAC-SHA256, HKDF, AES-GCM y bytes aleatorios del runtime.
 */

const encoder = new TextEncoder();

export function base64url(bytes: Uint8Array): string {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function fromBase64url(text: string): Uint8Array {
  const padded = text
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    .padEnd(Math.ceil(text.length / 4) * 4, '=');
  const binary = atob(padded);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

/** Token opaco de `bytes` bytes aleatorios (256 bits por defecto), en base64url. */
export function randomToken(bytes = 32): string {
  return base64url(crypto.getRandomValues(new Uint8Array(bytes)));
}

const hmacKeys = new Map<string, Promise<CryptoKey>>();

function hmacKey(secret: string): Promise<CryptoKey> {
  let key = hmacKeys.get(secret);
  if (!key) {
    key = crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    );
    hmacKeys.set(secret, key);
  }
  return key;
}

/**
 * HMAC-SHA256 en base64url. Es como se guardan los tokens en D1: sin el pepper
 * (secreto del Worker) una copia robada de la base no sirve para nada.
 */
export async function hmacSha256(secret: string, message: string): Promise<string> {
  const signature = await crypto.subtle.sign(
    'HMAC',
    await hmacKey(secret),
    encoder.encode(message),
  );
  return base64url(new Uint8Array(signature));
}

export async function sha256Base64url(message: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(message));
  return base64url(new Uint8Array(digest));
}

/** Comparación en tiempo constante (para secretos de webhook). */
export function timingSafeEqualStrings(a: string, b: string): boolean {
  const left = encoder.encode(a);
  const right = encoder.encode(b);
  if (left.byteLength !== right.byteLength) {
    // Compara igual contra sí mismo para no filtrar la longitud por tiempo.
    crypto.subtle.timingSafeEqual(left, left);
    return false;
  }
  return crypto.subtle.timingSafeEqual(left, right);
}

const aesKeys = new Map<string, Promise<CryptoKey>>();

/** Llave AES-GCM derivada del pepper con HKDF y una etiqueta de uso. */
function aesKey(secret: string, label: string): Promise<CryptoKey> {
  const cacheKey = `${label}\u0000${secret}`;
  let key = aesKeys.get(cacheKey);
  if (!key) {
    key = (async () => {
      const base = await crypto.subtle.importKey('raw', encoder.encode(secret), 'HKDF', false, [
        'deriveKey',
      ]);
      return crypto.subtle.deriveKey(
        { name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(32), info: encoder.encode(label) },
        base,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt'],
      );
    })();
    aesKeys.set(cacheKey, key);
  }
  return key;
}

/** Cifra con AES-256-GCM; salida base64url de `iv || ciphertext`. */
export async function encryptString(secret: string, label: string, plaintext: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    await aesKey(secret, label),
    encoder.encode(plaintext),
  );
  const out = new Uint8Array(iv.byteLength + cipher.byteLength);
  out.set(iv, 0);
  out.set(new Uint8Array(cipher), iv.byteLength);
  return base64url(out);
}

export async function decryptString(secret: string, label: string, encoded: string) {
  const data = fromBase64url(encoded);
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: data.slice(0, 12) },
    await aesKey(secret, label),
    data.slice(12),
  );
  return new TextDecoder().decode(plain);
}
