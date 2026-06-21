import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdmin } from '@/lib/supabase/client';
import { requireAdmin, TRAINER_PROFILE_ROLES } from '@/lib/personals';

const updateSchema = z.object({
  action: z.enum(['approve', 'reject']),
});

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, context: RouteContext) {
  const { payload, error: authError } = requireAdmin(request);
  if (authError || !payload) {
    return NextResponse.json({ error: authError ?? 'Unauthorized' }, { status: authError === 'Forbidden' ? 403 : 401 });
  }

  const { id } = await context.params;
  const body = await request.json().catch(() => ({}));
  const parsed = updateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation error', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const supabaseAdmin = getSupabaseAdmin();

  const { data: profile, error: fetchError } = await supabaseAdmin
    .from('profiles')
    .select('id, full_name, email, cref, role, status')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();

  if (fetchError) {
    console.error('[PATCH /api/personals/[id]] fetch:', fetchError);
    return NextResponse.json({ error: 'Erro ao buscar perfil' }, { status: 500 });
  }

  if (!profile) {
    return NextResponse.json({ error: 'Perfil não encontrado' }, { status: 404 });
  }

  if (!TRAINER_PROFILE_ROLES.includes(profile.role as (typeof TRAINER_PROFILE_ROLES)[number])) {
    return NextResponse.json({ error: 'Perfil não é de personal trainer' }, { status: 400 });
  }

  if (profile.status !== 'pendente') {
    return NextResponse.json(
      { error: 'Este cadastro já foi processado', status: profile.status },
      { status: 409 }
    );
  }

  const nextStatus = parsed.data.action === 'approve' ? 'aprovado' : 'rejeitado';

  if (parsed.data.action === 'approve') {
    const { error: confirmError } = await supabaseAdmin.auth.admin.updateUserById(id, {
      email_confirm: true,
    });
    if (confirmError) {
      console.error('[PATCH /api/personals/[id]] confirm email:', confirmError);
      return NextResponse.json(
        { error: 'Não foi possível confirmar o e-mail do usuário no Auth' },
        { status: 500 }
      );
    }
  }

  const { data: updated, error: updateError } = await supabaseAdmin
    .from('profiles')
    .update({ status: nextStatus })
    .eq('id', id)
    .select('id, full_name, email, cref, role, status, created_at')
    .single();

  if (updateError) {
    console.error('[PATCH /api/personals/[id]] update:', updateError);
    return NextResponse.json({ error: 'Erro ao atualizar status' }, { status: 500 });
  }

  return NextResponse.json({ data: updated });
}
