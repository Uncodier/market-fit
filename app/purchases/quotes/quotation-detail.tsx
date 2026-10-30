'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import useSWR from 'swr'
import { useAuthContext } from '@/app/components/auth/auth-provider'
import { Button } from '@/app/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/app/components/ui/tabs'
import { StickyHeader } from '@/app/components/ui/sticky-header'
import { EntityAvatar, StatusDot } from '@/app/components/documents/document-list'
import { RotateCw } from '@/app/components/ui/icons'
import { demoProcurementQuotes } from '@/lib/demo-data/procurement-commerce'
import { demoSuppliers } from '@/lib/demo-data/procurement-suppliers'
import type { ProcurementQuotationDetail as Detail } from '../procurement/commerce/quotation-detail-contracts'
import { CommerceApproval } from '../procurement/commerce/CommerceApproval'
import { QuotationEvidenceDetail } from '../procurement/evidence/quotation-evidence-detail'
import { isProcurementDemo } from '../procurement/ui/is-demo'
import { ProcurementDemoNotice } from '../procurement/ui/demo-notice'
import { useProcurementI18n } from '../procurement/i18n/use-procurement-i18n'
import { QuotationDetailSkeleton } from './quotation-detail-skeleton'
import { QuotationAmounts, QuotationProducts } from './quotation-products'
import { QuotationAbout } from './quotation-about'

export function ProcurementQuotationDetail({ siteId, id }: { siteId: string; id: string }) {
  const demo = isProcurementDemo(siteId)
  return <ScopedQuotationDetail key={`${siteId}:${id}:${demo}`} siteId={siteId} id={id} demo={demo} />
}

function ScopedQuotationDetail({ siteId, id, demo }: { siteId: string; id: string; demo: boolean }) {
  const { user, isLoading: authLoading } = useAuthContext()
  const { t } = useProcurementI18n()
  const { data, error, isLoading, isValidating, mutate } = useSWR<Detail>(!demo && user ? ['procurement-quotation-detail', user.id, siteId, id] : null, async () => {
    const response = await fetch(`/api/procurement/commerce/quotes/${encodeURIComponent(id)}?site_id=${encodeURIComponent(siteId)}`, { cache: 'no-store' })
    if (!response.ok) throw new Error(response.status === 404 ? 'unavailable' : response.status === 401 || response.status === 403 ? 'forbidden' : 'loadFailed')
    const result = await response.json()
    if (!result.data?.quotation || result.data.quotation.id.toLowerCase() !== id.toLowerCase()) throw new Error('loadFailed')
    return result.data as Detail
  }, { keepPreviousData: false, shouldRetryOnError: false })
  const demoQuote = demo ? demoProcurementQuotes.find(quotation => quotation.id === id) : null
  const detail = demo ? demoQuote ? { quotation: demoQuote, supplier: demoSuppliers(siteId).find(supplier => supplier.id === demoQuote.supplier_id) ?? null } : undefined : data
  if (!demo && (authLoading || (user && isLoading))) return <QuotationDetailSkeleton />
  const errorKey = !demo && !user ? 'forbidden' : error ? ['unavailable', 'forbidden'].includes(error.message) ? error.message : 'loadFailed' : 'unavailable'
  if (error || !detail || (!demo && !user)) return <div className="space-y-4 p-8">
    <h1 className="text-xl font-semibold">{t('procurement.quoteDetail.title')}</h1>
    <p role="alert">{t(`procurement.quoteDetail.${errorKey}`)}</p>
    <div className="flex flex-wrap gap-3"><Button variant="outline" asChild><Link href="/purchases/quotes">{t('procurement.quoteDetail.back')}</Link></Button>
      {!demo && <Button disabled={isValidating} onClick={() => void mutate()}>{t('procurement.quoteDetail.retry')}</Button>}</div>
  </div>
  return <QuotationReview key={`${user?.id ?? 'demo'}:${detail.quotation.id}`} detail={detail} siteId={siteId} demo={demo} refreshing={isValidating} onRefresh={() => { void mutate() }} />
}

function QuotationReview({ detail, siteId, demo, refreshing, onRefresh }: {
  detail: Detail; siteId: string; demo: boolean; refreshing: boolean; onRefresh: () => void
}) {
  const { quotation } = detail
  const { t, formatDate } = useProcurementI18n()
  const [tab, setTab] = useState('overview')
  const title = quotation.title || quotation.reference
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('breadcrumb:update', { detail: { title, path: `/purchases/quotes/${quotation.id}`, section: 'purchases' } }))
    return () => { window.dispatchEvent(new CustomEvent('breadcrumb:update', { detail: { title: null, path: null, section: 'purchases' } })) }
  }, [quotation.id, title])
  const statusLabel = t(quotation.award_id ? 'procurement.partners.quotes.awardApproved' : 'procurement.partners.quotes.notAwarded')
  return <div className="min-w-0 flex-1 p-0"><Tabs value={tab} onValueChange={setTab}>
    <StickyHeader><div className="flex w-full min-w-0 flex-wrap items-center justify-between gap-3">
      <div className="min-w-0 max-w-full overflow-x-auto"><TabsList>
        {['overview', 'products', 'evidence', 'approvals'].map(value => <TabsTrigger key={value} value={value}>{t(`procurement.quoteDetail.${value}`)}</TabsTrigger>)}
      </TabsList></div>
      <div className="shrink-0"><StatusDot status={quotation.award_id ? 'accepted' : 'sent'} label={statusLabel} /></div>
    </div></StickyHeader>
    <div className="px-4 py-5 lg:px-8">
      {demo && <ProcurementDemoNotice />}
      <header className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
        <div className="flex min-w-0 items-start gap-3"><EntityAvatar name={quotation.supplier_name} className="h-11 w-11 text-sm" />
          <div className="min-w-0"><h1 className="break-words text-xl font-semibold leading-tight">{title}</h1>
            <p className="mt-1 break-words text-sm text-muted-foreground">{quotation.supplier_name} · {quotation.reference}</p>
            <p className="mt-1 text-xs text-muted-foreground">{t('procurement.quoteDetail.received')} · {formatDate(quotation.recorded_at)}</p>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button variant="outline" size="sm" asChild><Link href={`/purchases/tenders/${encodeURIComponent(quotation.tender_id)}`}>{t('procurement.quoteDetail.openTender')}</Link></Button>
          {!demo && <Button variant="ghost" size="sm" disabled={refreshing} onClick={onRefresh}><RotateCw className="mr-2 h-4 w-4" />{t('procurement.quoteDetail.refresh')}</Button>}
        </div>
      </header>
      <div className="mt-5 flex flex-col border-t border-border/50 lg:flex-row">
        <main className="w-full min-w-0 pt-5 lg:flex-1 lg:pr-8">
          <TabsContent value="overview" className="mt-0 space-y-6">
            <QuotationAmounts quotation={quotation} />
            <section className="space-y-3 rounded-xl border border-border/60 p-5"><h2 className="text-lg font-semibold">{t('procurement.quoteDetail.review')}</h2>
              <p className="text-sm text-muted-foreground">{t('procurement.quoteDetail.reviewHint')}</p>
              <div className="flex flex-wrap gap-2"><Button variant="outline" size="sm" onClick={() => setTab('evidence')}>{t('procurement.quoteDetail.reviewEvidence')}</Button>
                <Button variant="ghost" size="sm" onClick={() => setTab('approvals')}>{t('procurement.quoteDetail.approvals')}</Button></div>
            </section>
            <QuotationProducts quotation={quotation} />
          </TabsContent>
          <TabsContent value="products" className="mt-0 space-y-6"><QuotationAmounts quotation={quotation} /><QuotationProducts quotation={quotation} /></TabsContent>
          <TabsContent value="evidence" className="mt-0"><QuotationEvidenceDetail siteId={siteId} quotationId={quotation.id} /></TabsContent>
          <TabsContent value="approvals" className="mt-0"><CommerceApproval siteId={siteId} targetId={quotation.award_id ?? quotation.id}
            version={1} event={quotation.award_id ? 'order' : 'award'} onChange={onRefresh} /></TabsContent>
        </main>
        <aside className="mt-5 w-full shrink-0 border-t border-border/50 pt-5 lg:mt-0 lg:w-[340px] lg:border-l lg:border-t-0 lg:pl-8 xl:w-[380px]">
          <div className="lg:sticky lg:top-[calc(var(--topbar-height,64px)+96px)] lg:max-h-[calc(100dvh-var(--topbar-height,64px)-112px)] lg:overflow-y-auto"><QuotationAbout detail={detail} /></div>
        </aside>
      </div>
    </div>
  </Tabs></div>
}