'use client'

import { Button } from '@/app/components/ui/button'
import { TenderHeader, TenderFooter } from './public-header'
import { useProcurementI18n } from '@/app/purchases/procurement/i18n/use-procurement-i18n'

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { t } = useProcurementI18n()
  return <div className="flex flex-col min-h-screen bg-background"><TenderHeader />
    <main className="flex-1 max-w-7xl mx-auto w-full px-4 md:px-8 py-8 md:py-12">
      <div role="alert" className="space-y-3 py-8"><h1 className="text-2xl font-bold">{t('procurement.portal.public.loadFailed')}</h1>
        <p>{t('procurement.portal.public.unavailable')}</p><Button variant="outline" onClick={reset}>{t('procurement.common.retry')}</Button>
      </div>
    </main><TenderFooter /></div>
}