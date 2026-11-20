"use client"

import { useId, useState } from "react"
import { z } from "zod"
import { Button } from "@/app/components/ui/button"
import { Input } from "@/app/components/ui/input"
import { Label } from "@/app/components/ui/label"
import { useLocalization } from "@/app/context/LocalizationContext"
import { ConnectorError } from "./connector-feedback"
import { useConnectorMutation } from "./use-connector-resource"
import type { Connector } from "./types"

export function BindProject({ siteId, connector, onChanged }: { siteId: string; connector: Connector; onChanged: () => void }) {
  const { t } = useLocalization()
  const id = useId()
  // Deliberately empty: a mutable account label is not a project reference.
  const [ref, setRef] = useState("")
  const mutation = useConnectorMutation()
  const valid = ref.length === 20 && /^[a-z]{20}$/.test(ref)
  return <div className="space-y-2">
    <Label htmlFor={id}>{t("connectors.bindProjectRef")}</Label>
    <p className="text-sm text-muted-foreground" id={`${id}-help`}>{t("connectors.bindProjectHelp")}</p>
    <Input id={id} aria-describedby={`${id}-help`} value={ref} autoComplete="off" spellCheck={false} autoCapitalize="none"
      disabled={mutation.pending} onChange={e => setRef(e.target.value)} />
    <Button size="sm" type="button" variant="outline" disabled={!valid || mutation.pending || !!mutation.error} onClick={async () => {
      const result = await mutation.run(`/api/connectors/connections/${encodeURIComponent(connector.id)}/bind-project`, {
        site_id: siteId, expected_revision: connector.revision, project_ref: ref,
      }, z.object({ connector_id: z.literal(connector.id), revision: z.literal(connector.revision + 1) }))
      if (result) onChanged()
    }}>{t(mutation.pending ? "connectors.verifying" : "connectors.bindProject")}</Button>
    {!!mutation.error && <ConnectorError error={mutation.error} retry={onChanged} />}
  </div>
}