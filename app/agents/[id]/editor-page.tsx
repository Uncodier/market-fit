"use client"

import { Suspense, useEffect, useState } from "react"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import { AgentPageSkeleton } from "@/app/agents/agent-detail-skeletons"
import { isAgentUuid } from "@/app/agents/save-agent"
import { Button } from "@/app/components/ui/button"
import { useLocalization } from "@/app/context/LocalizationContext"
import { useSite } from "@/app/context/SiteContext"
import { AgentEditor } from "./agent-editor"
import { createDraft, type EditorProfile } from "./editor-profile"
import { loadEditorProfile } from "./load-editor-profile"

function Unavailable({ message }: { message: string }) {
  const router = useRouter()
  return <div className="flex-1 p-8 flex flex-col items-center justify-center">
    <h1 className="text-2xl font-bold mb-4">Error loading agent</h1>
    <p className="text-muted-foreground mb-6">{message}</p>
    <Button onClick={() => router.push("/agents")}>Back to Agents</Button>
  </div>
}

function PersistedEditor({ siteId, agentId, initialTab }: { siteId: string; agentId: string; initialTab: "basic" | "connectors" }) {
  const [result, setResult] = useState<EditorProfile | "unavailable" | null>(null)
  useEffect(() => {
    const request = new AbortController()
    loadEditorProfile(siteId, agentId, request.signal).then((profile) => {
      if (!request.signal.aborted) setResult(profile)
    }).catch(() => {
      if (!request.signal.aborted) setResult("unavailable")
    })
    return () => request.abort()
  }, [siteId, agentId])
  if (result === "unavailable") return <Unavailable message="Agent not found or unavailable for this site" />
  if (!result) return <AgentPageSkeleton />
  return <AgentEditor siteId={siteId} routeId={agentId} initialProfile={result} initialTab={initialTab} />
}

function EditorRoute({ draft }: { draft: boolean }) {
  const params = useParams<{ id?: string }>()
  const id = draft ? 'new' : params.id || ''
  const searchParams = useSearchParams()
  const roleHint = searchParams.get("role")
  const initialTab = searchParams.get("tab") === "connectors" ? "connectors" : "basic"
  const { currentSite, isLoading } = useSite()
  const { t } = useLocalization()
  if (!currentSite?.id) return isLoading ? <AgentPageSkeleton draft={id === "new"} /> : <Unavailable message={t("settings.empty.noSite")} />

  // Reset the whole editor (including active tab, pending loads, and draft edits)
  // in the same render as a site/route switch, not in a later effect.
  const key = `${currentSite.id}:${id}`
  if (isAgentUuid(id)) return <PersistedEditor key={key} siteId={currentSite.id} agentId={id.toLowerCase()} initialTab={initialTab} />
  const profile = createDraft(id, roleHint)
  if (!profile) return <Unavailable message="Agent not found" />
  return <AgentEditor key={`${key}:${profile.role}`} siteId={currentSite.id} routeId={id} initialProfile={profile} />
}

export function AgentEditorPage({ draft = false }: { draft?: boolean }) {
  return <Suspense fallback={<AgentPageSkeleton draft={draft} />}><EditorRoute draft={draft} /></Suspense>
}