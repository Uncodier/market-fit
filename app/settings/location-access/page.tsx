"use client"

import Link from "next/link"
import { useSite } from "@/app/context/SiteContext"
import { LocationScopeEditor } from "@/app/components/LocationScopeEditor"

export default function LocationAccessPage() {
  const { currentSite } = useSite()
  return <main className="mx-auto w-full max-w-3xl space-y-6 p-6">
    <Link href="/settings?tab=team" className="text-sm underline">Back to team settings</Link>
    <h1 className="text-2xl font-semibold">Location access</h1>
    <p className="text-sm text-muted-foreground">Resolve operating branches for existing records. Records without a known branch remain hidden from members with location restrictions. Parent and child scopes must agree.</p>
    {currentSite?.id ? <LocationScopeEditor siteId={currentSite.id} /> : <p>Select a site to manage location scope.</p>}
  </main>
}