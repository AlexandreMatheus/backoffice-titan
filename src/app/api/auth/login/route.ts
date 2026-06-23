import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import {
  generateAccessToken,
  generateRefreshToken,
  hashToken,
} from '@/lib/auth/jwt';

function isAdminEmail(email: string): boolean {
  const adminEmails = (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return adminEmails.includes(email.toLowerCase());
}

export async function POST(request: NextRequest) {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const body = await request.json() as { email?: string; password?: string };
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: 'AUTH_INVALID_INPUT', message: 'Email and password required' },
        { status: 400 }
      );
    }

    // Authenticate with Supabase
    const { data: authData, error: authError } = await supabaseAdmin.auth.signInWithPassword({
      email,
      password,
    });

    if (authError || !authData.user) {
      return NextResponse.json(
        { error: 'AUTH_INVALID_CREDENTIALS', message: 'Email ou senha inválidos' },
        { status: 401 }
      );
    }

    const userId = authData.user.id;
    const userEmail = authData.user.email || email;

    // If email is in ADMIN_EMAILS, allow without requiring a profile row
    const emailIsAdmin = isAdminEmail(userEmail);

    // Get user profile (optional if email is already admin)
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('id, email, full_name, user_type, status')
      .eq('id', userId)
      .maybeSingle();

    // Admin check: email in ADMIN_EMAILS OR profile.user_type === 'admin'
    const isAdmin = emailIsAdmin || profile?.user_type === 'admin';

    if (!isAdmin) {
      return NextResponse.json(
        {
          error: 'AUTH_FORBIDDEN',
          message: 'Acesso negado. Apenas administradores podem acessar o backoffice.',
        },
        { status: 403 }
      );
    }

    const accessToken = generateAccessToken(userId, 15 * 60, 'admin');
    const refreshToken = generateRefreshToken();
    const tokenHash = hashToken(refreshToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    // Store refresh token
    await supabaseAdmin.from('refresh_token_store').insert({
      user_id: userId,
      token_hash: tokenHash,
      expires_at: expiresAt,
      is_active: true,
    });

    const userPayload = {
      id: userId,
      email: profile?.email || userEmail,
      full_name: profile?.full_name || userEmail.split('@')[0],
      user_type: 'admin' as const,
      status: profile?.status || 'active',
    };

    return NextResponse.json({
      access_token: accessToken,
      refresh_token: refreshToken,
      user: userPayload,
    });
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'INTERNAL_SERVER_ERROR', message: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
