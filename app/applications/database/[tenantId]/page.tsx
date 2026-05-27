"use client"

import { use, useState } from "react"
import { TenantTablesExplorer } from "@/app/components/applications/TenantTablesExplorer"
import { useLocalization } from "@/app/context/LocalizationContext"
import { useRouter } from "next/navigation"

export default function TenantDatabasePage({ params }: { params: Promise<{ tenantId: string }> }) {
  const { t } = useLocalization()
  const router = useRouter()
  const resolvedParams = use(params)

  return (
    <div className="flex h-[calc(100dvh-64px)] relative overflow-hidden w-full bg-background flex-row">
      <TenantTablesExplorer tenantId={resolvedParams.tenantId} />
    </div>
  )
}
