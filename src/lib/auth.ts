import { cookies } from 'next/headers';
import { signValue, verifySignedValue } from '@/lib/security';

const SESSION_COOKIE = 'sfms_session';

export interface SessionPayload {
  userId: string;
  email: string;
  name: string;
  role: string;
}

export async function createSession(payload: SessionPayload) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signedValue = `${encoded}.${signValue(encoded)}`;
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, signedValue, {
    httpOnly: true,
    path: '/',
    maxAge: 60 * 60 * 24, // 24 hours
    sameSite: 'lax',
    secure: false,
  });
}

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const cookie = cookieStore.get(SESSION_COOKIE);
  if (!cookie) return null;

  try {
    const [encoded, signature] = cookie.value.split('.');
    if (!encoded || !signature || !verifySignedValue(encoded, signature)) {
      return null;
    }
    return JSON.parse(Buffer.from(encoded, 'base64url').toString('utf-8'));
  } catch {
    return null;
  }
}

export async function destroySession() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

export async function requireAuth(): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) {
    throw new Error('UNAUTHORIZED');
  }
  return session;
}
