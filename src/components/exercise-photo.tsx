'use client';

import Image from 'next/image';
import { ImageIcon } from 'lucide-react';
import { useR2Photo } from '@/hooks/use-r2-photo';
import { cn } from '@/lib/utils';

interface ExercisePhotoProps {
  r2PhotoUrl?: string | null;
  name: string;
  className?: string;
  fill?: boolean;
  width?: number;
  height?: number;
}

export function ExercisePhoto({ r2PhotoUrl, name, className, fill, width = 40, height = 40 }: ExercisePhotoProps) {
  const { resolvedUrl, loading } = useR2Photo(r2PhotoUrl);

  if (loading) {
    return (
      <div className={cn('flex items-center justify-center bg-muted animate-pulse', className)} />
    );
  }

  if (!resolvedUrl) {
    return (
      <div className={cn('flex items-center justify-center bg-muted', className)}>
        <ImageIcon className="h-4 w-4 text-muted-foreground/40" />
      </div>
    );
  }

  if (fill) {
    return (
      <Image
        src={resolvedUrl}
        alt={name}
        fill
        className={cn('object-cover', className)}
        unoptimized
      />
    );
  }

  return (
    <Image
      src={resolvedUrl}
      alt={name}
      width={width}
      height={height}
      className={cn('h-full w-full object-cover', className)}
      unoptimized
    />
  );
}
