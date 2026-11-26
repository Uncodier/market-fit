import { useState } from "react"
import Link from "next/link"
import { Button } from "@/app/components/ui/button"
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/app/components/ui/dialog"
import { Plus } from "@/app/components/ui/icons"
import { useLocalization } from "@/app/context/LocalizationContext"
import { agentConnectorGrantReceipt, type AgentConnectorDirectory } from "@/app/connectors/agent-access-contract"
import { ConnectorError } from "@/app/connectors/connector-feedback"
import { useConnectorMutation } from "@/app/connectors/use-connector-resource"

export function AddAgentConnectorDialog({ accounts, siteId, agentId, refresh }: {
  accounts: AgentConnectorDirectory["available"]; siteId: string; agentId: string; refresh: () => void
}) {
  const { t } = useLocalization()
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState("")
  const mutation = useConnectorMutation()
  const account = accounts.find(item => item.id === selected)

  async function add() {
    if (!account || mutation.pending || mutation.error) return
    const receipt = await mutation.run(`/api/connectors/connections/${account.id}/access`, {
      site_id: siteId, expected_revision: account.revision,
      members: [], agents: [{ agent_id: agentId, enabled: true, expires_at: null }],
    }, agentConnectorGrantReceipt(account.id, account.revision), "PATCH")
    if (!receipt) return
    setOpen(false)
    refresh()
  }

  return <Dialog open={open} onOpenChange={value => {
    if (!mutation.pending) { setOpen(value); setSelected("") }
  }}>
    <DialogTrigger asChild><Button type="button" size="sm" variant="outline">
      <Plus aria-hidden />{t("connectors.agentAccess.add")}
    </Button></DialogTrigger>
    <DialogContent busy={mutation.pending}>
      <DialogHeader>
        <DialogTitle>{t("connectors.agentAccess.add")}</DialogTitle>
        <DialogDescription>{t("connectors.agentAccess.addHelp")}</DialogDescription>
      </DialogHeader>
      <DialogBody className="space-y-3">
        {!!mutation.error && <ConnectorError error={mutation.error} retry={refresh} />}
        {accounts.length ? <fieldset className="space-y-2" disabled={mutation.pending || !!mutation.error}>
          <legend className="mb-2 text-sm font-medium">{t("connectors.agentAccess.configured")}</legend>
          {accounts.map(item => <label key={item.id} className="flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm has-[:checked]:border-primary">
            <input type="radio" name="agent-connector" checked={selected === item.id} onChange={() => setSelected(item.id)} />
            <span className="min-w-0 break-words"><span className="block font-medium">{item.display_name}</span>
              <span className="text-xs text-muted-foreground">{item.toolkit_slug} · {item.id.slice(-8)}</span></span>
          </label>)}
        </fieldset> : <p className="text-sm text-muted-foreground">{t("connectors.agentAccess.noConfigured")}</p>}
      </DialogBody>
      <DialogFooter>
        {!mutation.pending && <Button asChild variant="outline" size="sm"><Link href="/connectors">{t("connectors.agentAccess.browse")}</Link></Button>}
        {accounts.length > 0 && <Button size="sm" type="button" disabled={!account || mutation.pending || !!mutation.error} onClick={() => void add()}>
          {t(mutation.pending ? "connectors.agentAccess.adding" : "connectors.agentAccess.grant")}
        </Button>}
      </DialogFooter>
    </DialogContent>
  </Dialog>
}