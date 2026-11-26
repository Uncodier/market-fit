"use client"

import Link from "next/link"
import { useCallback, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useDebouncedCallback } from "use-debounce"
import { useLocalization } from "@/app/context/LocalizationContext"
import { StickyHeader } from "@/app/components/ui/sticky-header"
import { SearchInput } from "@/app/components/ui/search-input"
import { Badge, badgeVariants } from "@/app/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/app/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select"
import { SectionCard, SectionCardContent, SectionCardHeader } from "@/app/components/ui/section-card"
import { ConnectorAccessPanel } from "./connector-access"
import { ConnectorRename } from "./connector-rename"
import { ConnectorProviderMode } from "./connector-provider-mode"
import { ConnectorLogo } from "./connector-logo"
import { ConnectorTools, ConnectorToolsLoading } from "./connector-tools"
import { ConnectorError, ConnectorSiteScope } from "./connector-feedback"
import {
  ConnectorAccountSkeleton, ConnectorDetailSkeleton, connectorAccountControlClassName,
  connectorDetailBodyClassName, connectorDetailToolbarClassName,
} from "./connector-skeletons"
import { ConnectionActions } from "./connector-lifecycle"
import { ConnectAccount } from "./connector-connect-account"
import { canRecoverLocalAccounts, ConnectorRequestError, scopedConnectorPath } from "./connector-request"
import { LocalAccountRecovery } from "./local-account-recovery"
import { detailSchema, type Connector } from "./types"
import { useConnectorResource } from "./use-connector-resource"

export function connectorStatus(connector: Connector) {
  if (connector.revocation_pending) return "revocationPending"
  const status = connector.provider_status.toUpperCase()
  if (["EXPIRED", "FAILED", "REVOKED", "INACTIVE"].includes(status)) return "reconnectRequired"
  if (status !== "ACTIVE" || !connector.verified_at) return "verificationPending"
  return connector.enabled ? "active" : "disabled"
}

function latestActiveConnector(connections: readonly Connector[]) {
  let latest: Connector | undefined
  let latestVerification = -Infinity
  for (const connector of connections) {
    if (connectorStatus(connector) !== "active" || !connector.verified_at) continue
    const verifiedAt = Date.parse(connector.verified_at)
    if (verifiedAt > latestVerification) {
      latest = connector
      latestVerification = verifiedAt
    }
  }
  return latest
}

export default function ConnectorDetailPage({ slug }: { slug: string }) {
  const workspace = useSearchParams().get("workspace")
  const { t } = useLocalization()
  return <ConnectorSiteScope loading={<ConnectorDetailSkeleton fullPage />}>{(siteId, scope) =>
    workspace && workspace !== siteId ? <p role="status" className="p-6 text-sm">{t("connectors.reviewOriginalWorkspace")}</p>
      : <DetailContent key={`${scope}:${slug}`} siteId={siteId} slug={slug} />}</ConnectorSiteScope>
}

export function DetailContent({ siteId, slug }: { siteId: string; slug: string }) {
  const { t } = useLocalization()
  const router = useRouter()
  const params = useSearchParams()
  const [tab, setTab] = useState("summary")
  const [searchInput, setSearchInput] = useState("")
  const [toolSearch, setToolSearch] = useState("")
  const debounceToolSearch = useDebouncedCallback(setToolSearch, 250)
  const onSearchExpanded = useCallback((expanded: boolean) => {
    if (expanded) setTab("tools")
  }, [])
  const searchLabel = t("connectors.searchToolsHeader")
  const requestedAccount = params.get("connector")
  const { data, error, reload } = useConnectorResource(scopedConnectorPath(`catalog/${encodeURIComponent(slug)}`, siteId), detailSchema)
  const selected = requestedAccount ? data?.connections.find(connector => connector.id === requestedAccount)
    : latestActiveConnector(data?.connections ?? [])
  const supabaseDisconnect = selected?.toolkit_slug === "supabase" && selected.revocation_pending && !selected.enabled
  return <div className="flex-1">
    <Tabs value={tab} onValueChange={setTab}>
    <StickyHeader><div className={connectorDetailToolbarClassName}>
      <TabsList className="h-8 rounded-full bg-muted/30 p-0.5">
        <TabsTrigger value="summary" className="rounded-full px-4 text-xs">{t("connectors.summary")}</TabsTrigger>
        <TabsTrigger value="tools" className="rounded-full px-4 text-xs">{t("connectors.tools")}</TabsTrigger>
      </TabsList>
      <form role="search" aria-label={searchLabel} className="min-w-0 max-w-full" onSubmit={event => {
        event.preventDefault()
        setTab("tools")
        debounceToolSearch.flush()
      }}>
        <SearchInput aria-label={searchLabel} placeholder={searchLabel} value={searchInput} maxLength={200}
          containerClassName="w-64 max-w-full" enterKeyHint="search" onExpandedChange={onSearchExpanded}
          onSearch={value => {
            setTab("tools")
            setSearchInput(value)
            const query = value.trim().slice(0, 200)
            if (query) debounceToolSearch(query)
            else {
              debounceToolSearch.cancel()
              setToolSearch("")
            }
          }} />
      </form>
      {!data && !error && <ConnectorAccountSkeleton />}
      {data && data.connections.length > 0 && <Select value={selected?.id ?? ""} onValueChange={id => {
        const nextParams = new URLSearchParams(params.toString())
        nextParams.set("connector", id)
        router.push(`/connectors/${encodeURIComponent(slug)}?${nextParams.toString()}`, { scroll: false })
      }}>
        <SelectTrigger aria-label={t("connectors.account")} className={connectorAccountControlClassName}>
          <SelectValue placeholder={t("connectors.selectAccount")} />
        </SelectTrigger>
        <SelectContent align="end">{data.connections.map(connector => <SelectItem key={connector.id} value={connector.id} textValue={connector.display_name} className="[&>span]:min-w-0">
          <span className="flex min-w-0 items-center gap-2">
            <span className="truncate" title={connector.display_name}>{connector.display_name}</span>
            {!connector.enabled && <span className={badgeVariants({ variant: "outline", className: "shrink-0" })}>{t("connectors.disabledTag")}</span>}
          </span>
        </SelectItem>)}</SelectContent>
      </Select>}
    </div></StickyHeader>
    <div className={connectorDetailBodyClassName}>
      <TabsContent value="tools">{searchInput.trim().slice(0, 200) !== toolSearch
        ? <ConnectorToolsLoading />
        : <ConnectorTools key={`${siteId}:${slug}:${toolSearch}`} siteId={siteId} slug={slug} search={toolSearch} />}</TabsContent>
      <TabsContent value="summary" className="space-y-6">
      {error ? <><ConnectorError error={error} retry={reload} />
        {canRecoverLocalAccounts(error) && <LocalAccountRecovery key={`${siteId}:${slug}:${requestedAccount ?? ""}`} siteId={siteId} slug={slug} requestedAccount={requestedAccount} />}
      </> : !data ? <ConnectorDetailSkeleton /> : <>
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
            {!data.connections.length && <p className="text-sm text-muted-foreground">{t(data.connection_setup?.kind === "no_auth" ? "connectors.noAccountRequired" : "connectors.noVisibleAccounts")}</p>}
            {data.connections.length > 0 && !selected && !requestedAccount && <p className="text-sm text-muted-foreground">{t("connectors.noActiveAccounts")}</p>}
            {requestedAccount && !selected && <ConnectorError error={new ConnectorRequestError("not_found", 404)} />}
            {selected && <div className="space-y-3">
              {data.can_manage && <ConnectorRename key={`${siteId}:${selected.id}:${selected.revision}`} siteId={siteId} connector={selected} onChanged={reload} />}
              <Badge variant="outline">{t(supabaseDisconnect ? "connectors.status.disabledInMakinari" : `connectors.status.${connectorStatus(selected)}`)}</Badge>
              {supabaseDisconnect ? <p className="text-sm text-muted-foreground">
                {t("connectors.supabaseDisconnectHelp")} {data.can_manage && <a className="underline" href="https://supabase.com/dashboard/account/tokens" target="_blank" rel="noopener noreferrer">{t("connectors.supabaseTokenLink")}</a>}
              </p> : <p className="text-sm text-muted-foreground">{t("connectors.reconnectHelp")}</p>}
              {data.can_manage && selected.revocation_pending && (!supabaseDisconnect || selected.revocation_dispatched === false) && <p className="text-xs text-muted-foreground">{t(selected.revocation_dispatched === false ? "connectors.revocationRetry" : "connectors.revocationVerify")}</p>}
            </div>}
          </SectionCardContent>
          {selected && data.can_manage && <ConnectionActions key={`${selected.id}:${selected.revision}`} siteId={siteId} connector={selected} onChanged={reload} />}
        </SectionCard>
        {selected && <ConnectorAccessPanel key={`${selected.id}:${selected.revision}`} siteId={siteId} connector={selected} canManage={data.can_manage} onChanged={reload} />}
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