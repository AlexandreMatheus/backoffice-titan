import crypto from 'crypto';
import type { MediaKind } from '@/lib/media-validation';

export function parseR2StorageUrl(value: string): { bucket: string; key: string } | null {
  const match = /^r2:\/\/([^/]+)\/(.+)$/.exec(value.trim());
  if (!match) return null;
  return { bucket: match[1], key: match[2] };
}

export function buildR2StorageUrl(bucket: string, key: string): string {
  return `r2://${bucket}/${key}`;
}

/** Nome único por upload — substituir mídia apaga a anterior e evita cache na URL. */
export function buildUniqueExerciseR2Key(
  exerciseId: string,
  kind: MediaKind,
  ext: string
): string {
  const normalizedExt = ext.replace(/^\./, '').trim() || (kind === 'video' ? 'mp4' : 'jpg');
  const suffix = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
  return `exercises/${exerciseId}/r2/${kind}-${suffix}.${normalizedExt}`;
}

/** Aceita chaves legadas (`video.mp4`) e novas (`video-{ts}-{rand}.mp4`). */
export function isExerciseR2KeyForKind(
  exerciseId: string,
  kind: MediaKind,
  key: string
): boolean {
  const prefix = `exercises/${exerciseId}/r2/${kind}`;
  return key === prefix || key.startsWith(`${prefix}-`) || key.startsWith(`${prefix}.`);
}
