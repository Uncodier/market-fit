'use client';

import { Skeleton } from '@/app/components/ui/skeleton';
import { StickyHeader } from '@/app/components/ui/sticky-header';
import { SectionCard, SectionCardHeader, SectionCardContent, SectionCardFooter } from '@/app/components/ui/section-card';
import { useProcurementI18n } from '../i18n/use-procurement-i18n';

export function RuleIndexSkeleton() {
  return <div data-rule-index-skeleton aria-hidden="true" className="hidden w-[240px] shrink-0 xl:block">
    <div className="space-y-4"><Skeleton className="h-3 w-24" />
      {[0, 1, 2, 3].map(index => <Skeleton key={index} className="h-4 w-40" />)}
    </div>
  </div>;
}

export function RuleRowsSkeleton({ cases = false }: { cases?: boolean }) {
  return <div data-rule-rows-skeleton aria-hidden="true" className="space-y-3">
    {[0, 1, 2, 3].map(index => <div key={index} className={`grid gap-3 border-b border-border/70 py-3 ${cases ? 'grid-cols-2' : 'grid-cols-3'}`}>
      <Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-full" />
      {!cases && <Skeleton className="h-4 w-full" />}
    </div>)}
  </div>;
}

export function RuleCardsSkeleton({ minimums = false }: { minimums?: boolean }) {
  const { t } = useProcurementI18n();
  return <div role="status" aria-label={t('procurement.common.loadingContent')} aria-busy="true" className="space-y-6">
    {!minimums && <div aria-hidden="true" className="space-y-3"><Skeleton className="h-6 w-48" /><Skeleton className="h-4 w-full" /></div>}
    {(minimums ? [0, 1] : [0, 1, 2]).map(index => <SectionCard key={index} aria-hidden="true">
      <SectionCardHeader><Skeleton className="h-5 w-40" /><Skeleton className="h-4 w-3/4" /></SectionCardHeader>
      {minimums ? <SectionCardContent><RuleRowsSkeleton cases={index === 1} /></SectionCardContent> : null}
      {!minimums && <SectionCardFooter><Skeleton className="h-8 w-24 rounded-full" /></SectionCardFooter>}
    </SectionCard>)}
  </div>;
}

/** Route/context skeleton only; never renders another sidebar or global TopBar. */
export function RuleScreenLoading({ minimums = false }: { minimums?: boolean }) {
  return <div className="flex h-[calc(100dvh-var(--topbar-height,64px))] w-full min-w-0 flex-1 flex-col bg-muted/30">
    <StickyHeader><div aria-hidden="true" className="flex w-full min-w-0 flex-wrap items-center gap-2 py-3">
      <Skeleton className={`h-8 max-w-full rounded-full motion-reduce:animate-none ${minimums ? 'w-56' : 'w-72'}`} />
      <Skeleton className="h-9 w-56 max-w-full rounded-full motion-reduce:animate-none" />
    </div></StickyHeader>
    <div className="min-h-0 flex-1 overflow-auto py-8 pb-16">
      <div className="mx-auto flex max-w-[1200px] justify-center gap-8">
        <div className="min-w-0 max-w-[880px] flex-1 space-y-6 px-4 md:px-16"><RuleCardsSkeleton minimums={minimums} /></div>
        <RuleIndexSkeleton />
      </div>
    </div>
  </div>;
}