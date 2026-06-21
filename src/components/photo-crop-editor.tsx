'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, Check, X, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  exportCompositedExerciseCropWeb,
  getLibraryShelfImageAspectRatio,
  loadImageElement,
  minZoomHorizontalCover,
  panAfterZoomChange,
} from '@/lib/exercise-photo-crop-math';

const MIN_ZOOM = 0.15;
const MAX_ZOOM = 8;

interface PhotoCropEditorProps {
  open: boolean;
  photoSrc: string;
  onConfirm: (file: File) => void;
  onCancel: () => void;
  aspectRatio?: number;
}

export function PhotoCropEditor({
  open,
  photoSrc,
  onConfirm,
  onCancel,
  aspectRatio: aspectRatioProp,
}: PhotoCropEditorProps) {
  const aspectRatio = aspectRatioProp ?? getLibraryShelfImageAspectRatio(LIBRARY_PREVIEW_WIDTH);
  const [natural, setNatural] = useState({ w: 0, h: 0 });
  const [loadingMeta, setLoadingMeta] = useState(true);
  const [metaError, setMetaError] = useState<string | null>(null);
  const [imageReady, setImageReady] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [processing, setProcessing] = useState(false);
  const [cropSize, setCropSize] = useState({ w: 0, h: 0 });

  const imageRef = useRef<HTMLImageElement | null>(null);
  const zoomRef = useRef(1);
  const panRef = useRef({ x: 0, y: 0 });
  const dragStartRef = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);

  const recomputeCropFrame = useCallback(() => {
    const maxW = Math.min(window.innerWidth * 0.92, 420);
    const maxH = Math.min(window.innerHeight * 0.5, 280);
    let cw = maxW;
    let ch = cw / aspectRatio;
    if (ch > maxH) {
      ch = maxH;
      cw = ch * aspectRatio;
    }
    setCropSize({ w: Math.floor(cw), h: Math.floor(ch) });
  }, [aspectRatio]);

  useEffect(() => {
    if (!open) return;
    recomputeCropFrame();
    const onResize = () => recomputeCropFrame();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [open, recomputeCropFrame]);

  useEffect(() => {
    if (!open || !photoSrc) return;

    setLoadingMeta(true);
    setMetaError(null);
    setImageReady(false);
    setZoom(1);
    setPan({ x: 0, y: 0 });
    zoomRef.current = 1;
    panRef.current = { x: 0, y: 0 };

    let cancelled = false;
    void loadImageElement(photoSrc)
      .then((img) => {
        if (cancelled) return;
        imageRef.current = img;
        if (!(img.naturalWidth > 0 && img.naturalHeight > 0)) {
          setMetaError('Não foi possível ler o tamanho da imagem.');
          setNatural({ w: 0, h: 0 });
        } else {
          setNatural({ w: img.naturalWidth, h: img.naturalHeight });
        }
        setLoadingMeta(false);
      })
      .catch(() => {
        if (cancelled) return;
        setMetaError('Não foi possível carregar a imagem.');
        setNatural({ w: 0, h: 0 });
        setLoadingMeta(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, photoSrc]);

  const { w: cropW, h: cropH } = cropSize;
  const baseScale = cropW > 0 && natural.w > 0 ? cropW / natural.w : 0;
  const dispW = natural.w > 0 ? natural.w * baseScale * zoom : 0;
  const dispH = natural.h > 0 ? natural.h * baseScale * zoom : 0;
  const tx = cropW > 0 ? (cropW - dispW) / 2 + pan.x : 0;
  const ty = cropH > 0 ? (cropH - dispH) / 2 + pan.y : 0;

  const canEdit = !loadingMeta && !metaError && natural.w > 0 && cropW > 0 && imageReady;

  const handleReset = () => {
    zoomRef.current = 1;
    setZoom(1);
    setPan({ x: 0, y: 0 });
    panRef.current = { x: 0, y: 0 };
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (!canEdit || processing) return;
    e.preventDefault();
    const prevZ = zoomRef.current;
    const delta = e.deltaY > 0 ? 0.92 : 1.08;
    const newZ = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, prevZ * delta));
    const { panX, panY } = panAfterZoomChange(prevZ, newZ, panRef.current.x, panRef.current.y);
    zoomRef.current = newZ;
    panRef.current = { x: panX, y: panY };
    setZoom(newZ);
    setPan({ x: panX, y: panY });
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (!canEdit || processing) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      panX: panRef.current.x,
      panY: panRef.current.y,
    };
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragStartRef.current || !canEdit || processing) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    const nx = dragStartRef.current.panX + dx;
    const ny = dragStartRef.current.panY + dy;
    panRef.current = { x: nx, y: ny };
    setPan({ x: nx, y: ny });
  };

  const handlePointerUp = () => {
    dragStartRef.current = null;
  };

  const handleConfirm = async () => {
    if (!imageRef.current || natural.w <= 0 || cropW <= 0) return;
    setProcessing(true);
    try {
      const blob = await exportCompositedExerciseCropWeb({
        image: imageRef.current,
        naturalWidth: natural.w,
        naturalHeight: natural.h,
        cropViewportWidth: cropW,
        cropViewportHeight: cropH,
        zoom: zoomRef.current,
        panX: panRef.current.x,
        panY: panRef.current.y,
      });
      const file = new File([blob], `exercise-crop-${Date.now()}.jpg`, { type: 'image/jpeg' });
      onConfirm(file);
    } catch (error) {
      console.error('[PhotoCropEditor] crop failed:', error);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && !processing && onCancel()}>
      <DialogContent className="max-w-lg gap-4 p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle>Ajustar foto (card da biblioteca)</DialogTitle>
          <DialogDescription>
            Arraste para reposicionar e use a roda do mouse para zoom. A proporção segue o card do app.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-3">
          {loadingMeta && (
            <div className="flex h-48 flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin" />
              Carregando imagem…
            </div>
          )}

          {!loadingMeta && metaError && (
            <p className="text-sm text-destructive">{metaError}</p>
          )}

          {!loadingMeta && !metaError && natural.w > 0 && cropW > 0 && (
            <div
              className="relative touch-none select-none rounded-md bg-zinc-950 p-3"
              onWheel={handleWheel}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
            >
              <div
                className="relative overflow-hidden rounded-sm bg-white"
                style={{ width: cropW, height: cropH }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photoSrc}
                  alt="Recorte"
                  className="pointer-events-none absolute max-w-none"
                  style={{
                    left: tx,
                    top: ty,
                    width: dispW,
                    height: dispH,
                  }}
                  onLoad={() => setImageReady(true)}
                />
              </div>
              <div
                className="pointer-events-none absolute inset-3 rounded-sm ring-2 ring-orange-500"
                style={{ width: cropW, height: cropH }}
              />
            </div>
          )}

          <div className="flex w-full flex-wrap items-center justify-between gap-2">
            <Button type="button" variant="outline" size="sm" onClick={handleReset} disabled={!canEdit || processing}>
              <RotateCcw className="mr-1 h-4 w-4" />
              Resetar
            </Button>
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" onClick={onCancel} disabled={processing}>
                <X className="mr-1 h-4 w-4" />
                Cancelar
              </Button>
              <Button type="button" size="sm" onClick={() => void handleConfirm()} disabled={!canEdit || processing}>
                {processing ? (
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                ) : (
                  <Check className="mr-1 h-4 w-4" />
                )}
                Confirmar
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Largura de referência do card mobile (390px) para proporção fixa no backoffice. */
export const LIBRARY_PREVIEW_WIDTH = 390;
