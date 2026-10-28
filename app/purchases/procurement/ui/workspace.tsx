'use client'

import { useEffect, type ReactNode } from 'react'
import { StickyHeader } from '@/app/components/ui/sticky-header'
import { MobileFiltersDrawer, FilterContainer, FilterSection } from '@/app/components/ui/mobile-filters-drawer'
import { SearchInput } from '@/app/components/ui/search-input'
import { Tabs, TabsList, TabsTrigger } from '@/app/components/ui/tabs'
import { Button } from '@/app/components/ui/button'
import { Skeleton } from '@/app/components/ui/skeleton'
import { EmptyState } from '@/app/components/ui/empty-state'
import { AlertCircle, ClipboardList } from '@/app/components/ui/icons'
import { cn } from '@/lib/utils'

/** Presentation extracted from the Deals/Subscriptions workspace composition. */
export function ProcurementWorkspace({ title, toolbar, children, className }: {
  title: string; toolbar: ReactNode; children: ReactNode; className?: string;
}) {
  useEffect(() => { window.dispatchEvent(new CustomEvent('breadcrumb:update', { detail: { title } })) }, [title])
  return <div className="flex h-[calc(100dvh-var(--topbar-height,64px))] w-full min-w-0 flex-1 flex-col bg-muted/30">
    <h1 className="sr-only">{title}</h1>
    <StickyHeader>{toolbar}</StickyHeader>
    <div className={cn('min-h-0 min-w-0 flex-1 space-y-6 overflow-auto p-4 md:p-6 lg:p-8', className)}>{children}</div>
  </div>
}

export function ProcurementToolbar({ search, onSearch, placeholder = 'Search…', status, onStatus, statuses, actions, viewSelector, children }: {
  search?: string; onSearch?: (value: string) => void; placeholder?: string;
  status?: string; onStatus?: (value: string) => void; statuses?: { value: string; label: string }[];
  actions?: ReactNode; viewSelector?: ReactNode; children?: ReactNode;
}) {
  return <div className="flex w-full min-w-0 items-center justify-between gap-3 py-3">
    <div className="min-w-0 flex-1"><MobileFiltersDrawer triggerText="Search and filters"><FilterContainer>
      {onSearch && <FilterSection mobileOnly><SearchInput aria-label={placeholder} placeholder={placeholder} value={search ?? ''}
        onChange={event => onSearch(event.target.value)} alwaysExpanded containerClassName="w-full" /></FilterSection>}
      {statuses && onStatus && <FilterSection title="Status"><Tabs value={status} onValueChange={onStatus}>
        <TabsList className="flex h-auto flex-wrap justify-start gap-1 rounded-full bg-muted/30 p-1 md:h-8 md:flex-nowrap">
          {statuses.map(item => <TabsTrigger key={item.value} value={item.value} className="whitespace-nowrap rounded-full px-3 py-1 text-xs">{item.label}</TabsTrigger>)}
        </TabsList></Tabs></FilterSection>}
      {children}
      {onSearch && <FilterSection desktopOnly><SearchInput aria-label={placeholder} placeholder={placeholder} value={search ?? ''}
        onChange={event => onSearch(event.target.value)} containerClassName="w-56 lg:w-64" /></FilterSection>}
    </FilterContainer></MobileFiltersDrawer></div>
    <div data-toolbar-actions className="ml-auto flex shrink-0 items-center gap-2">
      {actions && <div data-secondary-actions className="flex items-center gap-1">{actions}</div>}
      {viewSelector && <div data-view-selector className="flex items-center border-l pl-2">{viewSelector}</div>}
    </div>
  </div>
}

export function ProcurementState({ loading, error, empty, emptyTitle = 'No records found', description = 'Create a record to get started.', onRetry }: {
  loading?: boolean; error?: string | null; empty?: boolean; emptyTitle?: string; description?: string; onRetry?: () => void;
}) {
  if (loading) return <div role="status" aria-label="Loading records" className="space-y-4 rounded-xl border bg-background p-6">
    <Skeleton className="h-8 w-48" />{Array.from({ length: 6 }, (_, index) => <Skeleton key={index} className="h-12 w-full" />)}
  </div>
  if (error) return <div role="alert" className="flex flex-col items-center gap-3 rounded-xl border bg-background p-8 text-center">
    <AlertCircle className="h-8 w-8 text-destructive" /><h2 className="font-semibold">Unable to load this view</h2>
    <p className="max-w-xl text-sm text-muted-foreground">{error}</p>
    {onRetry && <Button variant="outline" onClick={onRetry}>Retry</Button>}
  </div>
  if (empty) return <EmptyState icon={<ClipboardList />} title={emptyTitle} description={description} variant="simple" />
  return null
}