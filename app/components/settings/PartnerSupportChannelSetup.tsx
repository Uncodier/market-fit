"use client"

import { Button } from "@/app/components/ui/button"
import { SectionCardContent, SectionCardFooter } from "@/app/components/ui/section-card"
import { getSupportChannelIcon } from "./support-channel-card-parts"

export function PartnerSupportChannelSetup({ type, status, invitationUrl, failureReason, connecting, checking, onConnect, onCheck }: {
  type: string; status: string; invitationUrl?: string; failureReason?: string
  connecting: boolean; checking: boolean; onConnect: () => void; onCheck: () => Promise<void>
}) {
  return <>
    <SectionCardContent className="pt-0">
      <div className="flex w-full flex-col justify-between gap-4 rounded-lg border bg-orange-50 p-4 dark:bg-orange-900/10 md:flex-row md:items-center">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-orange-100 text-orange-600 dark:bg-orange-900/20">
            {getSupportChannelIcon(type, 20)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-orange-800 dark:text-orange-200">{status === "failed" ? "Setup failed" : "Action Required"}</p>
            <p className="text-sm text-muted-foreground">{status === "failed" ? failureReason || "Authorization did not finish. You can retry the same link."
              : invitationUrl ? "Waiting for Meta authorization…" : "Authenticate to connect this account"}</p>
          </div>
        </div>
      </div>
    </SectionCardContent>
    <SectionCardFooter className="flex flex-wrap gap-2">
      <Button type="button" onClick={onConnect} disabled={connecting || checking}>
        {connecting ? "Connecting..." : invitationUrl ? "Continue Setup" : "Connect Account"}
      </Button>
      {invitationUrl && <Button variant="outline" type="button" disabled={checking} onClick={() => { void onCheck() }}>
        {checking ? "Checking..." : "Check setup status"}
      </Button>}
    </SectionCardFooter>
  </>
}