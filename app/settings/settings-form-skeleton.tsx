"use client"

import type { ReactNode } from 'react'
import { Skeleton } from '@/app/components/ui/skeleton'
import { SectionCard, SectionCardContent, SectionCardFooter, SectionCardHeader } from '@/app/components/ui/section-card'
import { SettingsCardsSkeletonContent, SettingsSecretsLoadingRows, VisitsSettingsSkeletonContent } from '@/app/components/settings/settings-loading'
import { useProcurementI18n } from '@/app/purchases/procurement/i18n/use-procurement-i18n'
import { ProcurementSettingsSkeleton } from '@/app/purchases/procurement/ui/settings-skeleton'

function Heading({ action = false }: { action?: boolean }) {
  return <div className="flex items-start justify-between gap-4">
    <div className="min-w-0 space-y-2"><Skeleton className="h-6 w-48 max-w-full" /><Skeleton className="h-4 w-64 max-w-full" /></div>
    {action && <Skeleton className="h-9 w-28 shrink-0" />}
  </div>
}

function Field({ height = 'h-10' }: { height?: string }) {
  return <div className="space-y-2"><Skeleton className="h-4 w-28" /><Skeleton className={`${height} w-full`} /></div>
}

function Fields({ count }: { count: number }) {
  return <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
    {Array.from({ length: count }, (_, index) => <Field key={index} />)}
  </div>
}

function Card({ section, shape, children, footer = true, action = false }: {
  section: string; shape?: string; children?: ReactNode; footer?: boolean; action?: boolean
}) {
  return <SectionCard data-settings-section={section} data-skeleton-shape={shape}>
    <SectionCardHeader><Heading action={action} /></SectionCardHeader>
    {children && <SectionCardContent>{children}</SectionCardContent>}
    {footer && <SectionCardFooter><Skeleton className="h-9 w-28" /></SectionCardFooter>}
  </SectionCard>
}

function Summaries({ section, count = 2 }: { section: string; count?: number }) {
  return <div data-settings-section={section} className="space-y-4">
    <Heading action />
    {Array.from({ length: count }, (_, index) => <Card key={index} section={`${section}-${index}`} shape="summary" footer={false} />)}
  </div>
}

function General() {
  return <>
    <Card section="site-information" shape="site">
      <div className="flex flex-col gap-4 sm:flex-row">
        <div className="w-full shrink-0 space-y-2 sm:w-60"><Skeleton className="h-4 w-28" /><Skeleton className="h-60 w-60" /></div>
        <div className="min-w-0 flex-1 space-y-4"><Field height="h-12" /><Field height="h-12" /><Field height="h-12" /><Skeleton className="h-8 w-full" /></div>
      </div>
      <Field height="h-[72px]" />
    </Card>
    <Card section="web-resources" shape="resources" action>
      {[0, 1].map(row => <div key={row} className="flex items-center gap-2"><Skeleton className="h-10 w-1/3" /><Skeleton className="h-10 flex-1" /><Skeleton className="h-8 w-8" /></div>)}
    </Card>
    <Card section="site-danger-zone" shape="danger" footer={false}><Skeleton className="h-9 w-32" /></Card>
  </>
}

function Company() {
  return <>
    <Card section="company-profile" shape="profile"><Field height="h-[72px]" /><Fields count={3} /></Card>
    <Summaries section="office-locations" count={1} />
    <Summaries section="service-available-restrictions" count={1} />
    <Summaries section="service-exclusions-addresses" count={1} />
    <Summaries section="business-hours" count={1} />
    {['goals-quarterly', 'goals-yearly', 'goals-five-year', 'goals-ten-year', 'swot-strengths', 'swot-weaknesses', 'swot-opportunities', 'swot-threats'].map(section =>
      <Card key={section} section={section} shape="text"><Skeleton className="h-24 w-full" /></Card>)}
  </>
}

function Choices() {
  return <div className="space-y-3">{[0, 1, 2].map(row => <div key={row} className="flex items-center gap-3 rounded-lg border p-3"><Skeleton className="h-4 w-4 shrink-0" /><Skeleton className="h-4 w-48 max-w-full" /></div>)}</div>
}

function Marketplace() {
  return <>
    <div data-settings-section="shop-share" className="space-y-4">
      <Heading />
      <div className="flex flex-col items-center gap-6 rounded-xl border bg-card p-4 md:flex-row md:p-6">
        <div className="flex shrink-0 items-center gap-4"><Skeleton className="h-[88px] w-[88px]" /><div className="space-y-2"><Skeleton className="h-4 w-32" /><Skeleton className="h-3 w-20" /><Skeleton className="h-7 w-24" /></div></div>
        <div className="w-full min-w-0 flex-1 space-y-2"><Skeleton className="h-4 w-28" /><Skeleton className="h-8 w-full" /><Skeleton className="h-11 w-full" /></div>
      </div>
    </div>
    <Card section="shop-hero" shape="hero"><Field /><Fields count={2} /><Choices /><Field height="h-[72px]" /><Skeleton className="aspect-video w-full" /></Card>
    <Card section="shop-trust" shape="trust"><Fields count={2} /><Field /><Fields count={2} /><Skeleton className="h-20 w-full" /></Card>
    <Card section="shop-payouts" shape="fields"><Fields count={4} /></Card>
    <Card section="shop-payments" shape="choices"><Choices /><Choices /></Card>
    <Card section="shop-self-service" shape="choices"><Choices /></Card>
  </>
}

function Content({ segment }: { segment: string }) {
  switch (segment) {
    case 'company': return <Company />
    case 'marketplace': return <Marketplace />
    case 'visits': return <VisitsSettingsSkeletonContent />
    case 'team': return <div data-settings-section="team-members" className="space-y-6"><Heading action /><SettingsCardsSkeletonContent kind="team" /></div>
    case 'channels': return <><Summaries section="support-channels" /><Card section="website-channel" shape="website"><Choices /><Field /><Skeleton className="h-32 w-full" /></Card></>
    case 'calendar': return <Summaries section="calendars" />
    case 'social': return <Summaries section="social-networks-section" />
    case 'printers': return <div className="space-y-6" data-settings-section="printers"><Heading action /><div className="max-w-sm"><Field /></div>{[0, 1].map(index => <Card key={index} section={`printer-${index}`} shape="summary" footer={false} />)}</div>
    case 'secrets': return <div className="space-y-6" data-settings-section="secrets">
      <Heading action />
      <div className="overflow-hidden rounded-xl border"><table className="w-full"><thead><tr>{[0, 1, 2, 3].map(column => <th key={column} className="px-4 py-3"><Skeleton className="h-4 w-20" /></th>)}</tr></thead><tbody><SettingsSecretsLoadingRows /></tbody></table></div>
    </div>
    case 'activities': return <div className="space-y-6" data-settings-section="activities"><Heading />
      {['daily_resume_and_stand_up', 'local_lead_generation', 'icp_lead_generation', 'leads_initial_cold_outreach', 'leads_follow_up', 'invoices_due', 'email_sync', 'assign_leads_to_team', 'notify_team_on_inbound_conversations', 'supervise_conversations'].map(key =>
        <Card key={key} section={`activity-${key}`} shape="activity">
          {key === 'icp_lead_generation' ? <Skeleton className="h-4 w-64 max-w-full" /> : <div className="flex flex-wrap gap-3">{[0, 1, 2].map(option => <Skeleton key={option} className="h-10 w-28" />)}</div>}
        </Card>)}
    </div>
    default: return <General />
  }
}

export function SettingsFormSkeleton({ segment = 'general' }: { segment?: string }) {
  const { t } = useProcurementI18n()
  if (segment === 'tenders' || segment === 'procurement') return <ProcurementSettingsSkeleton />
  const spacing = segment === 'general' ? 'space-y-12' : ['company', 'visits'].includes(segment) ? 'space-y-4' : 'space-y-6'
  return <div role="status" aria-label={t('procurement.common.loadingContent')} aria-busy="true" data-settings-skeleton={segment}>
    <div aria-hidden="true" className={spacing}><Content segment={segment} /></div>
  </div>
}
