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
  layoutPreview,
  loadImageElement,
  panAfterZoomChange,
} from '@/lib/exercise-photo-crop-math';

const MIN_ZOOM = 0.15;
const MAX_ZOOM = 8;

type PointerPoint = { x: number; y: number };

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
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const zoomRef = useRef(1);
  const panRef = useRef({ x: 0, y: 0 });
  const naturalRef = useRef(natural);
  const cropSizeRef = useRef(cropSize);
  const dragStartRef = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);
  const activePointersRef = useRef(new Map<number, PointerPoint>());
  const pinchStartRef = useRef<{
    distance: number;
    zoom: number;
    panX: number;
    panY: number;
  } | null>(null);

  naturalRef.current = natural;
  cropSizeRef.current = cropSize;

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
    activePointersRef.current.clear();
    dragStartRef.current = null;
    pinchStartRef.current = null;

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
          setImageReady(true);
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
  const canEdit = !loadingMeta && !metaError && natural.w > 0 && cropW > 0 && imageReady;

  const paintPreview = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imageRef.current;
    const nw = naturalRef.current.w;
    const nh = naturalRef.current.h;
    const cw = cropSizeRef.current.w;
    const ch = cropSizeRef.current.h;
    if (!canvas || !img || !(nw > 0 && cw > 0)) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const z = zoomRef.current;
    const px = panRef.current.x;
    const py = panRef.current.y;
    const { dispW, dispH, tx, ty } = layoutPreview(nw, nh, cw, ch, z, px, py);

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, cw, ch);
    ctx.drawImage(img, tx, ty, dispW, dispH);
  }, []);

  useEffect(() => {
    if (!canEdit) return;
    paintPreview();
  }, [canEdit, zoom, pan, cropW, cropH, paintPreview]);

  const commitZoomPan = useCallback((nextZoom: number, nextPanX: number, nextPanY: number) => {
    zoomRef.current = nextZoom;
    panRef.current = { x: nextPanX, y: nextPanY };
    setZoom(nextZoom);
    setPan({ x: nextPanX, y: nextPanY });
  }, []);

  const handleReset = () => {
    commitZoomPan(1, 0, 0);
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (!canEdit || processing) return;
    e.preventDefault();
    e.stopPropagation();

    const prevZ = zoomRef.current;
    const factor = e.deltaY > 0 ? 0.92 : 1.08;
    const newZ = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, prevZ * factor));
    const next = panAfterZoomChange(prevZ, newZ, panRef.current.x, panRef.current.y);
    commitZoomPan(newZ, next.panX, next.panY);
  };

  const getPinchDistance = () => {
    const points = Array.from(activePointersRef.current.values());
    if (points.length < 2) return 0;
    const [a, b] = points;
    return Math.hypot(a.x - b.x, a.y - b.y);
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (!canEdit || processing) return;
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    activePointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (activePointersRef.current.size >= 2) {
      dragStartRef.current = null;
      pinchStartRef.current = {
        distance: Math.max(1, getPinchDistance()),
        zoom: zoomRef.current,
        panX: panRef.current.x,
        panY: panRef.current.y,
      };
      return;
    }

    pinchStartRef.current = null;
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      panX: panRef.current.x,
      panY: panRef.current.y,
    };
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!canEdit || processing) return;
    e.preventDefault();
    e.stopPropagation();

    if (activePointersRef.current.has(e.pointerId)) {
      activePointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    }

    if (activePointersRef.current.size >= 2 && pinchStartRef.current) {
      const distance = Math.max(1, getPinchDistance());
      const scale = distance / pinchStartRef.current.distance;
      const prevZ = zoomRef.current;
      const newZ = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, pinchStartRef.current.zoom * scale));
      const next = panAfterZoomChange(prevZ, newZ, panRef.current.x, panRef.current.y);
      commitZoomPan(newZ, next.panX, next.panY);
      return;
    }

    if (!dragStartRef.current) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    const nextPan = {
      x: dragStartRef.current.panX + dx,
      y: dragStartRef.current.panY + dy,
    };
    panRef.current = nextPan;
    setPan(nextPan);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    activePointersRef.current.delete(e.pointerId);
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* pointer capture may already be released */
    }

    pinchStartRef.current = null;

    const remaining = Array.from(activePointersRef.current.values())[0];
    if (remaining) {
      dragStartRef.current = {
        x: remaining.x,
        y: remaining.y,
        panX: panRef.current.x,
        panY: panRef.current.y,
      };
      return;
    }

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
                <canvas
                  ref={canvasRef}
                  width={cropW}
                  height={cropH}
                  className="block"
                  style={{ width: cropW, height: cropH }}
                />
                <div className="pointer-events-none absolute inset-0">
                  <div className="absolute left-1/3 top-0 h-full w-px bg-orange-500/35" />
                  <div className="absolute left-2/3 top-0 h-full w-px bg-orange-500/35" />
                  <div className="absolute top-1/3 left-0 h-px w-full bg-orange-500/35" />
                  <div className="absolute top-2/3 left-0 h-px w-full bg-orange-500/35" />
                </div>
              </div>
              <div
                className="pointer-events-none absolute inset-3 rounded-sm ring-2 ring-orange-500"
                style={{ width: cropW, height: cropH }}
              />
            </div>
          )}

          {canEdit && (
            <p className="text-sm font-semibold text-muted-foreground">{Math.round(zoom * 100)}%</p>
          )}

          <div className="flex w-full flex-wrap items-center justify-between gap-2">
            <Button type="button" variant="outline" size="sm" onClick={handleReset} disabled={!canEdit || processing}>
              <RotateCcw className="mr-1 h-4 w-4" />
              Centralizar
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
