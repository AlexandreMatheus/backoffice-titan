import { createClient as createSupabaseClient } from '@supabase/supabase-js';

export { getSupabaseAdmin, SupabaseAdminConfigError } from '@/lib/supabase/admin';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

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
