"use client"

import { useId, useState } from 'react'
import useSWR from 'swr'
import { Button } from '@/app/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/app/components/ui/dropdown-menu'
import { Mail, MoreHorizontal } from '@/app/components/ui/icons'
import { useOptionalSite } from '@/app/context/SiteContext'
import { NewLeadMessageDialog } from '@/app/leads/components/NewLeadMessage'
import { isRealSiteId } from '@/lib/demo-utils'
import type { Supplier } from '../schema'
import { supplierResponse } from './client'
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/app/components/ui/dialog'

export function SupplierMessageOptions({ supplier, allowed }: { supplier: Pick<Supplier, 'id' | 'site_id' | 'name' | 'version'>; allowed: boolean }) {
  const currentSite = useOptionalSite()?.currentSite
  const triggerId = useId()
  const [openFor, setOpenFor] = useState<string>()
  const enabled = allowed && currentSite?.id === supplier.site_id && isRealSiteId(currentSite?.id)
  const scope = `${supplier.site_id}:${supplier.id}:${supplier.version}`
  const open = enabled && openFor === scope
  const { data, error, mutate } = useSWR(open ? ['supplier-message', supplier.site_id, supplier.id, supplier.version] as const : null,
    async ([, siteId, supplierId, version]) => {
      const response = await fetch(`/api/procurement/suppliers/${encodeURIComponent(supplierId)}?site_id=${encodeURIComponent(siteId)}`, { cache: 'no-store' })
      const result = await supplierResponse<{ supplier: Supplier }>(response)
      if (result.supplier.id !== supplierId || result.supplier.site_id !== siteId || result.supplier.version !== version) {
        throw new Error('Supplier details changed. Reload the supplier before composing.')
      }
      return result.supplier
    }, { revalidateOnFocus: false, revalidateOnReconnect: false, revalidateIfStale: false, shouldRetryOnError: false })
  if (!enabled || !currentSite) return null
  const restoreFocus = (event: Event) => { event.preventDefault(); document.getElementById(triggerId)?.focus() }

  return <>
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button id={triggerId} variant="ghost" size="icon" className="h-8 w-8 shrink-0" aria-label={`Options for ${supplier.name}`} title="Options">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onCloseAutoFocus={event => { if (open) event.preventDefault() }}>
        <DropdownMenuItem onSelect={() => setOpenFor(scope)}><Mail className="mr-2 h-4 w-4" /> New Message</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
    {data ? <NewLeadMessageDialog key={scope} site={currentSite} lead={data} open={open} onOpenChange={next => setOpenFor(next ? scope : undefined)}
      onCloseAutoFocus={restoreFocus} /> : <Dialog open={open} onOpenChange={next => { if (!next) setOpenFor(undefined) }}>
      <DialogContent onCloseAutoFocus={restoreFocus}>
        <DialogHeader><DialogTitle>New Message</DialogTitle><DialogDescription>{supplier.name}</DialogDescription></DialogHeader>
        <DialogBody>{error ? <div className="space-y-2"><p role="alert">{error instanceof Error ? error.message : 'Unable to load supplier contacts.'}</p>
          <Button variant="outline" onClick={() => void mutate()}>Retry</Button></div> : <p role="status">Loading contacts…</p>}</DialogBody>
      </DialogContent>
    </Dialog>}
  </>
}