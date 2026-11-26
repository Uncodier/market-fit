"use client"

import Link from "next/link"
import { useId, useState } from "react"
import { Button } from "@/app/components/ui/button"
import { Plug, Plus } from "@/app/components/ui/icons"
import { Popover, PopoverClose, PopoverContent, PopoverTrigger } from "@/app/components/ui/popover"
import { scopedConnectorPath } from "@/app/connectors/connector-request"
import { connectionsSchema, isUsableConnector } from "@/app/connectors/types"
import { useConnectorResource } from "@/app/connectors/use-connector-resource"
import { ConnectorLogo, connectorToolkitLogo } from "@/app/connectors/connector-logo"
import { isRobotConnectorId } from "@/lib/navigation/robot-connector-hint"

type Props = {
  siteId?: string
  canSelect: boolean
  selectedId?: string | null
  selectedName?: string
  selectedToolkit?: string
  onChange: (id?: string) => void
  disabled?: boolean
}

export function ConnectorSelector({ siteId, canSelect, selectedId, selectedName, selectedToolkit, onChange, disabled }: Props) {
  const selectedLabel = selectedName && isRobotConnectorId(selectedId)
    ? `${selectedName} · ${selectedId.slice(-8)}` : selectedName
  return <Popover>
    <PopoverTrigger asChild>
      <Button type="button" variant="secondary" size="sm" disabled={disabled || !siteId}
        aria-label={selectedLabel ? `Select connector: ${selectedLabel}` : "Select connector"}
        title={selectedLabel || "Connectors"} className="relative h-8 px-2 sm:px-3">
        {selectedToolkit ? <ConnectorLogo compact src={connectorToolkitLogo(selectedToolkit)} name={selectedToolkit} />
          : <Plug className="h-4 w-4 text-sky-600" />}
        <span className="hidden max-w-24 truncate sm:inline">{selectedName || "connectors"}</span>
        {selectedId && <span aria-hidden="true" className="absolute right-1 top-1 size-1.5 rounded-full bg-sky-600 sm:hidden" />}
      </Button>
    </PopoverTrigger>
    <PopoverContent side="top" align="start" aria-label="Connector selection">
      <p className="mb-2 text-xs text-muted-foreground">Choose the account Ask should use. Match its ID here if Ask asks which connection you mean.</p>
      <fieldset disabled={disabled} className="min-w-0 space-y-2">
        <legend className="sr-only">Connector account</legend>
        {selectedId !== undefined && <Button type="button" variant="ghost" size="sm" onClick={() => onChange()}>
          Clear connector selection
        </Button>}
        {siteId && canSelect ? <ConnectorOptions key={siteId} siteId={siteId} selectedId={selectedId} onChange={onChange} />
          : <p className="text-sm text-muted-foreground">Connectors are unavailable in this conversation.</p>}
      </fieldset>
      <div className="mt-3 border-t pt-2">
        <PopoverClose asChild>
          <Link href="/connectors" className="flex items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <Plus className="h-4 w-4" /> Add New Connector
          </Link>
        </PopoverClose>
      </div>
    </PopoverContent>
  </Popover>
}

function ConnectorOptions({ siteId, selectedId, onChange }: Pick<Props, 'selectedId' | 'onChange'> & { siteId: string }) {
  const group = useId()
  const [search, setSearch] = useState("")
  const { data, error, reload } = useConnectorResource(scopedConnectorPath('connections', siteId), connectionsSchema)
  const accounts = (data?.items ?? []).filter(account => isRobotConnectorId(account.id) && isUsableConnector(account))
  const suffixCounts = new Map<string, number>()
  for (const { id } of accounts) suffixCounts.set(id.slice(-8), (suffixCounts.get(id.slice(-8)) ?? 0) + 1)
  const query = search.trim().toLowerCase()
  const matching = accounts.filter(account => `${account.display_name} ${account.toolkit_slug} ${account.id}`.toLowerCase().includes(query))
  if (error) return <div role="alert" className="text-sm">
    <p>Could not load connectors.</p><Button type="button" variant="outline" size="sm" onClick={reload}>Try again</Button>
  </div>
  if (!data) return <p role="status" className="text-sm text-muted-foreground">Loading connectors…</p>
  if (!accounts.length) return <p className="text-sm text-muted-foreground">No usable connectors in this workspace.</p>
  return <>
    <input aria-label="Filter connectors" placeholder="Find a connector" value={search} onChange={event => setSearch(event.target.value)}
      className="w-full rounded-md border bg-background p-1 text-sm" />
    <div className="grid max-h-44 grid-cols-1 gap-2 overflow-y-auto text-sm">
      {matching.map(account => <label key={account.id} className="flex min-w-0 items-center gap-2">
        <input type="radio" name={group} checked={account.id === selectedId} onChange={() => onChange(account.id)} />
        <ConnectorLogo compact src={connectorToolkitLogo(account.toolkit_slug)} name={account.toolkit_slug} />
        <span className="min-w-0 break-words">{account.display_name || account.toolkit_slug}
          <span className="block text-xs text-muted-foreground">{account.toolkit_slug} · Account {suffixCounts.get(account.id.slice(-8)) === 1 ? `…${account.id.slice(-8)}` : account.id}</span>
        </span>
      </label>)}
      {!matching.length && <p role="status" className="text-muted-foreground">No matching connectors.</p>}
    </div>
  </>
}