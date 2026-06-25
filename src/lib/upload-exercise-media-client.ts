import type { MediaKind } from '@/lib/media-validation';
import {
  EXERCISE_MEDIA_MAX_UPLOAD_BYTES,
  EXERCISE_MEDIA_MAX_UPLOAD_LABEL,
} from '@/lib/exercise-media-upload-limits';

export type UploadProgressHandler = (percent: number) => void;

function uploadViaServer(
  exerciseId: string,
  file: File,
  kind: MediaKind,
  accessToken: string,
  onProgress?: UploadProgressHandler,
  signal?: AbortSignal
): Promise<{ storageUrl: string; exercise?: { r2_photo_url?: string | null; r2_video_url?: string | null } }> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Upload cancelado', 'AbortError'));
      return;
    }

    const formData = new FormData();
    formData.append('kind', kind);
    formData.append('file', file);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', `/api/exercises/${exerciseId}/media`);
    xhr.setRequestHeader('Authorization', `Bearer ${accessToken}`);

    const onAbort = () => xhr.abort();
    signal?.addEventListener('abort', onAbort, { once: true });

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };

    xhr.onload = () => {
      signal?.removeEventListener('abort', onAbort);
      let data: {
        error?: string;
        storageUrl?: string;
        exercise?: { r2_photo_url?: string | null; r2_video_url?: string | null };
      } = {};
      try {
        data = JSON.parse(xhr.responseText || '{}') as typeof data;
      } catch {
        /* ignore */
      }

      if (xhr.status >= 200 && xhr.status < 300 && data.storageUrl) {
        resolve({
          storageUrl: data.storageUrl,
          exercise: data.exercise,
        });
        return;
      }

      reject(
        new Error(
          data.error ??
            (xhr.status === 413
              ? `Arquivo grande demais (máx. ${EXERCISE_MEDIA_MAX_UPLOAD_LABEL} pelo servidor)`
              : `Falha no upload (HTTP ${xhr.status})`)
        )
      );
    };

    xhr.onerror = () => {
      signal?.removeEventListener('abort', onAbort);
      reject(new Error('Falha de rede ao enviar mídia ao servidor'));
    };

    xhr.onabort = () => {
      signal?.removeEventListener('abort', onAbort);
      reject(new DOMException('Upload cancelado', 'AbortError'));
    };

    xhr.send(formData);
  });
}

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

    const onAbort = () => xhr.abort();
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
      reject(
        new Error(
          'Falha de rede no upload R2. Verifique CORS do bucket ou use arquivo menor que ' +
            EXERCISE_MEDIA_MAX_UPLOAD_LABEL +
            '.'
        )
      );
    };

    xhr.onabort = () => {
      signal?.removeEventListener('abort', onAbort);
      reject(new DOMException('Upload cancelado', 'AbortError'));
    };

    xhr.send(file);
  });
}

async function uploadViaPresigned(params: {
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
    throw new Error(registerData.error ?? `Erro ao salvar mídia (HTTP ${registerRes.status})`);
  }

  params.onProgress?.(100);
  return {
    storageUrl: registerData.storageUrl ?? signedData.storageUrl,
    exercise: registerData.exercise,
  };
}

export async function uploadExerciseMediaViaPresigned(params: {
  exerciseId: string;
  file: File;
  kind: MediaKind;
  accessToken: string;
  onProgress?: UploadProgressHandler;
  signal?: AbortSignal;
}): Promise<{ storageUrl: string; exercise?: { r2_photo_url?: string | null; r2_video_url?: string | null } }> {
  console.info('[uploadExerciseMedia] start', {
    exerciseId: params.exerciseId,
    kind: params.kind,
    bytes: params.file.size,
    contentType: params.file.type,
    via: params.file.size <= EXERCISE_MEDIA_MAX_UPLOAD_BYTES ? 'server' : 'presigned',
  });

  if (params.file.size <= EXERCISE_MEDIA_MAX_UPLOAD_BYTES) {
    const result = await uploadViaServer(
      params.exerciseId,
      params.file,
      params.kind,
      params.accessToken,
      params.onProgress,
      params.signal
    );
    console.info('[uploadExerciseMedia] complete (server)', {
      exerciseId: params.exerciseId,
      kind: params.kind,
      storageUrl: result.storageUrl,
    });
    return result;
  }

  const result = await uploadViaPresigned(params);
  console.info('[uploadExerciseMedia] complete (presigned)', {
    exerciseId: params.exerciseId,
    kind: params.kind,
    storageUrl: result.storageUrl,
  });
  return result;
}
