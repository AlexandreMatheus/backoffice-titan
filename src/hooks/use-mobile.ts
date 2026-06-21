'use client';

import { useEffect, useState } from 'react';

const MOBILE_QUERY = '(max-width: 767px)';

export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(MOBILE_QUERY);
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  return isMobile;
}

/** Escala do boneco muscular conforme largura da tela. */
export function useBodySvgScale(desktopScale = 0.38): number {
  const [scale, setScale] = useState(desktopScale);

  useEffect(() => {
    const update = () => {
      const w = window.innerWidth;
      if (w < 380) setScale(0.16);
      else if (w < 480) setScale(0.19);
      else if (w < 640) setScale(0.22);
      else if (w < 1024) setScale(0.28);
      else setScale(desktopScale);
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [desktopScale]);

  return scale;
}
