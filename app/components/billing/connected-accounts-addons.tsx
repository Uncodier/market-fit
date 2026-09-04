"use client"

import { Button } from "../ui/button"
import { SectionCard, SectionCardHeader, SectionCardContent } from "../ui/section-card"

interface ConnectedAccountsAddonsProps {
  totalConnectedAccounts: number
  includedAccounts: number
  addonsCount: number
  limitAccounts: number
  requiredAddons: number
  missingAddons: number
  accountsUsagePercentage: number
  isPaidPlan: boolean
  isSaving: boolean
  onManageAddons: () => void
}

export function ConnectedAccountsAddons({
  totalConnectedAccounts,
  includedAccounts,
  addonsCount,
  limitAccounts,
  requiredAddons,
  missingAddons,
  accountsUsagePercentage,
  isPaidPlan,
  isSaving,
  onManageAddons,
}: ConnectedAccountsAddonsProps) {
  return (
    <SectionCard id="addons">
      <SectionCardHeader
        title="Connected Accounts & Add-ons"
        description="Manage your account connection limits. Each add-on costs $10/month and grants you 1 extra account connection (WhatsApp, Messenger, Instagram, Email, Outstand, etc.) and +5 credits/month."
      />
      <SectionCardContent className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-sm font-medium mb-1">Connected Accounts</h4>
            <div className="text-sm text-muted-foreground">
              {totalConnectedAccounts} connected / {includedAccounts} included in plan
              {addonsCount > 0 ? ` + ${addonsCount} add-on${addonsCount === 1 ? "" : "s"}` : ""}
              {` (${totalConnectedAccounts}/${limitAccounts} available)`}
            </div>
            {missingAddons > 0 && (
              <div className="text-sm text-red-600 mt-1">
                Your current setup requires {requiredAddons} add-on{requiredAddons === 1 ? "" : "s"}. You still need {missingAddons} more.
              </div>
            )}
          </div>
          <div className="w-[120px]">
            <div className="h-2 w-full bg-muted overflow-hidden rounded-full">
              <div
                className={`h-full ${totalConnectedAccounts > limitAccounts ? "bg-red-500" : "bg-primary"}`}
                style={{ width: `${accountsUsagePercentage}%` }}
              />
            </div>
          </div>
        </div>

        {isPaidPlan ? (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 border rounded-lg">
            <div>
              <div className="font-medium">Current add-ons: {addonsCount}</div>
              <div className="text-sm text-muted-foreground">
                {requiredAddons > 0
                  ? `Current configuration requires ${requiredAddons} add-on${requiredAddons === 1 ? "" : "s"}.`
                  : "No extra add-ons required for the current configuration."}
              </div>
            </div>
            <Button variant="outline" onClick={onManageAddons} disabled={isSaving}>
              {isSaving ? "Processing..." : "Manage Add-ons"}
            </Button>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 border rounded-lg bg-muted/50">
            <div>
              <div className="font-medium">Add-ons unavailable on free plan</div>
              <div className="text-sm text-muted-foreground">Please upgrade to a paid subscription to purchase add-ons.</div>
            </div>
          </div>
        )}
      </SectionCardContent>
    </SectionCard>
  )
}
