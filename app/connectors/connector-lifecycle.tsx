"use client"

import { useState } from "react"
import { useLocalization } from "@/app/context/LocalizationContext"
import { Button } from "@/app/components/ui/button"
import { ConfirmDialog } from "@/app/components/ui/confirm-dialog"
import { SectionCardFooter } from "@/app/components/ui/section-card"
import { ConnectorError } from "./connector-feedback"
import type { Connector } from "./types"
import { mutationResultSchema, useConnectorMutation } from "./use-connector-resource"

export function ConnectionActions({ siteId, connector, onChanged }: { siteId: string; connector: Connector; onChanged: () => void }) {
  const { t } = useLocalization()
  const [open, setOpen] = useState(false)
  const disconnect = useConnectorMutation()
  const verify = useConnectorMutation()
  return <SectionCardFooter className="flex-wrap">
    {!!disconnect.error && <div className="w-full"><ConnectorError error={disconnect.error} retry={onChanged} /></div>}
    {!!verify.error && <div className="w-full"><ConnectorError error={verify.error} retry={onChanged} /></div>}
    <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)} disabled={disconnect.pending || !!disconnect.error || (connector.revocation_pending && connector.revocation_dispatched !== false)}>{t("connectors.disconnect")}</Button>
    <Button type="button" variant="outline" size="sm" disabled={verify.pending || !!verify.error} onClick={async () => {
      const result = await verify.run(`/api/connectors/connections/${encodeURIComponent(connector.id)}/sync`, {
        site_id: siteId, expected_revision: connector.revision,
      }, mutationResultSchema)
      if (result !== undefined) onChanged()
    }}>{t(verify.pending ? "connectors.verifying" : "connectors.verifyProvider")}</Button>
    <ConfirmDialog open={open} onOpenChange={setOpen} title={t("connectors.disconnectTitle")} description={t("connectors.disconnectHelp")} confirmLabel={t("connectors.disconnect")} cancelLabel={t("connectors.cancel")} variant="destructive" loading={disconnect.pending} onConfirm={async () => {
      const result = await disconnect.run(`/api/connectors/connections/${encodeURIComponent(connector.id)}/disconnect`, { site_id: siteId, expected_revision: connector.revision }, mutationResultSchema)
      if (result !== undefined) onChanged()
    }} />
  </SectionCardFooter>
}