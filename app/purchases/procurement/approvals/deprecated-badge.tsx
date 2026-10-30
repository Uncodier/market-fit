'use client'

import { Badge } from '@/app/components/ui/badge'
import { useProcurementI18n } from '../i18n/use-procurement-i18n'

export function DeprecatedBadge({ deprecated }: { deprecated?: boolean }) {
  const { valueLabel } = useProcurementI18n()
  return deprecated ? <Badge variant="secondary">{valueLabel('deprecated')}</Badge> : null
}