"use client"

import type { FormEvent } from "react"
import { isSocialMediaEntryConnected } from "@/app/components/settings/data-adapter"
import { DatePicker } from "@/app/components/ui/date-picker"
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogForm,
  DialogHeader,
  DialogTitle,
} from "@/app/components/ui/dialog"
import { EmptyCard } from "@/app/components/ui/empty-card"
import { Badge } from "@/app/components/ui/badge"
import { Button } from "@/app/components/ui/button"
import { Globe } from "@/app/components/ui/icons"
import { Switch } from "@/app/components/ui/switch"
import { getNetworkIcon } from "./content-detail-icons"

type Props = {
  publishingContent: any
  socialMedia: any[]
  selectedNetworks: string[]
  setSelectedNetworks: React.Dispatch<React.SetStateAction<string[]>>
  scheduleEnabled: boolean
  setScheduleEnabled: (enabled: boolean) => void
  scheduledDate: Date
  setScheduledDate: (date: Date) => void
  dateLabel: string
  close: () => void
  submit: (event: FormEvent) => void
  connectAccounts: () => void
}

export function ContentPublishDialog({
  publishingContent,
  socialMedia,
  selectedNetworks,
  setSelectedNetworks,
  scheduleEnabled,
  setScheduleEnabled,
  scheduledDate,
  setScheduledDate,
  dateLabel,
  close,
  submit,
  connectAccounts,
}: Props) {
  if (!publishingContent) return null

  const toggleNetwork = (id: string, checked: boolean) => {
    setSelectedNetworks((previous) => checked
      ? [...previous, id]
      : previous.filter((networkId) => networkId !== id))
  }

  return (
    <Dialog open onOpenChange={(open) => !open && close()}>
      <DialogContent size="sm">
        <DialogForm onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>Publish to Social Media</DialogTitle>
            <DialogDescription>
              Publish &quot;{publishingContent.title}&quot; to your connected social media accounts.
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="grid gap-4">
            {socialMedia.length === 0 ? (
              <EmptyCard
                icon={<Globe className="h-10 w-10 text-muted-foreground" />}
                title="No social accounts connected"
                description="Connect your social media accounts in settings to start publishing content directly from here."
                actionButton={<Button type="button" onClick={connectAccounts} className="mt-2">Connect Accounts</Button>}
              />
            ) : (
              <div className="space-y-4 pt-4">
                <p className="text-sm font-medium">Select Networks:</p>
                <div className="space-y-2">
                  {socialMedia.flatMap((social, socialIndex) => {
                    const ready = isSocialMediaEntryConnected(social)
                    const accounts = social.connectedPages?.length
                      ? social.connectedPages.map((page: any) => ({
                          id: page.id,
                          name: page.name || social.accountName || social.platform,
                        }))
                      : [{
                          id: social.account_id || social.accountId || social.id || social.platform,
                          name: social.accountName || social.platform,
                        }]

                    return accounts.map((account: { id: string; name: string }, accountIndex: number) => {
                      const inputId = `social-${social.platform}-${account.id}`
                      return (
                        <div key={`${socialIndex}-${accountIndex}`} className="flex items-center space-x-2">
                          <Switch
                            id={inputId}
                            checked={selectedNetworks.includes(account.id)}
                            onCheckedChange={(checked) => toggleNetwork(account.id, checked)}
                          />
                          <label htmlFor={inputId} className="flex flex-wrap items-center gap-2 text-sm font-medium capitalize leading-none">
                            {getNetworkIcon(social.platform)}
                            <span className="truncate">{account.name}</span>
                            {ready && (
                              <Badge variant="secondary" className="shrink-0 border-0 bg-green-100 text-[10px] font-medium text-green-800 dark:bg-green-900/40 dark:text-green-300">
                                Publish ready
                              </Badge>
                            )}
                          </label>
                        </div>
                      )
                    })
                  })}
                </div>
                <div className="mt-4 border-t pt-4">
                  <div className="mb-4 flex items-center space-x-2">
                    <Switch
                      id="schedule-post"
                      checked={scheduleEnabled}
                      onCheckedChange={setScheduleEnabled}
                    />
                    <label htmlFor="schedule-post" className="text-sm font-medium">
                      Schedule post for later
                    </label>
                  </div>
                  {scheduleEnabled && (
                    <div className="mt-4 grid gap-2">
                      <label className="text-xs text-muted-foreground">{dateLabel}</label>
                      <DatePicker date={scheduledDate} setDate={setScheduledDate} showTimePicker />
                    </div>
                  )}
                </div>
              </div>
            )}
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={close}>Cancel</Button>
            <Button type="submit" disabled={socialMedia.length === 0 || selectedNetworks.length === 0}>
              {scheduleEnabled && scheduledDate ? "Schedule" : "Publish Now"}
            </Button>
          </DialogFooter>
        </DialogForm>
      </DialogContent>
    </Dialog>
  )
}
