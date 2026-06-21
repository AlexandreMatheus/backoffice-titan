import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/client';
import { extractTokenFromHeader, verifyAccessToken } from '@/lib/auth/jwt';
import { z } from 'zod';

function requireAuth(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const token = extractTokenFromHeader(authHeader);
  return verifyAccessToken(token ?? undefined);
}

const updateExerciseSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  subnome: z.string().max(255).optional().nullable(),
  level: z
    .enum(['adaptacao', 'iniciante', 'intermediario', 'avancado'])
    .optional()
    .nullable(),
  muscle_group: z.string().max(255).optional().nullable(),
  execution_type: z.string().max(100).optional().nullable(),
  prateleira: z.string().max(100).optional().nullable(),
  home_adaptable: z.boolean().optional().nullable(),
  order_index: z.number().int().optional().nullable(),
  video_url: z.string().url().optional().nullable().or(z.literal('')),
  thumbnail_url: z.string().url().optional().nullable().or(z.literal('')),
  r2_video_url: z.string().optional().nullable(),
  r2_photo_url: z.string().optional().nullable(),
  metadata: z.record(z.unknown()).optional().nullable(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const payload = requireAuth(request);
  if (!payload) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  const { data, error } = await supabaseAdmin
    .from('exercises')
    .select('*')
    .eq('id', id)
    .is('created_by', null)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: 'Exercício não encontrado' }, { status: 404 });
  }

  return NextResponse.json(data);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const payload = requireAuth(request);
  if (!payload) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (payload.userType !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();
  const parsed = updateExerciseSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation error', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const updateData: Record<string, unknown> = {
    ...parsed.data,
    updated_at: new Date().toISOString(),
  };

  // Clean up empty strings
  if (updateData.video_url === '') updateData.video_url = null;
  if (updateData.thumbnail_url === '') updateData.thumbnail_url = null;

  const { data, error } = await supabaseAdmin
    .from('exercises')
    .update(updateData)
    .eq('id', id)
    .is('created_by', null)
    .select()
    .single();

  if (error || !data) {
    console.error('Error updating exercise:', error);
    return NextResponse.json({ error: 'Erro ao atualizar exercício' }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const payload = requireAuth(request);
  if (!payload) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (payload.userType !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;

  const { error } = await supabaseAdmin
    .from('exercises')
    .delete()
    .eq('id', id)
    .is('created_by', null);

  if (error) {
    console.error('Error deleting exercise:', error);
    return NextResponse.json({ error: 'Erro ao deletar exercício' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
