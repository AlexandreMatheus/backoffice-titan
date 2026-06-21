import { NextRequest, NextResponse } from 'next/server';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { supabaseAdmin } from '@/lib/supabase/client';
import { extractTokenFromHeader, verifyAccessToken } from '@/lib/auth/jwt';
import {
  inferMediaExtension,
  isAllowedPhotoMime,
  isAllowedVideoMime,
  resolveMediaContentType,
  type MediaKind,
} from '@/lib/media-validation';

function getR2Client() {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error('Missing R2 configuration environment variables');
  }
  return new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authHeader = request.headers.get('authorization');
  const token = extractTokenFromHeader(authHeader);
  const payload = verifyAccessToken(token ?? undefined);
  if (!payload) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (payload.userType !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const bucket = process.env.R2_BUCKET;
  if (!bucket) {
    return NextResponse.json({ error: 'R2_BUCKET not configured' }, { status: 500 });
  }

  const { id: exerciseId } = await params;
  const formData = await request.formData();
  const kindRaw = formData.get('kind');
  const file = formData.get('file');

  if (kindRaw !== 'photo' && kindRaw !== 'video') {
    return NextResponse.json({ error: 'kind must be photo or video' }, { status: 400 });
  }
  const kind = kindRaw as MediaKind;

  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: 'Arquivo de mídia inválido' }, { status: 400 });
  }

  const contentType = resolveMediaContentType(file, kind);
  if (!contentType) {
    return NextResponse.json(
      {
        error:
          kind === 'photo'
            ? 'Apenas imagens JPG, PNG, WEBP ou GIF são permitidas'
            : 'Apenas vídeos MP4, WEBM ou MOV são permitidos',
      },
      { status: 400 }
    );
  }
  if (kind === 'photo' && !isAllowedPhotoMime(contentType)) {
    return NextResponse.json(
      { error: 'Apenas imagens JPG, PNG, WEBP ou GIF são permitidas' },
      { status: 400 }
    );
  }
  if (kind === 'video' && !isAllowedVideoMime(contentType)) {
    return NextResponse.json(
      { error: 'Apenas vídeos MP4, WEBM ou MOV são permitidos' },
      { status: 400 }
    );
  }

  const { data: existing, error: fetchError } = await supabaseAdmin
    .from('exercises')
    .select('id')
    .eq('id', exerciseId)
    .is('created_by', null)
    .maybeSingle();

  if (fetchError) {
    console.error('[exercises/media] fetch error:', fetchError);
    return NextResponse.json({ error: 'Erro ao buscar exercício' }, { status: 500 });
  }
  if (!existing) {
    return NextResponse.json({ error: 'Exercício não encontrado' }, { status: 404 });
  }

  try {
    const ext = inferMediaExtension(contentType, kind);
    const key = `exercises/${exerciseId}/r2/${kind}.${ext}`;
    const storageUrl = `r2://${bucket}/${key}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    const client = getR2Client();
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType,
      })
    );

    const field = kind === 'photo' ? 'r2_photo_url' : 'r2_video_url';
    const { data, error } = await supabaseAdmin
      .from('exercises')
      .update({
        [field]: storageUrl,
        updated_at: new Date().toISOString(),
      })
      .eq('id', exerciseId)
      .is('created_by', null)
      .select('id, r2_photo_url, r2_video_url')
      .single();

    if (error || !data) {
      console.error('[exercises/media] db update error:', error);
      return NextResponse.json(
        { error: 'Arquivo enviado ao R2, mas falhou ao salvar no banco' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      kind,
      storageUrl,
      exercise: data,
    });
  } catch (error) {
    console.error('[exercises/media] upload error:', error);
    return NextResponse.json({ error: 'Erro ao enviar mídia' }, { status: 500 });
  }
}
