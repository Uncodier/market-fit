'use client'

import Link from 'next/link'
import { Button } from '@/app/components/ui/button'
import { TenderHeader, TenderFooter } from './public-header'
import { useProcurementI18n } from '@/app/purchases/procurement/i18n/use-procurement-i18n'

export default function NotFound() {
  const { t } = useProcurementI18n()
  return <div className="flex flex-col min-h-screen bg-background"><TenderHeader /><main className="flex-1 mx-auto w-full max-w-7xl space-y-4 px-4 md:px-8 py-24 text-center">
    <h1 className="text-3xl font-semibold">{t('procurement.portal.public.notFound')}</h1>
    <p className="text-muted-foreground">{t('procurement.portal.public.notFoundHint')}</p>
    <Button variant="outline" asChild><Link href="/tenders">{t('procurement.portal.public.browsePublic')}</Link></Button>
  </main><TenderFooter /></div>
}