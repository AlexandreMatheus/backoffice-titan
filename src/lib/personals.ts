import { NextRequest } from 'next/server';
import { extractTokenFromHeader, verifyAccessToken } from '@/lib/auth/jwt';

export function requireAuth(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const token = extractTokenFromHeader(authHeader);
  return verifyAccessToken(token ?? undefined);
}

export function requireAdmin(request: NextRequest) {
  const payload = requireAuth(request);
  if (!payload) return { payload: null, error: 'Unauthorized' as const };
  if (payload.userType !== 'admin') return { payload: null, error: 'Forbidden' as const };
  return { payload, error: null };
}

export const TRAINER_PROFILE_ROLES = [
  'personal_trainer',
  'educador_fisico',
  'nutricionista',
  'trainer',
] as const;

export const CONFEF_REGISTRADOS_URL = 'https://www.confef.org.br/registrados/';
