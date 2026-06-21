/**
 * Converte `r2://bucket/key` em URL pública usando R2_PUBLIC_BASE_URL (server-side)
 * ou NEXT_PUBLIC_R2_PUBLIC_BASE_URL (client-side).
 * Retorna null se não houver base configurada ou a URL não for r2://.
 */
export function r2StorageToPublicUrl(r2Url?: string | null): string | null {
  if (!r2Url?.trim()) return null
  const trimmed = r2Url.trim()

  // Já é HTTP — usa direto
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed

  if (!trimmed.startsWith('r2://')) return null

  const base =
    process.env.R2_PUBLIC_BASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_R2_PUBLIC_BASE_URL?.trim()

  if (!base) return null

  // Não expor endpoint privado do cloudflarestorage.com como URL pública
  if (base.includes('r2.cloudflarestorage.com')) return null

  const match = /^r2:\/\/[^/]+\/(.+)$/.exec(trimmed)
  if (!match) return null

  return `${base.replace(/\/$/, '')}/${match[1]}`
}

/** Resolve photo e video URL de um exercício, convertendo r2:// para HTTPS */
export function resolveExerciseMediaUrls<
  T extends { r2_photo_url?: string | null; r2_video_url?: string | null }
>(exercise: T): T {
  return {
    ...exercise,
    r2_photo_url: r2StorageToPublicUrl(exercise.r2_photo_url) ?? exercise.r2_photo_url,
    r2_video_url: r2StorageToPublicUrl(exercise.r2_video_url) ?? exercise.r2_video_url,
  }
}
