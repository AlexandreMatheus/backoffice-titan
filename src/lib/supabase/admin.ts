import 'server-only';
import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js';

export class SupabaseAdminConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SupabaseAdminConfigError';
  }
}

function decodeJwtRole(key: string): string | null {
  try {
    const parts = key.split('.');
    if (parts.length !== 3) return null;
    const payloadSegment = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(Buffer.from(payloadSegment, 'base64').toString('utf8')) as {
      role?: string;
    };
    return payload.role ?? null;
  } catch {
    return null;
  }
}

function resolveServiceRoleKey(): string {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!key || key === 'placeholder') {
    throw new SupabaseAdminConfigError(
      'SUPABASE_SERVICE_ROLE_KEY ausente. Adicione a service role key do Supabase em .env.local e reinicie o servidor.'
    );
  }

  const role = decodeJwtRole(key);
  if (role !== 'service_role') {
    throw new SupabaseAdminConfigError(
      'SUPABASE_SERVICE_ROLE_KEY inválida: use a chave service_role do Supabase (não a anon key).'
    );
  }

  return key;
}

/** Fresh service-role client per call — avoids stale singleton after HMR/env changes. */
export function getSupabaseAdmin(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (!url) {
    throw new SupabaseAdminConfigError('NEXT_PUBLIC_SUPABASE_URL ausente.');
  }

  return createSupabaseClient(url, resolveServiceRoleKey(), {
    auth: {
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
}
