import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { verifyAccessToken, extractTokenFromHeader } from '@/lib/auth/jwt';

// GET /api/exercises/stats?count=total|with_photo|with_video
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const token = extractTokenFromHeader(authHeader);
  if (!token || !verifyAccessToken(token)) {
    return NextResponse.json({ error: 'AUTH_UNAUTHORIZED' }, { status: 401 });
  }

  const count = request.nextUrl.searchParams.get('count') ?? 'total';

  const supabaseAdmin = getSupabaseAdmin();
  let query = supabaseAdmin
    .from('exercises')
    .select('*', { count: 'exact', head: true })
    .is('created_by', null);

  if (count === 'with_photo') {
    query = query.not('r2_photo_url', 'is', null);
  } else if (count === 'with_video') {
    query = query.not('r2_video_url', 'is', null);
  }

  const { count: result, error } = await query;

  if (error) {
    return NextResponse.json({ error: 'QUERY_FAILED' }, { status: 500 });
  }

  return NextResponse.json({ count: result ?? 0 });
}
