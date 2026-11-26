"use client"

import Link from "next/link"
import { useParams } from "next/navigation"
import { AgentConnectorsTab } from "@/app/components/agents/agent-connectors-tab"
import { AgentConnectorsSkeleton } from "@/app/agents/agent-detail-skeletons"
import { Button } from "@/app/components/ui/button"
import { useLocalization } from "@/app/context/LocalizationContext"
import { useSite } from "@/app/context/SiteContext"
import { isAgentUuid } from "@/app/agents/save-agent"

export default function AgentConnectorsPage() {
  const { id } = useParams<{ id: string }>()
  const { t } = useLocalization()
  const { currentSite, isLoading } = useSite()
  const agentId = isAgentUuid(id) ? id.toLowerCase() : null
  const siteId = currentSite?.id

  return <div className="mx-auto w-full min-w-0 max-w-[880px] space-y-6 px-4 py-8 pb-16 md:px-16">
    <Button asChild variant="outline" size="sm"><Link href={agentId ? `/agents/${agentId}?tab=connectors` : "/agents"}>
      {t(agentId ? "connectors.agentAccess.backToAgent" : "connectors.agentAccess.backToAgents")}
    </Link></Button>
    {!agentId ? <p role="alert">{t("connectors.agentAccess.agentNotFound")}</p>
      : isLoading ? <AgentConnectorsSkeleton />
      : !siteId ? <p role="alert">{t("settings.empty.noSite")}</p>
      : <AgentConnectorsTab key={`${siteId}:${agentId}`} siteId={siteId} agentId={agentId} />}
  </div>
}