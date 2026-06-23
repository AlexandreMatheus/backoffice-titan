import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import {
  extractTokenFromHeader,
  verifyAccessToken,
  hashToken,
} from '@/lib/auth/jwt';

export async function POST(request: NextRequest) {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const authHeader = request.headers.get('authorization');
    const token = extractTokenFromHeader(authHeader);
    const payload = verifyAccessToken(token ?? undefined);

    let refresh_token: string | null = null;
    try {
      const body = await request.json() as { refresh_token?: string };
      refresh_token = body?.refresh_token ?? null;
    } catch {
      // no body
    }

    if (payload && refresh_token) {
      const tokenHash = hashToken(refresh_token);
      await supabaseAdmin
        .from('refresh_token_store')
        .update({
          is_active: false,
          revoked_at: new Date().toISOString(),
          revoke_reason: 'logout',
        })
        .eq('token_hash', tokenHash)
        .eq('user_id', payload.userId);
    } else if (payload) {
      // Revoke all tokens for this user
      await supabaseAdmin
        .from('refresh_token_store')
        .update({
          is_active: false,
          revoked_at: new Date().toISOString(),
          revoke_reason: 'logout',
        })
        .eq('user_id', payload.userId)
        .eq('is_active', true);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Logout error:', error);
    return NextResponse.json({ success: true }); // Always return success
  }
}
