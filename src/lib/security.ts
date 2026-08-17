import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'crypto';

const PASSWORD_PREFIX = 'scrypt';
const SESSION_SECRET = process.env.SESSION_SECRET ?? process.env.NEXTAUTH_SECRET ?? 'sfms-local-development-secret';

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  const derived = scryptSync(password, salt, 64).toString('hex');
  return `${PASSWORD_PREFIX}$${salt}$${derived}`;
}

export function verifyPassword(password: string, storedPassword: string) {
  if (!storedPassword.startsWith(`${PASSWORD_PREFIX}$`)) {
    return password === storedPassword;
  }

  const [, salt, hash] = storedPassword.split('$');
  if (!salt || !hash) return false;

  const expected = Buffer.from(hash, 'hex');
  const actual = scryptSync(password, salt, expected.length);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function signValue(value: string) {
  return createHmac('sha256', SESSION_SECRET).update(value).digest('base64url');
}

export function verifySignedValue(value: string, signature: string) {
  const expected = Buffer.from(signValue(value));
  const actual = Buffer.from(signature);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
