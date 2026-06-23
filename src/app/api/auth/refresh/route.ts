import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import {
  generateAccessToken,
  generateRefreshToken,
  hashToken,
  extractTokenFromHeader,
} from '@/lib/auth/jwt';

export async function POST(request: NextRequest) {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    let refresh_token: string | null = null;

    try {
      const text = await request.text();
      if (text) {
        const body = JSON.parse(text) as { refresh_token?: string };
        refresh_token = body?.refresh_token ?? null;
      }
    } catch {
      const authHeader = request.headers.get('authorization');
      refresh_token = extractTokenFromHeader(authHeader);
    }

    if (!refresh_token) {
      return NextResponse.json(
        { error: 'AUTH_INVALID_INPUT', message: 'Refresh token required' },
        { status: 400 }
      );
    }

    const tokenHash = hashToken(refresh_token);

    const { data: tokenRecord, error: lookupError } = await supabaseAdmin
      .from('refresh_token_store')
      .select('*')
      .eq('token_hash', tokenHash)
      .single();

    if (lookupError || !tokenRecord) {
      return NextResponse.json(
        { error: 'AUTH_INVALID_TOKEN', message: 'Token inválido' },
        { status: 401 }
      );
    }

    if (!tokenRecord.is_active) {
      return NextResponse.json(
        { error: 'AUTH_INVALID_TOKEN', message: 'Token revogado' },
        { status: 401 }
      );
    }

    if (new Date(tokenRecord.expires_at) < new Date()) {
      return NextResponse.json(
        { error: 'AUTH_TOKEN_EXPIRED', message: 'Token expirado' },
        { status: 401 }
      );
    }

    // Rotate: invalidate old token
    await supabaseAdmin
      .from('refresh_token_store')
      .update({
        is_active: false,
        revoked_at: new Date().toISOString(),
        revoke_reason: 'token_rotated',
      })
      .eq('id', tokenRecord.id);

    // Issue new tokens
    const newAccessToken = generateAccessToken(tokenRecord.user_id, 15 * 60, 'admin');
    const newRefreshToken = generateRefreshToken();
    const newTokenHash = hashToken(newRefreshToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    await supabaseAdmin.from('refresh_token_store').insert({
      user_id: tokenRecord.user_id,
      token_hash: newTokenHash,
      expires_at: expiresAt,
      is_active: true,
    });

    return NextResponse.json({
      access_token: newAccessToken,
      refresh_token: newRefreshToken,
    });
  } catch (error) {
    console.error('Refresh error:', error);
    return NextResponse.json(
      { error: 'INTERNAL_SERVER_ERROR', message: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
