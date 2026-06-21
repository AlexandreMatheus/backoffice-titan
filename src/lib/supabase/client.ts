import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

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
    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8')) as {
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
  if (role && role !== 'service_role') {
    throw new SupabaseAdminConfigError(
      'SUPABASE_SERVICE_ROLE_KEY inválida: use a chave service_role do Supabase (não a anon key).'
    );
  }

  return key;
}

let adminClient: SupabaseClient | null = null;

/** Server-side Supabase client with service role (bypasses RLS). Lazily initialized at request time. */
export function getSupabaseAdmin(): SupabaseClient {
  if (adminClient) return adminClient;

  const url = SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (!url) {
    throw new SupabaseAdminConfigError('NEXT_PUBLIC_SUPABASE_URL ausente.');
  }

  adminClient = createSupabaseClient(url, resolveServiceRoleKey(), {
    auth: {
      persistSession: false,
      detectSessionInUrl: false,
    },
  });

  return adminClient;
}

/** @deprecated Prefer getSupabaseAdmin() — kept for gradual migration */
export const supabaseAdmin = new Proxy({} as SupabaseClient, {
  get(_target, prop, receiver) {
    const client = getSupabaseAdmin();
    const value = Reflect.get(client, prop, receiver);
    return typeof value === 'function' ? value.bind(client) : value;
  },
});

// Public Supabase client (for browser/client operations)
export const supabaseClient = createSupabaseClient(
  SUPABASE_URL || 'https://placeholder.supabase.co',
  SUPABASE_ANON_KEY || 'placeholder'
);

export function createClient() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error(
      'Missing Supabase environment variables: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY'
    );
  }
  return createSupabaseClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}
