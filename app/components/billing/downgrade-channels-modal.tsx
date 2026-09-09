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
  targetSocialLimit: number
  targetAgentLimit: number
  targetAddonsCount: number
  busy?: boolean
  onConfirm: (keepKeys: string[]) => void
}

export function DowngradeChannelsModal({
  open,
  onOpenChange,
  site,
  targetSocialLimit,
  targetAgentLimit,
  targetAddonsCount,
  busy = false,
  onConfirm,
}: DowngradeChannelsModalProps) {
  const [accounts, setAccounts] = useState<ConnectedAccount[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!open) return
    const connected = listConnectedAccounts(site)
    setAccounts(connected)
    
    // Auto-select up to limits
    const socials = connected.filter(a => a.kind === "social")
    const channels = connected.filter(a => a.kind === "channel")
    
    let remainingAddons = targetAddonsCount
    const toKeep = new Set<string>()
    
    // Keep socials up to base limit
    socials.slice(0, targetSocialLimit).forEach(a => toKeep.add(a.key))
    const extraSocials = socials.slice(targetSocialLimit)
    
    // Keep channels up to base limit
    channels.slice(0, targetAgentLimit).forEach(a => toKeep.add(a.key))
    const extraChannels = channels.slice(targetAgentLimit)
    
    // Use addons for remaining
    for (const a of extraSocials) {
      if (remainingAddons > 0) {
        toKeep.add(a.key)
        remainingAddons--
      }
    }
    
    for (const a of extraChannels) {
      if (remainingAddons > 0) {
        toKeep.add(a.key)
        remainingAddons--
      }
    }
    
    setSelected(toKeep)
  }, [open, site, targetSocialLimit, targetAgentLimit, targetAddonsCount])

  const selectedSocialCount = Array.from(selected).filter(key => accounts.find(a => a.key === key)?.kind === "social").length
  const selectedAgentCount = Array.from(selected).filter(key => accounts.find(a => a.key === key)?.kind === "channel").length

  const missingSocial = Math.max(0, selectedSocialCount - targetSocialLimit)
  const missingAgent = Math.max(0, selectedAgentCount - targetAgentLimit)
  const usedAddons = missingSocial + missingAgent
  
  const isOverLimit = usedAddons > targetAddonsCount
  const canSelectMore = usedAddons < targetAddonsCount

  const channels = accounts.filter((account) => account.kind === "channel")
  const socials = accounts.filter((account) => account.kind === "social")

  const handleToggle = (key: string, checked: boolean) => {
    setSelected((current) => {
      const next = new Set(current)
      if (checked) {
        // Find if this new selection would exceed the limits
        const acc = accounts.find(a => a.key === key)
        if (!acc) return current
        
        let newMissingSocial = missingSocial
        let newMissingAgent = missingAgent
        
        if (acc.kind === "social") {
          if (selectedSocialCount >= targetSocialLimit) newMissingSocial++
        } else {
          if (selectedAgentCount >= targetAgentLimit) newMissingAgent++
        }
        
        if (newMissingSocial + newMissingAgent > targetAddonsCount) {
          // Cannot add
          return current
        }
        
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
            Your new plan includes {targetSocialLimit} social accounts and {targetAgentLimit} agent channels, plus {targetAddonsCount} add-on slots.
            You currently have {accounts.length} connected. Select the ones you want to keep.
            Unselected accounts will be removed.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="py-2">
          <div className="mb-2 flex items-center justify-between px-1 text-sm">
            <span className="font-medium text-muted-foreground">Accounts to keep</span>
            <span className={isOverLimit ? "font-semibold text-destructive" : "font-semibold"}>
              {usedAddons} / {targetAddonsCount} add-ons used
            </span>
          </div>

          <ScrollArea className="h-[250px] rounded-md border p-4">
            <div className="space-y-4">
              {channels.length > 0 && (
                <AccountGroup
                  title={`Agent Channels (${selectedAgentCount} / ${targetAgentLimit} base)`}
                  accounts={channels}
                  selected={selected}
                  canSelectMore={canSelectMore || selectedAgentCount < targetAgentLimit}
                  onToggle={handleToggle}
                />
              )}
              {socials.length > 0 && (
                <AccountGroup
                  title={`Social Networks (${selectedSocialCount} / ${targetSocialLimit} base)`}
                  accounts={socials}
                  selected={selected}
                  canSelectMore={canSelectMore || selectedSocialCount < targetSocialLimit}
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
  canSelectMore,
  onToggle,
}: {
  title: string
  accounts: ConnectedAccount[]
  selected: Set<string>
  canSelectMore: boolean
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
                disabled={!isSelected && !canSelectMore}
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
