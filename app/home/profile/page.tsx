'use client'

import BuyerProfilePage from '@/app/buyer/profile/page'
import { CredentialManager } from './credential-manager'
import { usePortalDemo } from '../demo-context'

export default function ProfilePage() {
  const demo = usePortalDemo()
  return <div className="min-w-0 space-y-8">{demo ? <header className="space-y-1"><h1 className="text-3xl font-semibold tracking-tight">Alex Morgan</h1><p className="text-sm text-muted-foreground">Demo account · Northstar Technology · alex@example.test</p></header> : <BuyerProfilePage />}<CredentialManager /></div>
}