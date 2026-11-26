"use client"

import { z } from "zod"
import { useLocalization } from "@/app/context/LocalizationContext"
import { SectionCard, SectionCardContent, SectionCardHeader } from "@/app/components/ui/section-card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select"
import { useState } from "react"
import { ConnectorError } from "./connector-feedback"
import { DirectPolicyControls } from "./provider-direct-settings"
import { scopedConnectorPath } from "./connector-request"
import { connectionsSchema } from "./types"
import { useConnectorResource } from "./use-connector-resource"

const localAccounts = connectionsSchema.extend({ can_manage: z.boolean() })

/** No upstream catalogue, sync, auth-config or tool lookup is needed to revoke a local grant. */
export function LocalAccountRecovery({ siteId, slug, requestedAccount }: {
  siteId: string; slug?: string; requestedAccount?: string | null
}) {
  const { t } = useLocalization()
  const { data, error, reload } = useConnectorResource(scopedConnectorPath("connections", siteId), localAccounts)
  const [chosen, setChosen] = useState<string>()
  if (error) return <ConnectorError error={error} retry={reload} />
  if (!data) return <p role="status">{t("connectors.loading")}</p>
  if (!data.can_manage) return null
  const accounts = data.items.filter(account => (!slug || account.toolkit_slug === slug) && (!requestedAccount || account.id === requestedAccount))
  if (!accounts.length) return <p>{t("connectors.noVisibleAccounts")}</p>
  const current = accounts.find(account => account.id === (requestedAccount || chosen)) ??
    (!chosen && !requestedAccount && accounts.length === 1 ? accounts[0] : undefined)
  return <SectionCard>
    <SectionCardHeader title={t("connectors.localRecoveryTitle")} description={t("connectors.localRecoveryHelp")} />
    <SectionCardContent>
      {accounts.length > 1 && <Select value={current?.id ?? ""} onValueChange={setChosen}>
        <SelectTrigger aria-label={t("connectors.account")}><SelectValue placeholder={t("connectors.selectAccount")} /></SelectTrigger>
        <SelectContent>{accounts.map(account => <SelectItem key={account.id} value={account.id}>{account.display_name}</SelectItem>)}</SelectContent>
      </Select>}
      {current && <div key={`${siteId}:${current.id}:${current.revision}`} className="space-y-4">
        <p className="text-sm font-medium">{current.display_name}</p>
        <h4 className="font-medium">{t("connectors.directTitle")}</h4>
        <DirectPolicyControls siteId={siteId} connector={current} onChanged={reload} />
      </div>}
    </SectionCardContent>
  </SectionCard>
}
