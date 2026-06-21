'use client'

import { useEffect } from 'react'

export function usePreventTrackpadBackNavigation() {
  useEffect(() => {
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaX) < Math.abs(e.deltaY)) return
      if (Math.abs(e.deltaX) > 0) {
        e.preventDefault()
      }
    }
    document.addEventListener('wheel', onWheel, { passive: false })
    return () => document.removeEventListener('wheel', onWheel)
  }, [])
}
