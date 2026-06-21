'use client'

import React, { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/auth-context'
import { BackofficeShell } from '@/components/app-sidebar'
import { Loader2 } from 'lucide-react'
import { usePreventTrackpadBackNavigation } from '@/hooks/use-prevent-trackpad-back-navigation'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth()
  const router = useRouter()
  usePreventTrackpadBackNavigation()

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/login')
    }
  }, [isLoading, isAuthenticated, router])

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#09090b]">
        <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
      </div>
    )
  }

  if (!isAuthenticated) return null

  return <BackofficeShell>{children}</BackofficeShell>
}
