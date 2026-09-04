"use client"

import { useEffect, useState } from "react"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/app/components/ui/alert-dialog"
import { Button } from "@/app/components/ui/button"
import { Checkbox } from "@/app/components/ui/checkbox"
import { ScrollArea } from "@/app/components/ui/scroll-area"
import { ChannelIcon } from "@/app/components/channels/channel-icon"
import type { Site } from "@/app/context/site-types"
import { listConnectedAccounts, type ConnectedAccount } from "./downgrade-accounts"

interface DowngradeChannelsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  site: Partial<Site> | null | undefined
  targetLimit: number
  busy?: boolean
  onConfirm: (keepKeys: string[]) => void
}

export function DowngradeChannelsModal({
  open,
  onOpenChange,
  site,
  targetLimit,
  busy = false,
  onConfirm,
}: DowngradeChannelsModalProps) {
  const [accounts, setAccounts] = useState<ConnectedAccount[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!open) return
    const connected = listConnectedAccounts(site)
    setAccounts(connected)
    setSelected(new Set(connected.slice(0, targetLimit).map((account) => account.key)))
  }, [open, site, targetLimit])

  const selectedCount = selected.size
  const isOverLimit = selectedCount > targetLimit
  const channels = accounts.filter((account) => account.kind === "channel")
  const socials = accounts.filter((account) => account.kind === "social")

  const handleToggle = (key: string, checked: boolean) => {
    setSelected((current) => {
      const next = new Set(current)
      if (checked) {
        if (next.size >= targetLimit && !next.has(key)) return current
        next.add(key)
      } else {
        next.delete(key)
      }
      return next
    })
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!busy) onOpenChange(next)
      }}
    >
      <AlertDialogContent className="sm:max-w-[500px]" busy={busy}>
        <AlertDialogHeader>
          <AlertDialogTitle>Choose accounts to keep</AlertDialogTitle>
          <AlertDialogDescription>
            Your new plan includes {targetLimit} connected {targetLimit === 1 ? "account" : "accounts"}.
            You currently have {accounts.length}. Select the ones you want to keep.
            Unselected accounts will be removed.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="py-2">
          <div className="mb-2 flex items-center justify-between px-1 text-sm">
            <span className="font-medium text-muted-foreground">Accounts to keep</span>
            <span className={isOverLimit ? "font-semibold text-destructive" : "font-semibold"}>
              {selectedCount} / {targetLimit} selected
            </span>
          </div>

          <ScrollArea className="h-[250px] rounded-md border p-4">
            <div className="space-y-4">
              {channels.length > 0 && (
                <AccountGroup
                  title="Channels"
                  accounts={channels}
                  selected={selected}
                  targetLimit={targetLimit}
                  selectedCount={selectedCount}
                  onToggle={handleToggle}
                />
              )}
              {socials.length > 0 && (
                <AccountGroup
                  title="Social Networks"
                  accounts={socials}
                  selected={selected}
                  targetLimit={targetLimit}
                  selectedCount={selectedCount}
                  onToggle={handleToggle}
                />
              )}
            </div>
          </ScrollArea>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
          <Button
            type="button"
            variant="destructive"
            disabled={isOverLimit || busy}
            onClick={() => onConfirm(Array.from(selected))}
          >
            {busy ? "Disconnecting..." : "Confirm Downgrade"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

function AccountGroup({
  title,
  accounts,
  selected,
  targetLimit,
  selectedCount,
  onToggle,
}: {
  title: string
  accounts: ConnectedAccount[]
  selected: Set<string>
  targetLimit: number
  selectedCount: number
  onToggle: (key: string, checked: boolean) => void
}) {
  return (
    <div>
      <h4 className="mb-2 text-sm font-semibold">{title}</h4>
      <div className="space-y-3">
        {accounts.map((account) => {
          const isSelected = selected.has(account.key)
          return (
            <div key={account.key} className="flex flex-row items-center space-x-3">
              <Checkbox
                id={account.key}
                checked={isSelected}
                onCheckedChange={(checked) => onToggle(account.key, checked === true)}
                disabled={!isSelected && selectedCount >= targetLimit}
              />
              <label
                htmlFor={account.key}
                className="flex w-full cursor-pointer items-center gap-2 text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                <ChannelIcon channel={account.platform} size={16} />
                <span className="truncate">{account.label}</span>
              </label>
            </div>
          )
        })}
      </div>
    </div>
  )
}
