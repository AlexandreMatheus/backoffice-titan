/** Card da biblioteca mobile: 50% da largura × 130px de altura. */
export const LIBRARY_CARD_IMAGE_HEIGHT = 130;
export const LIBRARY_CARD_VIEWPORT_WIDTH = 390;

export function getLibraryShelfImageAspectRatio(
  viewportWidth = typeof window !== 'undefined' ? window.innerWidth : LIBRARY_CARD_VIEWPORT_WIDTH
): number {
  const cardWidth = viewportWidth * 0.5;
  return cardWidth / LIBRARY_CARD_IMAGE_HEIGHT;
}

export interface CropPixels {
  originX: number;
  originY: number;
  width: number;
  height: number;
}

interface HorizontalCoverParams {
  naturalWidth: number;
  naturalHeight: number;
  cropViewportWidth: number;
  cropViewportHeight: number;
  zoom: number;
  panX: number;
  panY: number;
}

export function computeHorizontalCoverCropPixels(params: HorizontalCoverParams): CropPixels {
  const { naturalWidth: nw, naturalHeight: nh, cropViewportWidth: vw, cropViewportHeight: vh, zoom, panX, panY } =
    params;

  if (!(nw > 0 && nh > 0 && vw > 0 && vh > 0)) {
    return { originX: 0, originY: 0, width: Math.round(nw) || 1, height: Math.round(nh) || 1 };
  }

  const baseScale = vw / nw;
  const dispW = nw * baseScale * zoom;
  const dispH = nh * baseScale * zoom;

  let tx = (vw - dispW) / 2 + panX;
  let ty = (vh - dispH) / 2 + panY;

  const minTx = vw - dispW;
  const maxTx = 0;
  const minTy = vh - dispH;
  const maxTy = 0;

  tx = Math.min(maxTx, Math.max(minTx, tx));
  ty = Math.min(maxTy, Math.max(minTy, ty));

  const leftNat = ((0 - tx) / dispW) * nw;
  const rightNat = ((vw - tx) / dispW) * nw;
  const topNat = ((0 - ty) / dispH) * nh;
  const bottomNat = ((vh - ty) / dispH) * nh;

  let originX = Math.floor(Math.min(leftNat, rightNat));
  let originY = Math.floor(Math.min(topNat, bottomNat));
  let width = Math.ceil(Math.abs(rightNat - leftNat));
  let height = Math.ceil(Math.abs(bottomNat - topNat));

  originX = Math.max(0, Math.min(originX, nw - 1));
  originY = Math.max(0, Math.min(originY, nh - 1));
  width = Math.min(width, nw - originX);
  height = Math.min(height, nh - originY);

  width = Math.max(1, width);
  height = Math.max(1, height);

  return { originX, originY, width, height };
}

export function minZoomHorizontalCover(
  naturalWidth: number,
  naturalHeight: number,
  cropViewportWidth: number,
  cropViewportHeight: number
): number {
  if (!(naturalWidth > 0 && naturalHeight > 0)) return 1;
  const baseH = (naturalHeight / naturalWidth) * cropViewportWidth;
  if (baseH + 1e-6 < cropViewportHeight) {
    return cropViewportHeight / baseH;
  }
  return 1;
}

export function panAfterZoomChange(
  oldZoom: number,
  newZoom: number,
  panX: number,
  panY: number
): { panX: number; panY: number } {
  if (oldZoom <= 0) return { panX, panY };
  const r = newZoom / oldZoom;
  return { panX: panX * r, panY: panY * r };
}

export function layoutPreview(
  nw: number,
  nh: number,
  cropW: number,
  cropH: number,
  zoom: number,
  panX: number,
  panY: number
) {
  const baseScale = cropW / nw;
  const dispW = nw * baseScale * zoom;
  const dispH = nh * baseScale * zoom;
  const tx = (cropW - dispW) / 2 + panX;
  const ty = (cropH - dispH) / 2 + panY;
  return { dispW, dispH, tx, ty };
}

/** Mantém a imagem dentro do viewport; centraliza quando menor que o recorte (letterbox). */
export function clampPanForViewport(
  naturalWidth: number,
  naturalHeight: number,
  cropViewportWidth: number,
  cropViewportHeight: number,
  zoom: number,
  panX: number,
  panY: number
): { panX: number; panY: number } {
  if (!(naturalWidth > 0 && naturalHeight > 0 && cropViewportWidth > 0 && cropViewportHeight > 0)) {
    return { panX, panY };
  }

  const { dispW, dispH } = layoutPreview(
    naturalWidth,
    naturalHeight,
    cropViewportWidth,
    cropViewportHeight,
    zoom,
    panX,
    panY
  );

  let tx = (cropViewportWidth - dispW) / 2 + panX;
  let ty = (cropViewportHeight - dispH) / 2 + panY;

  const minTx = cropViewportWidth - dispW;
  const maxTx = 0;
  const minTy = cropViewportHeight - dispH;
  const maxTy = 0;

  if (minTx > maxTx) {
    tx = (cropViewportWidth - dispW) / 2;
  } else {
    tx = Math.min(maxTx, Math.max(minTx, tx));
  }

  if (minTy > maxTy) {
    ty = (cropViewportHeight - dispH) / 2;
  } else {
    ty = Math.min(maxTy, Math.max(minTy, ty));
  }

  return {
    panX: tx - (cropViewportWidth - dispW) / 2,
    panY: ty - (cropViewportHeight - dispH) / 2,
  };
}

export function applyZoomChange(
  oldZoom: number,
  newZoom: number,
  panX: number,
  panY: number,
  naturalWidth: number,
  naturalHeight: number,
  cropViewportWidth: number,
  cropViewportHeight: number
): { zoom: number; panX: number; panY: number } {
  const scaled = panAfterZoomChange(oldZoom, newZoom, panX, panY);
  const clamped = clampPanForViewport(
    naturalWidth,
    naturalHeight,
    cropViewportWidth,
    cropViewportHeight,
    newZoom,
    scaled.panX,
    scaled.panY
  );
  return { zoom: newZoom, ...clamped };
}

export interface ExerciseCropExportParams {
  image: HTMLImageElement;
  naturalWidth: number;
  naturalHeight: number;
  cropViewportWidth: number;
  cropViewportHeight: number;
  zoom: number;
  panX: number;
  panY: number;
  targetLongEdge?: number;
}

export async function exportCompositedExerciseCropWeb(
  params: ExerciseCropExportParams
): Promise<Blob> {
  const {
    image,
    naturalWidth: nw,
    naturalHeight: nh,
    cropViewportWidth: cropW,
    cropViewportHeight: cropH,
    zoom,
    panX,
    panY,
    targetLongEdge = 1400,
  } = params;

  if (!(nw > 0 && nh > 0 && cropW > 0 && cropH > 0)) {
    throw new Error('Dimensões inválidas para export do crop.');
  }

  const { dispW, dispH, tx, ty } = layoutPreview(nw, nh, cropW, cropH, zoom, panX, panY);

  let scalePx = targetLongEdge / Math.max(cropW, cropH);
  const maxResize = 4096 / Math.max(dispW, dispH, 1);
  if (scalePx > maxResize) {
    scalePx = maxResize;
  }

  const OW = Math.max(1, Math.round(cropW * scalePx));
  const OH = Math.max(1, Math.round(cropH * scalePx));
  const IDW = Math.max(1, Math.round(dispW * scalePx));
  const IDH = Math.max(1, Math.round(dispH * scalePx));
  const OX = Math.round(tx * scalePx);
  const OY = Math.round(ty * scalePx);

  const resizedCanvas = document.createElement('canvas');
  resizedCanvas.width = IDW;
  resizedCanvas.height = IDH;
  const resizedCtx = resizedCanvas.getContext('2d');
  if (!resizedCtx) {
    throw new Error('Canvas não suportado');
  }
  resizedCtx.drawImage(image, 0, 0, IDW, IDH);

  const outCanvas = document.createElement('canvas');
  outCanvas.width = OW;
  outCanvas.height = OH;
  const outCtx = outCanvas.getContext('2d');
  if (!outCtx) {
    throw new Error('Canvas não suportado');
  }

  outCtx.fillStyle = '#ffffff';
  outCtx.fillRect(0, 0, OW, OH);
  outCtx.drawImage(resizedCanvas, OX, OY);

  return new Promise((resolve, reject) => {
    outCanvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Não foi possível gerar JPEG'));
          return;
        }
        resolve(blob);
      },
      'image/jpeg',
      0.92
    );
  });
}

export function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Não foi possível carregar a imagem'));
    img.src = src;
  });
}
