'use client'

import { useProcurementI18n } from '@/app/purchases/procurement/i18n/use-procurement-i18n'

import BuyerProfilePage from '@/app/buyer/profile/page'
import { CredentialManager } from './credential-manager'
import { usePortalDemo } from '../demo-context'

const demoProfile = { name: 'Alex Morgan', company: 'Northstar Technology', email: 'alex@example.test' }

export default function ProfilePage() {
  const { t } = useProcurementI18n()
  const demo = usePortalDemo()
  return <div className="min-w-0 space-y-8">{demo ? <header className="space-y-1"><h1 className="text-3xl font-semibold tracking-tight">{demoProfile.name}</h1><p className="text-sm text-muted-foreground">{t('procurement.surfaces.demo.account', { company: demoProfile.company, email: demoProfile.email })}</p></header> : <BuyerProfilePage />}<CredentialManager /></div>
}