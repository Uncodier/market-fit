"use client"

import { useSite } from "@/app/context/SiteContext"
import { isDemoModeActive, isRealSiteId } from "@/lib/demo-utils"
import { SupplierList } from "./supplier-list"
import { SupplierDetail } from "./supplier-detail"

export function SuppliersWorkspace({ id }: { id?: string }) {
  const { currentSite } = useSite()
  if (!currentSite || !isRealSiteId(currentSite.id) || isDemoModeActive()) {
    return <div className="p-6">Select a real workspace to manage suppliers. Demo saves are not supported.</div>
  }
  return <main className="h-full min-w-0 w-full" key={`${currentSite.id}:${id ?? "list"}`}>
    {id ? <SupplierDetail siteId={currentSite.id} id={id} /> : <SupplierList siteId={currentSite.id} />}
  </main>
}