import { useState } from "react"
import Link from "next/link"
import { useLocalization } from "@/app/context/LocalizationContext"
import { Accordion, AccordionContent, AccordionHeader, AccordionItem, AccordionTrigger } from "@/app/components/ui/accordion"
import { Button } from "@/app/components/ui/button"
import { Plug } from "@/app/components/ui/icons"
import { SectionCard } from "@/app/components/ui/section-card"
import { AgentConnectorsSkeleton } from "@/app/agents/agent-detail-skeletons"
import { agentConnectorDirectorySchema } from "@/app/connectors/agent-access-contract"
import { ConnectorEmpty, ConnectorError } from "@/app/connectors/connector-feedback"
import { ConnectorRequestError } from "@/app/connectors/connector-request"
import { useConnectorResource } from "@/app/connectors/use-connector-resource"
import { AddAgentConnectorDialog } from "./add-agent-connector-dialog"
import { AgentConnectorTools } from "./agent-connector-tools"

export function AgentConnectorsTab({ siteId, agentId, showDetailsLink = false }: { siteId: string; agentId: string; showDetailsLink?: boolean }) {
  const { t } = useLocalization()
  const [expanded, setExpanded] = useState("")
  const params = new URLSearchParams({ site_id: siteId, agent_id: agentId })
  const { data, error, reload } = useConnectorResource(`/api/connectors/agent-access?${params}`, agentConnectorDirectorySchema)
  if (error) return error instanceof ConnectorRequestError && error.status === 403
    ? <ConnectorEmpty title={t("connectors.title")} description={t("connectors.agentAccess.managerOnly")} />
    : <ConnectorError error={error} retry={reload} />
  if (!data) return <AgentConnectorsSkeleton />

  return <section className="space-y-6">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0 flex-1 basis-56">
        <h2 className="text-xl font-semibold">{t("connectors.title")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t("connectors.agentAccess.summary")}</p>
        {!data.active && <p className="mt-1 text-sm text-muted-foreground">{t("connectors.agentAccess.inactive")}</p>}
      </div>
      <div className="flex flex-wrap gap-2">
        {showDetailsLink && <Button asChild variant="ghost" size="sm"><Link href={`/agents/${agentId}/connectors`}>{t("connectors.agentAccess.openView")}</Link></Button>}
        {data.active && <AddAgentConnectorDialog accounts={data.available} siteId={siteId} agentId={agentId} refresh={reload} />}
      </div>
    </div>
    {data.assigned.length === 0 ? <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
      {t("connectors.agentAccess.none")}
    </p> : <Accordion type="single" collapsible value={expanded} onValueChange={setExpanded} className="space-y-2">
      {data.assigned.map(account => <SectionCard key={account.id}>
        <AccordionItem value={account.id} className="border-0">
          <AccordionHeader><AccordionTrigger className="gap-3 px-4 text-left hover:no-underline">
            <span className="flex min-w-0 items-center gap-3">
              <Plug aria-hidden className="size-5 shrink-0 text-muted-foreground" />
              <span className="min-w-0 break-words"><span className="block font-semibold">{account.display_name}</span>
                <span className="text-xs text-muted-foreground">{account.toolkit_slug} · {account.id.slice(-8)}
                  {!account.available && ` · ${t("connectors.agentAccess.unavailable")}`}</span></span>
            </span>
          </AccordionTrigger></AccordionHeader>
          <AccordionContent className="border-t px-4 pt-4">
            {expanded === account.id && <AgentConnectorTools key={account.revision} account={account} siteId={siteId} agentId={agentId} active={data.active} refresh={reload} />}
          </AccordionContent>
        </AccordionItem>
      </SectionCard>)}
    </Accordion>}
  </section>
}