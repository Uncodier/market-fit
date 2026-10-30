'use client'

import { BuyerHomeView } from '@/app/buyer/components/BuyerHomeView'
import { FileText, Search, ShieldCheck } from '@/app/components/ui/icons'
import { useProcurementI18n } from '@/app/purchases/procurement/i18n/use-procurement-i18n'
import useSWR from 'swr'
import { useAuthContext } from '@/app/components/auth/auth-provider'
import { readPortalJson, type Opportunity, type SavedDraft, type Submission } from './submissions/types'
import { useMemo } from 'react'
import { usePortalDemo } from './demo-context'
import { getDemoHomeSummary } from './demo-summary'
import { GlobalSearchInput } from './search/global-search-input'
import { demoPortalDrafts, demoPortalOpportunities, demoPortalSubmissions } from '@/lib/demo-data/procurement-portal'

export default function HomePage() {
  const { t } = useProcurementI18n()
  const { user } = useAuthContext()
  const demo = usePortalDemo()
  const demoSummary = useMemo(() => demo ? getDemoHomeSummary() : undefined, [demo])
  const submissions = useSWR(!demo && user ? ['supplier-submissions', user.id] : null, async () => {
    const result = await readPortalJson('/api/procurement/commerce/submissions') as { data: Submission[] }
    return { submissions: result.data }
  })
  const opportunities = useSWR(!demo && user ? ['supplier-opportunities', user.id] : null,
    () => readPortalJson('/api/procurement/credentials/participation') as Promise<{ opportunities: Opportunity[] }>)
  const savedDrafts = useSWR(!demo && user ? ['supplier-drafts', user.id] : null,
    () => readPortalJson('/api/procurement/credentials/drafts/list') as Promise<{ drafts: SavedDraft[] }>)
  const hasSubmissions = !!user && !submissions.error && !submissions.isLoading &&
    (submissions.data?.submissions?.length ?? 0) > 0
  const hasInvitations = !!user && !opportunities.error && !opportunities.isLoading &&
    (opportunities.data?.opportunities ?? []).some(row => row.directly_invited === true)
  const hasDrafts = !!user && !savedDrafts.error && !savedDrafts.isLoading && (savedDrafts.data?.drafts?.length ?? 0) > 0
  return <div className="space-y-6">
    <GlobalSearchInput />
    <BuyerHomeView basePath="/home" demoSummary={demoSummary} additionalCards={[
      {
        title: t('procurement.portal.home.products'),
        description: t('procurement.portal.home.productsDescription'),
        icon: <Search className="w-6 h-6 text-foreground/70" />,
        href: '/marketplace',
      },
      {
        title: t('procurement.portal.home.credentials'),
        description: t('procurement.portal.home.credentialsDescription'),
        icon: <ShieldCheck className="w-6 h-6 text-foreground/70" />,
        href: '/home/profile',
      },
      ...(demo || hasSubmissions || hasInvitations || hasDrafts ? [{
        title: t('procurement.portal.activity.title'),
        description: t('procurement.portal.home.activityDescription'),
        icon: <FileText className="w-6 h-6 text-foreground/70" />,
        href: '/home/submissions',
        count: demo ? demoPortalSubmissions.length + demoPortalDrafts.length + demoPortalOpportunities.filter(row => row.directly_invited).length : undefined,
      }] : []),
      {
        title: t('procurement.portal.home.discover'),
        description: t('procurement.portal.home.tendersDescription'),
        icon: <Search className="w-6 h-6 text-foreground/70" />,
        href: '/tenders',
      },
    ]} />
  </div>
}