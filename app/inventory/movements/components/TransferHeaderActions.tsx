"use client"

import { Button } from "@/app/components/ui/button"
import { MoreHorizontal, X, ClipboardList } from "@/app/components/ui/icons"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/app/components/ui/dropdown-menu"
import { TopBarPrimaryActions } from "@/app/components/navigation/topbar-primary-actions"
import type { TransferTransitionInput } from "../order-schema"
import { transferLabel } from "../transfer-presentation"

type Action = TransferTransitionInput["action"]
export function TransferPrimaryAction({ action, pending, disabled, onSelect, onRetry }: {
  action?: Action; pending: boolean; disabled: boolean; onSelect: (action: Action) => void; onRetry: () => void
}) {
  if (!pending && !action) return null
  const label = pending ? "Retry original operation" : `${transferLabel(action!)} Transfer`
  return <TopBarPrimaryActions><Button aria-label={label} title={label} disabled={disabled}
    className="!min-w-0 sm:!min-w-[155px] md:!min-w-[200px] !w-9 sm:!w-auto !h-9 !p-0 sm:!px-3.5 rounded-full font-medium text-sm"
    onClick={() => pending ? onRetry() : onSelect(action!)}>
    <ClipboardList className="h-4 w-4 shrink-0" /><span className="hidden sm:inline ml-2">{label}</span>
  </Button></TopBarPrimaryActions>
}

export function TransferSecondaryActions({ actions, disabled, onSelect }: {
  actions: Action[]; disabled: boolean; onSelect: (action: Action) => void
}) {
  if (!actions.length) return null
  return <DropdownMenu><DropdownMenuTrigger asChild>
    <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Transfer options" disabled={disabled}>
      <MoreHorizontal className="h-4 w-4" />
    </Button>
  </DropdownMenuTrigger><DropdownMenuContent align="end">
    {actions.map(action => <DropdownMenuItem key={action} disabled={disabled}
      className={action === "cancel" ? "text-destructive focus:text-destructive" : undefined}
      onSelect={() => onSelect(action)}>
      {action === "cancel" ? <X className="h-4 w-4 mr-2" /> : <ClipboardList className="h-4 w-4 mr-2" />}
      {action === "cancel" ? "Cancel transfer" : "Resolve differences"}
    </DropdownMenuItem>)}
  </DropdownMenuContent></DropdownMenu>
}