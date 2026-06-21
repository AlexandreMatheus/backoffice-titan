'use client';

import { useEffect, useState } from 'react';

// Cache simples em memória para evitar requisições repetidas durante a sessão
const cache = new Map<string, { url: string; expiresAt: number }>();

function getCached(storageUrl: string): string | null {
  const entry = cache.get(storageUrl);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt - 60_000) {
    cache.delete(storageUrl);
    return null;
  }
  return entry.url;
}

function setCached(storageUrl: string, url: string, expiresAt: string) {
  cache.set(storageUrl, { url, expiresAt: new Date(expiresAt).getTime() });
}

/**
 * Resolve um `r2://bucket/key` para URL assinada (HTTPS) via /api/r2/signed-url.
 * Retorna null se não houver URL ou enquanto carrega.
 */
export function useR2Photo(r2PhotoUrl: string | null | undefined) {
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!r2PhotoUrl?.startsWith('r2://')) {
      // Já é HTTPS ou vazio
      setResolvedUrl(r2PhotoUrl?.startsWith('http') ? r2PhotoUrl : null);
      return;
    }

    const cached = getCached(r2PhotoUrl);
    if (cached) {
      setResolvedUrl(cached);
      return;
    }

    let cancelled = false;
    setLoading(true);

    const token = typeof window !== 'undefined' ? localStorage.getItem('atlas_bo_access_token') : null;

    fetch('/api/r2/signed-url', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ action: 'download', storageUrl: r2PhotoUrl }),
    })
      .then((res) => res.json())
      .then((data: { url?: string; expiresAt?: string }) => {
        if (cancelled) return;
        if (data.url && data.expiresAt) {
          setCached(r2PhotoUrl, data.url, data.expiresAt);
          setResolvedUrl(data.url);
        }
      })
      .catch(() => {
        if (!cancelled) setResolvedUrl(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [r2PhotoUrl]);

  return { resolvedUrl, loading };
}
