'use client'

import { useEffect, type ReactNode } from 'react'
import { StickyHeader } from '@/app/components/ui/sticky-header'
import { MobileFiltersDrawer, FilterContainer, FilterSection } from '@/app/components/ui/mobile-filters-drawer'
import { SearchInput } from '@/app/components/ui/search-input'
import { Tabs, TabsList, TabsTrigger } from '@/app/components/ui/tabs'
import { Button } from '@/app/components/ui/button'
import { Skeleton } from '@/app/components/ui/skeleton'
import { EmptyCard } from '@/app/components/ui/empty-card'
import { AlertCircle, ClipboardList } from '@/app/components/ui/icons'
import { cn } from '@/lib/utils'
import { useProcurementI18n } from '../i18n/use-procurement-i18n'

/** Presentation extracted from the Deals/Subscriptions workspace composition. */
export function ProcurementWorkspace({ title, toolbar, children, className, embedded = false }: {
  title: string; toolbar: ReactNode; children: ReactNode; className?: string; embedded?: boolean;
}) {
  // Settings owns its tab header, breadcrumb and page scrolling.
  if (embedded) return <section aria-label={title} className={cn('min-w-0 space-y-6', className)}>{children}</section>
  return <StandaloneProcurementWorkspace title={title} toolbar={toolbar} className={className}>{children}</StandaloneProcurementWorkspace>
}

function StandaloneProcurementWorkspace({ title, toolbar, children, className }: {
  title: string; toolbar: ReactNode; children: ReactNode; className?: string;
}) {
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('breadcrumb:update', { detail: { title } }))
  }, [title])
  return <div className="flex h-[calc(100dvh-var(--topbar-height,64px))] w-full min-w-0 flex-1 flex-col bg-muted/30">
    <h1 className="sr-only">{title}</h1>
    <StickyHeader>{toolbar}</StickyHeader>
    <div className={cn('min-h-0 min-w-0 flex-1 space-y-6 overflow-auto p-4 md:p-6 lg:p-8', className)}>{children}</div>
  </div>
}

export function ProcurementToolbar({ search, onSearch, placeholder, status, onStatus, statuses, actions, viewSelector, children }: {
  search?: string; onSearch?: (value: string) => void; placeholder?: string;
  status?: string; onStatus?: (value: string) => void; statuses?: { value: string; label: string }[];
  actions?: ReactNode; viewSelector?: ReactNode; children?: ReactNode;
}) {
  const { t } = useProcurementI18n()
  const searchLabel = placeholder ?? t('procurement.common.search')
  return <div className="flex w-full min-w-0 items-center justify-between gap-3 py-3">
    <div className="min-w-0 flex-1"><MobileFiltersDrawer triggerText={t('procurement.common.filters')}><FilterContainer>
      {onSearch && <FilterSection mobileOnly><SearchInput aria-label={searchLabel} placeholder={searchLabel} value={search ?? ''}
        onChange={event => onSearch(event.target.value)} alwaysExpanded containerClassName="w-full" /></FilterSection>}
      {statuses && onStatus && <FilterSection title={t('procurement.common.status')}><Tabs value={status} onValueChange={onStatus}>
        <TabsList className="flex h-auto flex-wrap justify-start gap-1 rounded-full bg-muted/30 p-1 md:h-8 md:flex-nowrap">
          {statuses.map(item => <TabsTrigger key={item.value} value={item.value} className="whitespace-nowrap rounded-full px-3 py-1 text-xs">{item.label}</TabsTrigger>)}
        </TabsList></Tabs></FilterSection>}
      {children}
      {onSearch && <FilterSection desktopOnly><SearchInput aria-label={searchLabel} placeholder={searchLabel} value={search ?? ''}
        onChange={event => onSearch(event.target.value)} containerClassName="w-56 lg:w-64" /></FilterSection>}
    </FilterContainer></MobileFiltersDrawer></div>
    <div data-toolbar-actions className="ml-auto flex shrink-0 items-center gap-2">
      {actions && <div data-secondary-actions className="flex items-center gap-1">{actions}</div>}
      {viewSelector && <div data-view-selector className="flex items-center border-l pl-2">{viewSelector}</div>}
    </div>
  </div>
}

export function ProcurementState({ loading, error, errorIsLocalized = false, empty, emptyTitle, description, emptyIcon, compact = false, onRetry }: {
  loading?: boolean; error?: string | null; empty?: boolean; emptyTitle?: string; description?: string; onRetry?: () => void;
  errorIsLocalized?: boolean;
  emptyIcon?: ReactNode; compact?: boolean;
}) {
  const { t, message } = useProcurementI18n()
  if (loading) return <div role="status" aria-label={t('procurement.common.loadingRecords')} className="space-y-4 rounded-xl border bg-background p-6">
    <Skeleton className="h-8 w-48" />{Array.from({ length: 6 }, (_, index) => <Skeleton key={index} className="h-12 w-full" />)}
  </div>
  if (error) return <div role="alert" className="flex flex-col items-center gap-3 rounded-xl border bg-background p-8 text-center">
    <AlertCircle className="h-8 w-8 text-destructive" /><h2 className="font-semibold">{t('procurement.common.loadFailed')}</h2>
    <p className="max-w-xl text-sm text-muted-foreground">{errorIsLocalized ? error : message(error)}</p>
    {onRetry && <Button variant="outline" onClick={onRetry}>{t('procurement.common.retry')}</Button>}
  </div>
  if (empty) return <EmptyCard icon={emptyIcon ?? <ClipboardList size={24} />} title={emptyTitle ?? t('procurement.common.noRecords')}
    description={description ?? t('procurement.common.createHint')} showHint={false} showShadow={!compact}
    contentClassName={compact ? 'min-h-[180px] py-6' : undefined} />
  return null
}