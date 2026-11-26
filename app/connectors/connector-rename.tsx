"use client"

import { useId, useState } from "react"
import { Button } from "@/app/components/ui/button"
import { Input } from "@/app/components/ui/input"
import { Label } from "@/app/components/ui/label"
import { useLocalization } from "@/app/context/LocalizationContext"
import { accountManagementReceipt, connectionName } from "./account-management-contract"
import { ConnectorError } from "./connector-feedback"
import type { Connector } from "./types"
import { useConnectorMutation } from "./use-connector-resource"

export function ConnectorRename({ siteId, connector, onChanged }: { siteId: string; connector: Connector; onChanged: () => void }) {
  const { t } = useLocalization()
  const id = useId()
  const [draft, setDraft] = useState(connector.display_name)
  const mutation = useConnectorMutation()
  const name = connectionName.safeParse(draft)
  const disabled = mutation.pending || !!mutation.error || !name.success || name.data === connector.display_name

  return <form className="space-y-2" onSubmit={async event => {
    event.preventDefault()
    if (disabled || !name.success) return
    const update = { operation: "rename", display_name: name.data } as const
    const receipt = await mutation.run(`/api/connectors/connections/${encodeURIComponent(connector.id)}/manage`,
      { site_id: siteId, expected_revision: connector.revision, ...update },
      accountManagementReceipt(connector.id, connector.revision, update), "PATCH")
    if (receipt) onChanged()
  }}>
    <Label htmlFor={id}>{t("connectors.connectionName")}</Label>
    <div className="flex flex-wrap items-center gap-2">
      <Input id={id} className="w-full sm:max-w-xs" value={draft} maxLength={200} required
        aria-describedby={`${id}-help`} disabled={mutation.pending || !!mutation.error} onChange={event => setDraft(event.target.value)} />
      <Button type="submit" variant="outline" size="sm" disabled={disabled}>
        {t(mutation.pending ? "connectors.saving" : "connectors.saveConnectionName")}
      </Button>
    </div>
    <p id={`${id}-help`} className="text-xs text-muted-foreground">{t("connectors.connectionNameHelp")}</p>
    {!!mutation.error && <ConnectorError error={mutation.error} retry={onChanged} />}
  </form>
}