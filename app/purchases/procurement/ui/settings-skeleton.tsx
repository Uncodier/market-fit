'use client'

import { Skeleton } from '@/app/components/ui/skeleton'
import { SectionCard, SectionCardContent, SectionCardFooter, SectionCardHeader } from '@/app/components/ui/section-card'
import { useProcurementI18n } from '../i18n/use-procurement-i18n'

export function PortalSettingsSkeleton() {
  const { t } = useProcurementI18n()
  return <div role="status" aria-label={t('procurement.policy.portal.loading')} aria-busy="true" data-portal-settings-skeleton>
    <SectionCard aria-hidden="true">
      <SectionCardHeader><Skeleton className="h-6 w-48 max-w-full" /><Skeleton className="mt-2 h-4 w-full" /><Skeleton className="mt-1 h-4 w-2/3" /></SectionCardHeader>
      <SectionCardContent>
        <Skeleton className="h-4 w-40" />
        <div className="flex items-center gap-2"><Skeleton className="h-5 w-5" /><Skeleton className="h-4 w-56 max-w-full" /></div>
        <Skeleton className="h-4 w-3/4" /><Skeleton className="h-10 w-full" />
      </SectionCardContent>
      <SectionCardFooter><Skeleton className="h-9 w-48 rounded-full" /></SectionCardFooter>
    </SectionCard>
  </div>
}

export function ProcurementSettingsSkeleton({ includePortal = true }: { includePortal?: boolean }) {
  const { t } = useProcurementI18n()
  return <div className="space-y-6" data-procurement-settings-skeleton>
    {includePortal && <PortalSettingsSkeleton />}
    <div role="status" aria-label={t('procurement.common.loadingContent')} aria-busy="true" className="space-y-6">
      {[6, 2, 4].map((fields, index) => <SectionCard key={index} aria-hidden="true" data-policy-settings-skeleton>
        <SectionCardHeader><Skeleton className="h-6 w-56 max-w-full" /><Skeleton className="mt-2 h-4 w-3/4" /></SectionCardHeader>
        <SectionCardContent>
          <div className="grid gap-4 sm:grid-cols-2">{Array.from({ length: fields }, (_, field) => <div key={field} className="space-y-2">
            <Skeleton className="h-4 w-32" /><Skeleton className="h-10 w-full" />
          </div>)}</div>
          {index === 0 && <div className="flex items-center gap-2"><Skeleton className="h-5 w-5" /><Skeleton className="h-4 w-2/3" /></div>}
        </SectionCardContent>
        <SectionCardFooter><Skeleton className="h-9 w-32 rounded-full" /></SectionCardFooter>
      </SectionCard>)}
    </div>
  </div>
}