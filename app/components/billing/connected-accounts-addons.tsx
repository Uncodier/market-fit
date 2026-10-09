"use client"

import { useState } from "react"
import { Button } from "../ui/button"
import { SectionCard, SectionCardHeader, SectionCardContent, SectionCardFooter } from "../ui/section-card"
import { BillingHelpTooltip } from "./billing-help-tooltip"
import { type BillingInterval, formatPrice, subscriptionPrice } from "@/lib/billing-pricing"
import { useLocalization } from "@/app/context/LocalizationContext"

interface ConnectedAccountsAddonsProps {
  totalSocialAccounts: number
  totalAgentChannels: number
  socialLimit: number
  agentLimit: number
  addonsCount: number
  billingInterval?: BillingInterval
  requiredAddons: number
  missingAddons: number
  socialUsagePercentage: number
  agentUsagePercentage: number
  isSaving: boolean
  onManageAddons: (count: number) => void
}

export function ConnectedAccountsAddons({
  totalSocialAccounts,
  totalAgentChannels,
  socialLimit,
  agentLimit,
  addonsCount,
  billingInterval = 'month',
  requiredAddons,
  missingAddons,
  socialUsagePercentage,
  agentUsagePercentage,
  isSaving,
  onManageAddons,
}: ConnectedAccountsAddonsProps) {
  const { t } = useLocalization()
  const label = (key: string, fallback: string) => t(key) || fallback
  const [target, setTarget] = useState<number | null>(null)
  const selectedCount = target ?? addonsCount
  const price = subscriptionPrice(10, billingInterval)
  const description = billingInterval === 'year'
    ? t('billing.addons.descriptionAnnual', { price: formatPrice(price.total), monthlyPrice: formatPrice(price.monthlyEquivalent), percent: 10 }) || `Manage your account connection limits. Each add-on costs ${formatPrice(price.total)}/year (${formatPrice(price.monthlyEquivalent)}/month equivalent, billed annually; save 10%) and grants you 1 extra account connection (either Social or Agent channel) and +1 credit/month.`
    : t('billing.addons.descriptionMonthly', { price: formatPrice(price.total) }) || `Manage your account connection limits. Each add-on costs ${formatPrice(price.total)}/month and grants you 1 extra account connection (either Social or Agent channel) and +1 credit/month.`
  const totalPrice = formatPrice(price.total * addonsCount)
  const monthlyPrice = formatPrice(price.monthlyEquivalent * addonsCount)
  const title = label('billing.addons.title', 'Connected Accounts & Add-ons')
  const intervalLabel = billingInterval === 'year'
    ? label('billing.interval.year', 'year') : label('billing.interval.month', 'month')
  const selectedPrice = formatPrice(price.total * selectedCount)
  const selectedMonthlyPrice = formatPrice(price.monthlyEquivalent * selectedCount)
  const changed = selectedCount !== addonsCount

  return (
    <SectionCard id="addons">
      <SectionCardHeader
        title={title}
        description={`${formatPrice(price.total)}/${intervalLabel}`}
        actions={<BillingHelpTooltip label={`${label('common.help', 'Help')}: ${title}`}>
          <p>{description}</p>
          <p>{requiredAddons > 0
            ? requiredAddons === 1
              ? t('billing.addons.requiredSingle', { count: requiredAddons }) || `Current configuration requires ${requiredAddons} add-on.`
              : t('billing.addons.required', { count: requiredAddons }) || `Current configuration requires ${requiredAddons} add-ons.`
            : label('billing.addons.noneRequired', 'No extra add-ons required for the current configuration.')}</p>
        </BillingHelpTooltip>}
      />
      <SectionCardContent className="space-y-4">
        <div className="divide-y rounded-lg border px-4">
        <div className="flex items-center justify-between gap-4 py-3">
          <div>
            <h4 className="text-sm font-medium mb-1">{t('billing.addons.socialAccounts') || "Social Accounts"}</h4>
            <div className="text-sm text-muted-foreground">
              {t('billing.addons.connectedUsage', { connected: totalSocialAccounts, limit: socialLimit }) || `${totalSocialAccounts} connected / ${socialLimit} included in plan`}
            </div>
          </div>
          <div className="w-20 shrink-0 sm:w-[120px]">
            <div className="h-2 w-full bg-muted overflow-hidden rounded-full" role="progressbar"
              aria-label={label('billing.addons.socialAccounts', 'Social Accounts')}
              aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(100, Math.max(0, socialUsagePercentage))}>
              <div
                className={`h-full ${totalSocialAccounts > socialLimit && totalSocialAccounts - socialLimit > addonsCount ? "bg-red-500" : "bg-primary"}`}
                style={{ width: `${Math.min(100, Math.max(0, socialUsagePercentage))}%` }}
              />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-4 py-3">
          <div>
            <h4 className="text-sm font-medium mb-1">{t('billing.addons.agentChannels') || "Agent Channels (Zavu)"}</h4>
            <div className="text-sm text-muted-foreground">
              {t('billing.addons.connectedUsage', { connected: totalAgentChannels, limit: agentLimit }) || `${totalAgentChannels} connected / ${agentLimit} included in plan`}
            </div>
          </div>
          <div className="w-20 shrink-0 sm:w-[120px]">
            <div className="h-2 w-full bg-muted overflow-hidden rounded-full" role="progressbar"
              aria-label={label('billing.addons.agentChannels', 'Agent Channels (Zavu)')}
              aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(100, Math.max(0, agentUsagePercentage))}>
              <div
                className={`h-full ${totalAgentChannels > agentLimit && totalAgentChannels - agentLimit > (addonsCount - Math.max(0, totalSocialAccounts - socialLimit)) ? "bg-red-500" : "bg-primary"}`}
                style={{ width: `${Math.min(100, Math.max(0, agentUsagePercentage))}%` }}
              />
            </div>
          </div>
        </div>
        </div>

        {missingAddons > 0 && (
          <div role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {requiredAddons === 1
              ? t('billing.addons.missingSingle', { required: requiredAddons, missing: missingAddons }) || `Your current setup requires ${requiredAddons} add-on. You still need ${missingAddons} more.`
              : t('billing.addons.missing', { required: requiredAddons, missing: missingAddons }) || `Your current setup requires ${requiredAddons} add-ons. You still need ${missingAddons} more.`}
          </div>
        )}

          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <div className="font-medium">{t('billing.addons.currentCount', { count: addonsCount }) || `Current add-ons: ${addonsCount}`}</div>
              {addonsCount > 0 && <p className="text-sm text-muted-foreground">
                {billingInterval === 'year'
                  ? t('billing.addons.totalAnnual', { price: totalPrice, monthlyPrice }) || `${totalPrice}/year total · ${monthlyPrice}/month equivalent`
                  : t('billing.addons.totalMonthly', { price: totalPrice }) || `${totalPrice}/month total`}
              </p>}
            </div>
              <div className="flex items-center gap-1 rounded-full border p-1">
                <Button type="button" variant="outline" aria-label={label('billing.addons.remove', 'Remove one add-on')}
                  size="icon" className="h-9 w-9"
                  disabled={isSaving || selectedCount <= requiredAddons || selectedCount === 0}
                  onClick={() => setTarget(current => Math.max(requiredAddons, (current ?? addonsCount) - 1))}>−</Button>
                <span className="min-w-10 text-center text-sm font-semibold tabular-nums" aria-label={label('billing.addons.count', 'Current add-ons')}>{selectedCount}</span>
                <Button type="button" variant="outline" aria-label={label('billing.addons.add', 'Add one add-on')}
                  size="icon" className="h-9 w-9"
                  disabled={isSaving || selectedCount >= 100}
                  onClick={() => setTarget(current => Math.min(100, (current ?? addonsCount) + 1))}>+</Button>
              </div>
          </div>
          {target !== null && <div className="space-y-2 rounded-lg bg-muted/40 p-3 text-sm" role="status">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="font-medium">{t('billing.addons.selectedCount', { count: target }) || `Selected add-ons: ${target}`}</p>
              <p className="font-medium tabular-nums">{billingInterval === 'year'
                ? t('billing.addons.totalAnnual', { price: selectedPrice, monthlyPrice: selectedMonthlyPrice }) || `${selectedPrice}/year total · ${selectedMonthlyPrice}/month equivalent`
                : t('billing.addons.totalMonthly', { price: selectedPrice }) || `${selectedPrice}/month total`}</p>
            </div>
            {changed && <p className="text-muted-foreground" id="addons-change-notice">{target > addonsCount
              ? label('billing.addons.increaseNotice', 'Additional add-ons are billed now. Limits change after payment is confirmed.')
              : label('billing.addons.reduceNotice', 'The reduction takes effect at your next renewal.')}</p>}
          </div>}
      </SectionCardContent>
      {target !== null && <SectionCardFooter className="flex-wrap" data-testid="addons-footer">
        <Button type="button" variant="outline" size="sm" disabled={isSaving} onClick={() => setTarget(null)}>{label('billing.actions.cancel', 'Cancel')}</Button>
        <Button type="button" size="sm" aria-describedby={changed ? 'addons-change-notice' : undefined}
          disabled={isSaving || !changed || target < requiredAddons} onClick={() => { onManageAddons(target); setTarget(null) }}>
          {label('billing.addons.confirm', 'Confirm change')}
        </Button>
      </SectionCardFooter>}
    </SectionCard>
  )
}
