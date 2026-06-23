import { NextRequest, NextResponse } from 'next/server';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { extractTokenFromHeader, verifyAccessToken } from '@/lib/auth/jwt';
import { buildR2StorageUrl, buildUniqueExerciseR2Key } from '@/lib/exercise-r2-media';
import { z } from 'zod';

/** Parses `r2://bucket/key` → { bucket, key } */
function parseR2Url(value: string): { bucket: string; key: string } | null {
  const m = /^r2:\/\/([^/]+)\/(.+)$/.exec(value.trim());
  if (!m) return null;
  return { bucket: m[1], key: m[2] };
}

function getR2Client() {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  if (!accountId || !accessKeyId || !secretAccessKey) {
    console.error('[r2/signed-url] Missing env vars:', {
      R2_ACCOUNT_ID: !!accountId,
      R2_ACCESS_KEY_ID: !!accessKeyId,
      R2_SECRET_ACCESS_KEY: !!secretAccessKey,
    });
    throw new Error('Missing R2 configuration environment variables');
  }
  return new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });
}

const uploadSchema = z.object({
  action: z.literal('upload'),
  exerciseId: z.string().uuid(),
  kind: z.enum(['video', 'photo']),
  contentType: z.string().optional(),
});

const downloadSchema = z.object({
  action: z.literal('download'),
  storageUrl: z.string().startsWith('r2://'),
});

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const token = extractTokenFromHeader(authHeader);
  const payload = verifyAccessToken(token ?? undefined);
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const bucket = process.env.R2_BUCKET;
  if (!bucket) {
    console.error('[r2/signed-url] R2_BUCKET env var not set');
    return NextResponse.json({ error: 'R2_BUCKET not configured' }, { status: 500 });
  }

  const body = await request.json();
  const expiresIn = 60 * 60; // 1h

  try {
    const client = getR2Client();

    if (body.action === 'upload') {
      if (payload.userType !== 'admin') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      const parsed = uploadSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: 'Validation error' }, { status: 400 });
      }
      const { exerciseId, kind, contentType } = parsed.data;
      const ext =
        contentType?.includes('png') ? 'png'
        : contentType?.includes('webp') ? 'webp'
        : contentType?.includes('gif') ? 'gif'
        : contentType?.includes('webm') ? 'webm'
        : contentType?.includes('quicktime') ? 'mov'
        : kind === 'video' ? 'mp4' : 'jpg';
      const key = buildUniqueExerciseR2Key(exerciseId, kind, ext);
      const command = new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        ...(contentType ? { ContentType: contentType } : {}),
      });
      const url = await getSignedUrl(client, command, { expiresIn });
      console.info('[r2/signed-url] upload url generated', { exerciseId, kind, key });
      return NextResponse.json({
        url,
        key,
        storageUrl: buildR2StorageUrl(bucket, key),
        expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
      });
    }

    if (body.action === 'download') {
      const parsed = downloadSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: 'Validation error' }, { status: 400 });
      }
      const r2 = parseR2Url(parsed.data.storageUrl);
      if (!r2) return NextResponse.json({ error: 'Invalid storageUrl' }, { status: 400 });

      const command = new GetObjectCommand({ Bucket: r2.bucket, Key: r2.key });
      const url = await getSignedUrl(client, command, { expiresIn });
      return NextResponse.json({
        url,
        key: r2.key,
        expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
      });
    }

    return NextResponse.json({ error: 'action must be upload or download' }, { status: 400 });
  } catch (error) {
    console.error('R2 signed URL error:', error);
    return NextResponse.json({ error: 'Erro ao gerar URL assinada' }, { status: 500 });
  }
}
