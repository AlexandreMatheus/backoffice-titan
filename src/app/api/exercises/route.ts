import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/client';
import { extractTokenFromHeader, verifyAccessToken } from '@/lib/auth/jwt';
import { z } from 'zod';

function requireAuth(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const token = extractTokenFromHeader(authHeader);
  return verifyAccessToken(token ?? undefined);
}

const createExerciseSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório').max(255),
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
  metadata: z.record(z.unknown()).optional().nullable(),
});

export async function GET(request: NextRequest) {
  const payload = requireAuth(request);
  if (!payload) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const search = searchParams.get('search') || '';
  const prateleira = searchParams.get('prateleira') || '';
  const muscle_group = searchParams.get('muscle_group') || '';
  const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 5000);
  const offset = parseInt(searchParams.get('offset') || '0', 10);

  let query = supabaseAdmin
    .from('exercises')
    .select('*', { count: 'exact' })
    .is('created_by', null)
    .order('order_index', { ascending: true, nullsFirst: false })
    .order('name', { ascending: true })
    .range(offset, offset + limit - 1);

  if (search) {
    query = query.ilike('name', `%${search}%`);
  }

  if (prateleira) {
    query = query.eq('prateleira', prateleira);
  }

  if (muscle_group) {
    query = query.eq('muscle_group', muscle_group);
  }

  const { data, error, count } = await query;

  if (error) {
    console.error('Error fetching exercises:', error);
    return NextResponse.json({ error: 'Erro ao buscar exercícios' }, { status: 500 });
  }

  return NextResponse.json({
    data: data ?? [],
    count: count ?? 0,
    limit,
    offset,
  });
}

export async function POST(request: NextRequest) {
  const payload = requireAuth(request);
  if (!payload) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (payload.userType !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json();
  const parsed = createExerciseSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation error', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const exerciseData = {
    ...parsed.data,
    created_by: null, // System exercise
    video_url: parsed.data.video_url || null,
    thumbnail_url: parsed.data.thumbnail_url || null,
  };

  const { data, error } = await supabaseAdmin
    .from('exercises')
    .insert(exerciseData)
    .select()
    .single();

  if (error) {
    console.error('Error creating exercise:', error);
    return NextResponse.json({ error: 'Erro ao criar exercício' }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
