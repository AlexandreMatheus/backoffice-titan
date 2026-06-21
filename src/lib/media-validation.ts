const PHOTO_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/heic',
  'image/heif',
]);

const VIDEO_MIME_TYPES = new Set([
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'video/x-msvideo',
]);

const PHOTO_EXT = /\.(jpe?g|png|webp|gif|heic|heif)$/i;
const VIDEO_EXT = /\.(mp4|webm|mov|m4v)$/i;

export type MediaKind = 'photo' | 'video';

export function inferMediaExtension(contentType: string, kind: MediaKind): string {
  const t = contentType.toLowerCase();
  if (kind === 'photo') {
    if (t.includes('png')) return 'png';
    if (t.includes('webp')) return 'webp';
    if (t.includes('gif')) return 'gif';
    if (t.includes('heic')) return 'heic';
    if (t.includes('heif')) return 'heif';
    return 'jpg';
  }
  if (t.includes('webm')) return 'webm';
  if (t.includes('quicktime')) return 'mov';
  return 'mp4';
}

export function validateMediaFile(file: File, kind: MediaKind): string | null {
  const mime = (file.type || '').toLowerCase().trim();
  const name = file.name || '';

  if (kind === 'photo') {
    if (mime && !mime.startsWith('image/')) {
      return 'Selecione apenas arquivos de imagem (JPG, PNG, WEBP ou GIF).';
    }
    if (mime && !PHOTO_MIME_TYPES.has(mime)) {
      return 'Formato de imagem não suportado. Use JPG, PNG, WEBP ou GIF.';
    }
    if (!mime && !PHOTO_EXT.test(name)) {
      return 'Selecione apenas arquivos de imagem.';
    }
    return null;
  }

  if (mime && !mime.startsWith('video/')) {
    return 'Selecione apenas arquivos de vídeo (MP4, WEBM ou MOV).';
  }
  if (mime && !VIDEO_MIME_TYPES.has(mime)) {
    return 'Formato de vídeo não suportado. Use MP4, WEBM ou MOV.';
  }
  if (!mime && !VIDEO_EXT.test(name)) {
    return 'Selecione apenas arquivos de vídeo.';
  }
  return null;
}

export function isAllowedPhotoMime(contentType: string): boolean {
  const mime = contentType.toLowerCase().trim();
  return mime.startsWith('image/') && PHOTO_MIME_TYPES.has(mime);
}

export function isAllowedVideoMime(contentType: string): boolean {
  const mime = contentType.toLowerCase().trim();
  return mime.startsWith('video/') && VIDEO_MIME_TYPES.has(mime);
}

export const PHOTO_INPUT_ACCEPT =
  'image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif,.jpg,.jpeg,.png,.webp,.gif,.heic,.heif';

export const VIDEO_INPUT_ACCEPT = 'video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov,.m4v';

export function resolveMediaContentType(file: File, kind: MediaKind): string | null {
  const mime = (file.type || '').toLowerCase().trim();
  if (mime) return mime;

  const name = (file.name || '').toLowerCase();
  if (kind === 'photo') {
    if (name.endsWith('.png')) return 'image/png';
    if (name.endsWith('.webp')) return 'image/webp';
    if (name.endsWith('.gif')) return 'image/gif';
    if (name.endsWith('.heic')) return 'image/heic';
    if (name.endsWith('.heif')) return 'image/heif';
    if (PHOTO_EXT.test(name)) return 'image/jpeg';
    return null;
  }

  if (name.endsWith('.webm')) return 'video/webm';
  if (name.endsWith('.mov')) return 'video/quicktime';
  if (VIDEO_EXT.test(name)) return 'video/mp4';
  return null;
}
