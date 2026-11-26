import Link from "next/link"
import { useState } from "react"
import { useLocalization } from "@/app/context/LocalizationContext"
import { Button } from "@/app/components/ui/button"
import { ConnectorError } from "@/app/connectors/connector-feedback"
import { ConnectorRequestError, exactToolIdPattern, scopedConnectorPath } from "@/app/connectors/connector-request"
import { agentGrantIsCurrent, type AgentConnectorDirectory } from "@/app/connectors/agent-access-contract"
import { accessSchema } from "@/app/connectors/types"
import { useConnectorResource } from "@/app/connectors/use-connector-resource"
import { AgentLoadingRegion } from "./agent-loading-region"
import { Skeleton } from "@/app/components/ui/skeleton"

type Account = AgentConnectorDirectory["assigned"][number]

export function AgentConnectorTools({ account, siteId, agentId, active, refresh }: {
  account: Account; siteId: string; agentId: string; active: boolean; refresh: () => void
}) {
  const { t } = useLocalization()
  const [openedAt] = useState(Date.now)
  const { data, error, reload } = useConnectorResource(scopedConnectorPath(`connections/${account.id}/access`, siteId), accessSchema)
  if (error) return <ConnectorError error={error} retry={reload} />
  if (!data) return <AgentLoadingRegion><div className="space-y-2"><Skeleton className="h-4 w-28" /><Skeleton className="h-10 w-full" /></div></AgentLoadingRegion>
  if (!data.can_manage || data.connector_id !== account.id || data.revision !== account.revision ||
    !data.agents.some(grant => grant.agent_id === agentId && agentGrantIsCurrent(grant, openedAt))) {
    return <ConnectorError error={new ConnectorRequestError("conflict", 409)} retry={refresh} />
  }

  const prefix = account.toolkit_slug.toUpperCase().replaceAll("-", "_") + "_"
  const isMatchingTool = (slug: string) => exactToolIdPattern.test(slug) && slug.startsWith(prefix) && !slug.startsWith("COMPOSIO_")
  const reviewed = new Map(data.reviewed_tools?.filter(tool => isMatchingTool(tool.slug)).map(tool => [tool.slug, tool.description]))
  const all = data.policy.tool_access_mode === "all"
  const tools = all ? [...reviewed.keys()] : [...new Set(data.policy.allowed_tools.filter(isMatchingTool))]
  const assistant = data.policy.allowed_hosts.includes("assistant")
  const href = `/connectors/${encodeURIComponent(account.toolkit_slug)}?connector=${account.id}#tools-permissions`
  return <div className="space-y-3">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h4 className="text-sm font-semibold">{t("connectors.agentAccess.tools")}</h4>
      <Button asChild variant="outline" size="sm"><Link href={href}>{t("connectors.agentAccess.manage")}</Link></Button>
    </div>
    {!active || !account.available || !assistant ? <p className="text-sm text-muted-foreground">
      {t(!active ? "connectors.agentAccess.inactive" : !account.available ? "connectors.agentAccess.accountUnavailable" : "connectors.agentAccess.assistantDisabled")}
    </p> : <>
      <p className="text-sm text-muted-foreground">{t("connectors.agentAccess.toolHelp")}</p>
      {data.policy.require_approval && <p className="text-xs text-muted-foreground">{t("connectors.agentAccess.approval")}</p>}
      {tools.length > 0 ? <ul className="divide-y rounded-md border">
        {tools.map(slug => <li key={slug} className="space-y-1 px-3 py-2">
          <code className="break-all text-xs">{slug}</code>
          {reviewed.has(slug) ? <p className="break-words text-sm text-muted-foreground">{reviewed.get(slug)}</p>
            : <p className="text-xs text-muted-foreground">{t("connectors.agentAccess.notConfirmed")}</p>}
        </li>)}
      </ul> : <p className="text-sm text-muted-foreground">{t(all && !data.reviewed_tools ? "connectors.agentAccess.inventoryUnavailable" : "connectors.agentAccess.noTools")}</p>}
    </>}
  </div>
}