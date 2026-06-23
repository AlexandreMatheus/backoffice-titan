import type { MediaKind } from '@/lib/media-validation';

export type UploadProgressHandler = (percent: number) => void;

function putFileWithProgress(
  url: string,
  file: File,
  contentType: string,
  onProgress?: UploadProgressHandler,
  signal?: AbortSignal
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Upload cancelado', 'AbortError'));
      return;
    }

    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    xhr.setRequestHeader('Content-Type', contentType);

    const onAbort = () => {
      xhr.abort();
    };
    signal?.addEventListener('abort', onAbort, { once: true });

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };

    xhr.onload = () => {
      signal?.removeEventListener('abort', onAbort);
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
        return;
      }
      reject(new Error(`Falha no upload R2 (HTTP ${xhr.status})`));
    };

    xhr.onerror = () => {
      signal?.removeEventListener('abort', onAbort);
      reject(new Error('Falha de rede no upload R2'));
    };

    xhr.onabort = () => {
      signal?.removeEventListener('abort', onAbort);
      reject(new DOMException('Upload cancelado', 'AbortError'));
    };

    xhr.send(file);
  });
}

export async function uploadExerciseMediaViaPresigned(params: {
  exerciseId: string;
  file: File;
  kind: MediaKind;
  accessToken: string;
  onProgress?: UploadProgressHandler;
  signal?: AbortSignal;
}): Promise<{ storageUrl: string; exercise?: { r2_photo_url?: string | null; r2_video_url?: string | null } }> {
  const contentType =
    params.file.type ||
    (params.kind === 'video' ? 'video/mp4' : 'image/jpeg');

  console.info('[uploadExerciseMedia] start', {
    exerciseId: params.exerciseId,
    kind: params.kind,
    bytes: params.file.size,
    contentType,
  });

  const signedRes = await fetch('/api/r2/signed-url', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${params.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      action: 'upload',
      exerciseId: params.exerciseId,
      kind: params.kind,
      contentType,
    }),
    signal: params.signal,
  });

  const signedData = (await signedRes.json().catch(() => ({}))) as {
    error?: string;
    url?: string;
    storageUrl?: string;
    key?: string;
  };

  if (!signedRes.ok) {
    console.error('[uploadExerciseMedia] signed-url failed', {
      status: signedRes.status,
      error: signedData.error,
    });
    throw new Error(signedData.error ?? `Erro ao preparar upload (HTTP ${signedRes.status})`);
  }

  if (!signedData.url || !signedData.storageUrl) {
    throw new Error('Resposta de upload incompleta (URL assinada ausente)');
  }

  params.onProgress?.(5);
  await putFileWithProgress(
    signedData.url,
    params.file,
    contentType,
    (pct) => params.onProgress?.(5 + Math.round(pct * 0.85)),
    params.signal
  );

  params.onProgress?.(92);

  const registerRes = await fetch(`/api/exercises/${params.exerciseId}/media`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${params.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      kind: params.kind,
      storageUrl: signedData.storageUrl,
      key: signedData.key,
    }),
    signal: params.signal,
  });

  const registerData = (await registerRes.json().catch(() => ({}))) as {
    error?: string;
    storageUrl?: string;
    exercise?: { r2_photo_url?: string | null; r2_video_url?: string | null };
  };

  if (!registerRes.ok) {
    console.error('[uploadExerciseMedia] register failed', {
      status: registerRes.status,
      error: registerData.error,
    });
    throw new Error(registerData.error ?? `Erro ao salvar mídia (HTTP ${registerRes.status})`);
  }

  params.onProgress?.(100);
  console.info('[uploadExerciseMedia] complete', {
    exerciseId: params.exerciseId,
    kind: params.kind,
    storageUrl: registerData.storageUrl ?? signedData.storageUrl,
  });

  return {
    storageUrl: registerData.storageUrl ?? signedData.storageUrl,
    exercise: registerData.exercise,
  };
}
