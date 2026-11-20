"use client"

import Link from "next/link"
import { useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useLocalization } from "@/app/context/LocalizationContext"
import { StickyHeader } from "@/app/components/ui/sticky-header"
import { Badge, badgeVariants } from "@/app/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/app/components/ui/tabs"
import { Label } from "@/app/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select"
import { SectionCard, SectionCardContent, SectionCardHeader } from "@/app/components/ui/section-card"
import { ConnectorAccessPanel } from "./connector-access"
import { ConnectorProviderMode } from "./connector-provider-mode"
import { ConnectorLogo } from "./connector-logo"
import { ConnectorTools } from "./connector-tools"
import { ConnectorEmpty, ConnectorError, ConnectorSiteScope } from "./connector-feedback"
import { ConnectorDetailSkeleton, connectorDetailBodyClassName } from "./connector-skeletons"
import { ConnectionActions } from "./connector-lifecycle"
import { BindProject } from "./connector-bind-project"
import { ConnectAccount } from "./connector-connect-account"
import { ConnectorRequestError, scopedConnectorPath } from "./connector-request"
import { detailSchema, type Connector } from "./types"
import { useConnectorResource } from "./use-connector-resource"

export function connectorStatus(connector: Connector) {
  if (connector.revocation_pending) return "revocationPending"
  const status = connector.provider_status.toUpperCase()
  if (["EXPIRED", "FAILED", "REVOKED", "INACTIVE"].includes(status)) return "reconnectRequired"
  if (status !== "ACTIVE" || !connector.verified_at) return "verificationPending"
  return connector.enabled ? "active" : "disabled"
}

export default function ConnectorDetailPage({ slug }: { slug: string }) {
  return <ConnectorSiteScope loading={<ConnectorDetailSkeleton fullPage />}>{(siteId, scope) => <DetailContent key={`${scope}:${slug}`} siteId={siteId} slug={slug} />}</ConnectorSiteScope>
}

export function DetailContent({ siteId, slug }: { siteId: string; slug: string }) {
  const { t } = useLocalization()
  const router = useRouter()
  const params = useSearchParams()
  const [tab, setTab] = useState("summary")
  const requestedAccount = params.get("connector")
  const { data, error, reload } = useConnectorResource(scopedConnectorPath(`catalog/${encodeURIComponent(slug)}`, siteId), detailSchema)
  const onlyAccount = data?.connections.length === 1 ? data.connections[0] : undefined
  const selected = requestedAccount ? data?.connections.find(connector => connector.id === requestedAccount)
    : onlyAccount?.enabled ? onlyAccount : undefined
  const supabaseDisconnect = selected?.toolkit_slug === "supabase" && selected.revocation_pending && !selected.enabled
  return <div className="flex-1">
    <Tabs value={tab} onValueChange={setTab}>
    <StickyHeader><div className="flex items-center py-3">
      <TabsList className="h-8 rounded-full bg-muted/30 p-0.5">
        <TabsTrigger value="summary" className="rounded-full px-4 text-xs">{t("connectors.summary")}</TabsTrigger>
        <TabsTrigger value="tools" className="rounded-full px-4 text-xs">{t("connectors.tools")}</TabsTrigger>
      </TabsList>
    </div></StickyHeader>
    <div className={connectorDetailBodyClassName}>
      <TabsContent value="tools"><ConnectorTools key={`${siteId}:${slug}`} siteId={siteId} slug={slug} /></TabsContent>
      <TabsContent value="summary" className="space-y-6">
      {error ? <ConnectorError error={error} retry={reload} /> : !data ? <ConnectorDetailSkeleton /> : <>
        <ConnectAccount siteId={siteId} detail={data} onChanged={reload} />
        <SectionCard id="overview"><SectionCardHeader title={data.toolkit.name} description={data.toolkit.description} />
          <SectionCardContent>
            <ConnectorLogo src={data.toolkit.logo} name={data.toolkit.name} />
            <div className="flex flex-wrap gap-2">{data.toolkit.domains.map(domain => <Badge key={domain} variant="outline">{domain}</Badge>)}</div>
            <p className="text-sm text-muted-foreground">{t("connectors.toolCount", { count: data.toolkit.tools_count })}</p>
            <p className="text-sm text-muted-foreground">{t("connectors.accessSeparate")}</p>
            <ConnectorProviderMode source={data.credential_source} />
          </SectionCardContent>
        </SectionCard>
        <SectionCard id="connection"><SectionCardHeader title={t("connectors.connection")} description={t("connectors.accountHelp")} />
          <SectionCardContent>
            {data.connections.length > 0 ? <div className="space-y-2"><Label>{t("connectors.account")}</Label>
              <Select value={selected?.id || ""} onValueChange={id => router.push(`/connectors/${encodeURIComponent(slug)}?connector=${encodeURIComponent(id)}`, { scroll: false })}>
                <SelectTrigger aria-label={t("connectors.account")}><SelectValue placeholder={t("connectors.selectAccount")} /></SelectTrigger>
                <SelectContent>{data.connections.map(connector => <SelectItem key={connector.id} value={connector.id} textValue={connector.display_name}>
                  <span className="inline-flex items-center gap-2">{connector.display_name}
                    {!connector.enabled && <span className={badgeVariants({ variant: "outline" })}>{t("connectors.disabledTag")}</span>}
                  </span>
                </SelectItem>)}</SelectContent>
              </Select>
            </div> : <p className="text-sm text-muted-foreground">{t("connectors.noVisibleAccounts")}</p>}
            {requestedAccount && !selected && <ConnectorError error={new ConnectorRequestError("not_found", 404)} />}
            {selected && <div className="space-y-3">
              <Badge variant="outline">{t(supabaseDisconnect ? "connectors.status.disabledInMakinari" : `connectors.status.${connectorStatus(selected)}`)}</Badge>
              {supabaseDisconnect ? <p className="text-sm text-muted-foreground">
                {t("connectors.supabaseDisconnectHelp")} {data.can_manage && <a className="underline" href="https://supabase.com/dashboard/account/tokens" target="_blank" rel="noopener noreferrer">{t("connectors.supabaseTokenLink")}</a>}
              </p> : <p className="text-sm text-muted-foreground">{t("connectors.reconnectHelp")}</p>}
              {data.can_manage && selected.revocation_pending && (!supabaseDisconnect || selected.revocation_dispatched === false) && <p className="text-xs text-muted-foreground">{t(selected.revocation_dispatched === false ? "connectors.revocationRetry" : "connectors.revocationVerify")}</p>}
              {data.can_manage && selected.toolkit_slug === "supabase" && selected.can_verify_supabase_project === true && connectorStatus(selected) === "active" &&
                <BindProject key={`${selected.id}:${selected.revision}`} siteId={siteId} connector={selected} onChanged={reload} />}
            </div>}
          </SectionCardContent>
          {selected && data.can_manage && <ConnectionActions key={`${selected.id}:${selected.revision}`} siteId={siteId} connector={selected} onChanged={reload} />}
        </SectionCard>
        {selected && <ConnectorAccessPanel key={`${selected.id}:${selected.revision}`} siteId={siteId} connector={selected} canManage={data.can_manage} onChanged={reload} />}
        {!selected && data.connections.length > 1 && !requestedAccount && <ConnectorEmpty title={t("connectors.selectAccount")} description={t("connectors.accountHelp")} />}
        <SectionCard id="related-skills"><SectionCardHeader title={t("connectors.relatedSkills")} description={t("connectors.skillsHelp")} />
          <SectionCardContent>{data.toolkit.skills.length ? <ul className="space-y-2 text-sm">{data.toolkit.skills.map(skill => <li key={skill}><Link className="text-primary hover:underline" href={`/skills?tab=makinari-skills#system-skill-${encodeURIComponent(skill)}`}>{skill}</Link></li>)}</ul> : <p className="text-sm text-muted-foreground">{t("connectors.noSkills")}</p>}</SectionCardContent>
        </SectionCard>
        <SectionCard id="activity"><SectionCardHeader title={t("connectors.activity")} />
          <SectionCardContent><p className="text-sm text-muted-foreground">{selected?.verified_at ? t("connectors.verifiedAt", { date: new Date(selected.verified_at).toLocaleString() }) : t("connectors.noVerification")}</p><p className="text-xs text-muted-foreground">{t("connectors.activityHelp")}</p></SectionCardContent>
        </SectionCard>
      </>}
      </TabsContent>
    </div>
    </Tabs>
  </div>
}