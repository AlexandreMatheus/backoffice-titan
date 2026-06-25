import { NextRequest, NextResponse } from 'next/server';
import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { extractTokenFromHeader, verifyAccessToken } from '@/lib/auth/jwt';
import {
  buildR2StorageUrl,
  buildUniqueExerciseR2Key,
  isExerciseR2KeyForKind,
  parseR2StorageUrl,
} from '@/lib/exercise-r2-media';
import {
  inferMediaExtension,
  isAllowedPhotoMime,
  isAllowedVideoMime,
  resolveMediaContentType,
  type MediaKind,
} from '@/lib/media-validation';
import {
  EXERCISE_MEDIA_MAX_UPLOAD_BYTES,
  EXERCISE_MEDIA_MAX_UPLOAD_LABEL,
} from '@/lib/exercise-media-upload-limits';

/** Uploads grandes (vídeos) podem levar vários minutos. */
export const maxDuration = 300;

async function deleteR2Object(storageUrl: string, expectedBucket: string) {
  const parsed = parseR2StorageUrl(storageUrl);
  if (!parsed) return;
  if (parsed.bucket !== expectedBucket) return;
  const client = getR2Client();
  await client.send(
    new DeleteObjectCommand({
      Bucket: parsed.bucket,
      Key: parsed.key,
    })
  );
}

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

async function registerUploadedMedia(params: {
  exerciseId: string;
  kind: MediaKind;
  storageUrl: string;
  bucket: string;
}) {
  const { exerciseId, kind, storageUrl, bucket } = params;
  const parsed = parseR2StorageUrl(storageUrl);
  if (!parsed || parsed.bucket !== bucket) {
    return NextResponse.json({ error: 'storageUrl inválida para este bucket' }, { status: 400 });
  }
  if (!isExerciseR2KeyForKind(exerciseId, kind, parsed.key)) {
    console.warn('[exercises/media] register key mismatch', {
      exerciseId,
      kind,
      key: parsed.key,
    });
    return NextResponse.json({ error: 'Chave R2 não corresponde ao exercício/kind' }, { status: 400 });
  }

  const supabaseAdmin = getSupabaseAdmin();
  const { data: existing, error: fetchError } = await supabaseAdmin
    .from('exercises')
    .select('id, created_by, r2_photo_url, r2_video_url')
    .eq('id', exerciseId)
    .maybeSingle();

  if (fetchError) {
    console.error('[exercises/media] register fetch error:', fetchError);
    return NextResponse.json({ error: 'Erro ao buscar exercício' }, { status: 500 });
  }
  if (!existing) {
    return NextResponse.json({ error: 'Exercício não encontrado' }, { status: 404 });
  }
  if (existing.created_by != null) {
    return NextResponse.json(
      { error: 'Apenas exercícios do sistema podem ser editados pelo backoffice' },
      { status: 403 }
    );
  }

  const previousStorageUrl =
    kind === 'photo' ? existing.r2_photo_url : existing.r2_video_url;
  const field = kind === 'photo' ? 'r2_photo_url' : 'r2_video_url';

  const { data, error } = await supabaseAdmin
    .from('exercises')
    .update({
      [field]: storageUrl,
      updated_at: new Date().toISOString(),
    })
    .eq('id', exerciseId)
    .select('id, r2_photo_url, r2_video_url')
    .maybeSingle();

  if (error) {
    console.error('[exercises/media] register db update error:', error);
    return NextResponse.json({ error: 'Erro ao salvar mídia no banco' }, { status: 500 });
  }
  if (!data) {
    console.error('[exercises/media] register db update matched 0 rows:', { exerciseId, kind });
    return NextResponse.json({ error: 'Erro ao salvar mídia no banco' }, { status: 500 });
  }

  if (
    previousStorageUrl &&
    previousStorageUrl !== storageUrl &&
    parseR2StorageUrl(previousStorageUrl)?.key !== parsed.key
  ) {
    try {
      await deleteR2Object(previousStorageUrl, bucket);
      console.info('[exercises/media] deleted previous object', {
        exerciseId,
        kind,
        previousStorageUrl,
      });
    } catch (deleteError) {
      console.error('[exercises/media] delete previous object error:', deleteError);
    }
  }

  console.info('[exercises/media] register success', { exerciseId, kind, storageUrl });
  return NextResponse.json({
    success: true,
    kind,
    storageUrl,
    exercise: data,
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
  const requestContentType = request.headers.get('content-type') || '';

  if (requestContentType.includes('application/json')) {
    const body = (await request.json().catch(() => ({}))) as {
      kind?: string;
      storageUrl?: string;
      key?: string;
    };
    console.info('[exercises/media] POST register', {
      exerciseId,
      kind: body.kind,
      key: body.key,
      hasStorageUrl: !!body.storageUrl,
    });
    if (body.kind !== 'photo' && body.kind !== 'video') {
      return NextResponse.json({ error: 'kind must be photo or video' }, { status: 400 });
    }
    const storageUrl = (body.storageUrl || '').trim();
    if (!storageUrl) {
      return NextResponse.json({ error: 'storageUrl is required' }, { status: 400 });
    }
    return registerUploadedMedia({
      exerciseId,
      kind: body.kind,
      storageUrl,
      bucket,
    });
  }

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

  console.info('[exercises/media] POST multipart', {
    exerciseId,
    kind,
    bytes: file.size,
    mime: file.type,
  });

  const MULTIPART_MAX_BYTES = EXERCISE_MEDIA_MAX_UPLOAD_BYTES;
  if (file.size > MULTIPART_MAX_BYTES) {
    console.warn('[exercises/media] multipart too large', {
      exerciseId,
      kind,
      bytes: file.size,
      maxBytes: MULTIPART_MAX_BYTES,
    });
    return NextResponse.json(
      {
        error:
          `Arquivo grande demais (máx. ${EXERCISE_MEDIA_MAX_UPLOAD_LABEL}). ` +
          'Para arquivos maiores, configure CORS no bucket R2 para upload direto.',
      },
      { status: 413 }
    );
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

  const supabaseAdmin = getSupabaseAdmin();

  const { data: existing, error: fetchError } = await supabaseAdmin
    .from('exercises')
    .select('id, created_by, r2_photo_url, r2_video_url')
    .eq('id', exerciseId)
    .maybeSingle();

  if (fetchError) {
    console.error('[exercises/media] fetch error:', fetchError);
    return NextResponse.json({ error: 'Erro ao buscar exercício' }, { status: 500 });
  }
  if (!existing) {
    return NextResponse.json({ error: 'Exercício não encontrado' }, { status: 404 });
  }
  if (existing.created_by != null) {
    return NextResponse.json(
      { error: 'Apenas exercícios do sistema podem ser editados pelo backoffice' },
      { status: 403 }
    );
  }

  try {
    const ext = inferMediaExtension(contentType, kind);
    const previousStorageUrl =
      kind === 'photo' ? existing.r2_photo_url : existing.r2_video_url;
    const key = buildUniqueExerciseR2Key(exerciseId, kind, ext);
    const storageUrl = buildR2StorageUrl(bucket, key);
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
      .select('id, r2_photo_url, r2_video_url')
      .maybeSingle();

    if (error) {
      console.error('[exercises/media] db update error:', error);
      try {
        await deleteR2Object(storageUrl, bucket);
      } catch (cleanupError) {
        console.error('[exercises/media] rollback upload error:', cleanupError);
      }
      return NextResponse.json(
        { error: 'Arquivo enviado ao R2, mas falhou ao salvar no banco' },
        { status: 500 }
      );
    }
    if (!data) {
      console.error('[exercises/media] db update matched 0 rows:', { exerciseId, kind });
      try {
        await deleteR2Object(storageUrl, bucket);
      } catch (cleanupError) {
        console.error('[exercises/media] rollback upload error:', cleanupError);
      }
      return NextResponse.json(
        {
          error:
            'Não foi possível salvar a mídia no banco. Reinicie o servidor dev e confirme SUPABASE_SERVICE_ROLE_KEY no .env.local.',
        },
        { status: 500 }
      );
    }

    if (
      previousStorageUrl &&
      previousStorageUrl !== storageUrl &&
      parseR2StorageUrl(previousStorageUrl)?.key !== key
    ) {
      try {
        await deleteR2Object(previousStorageUrl, bucket);
      } catch (deleteError) {
        console.error('[exercises/media] delete previous object error:', deleteError);
      }
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

export async function DELETE(
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
  const kindRaw = request.nextUrl.searchParams.get('kind');
  if (kindRaw !== 'photo' && kindRaw !== 'video') {
    return NextResponse.json({ error: 'kind must be photo or video' }, { status: 400 });
  }
  const kind = kindRaw as MediaKind;

  console.info('[exercises/media] DELETE', { exerciseId, kind });

  const supabaseAdmin = getSupabaseAdmin();

  const { data: existing, error: fetchError } = await supabaseAdmin
    .from('exercises')
    .select('id, created_by, r2_photo_url, r2_video_url')
    .eq('id', exerciseId)
    .maybeSingle();

  if (fetchError) {
    console.error('[exercises/media] fetch error:', fetchError);
    return NextResponse.json({ error: 'Erro ao buscar exercício' }, { status: 500 });
  }
  if (!existing) {
    return NextResponse.json({ error: 'Exercício não encontrado' }, { status: 404 });
  }
  if (existing.created_by != null) {
    return NextResponse.json(
      { error: 'Apenas exercícios do sistema podem ser editados pelo backoffice' },
      { status: 403 }
    );
  }

  const storageUrl = kind === 'photo' ? existing.r2_photo_url : existing.r2_video_url;
  if (storageUrl) {
    try {
      await deleteR2Object(storageUrl, bucket);
    } catch (error) {
      console.error('[exercises/media] delete object error:', error);
    }
  }

  const field = kind === 'photo' ? 'r2_photo_url' : 'r2_video_url';
  const { data, error } = await supabaseAdmin
    .from('exercises')
    .update({
      [field]: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', exerciseId)
    .select('id, r2_photo_url, r2_video_url')
    .maybeSingle();

  if (error) {
    console.error('[exercises/media] db clear error:', error);
    return NextResponse.json({ error: 'Erro ao remover mídia do banco' }, { status: 500 });
  }
  if (!data) {
    console.error('[exercises/media] db clear matched 0 rows:', { exerciseId, kind });
    return NextResponse.json({ error: 'Erro ao remover mídia do banco' }, { status: 500 });
  }

  console.info('[exercises/media] DELETE success', { exerciseId, kind });
  return NextResponse.json({ success: true, kind, exercise: data });
}
