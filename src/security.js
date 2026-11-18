// Хешування паролів (scrypt із вбудованого модуля node:crypto).
// У базі зберігається лише рядок виду  scrypt$N$r$p$<сіль>$<хеш>, а не сам пароль.
import { pbkdf2, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(scrypt);
const pbkdf2Async = promisify(pbkdf2);

const PARAMS = Object.freeze({ N: 16384, r: 8, p: 1 });
const KEY_LENGTH = 64;
const MAX_MEM = 256 * 1024 * 1024;   // запас пам'яті для scrypt зі старої версії (N = 32768)

/** Чи створений хеш поточною (JavaScript) версією програми. */
export const isCurrentHash = (stored) => String(stored).startsWith('scrypt$');

export async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const { N, r, p } = PARAMS;
  const key = await scryptAsync(password, salt, KEY_LENGTH, { N, r, p });
  return ['scrypt', N, r, p, salt, key.toString('hex')].join('$');
}

export async function verifyPassword(password, stored) {
  const text = String(stored ?? '');
  const actualAndExpected = isCurrentHash(text)
    ? await verifyCurrent(password, text)
    : await verifyLegacy(password, text);
  if (!actualAndExpected) return false;
  const [actual, expected] = actualAndExpected;
  // порівняння за сталий час — щоб не можна було вгадувати хеш за часом відповіді
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

async function verifyCurrent(password, stored) {
  const [, N, r, p, salt, hex] = stored.split('$');
  if (!hex) return null;
  const expected = Buffer.from(hex, 'hex');
  const actual = await scryptAsync(password, salt, expected.length,
    { N: Number(N), r: Number(r), p: Number(p), maxmem: MAX_MEM });
  return [actual, expected];
}

/**
 * Хеші, створені попередньою версією на Python (werkzeug):
 *   scrypt:32768:8:1$<сіль>$<хеш>   або   pbkdf2:sha256:600000$<сіль>$<хеш>
 * Потрібні, щоб користувачі, додані у старій версії, могли увійти.
 */
async function verifyLegacy(password, stored) {
  const [method, salt, hex] = stored.split('$');
  if (!method || !salt || !hex) return null;
  const expected = Buffer.from(hex, 'hex');
  const [algo, ...args] = method.split(':');
  if (algo === 'scrypt') {
    const [N = 32768, r = 8, p = 1] = args.map(Number);
    return [await scryptAsync(password, salt, expected.length, { N, r, p, maxmem: MAX_MEM }), expected];
  }
  if (algo === 'pbkdf2') {
    const [digest = 'sha256', iterations = 600000] = args;
    return [await pbkdf2Async(password, salt, Number(iterations), expected.length, digest), expected];
  }
  return null;
}
