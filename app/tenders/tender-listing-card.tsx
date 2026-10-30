'use client'

import Link from 'next/link'
import { Badge } from '@/app/components/ui/badge'
import { ArrowRight, Calendar, ClipboardList } from '@/app/components/ui/icons'
import { useProcurementI18n } from '@/app/purchases/procurement/i18n/use-procurement-i18n'
import type { PublicTenderRow } from './public-data'
import { TenderSiteLogo, TenderSiteCountries } from './site-branding'

/** Document-first opportunity card; published facts stay together without placeholder media. */
export function TenderListingCard({ row, closed }: { row: PublicTenderRow; closed: boolean }) {
  const { t, formatNumber, formatDate } = useProcurementI18n()
  const href = `/tenders/${row.site_slug}/${row.tender_slug}`
  const focus = 'rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'
  return <article className="group min-w-0 w-full rounded-2xl border border-border bg-card p-5 md:p-6 transition-all hover:border-primary/30 hover:shadow-sm focus-within:border-primary/40">
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_14rem]">
    <div className="min-w-0">
    <div className="flex flex-wrap items-center gap-3 mb-3">
      <Badge variant="outline" className={closed ? 'bg-muted text-muted-foreground' : 'border-emerald-600/20 bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200'}>
        <span aria-hidden={true} className="mr-1.5 h-1.5 w-1.5 rounded-full bg-current" />
        {t(closed ? 'procurement.portal.listing.closed' : 'procurement.portal.listing.openBadge')}
      </Badge>
      <div className="flex min-w-0 max-w-full items-center gap-2">
        <TenderSiteLogo logo={row.site_logo_url} name={row.site_name ?? row.site_slug} compact />
        <Link href={`/tenders/${row.site_slug}`} className={`min-w-0 break-words text-sm text-muted-foreground hover:text-foreground hover:underline ${focus}`}>{row.site_name ?? row.site_slug}</Link>
      </div>
      <TenderSiteCountries regions={row.facets?.regions} />
    </div>
    <h2 className="text-xl font-semibold tracking-tight leading-snug break-words"><Link href={href} className={`hover:underline ${focus}`}>{row.snapshot.title}</Link></h2>
    {row.snapshot.description && <p className="mt-2 text-sm leading-relaxed text-muted-foreground line-clamp-2 break-words max-w-2xl">{row.snapshot.description}</p>}
    <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
      <span className="inline-flex items-center gap-1.5"><ClipboardList className="h-3.5 w-3.5" aria-hidden={true} />{t('procurement.portal.public.requirements')} · {formatNumber(row.snapshot.requirements.length)}</span>
      <span>{t('procurement.portal.version', { version: formatNumber(row.version) })}</span>
    </div>
    </div>
      <div className="flex flex-col gap-3 border-t border-border pt-4 lg:border-t-0 lg:pt-0 lg:border-l lg:pl-5">
      <div className="flex items-start gap-2 text-sm">
        <Calendar className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden={true} />
        <div className="min-w-0"><p className="text-xs text-muted-foreground">{t('procurement.portal.listing.deadlineLabel')}</p>
          <time dateTime={row.snapshot.participation_deadline} className="mt-1 block font-medium">{formatDate(row.snapshot.participation_deadline, { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' })} UTC</time>
        </div>
      </div>
        <Link href={href} className={`inline-flex min-h-11 items-center gap-2 self-start mt-auto text-sm font-medium text-muted-foreground hover:text-foreground hover:underline ${focus}`} aria-label={`${t('procurement.portal.listing.view')}: ${row.snapshot.title}`}><span>{t('procurement.portal.listing.view')}</span><ArrowRight className="h-4 w-4 shrink-0" aria-hidden={true} /></Link>
      </div>
    </div>
  </article>
}