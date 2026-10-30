'use client'

import Link from 'next/link'
import { EmptyCard } from '@/app/components/ui/empty-card'
import { ClipboardList } from '@/app/components/ui/icons'
import { Button } from '@/app/components/ui/button'
import { useProcurementI18n } from '@/app/purchases/procurement/i18n/use-procurement-i18n'

export function EmptyTenders({ href }: { href: string }) {
  const { t } = useProcurementI18n()
  return <EmptyCard icon={<ClipboardList size={24} />} title={t('procurement.portal.public.empty')}
    description={t('procurement.portal.public.emptyHint')} showHint={false}
    actionButton={<Button variant="outline" asChild><Link href={href}>{t('procurement.portal.public.clearSearch')}</Link></Button>} />
}