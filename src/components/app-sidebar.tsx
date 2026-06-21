'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  Flame,
  LayoutDashboard,
  Dumbbell,
  LogOut,
  PanelLeftClose,
  PanelLeft,
  ShieldCheck,
  UserCheck,
  Menu,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { useAuth } from '@/contexts/auth-context'
import { useIsMobile } from '@/hooks/use-mobile'
import { cn } from '@/lib/utils'

type NavItem = { title: string; href: string; icon: React.ElementType; section: 'main' | 'tools' }

const NAV: NavItem[] = [
  { title: 'Dashboard',   href: '/dashboard',            icon: LayoutDashboard, section: 'main' },
  { title: 'Personais',   href: '/dashboard/personals',  icon: UserCheck,       section: 'main' },
  { title: 'Exercícios',  href: '/dashboard/exercises',  icon: Dumbbell,        section: 'main' },
]

const COLLAPSED_KEY = 'atlas-bo-nav-collapsed'

function pageTitle(pathname: string | null) {
  return NAV.find(n => pathname === n.href || pathname?.startsWith(n.href + '/'))?.title ?? 'Backoffice'
}

/* ─── Sidebar ─────────────────────────────────────────────────────────────── */
export function AppSidebar() {
  const pathname  = usePathname()
  const router    = useRouter()
  const { user, logout } = useAuth()

  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    try { return localStorage.getItem(COLLAPSED_KEY) === '1' } catch { return false }
  })

  const toggle = useCallback(() => {
    setCollapsed(c => {
      const next = !c
      try { localStorage.setItem(COLLAPSED_KEY, next ? '1' : '0') } catch { /**/ }
      return next
    })
  }, [])

  const isActive = (href: string) =>
    pathname === href || (href !== '/dashboard' && pathname?.startsWith(href + '/'))

  const initials =
    user?.full_name?.split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 2) ||
    user?.email?.slice(0, 2).toUpperCase() || 'BO'

  const title    = pageTitle(pathname)
  const dateLabel = format(new Date(), "EEEE, d 'de' MMMM yyyy", { locale: ptBR })

  const navSection = (label: string, section: 'main' | 'tools') => (
    <div key={label} className="space-y-1">
      {!collapsed && (
        <p className="px-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
          {label}
        </p>
      )}
      {NAV.filter(i => i.section === section).map(item => {
        const Icon = item.icon
        const active = isActive(item.href)
        return (
          <Link
            key={item.href}
            href={item.href}
            title={collapsed ? item.title : undefined}
            className={cn(
              'flex items-center rounded-xl py-2 text-sm transition-colors',
              collapsed ? 'justify-center px-0' : 'gap-2.5 px-2.5',
              active
                ? 'bg-orange-500/15 text-orange-100 ring-1 ring-orange-500/35'
                : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100'
            )}
          >
            <Icon className={cn('h-4 w-4 flex-shrink-0', active ? 'text-orange-400' : '')} />
            {!collapsed && <span className="truncate">{item.title}</span>}
          </Link>
        )
      })}
    </div>
  )

  return (
    <div className="flex h-dvh max-h-dvh min-h-0 w-full overflow-hidden bg-zinc-50 text-zinc-900 dark:bg-[#09090b] dark:text-zinc-100">
      {/* ── Sidebar ── */}
      <aside className={cn(
        'flex h-full min-h-0 flex-shrink-0 flex-col border-r border-zinc-800/90 bg-[#0c0c0f] transition-[width] duration-200',
        collapsed ? 'w-[72px] max-w-[72px]' : 'w-[248px] max-w-[248px]'
      )}>
        {/* Brand */}
        <div className={cn(
          'flex flex-shrink-0 items-center gap-2 border-b border-zinc-800/80 py-4',
          collapsed ? 'flex-col px-2' : 'px-4'
        )}>
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-orange-500/15 ring-1 ring-orange-500/40">
            <Flame className="h-5 w-5 text-orange-500" />
          </div>
          {!collapsed && (
            <div className="min-w-0 flex-1 leading-tight">
              <p className="text-[11px] font-bold uppercase tracking-wide text-zinc-100">
                Atlas <span className="text-orange-500">Backoffice</span>
              </p>
              <p className="text-[9px] text-zinc-500">Painel interno 2.0</p>
            </div>
          )}
          <Button
            type="button" variant="ghost" size="icon"
            className={cn('h-8 w-8 flex-shrink-0 text-zinc-500 hover:text-zinc-200', collapsed && 'mt-1')}
            title={collapsed ? 'Expandir' : 'Recolher'}
            onClick={toggle}
          >
            {collapsed ? <PanelLeft className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </Button>
        </div>

        {/* Nav */}
        <nav className={cn(
          'min-h-0 flex-1 space-y-5 overflow-y-auto overflow-x-hidden overscroll-contain py-4',
          collapsed ? 'px-1.5' : 'px-2'
        )}>
          {navSection('Principal', 'main')}
          {navSection('Ferramentas', 'tools')}
        </nav>

        {/* User */}
        <div className={cn('flex-shrink-0 border-t border-zinc-800/80', collapsed ? 'p-2' : 'p-3')}>
          <div className={cn(
            'flex items-center gap-2 rounded-xl border border-zinc-800/80 bg-zinc-950/60 py-2',
            collapsed ? 'flex-col px-1' : 'px-2'
          )}>
            <Avatar className="h-9 w-9 flex-shrink-0">
              <AvatarFallback className="bg-orange-500/20 text-[11px] font-semibold text-orange-200">
                {initials}
              </AvatarFallback>
            </Avatar>
            {!collapsed && (
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-zinc-200">
                  {user?.full_name || user?.email?.split('@')[0]}
                </p>
                <p className="flex items-center gap-1 truncate text-[10px] text-zinc-500">
                  <ShieldCheck className="h-2.5 w-2.5 text-orange-500" />
                  Administrador
                </p>
              </div>
            )}
            <Button
              type="button" variant="ghost" size="icon"
              className="h-8 w-8 flex-shrink-0 text-zinc-500 hover:text-zinc-200"
              title="Sair"
              onClick={async () => { await logout(); router.push('/login') }}
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </aside>

      {/* ── Main area (header + slot) ── */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col" id="bo-main-area">
        <header className="flex h-[52px] max-h-[52px] flex-shrink-0 items-center border-b border-zinc-800/80 bg-[#09090b]/95 px-5 backdrop-blur">
          <div>
            <h1 className="text-sm font-semibold capitalize text-zinc-100">{title}</h1>
            <p className="text-[11px] text-zinc-500 first-letter:uppercase">{dateLabel}</p>
          </div>
        </header>
        <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto bg-[#09090b]" id="bo-main-content">
          {/* children injected by layout */}
        </main>
      </div>
    </div>
  )
}

/* ─── Shell (wraps sidebar + children) ───────────────────────────────────── */
export function BackofficeShell({ children }: { children: React.ReactNode }) {
  const pathname  = usePathname()
  const router    = useRouter()
  const { user, logout } = useAuth()
  const isMobile = useIsMobile()

  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    try { return localStorage.getItem(COLLAPSED_KEY) === '1' } catch { return false }
  })
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  useEffect(() => {
    setMobileNavOpen(false)
  }, [pathname])

  useEffect(() => {
    if (isMobile) setMobileNavOpen(false)
  }, [isMobile])

  const toggle = useCallback(() => {
    setCollapsed(c => {
      const next = !c
      try { localStorage.setItem(COLLAPSED_KEY, next ? '1' : '0') } catch { /**/ }
      return next
    })
  }, [])

  const isActive = (href: string) =>
    pathname === href || (href !== '/dashboard' && pathname?.startsWith(href + '/'))

  const initials =
    user?.full_name?.split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 2) ||
    user?.email?.slice(0, 2).toUpperCase() || 'BO'

  const title    = pageTitle(pathname)
  const dateLabel = format(new Date(), "EEEE, d 'de' MMMM yyyy", { locale: ptBR })
  const sidebarExpanded = isMobile ? true : !collapsed

  const navSection = (label: string, section: 'main' | 'tools') => (
    <div key={label} className="space-y-1">
      {sidebarExpanded && (
        <p className="px-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
          {label}
        </p>
      )}
      {NAV.filter(i => i.section === section).map(item => {
        const Icon = item.icon
        const active = isActive(item.href)
        return (
          <Link
            key={item.href}
            href={item.href}
            title={!sidebarExpanded ? item.title : undefined}
            onClick={() => {
              if (isMobile) setMobileNavOpen(false)
            }}
            className={cn(
              'flex items-center rounded-xl py-2 text-sm transition-colors',
              sidebarExpanded ? 'gap-2.5 px-2.5' : 'justify-center px-0',
              active
                ? 'bg-orange-500/15 text-orange-100 ring-1 ring-orange-500/35'
                : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100'
            )}
          >
            <Icon className={cn('h-4 w-4 flex-shrink-0', active ? 'text-orange-400' : '')} />
            {sidebarExpanded && <span className="truncate">{item.title}</span>}
          </Link>
        )
      })}
    </div>
  )

  return (
    <div className="flex h-dvh max-h-dvh min-h-0 w-full overflow-hidden bg-[#09090b] text-zinc-100">
      {isMobile && mobileNavOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-[1px]"
          aria-label="Fechar menu"
          onClick={() => setMobileNavOpen(false)}
        />
      ) : null}

      {/* Sidebar — drawer no mobile, coluna fixa no desktop */}
      <aside
        className={cn(
          'flex h-full min-h-0 flex-shrink-0 flex-col border-r border-zinc-800/90 bg-[#0c0c0f] transition-[width,transform] duration-200',
          isMobile
            ? cn(
                'fixed inset-y-0 left-0 z-50 w-[min(280px,88vw)] max-w-[280px] shadow-2xl',
                mobileNavOpen ? 'translate-x-0' : '-translate-x-full pointer-events-none'
              )
            : collapsed
              ? 'w-[72px] max-w-[72px]'
              : 'w-[248px] max-w-[248px]'
        )}
      >
        <div className={cn(
          'flex flex-shrink-0 items-center gap-2 border-b border-zinc-800/80 py-4',
          sidebarExpanded ? 'px-4' : 'flex-col px-2'
        )}>
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-orange-500/15 ring-1 ring-orange-500/40">
            <Flame className="h-5 w-5 text-orange-500" />
          </div>
          {sidebarExpanded && (
            <div className="min-w-0 flex-1 leading-tight">
              <p className="text-[11px] font-bold uppercase tracking-wide text-zinc-100">
                Atlas <span className="text-orange-500">Backoffice</span>
              </p>
              <p className="text-[9px] text-zinc-500">Painel interno 2.0</p>
            </div>
          )}
          {isMobile ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 flex-shrink-0 text-zinc-500 hover:text-zinc-200"
              title="Fechar menu"
              onClick={() => setMobileNavOpen(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={cn('h-8 w-8 flex-shrink-0 text-zinc-500 hover:text-zinc-200', collapsed && 'mt-1')}
              onClick={toggle}
              title={collapsed ? 'Expandir' : 'Recolher'}
            >
              {collapsed ? <PanelLeft className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
            </Button>
          )}
        </div>

        <nav className={cn(
          'min-h-0 flex-1 space-y-5 overflow-y-auto overflow-x-hidden overscroll-contain py-4',
          sidebarExpanded ? 'px-2' : 'px-1.5'
        )}>
          {navSection('Principal', 'main')}
          {navSection('Ferramentas', 'tools')}
        </nav>

        <div className={cn('flex-shrink-0 border-t border-zinc-800/80', sidebarExpanded ? 'p-3' : 'p-2')}>
          <div className={cn(
            'flex items-center gap-2 rounded-xl border border-zinc-800/80 bg-zinc-950/60 py-2',
            sidebarExpanded ? 'px-2' : 'flex-col px-1'
          )}>
            <Avatar className="h-9 w-9 flex-shrink-0">
              <AvatarFallback className="bg-orange-500/20 text-[11px] font-semibold text-orange-200">
                {initials}
              </AvatarFallback>
            </Avatar>
            {sidebarExpanded && (
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-zinc-200">
                  {user?.full_name || user?.email?.split('@')[0]}
                </p>
                <p className="flex items-center gap-1 truncate text-[10px] text-zinc-500">
                  <ShieldCheck className="h-2.5 w-2.5 text-orange-500" />
                  Administrador
                </p>
              </div>
            )}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 flex-shrink-0 text-zinc-500 hover:text-zinc-200"
              title="Sair"
              onClick={async () => {
                if (isMobile) setMobileNavOpen(false)
                await logout()
                router.push('/login')
              }}
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="flex h-[52px] max-h-[52px] flex-shrink-0 items-center gap-3 border-b border-zinc-800/80 bg-[#09090b]/95 px-4 backdrop-blur sm:px-5">
          {isMobile ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9 shrink-0 text-zinc-300 hover:text-zinc-100"
              title="Abrir menu"
              onClick={() => setMobileNavOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </Button>
          ) : null}
          <div className="min-w-0">
            <h1 className="truncate text-sm font-semibold capitalize text-zinc-100">{title}</h1>
            <p className="truncate text-[11px] text-zinc-500 first-letter:uppercase">{dateLabel}</p>
          </div>
        </header>
        <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto overflow-x-hidden bg-[#09090b]">
          {children}
        </main>
      </div>
    </div>
  )
}
