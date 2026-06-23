'use client';

import { Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface MediaUploadOverlayProps {
  label: string;
  progress: number;
  onCancel?: () => void;
}

export function MediaUploadOverlay({ label, progress, onCancel }: MediaUploadOverlayProps) {
  const clamped = Math.min(100, Math.max(0, progress));

  return (
    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-black/55 px-6">
      <Loader2 className="h-7 w-7 animate-spin text-white" />
      <p className="text-sm font-medium text-white">{label}</p>
      <div className="h-2 w-full max-w-xs overflow-hidden rounded-full bg-white/20">
        <div
          className="h-full rounded-full bg-orange-500 transition-[width] duration-200"
          style={{ width: `${clamped}%` }}
        />
      </div>
      <p className="text-xs text-white/80">{clamped}%</p>
      {onCancel ? (
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="mt-1 gap-1"
          onClick={onCancel}
        >
          <X className="h-4 w-4" />
          Cancelar envio
        </Button>
      ) : null}
    </div>
  );
}
