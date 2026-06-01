"use client"

import { use, Suspense } from "react"
import { TenantTablesExplorer } from "@/app/components/applications/TenantTablesExplorer"
import { useSearchParams } from "next/navigation"

function TenantDatabaseContent({ tenantId }: { tenantId: string }) {
  const searchParams = useSearchParams()
  const isArtifact = searchParams.get("artifact") === "true"

  return (
    <div className={`flex relative overflow-hidden w-full bg-background flex-row ${isArtifact ? 'h-[100dvh]' : 'h-[calc(100dvh-64px)]'}`}>
      <TenantTablesExplorer tenantId={tenantId} />
    </div>
  )
}

export default function TenantDatabasePage({ params }: { params: Promise<{ tenantId: string }> }) {
  const resolvedParams = use(params)

  return (
    <Suspense fallback={<div className="flex items-center justify-center h-full">Loading...</div>}>
      <TenantDatabaseContent tenantId={resolvedParams.tenantId} />
    </Suspense>
  )
}
