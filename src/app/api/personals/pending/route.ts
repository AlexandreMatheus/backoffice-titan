import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin, SupabaseAdminConfigError } from '@/lib/supabase/admin';
import { requireAdmin, TRAINER_PROFILE_ROLES } from '@/lib/personals';

const TRAINER_ROLE_FILTER = TRAINER_PROFILE_ROLES.join(',');

export async function GET(request: NextRequest) {
  const { payload, error: authError } = requireAdmin(request);
  if (authError || !payload) {
    return NextResponse.json(
      { error: authError ?? 'Unauthorized' },
      { status: authError === 'Forbidden' ? 403 : 401 }
    );
  }

  try {
    const supabaseAdmin = getSupabaseAdmin();
    const { searchParams } = new URL(request.url);
    const search = (searchParams.get('search') || '').trim();

    let query = supabaseAdmin
      .from('profiles')
      .select('id, full_name, email, cref, cpf, phone, role, status, created_at', {
        count: 'exact',
      })
      .eq('status', 'pendente')
      .is('deleted_at', null)
      .or(`role.in.(${TRAINER_ROLE_FILTER}),user_type.eq.trainer`)
      .order('created_at', { ascending: true });

    if (search) {
      query = query.or(
        `full_name.ilike.%${search}%,email.ilike.%${search}%,cref.ilike.%${search}%`
      );
    }

    const { data, error, count } = await query;

    if (error) {
      console.error('[GET /api/personals/pending]', error);
      return NextResponse.json({ error: 'Erro ao buscar personais pendentes' }, { status: 500 });
    }

    return NextResponse.json({
      data: data ?? [],
      count: count ?? 0,
    });
  } catch (error) {
    if (error instanceof SupabaseAdminConfigError) {
      console.error('[GET /api/personals/pending] config:', error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    throw error;
  }
}
