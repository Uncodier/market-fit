'use client'

import Link from 'next/link'
import { Button } from '@/app/components/ui/button'
import { useProcurementI18n } from '@/app/purchases/procurement/i18n/use-procurement-i18n'
import { TenderListing } from './tender-listing'
import { TenderHeader, TenderFooter } from './public-header'
import type { PublicTenderRow } from './public-data'

/** Localized presentation of the public DTO; loading and access stay on the server. */
export function TenderDirectoryView({ siteSlug, siteName, page, search, rows, error, closedIds }: {
  siteSlug?: string; siteName?: string; page: number; search: string; rows: PublicTenderRow[]; error: string | null; closedIds: string[]; demo?: boolean
}) {
  const { t, message, formatNumber } = useProcurementI18n()
  const base = siteSlug ? `/tenders/${siteSlug}` : '/tenders'
  const href = (next: number) => `${base}?page=${next}&search=${encodeURIComponent(search)}`
  return <div className="flex flex-col min-h-screen bg-background"><TenderHeader key={search} siteSlug={siteSlug} search={search} /><main className="flex-1 max-w-7xl mx-auto w-full px-4 md:px-8 py-8 md:py-12">
    <TenderListing key={`${page}:${search}`} rows={rows} closedIds={closedIds} emptyHref={base}
      header={<header className="space-y-4 mb-8"><nav aria-label={t('procurement.portal.public.navigation')} className="flex flex-wrap gap-3 text-sm text-muted-foreground"><Link className="hover:underline" href="/marketplace">{t('procurement.portal.public.marketplace')}</Link><span>/</span><Link className="hover:underline" href="/tenders">{t('procurement.portal.public.tenders')}</Link>{siteSlug && <><span>/</span><span>{siteName ?? siteSlug}</span></>}</nav><h1 className="max-w-3xl text-2xl md:text-3xl font-semibold tracking-tight leading-tight">{siteSlug ? t('procurement.portal.public.siteTitle', { site: siteName ?? siteSlug }) : t('procurement.portal.public.discover')}</h1><p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">{t('procurement.portal.public.discoveryDescription')}</p></header>}
      errorContent={error ? <div role="alert" className="space-y-3 py-8"><h2 className="text-lg font-semibold">{t('procurement.portal.public.loadFailed')}</h2>
      <p>{message(error)}</p><Button variant="outline" asChild><Link href={href(page)}>{t('procurement.common.retry')}</Link></Button>
    </div> : undefined}>
      <nav aria-label={t('procurement.portal.public.pages')} className="mt-8 flex items-center justify-center gap-4">{page > 0 && <Button variant="outline" asChild><Link href={href(page - 1)}>{t('procurement.portal.previous')}</Link></Button>}<span className="text-sm">{t('procurement.portal.public.page', { page: formatNumber(page + 1) })}</span>{rows.length === 25 && <Button variant="outline" asChild><Link href={href(page + 1)}>{t('procurement.portal.next')}</Link></Button>}</nav>
    </TenderListing>
  </main><TenderFooter /></div>
}