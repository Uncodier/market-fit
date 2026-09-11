"use client"

import { use, Suspense } from "react"
import { CodeExplorer } from "@/app/components/applications/CodeExplorer"
import { useSearchParams } from "next/navigation"

function RequirementCodeContent({ requirementId }: { requirementId: string }) {
  const searchParams = useSearchParams()
  const isArtifact = searchParams.get("artifact") === "true"

  return (
    <div className={`flex relative overflow-hidden w-full bg-background flex-row ${isArtifact ? 'h-[100dvh]' : 'h-[calc(100dvh-64px)]'}`}>
      <CodeExplorer requirementId={requirementId} />
    </div>
  )
}

export default function RequirementCodePage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params)

  return (
    <Suspense fallback={<div className="flex items-center justify-center h-[calc(100dvh-64px)]">Loading...</div>}>
      <RequirementCodeContent requirementId={resolvedParams.id} />
    </Suspense>
  )
}
