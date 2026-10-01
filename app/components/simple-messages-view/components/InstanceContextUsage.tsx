import useSWR from 'swr'
import { cn } from '@/lib/utils'
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/app/components/ui/dialog'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/app/components/ui/tooltip'
import { ContextUsagePie } from './ContextUsagePie'
import { contextCategories, contextInputColor, contextOutputColor, getContextUsageSummary, type ContextUsage } from '../utils/instance-context-usage'

function ContextUsageLegend({ usage, remaining }: { usage: ContextUsage; remaining: number | null }) {
  const breakdown = usage.breakdown
  const items: { key: string; name: string; color?: string; tokens: number }[] = breakdown
    ? contextCategories.map(category => ({ ...category, tokens: breakdown[category.key] })) : []
  if (!breakdown || (breakdown.estimatedInputTokens === 0 && usage.usedTokens > 0)) {
    items.push({ key: 'input', name: 'Input (breakdown unavailable)', color: contextInputColor, tokens: usage.usedTokens })
  }
  if (usage.outputTokens != null && usage.outputTokens > 0) {
    items.push({ key: 'output', name: 'Last output', color: contextOutputColor, tokens: usage.outputTokens })
  }
  if (remaining !== null) items.push({ key: 'remaining', name: 'Free context', tokens: remaining })
  return (
    <ul className="space-y-1.5" aria-label="Context token breakdown">
      {items.map(({ key, name, color, tokens }) => (
        <li key={key} className={cn('flex items-center justify-between gap-3', key === 'remaining' && 'border-t pt-1.5')}>
          <span className="flex items-center gap-1.5">
            <span className={cn('h-2 w-2 shrink-0 rounded-full', !color && 'border border-border bg-muted')} style={{ backgroundColor: color }} />
            {name}
          </span>
          <span className="tabular-nums">{tokens.toLocaleString()}</span>
        </li>
      ))}
    </ul>
  )
}

export function InstanceContextUsage({ instanceId, siteId }: { instanceId?: string; siteId?: string }) {
  const { data, error, isLoading } = useSWR<{ context: ContextUsage | null }>(
    instanceId && siteId ? ['instance-context', instanceId, siteId] : null,
    async ([, id, site]: [string, string, string]) => {
      const response = await fetch(`/api/robots/instance/context?instance_id=${encodeURIComponent(id)}&site_id=${encodeURIComponent(site)}`)
      if (!response.ok) throw new Error(`Context status unavailable (HTTP ${response.status})`)
      return response.json()
    },
    { refreshInterval: 15000, revalidateOnFocus: true },
  )
  if (!instanceId || !siteId) return null

  // A failed SWR revalidation must not display an old measurement as current.
  const usage = error ? null : data?.context
  const breakdown = usage?.breakdown || null
  const { budget, projected, remaining, utilization, percentage, sectors } = getContextUsageSummary(usage)
  const chartDescription = budget === null
    ? 'Capacity unknown; the pie shows composition only.'
    : 'Colored slices show used context; gray is free context.'
  const providerAdjustment = usage?.source === 'provider' && breakdown && breakdown.estimatedInputTokens !== usage.usedTokens
  const inputScaleDescription = breakdown && breakdown.estimatedInputTokens > 0
    ? 'Input slices use estimated proportions of the provider total.'
    : 'No category proportions are available for the measured input.'
  const utilizationClassName = utilization !== null && (utilization >= 0.9
    ? 'text-destructive' : utilization >= 0.7 && 'text-amber-600 dark:text-amber-400')
  const detail = usage
    ? budget === null
      ? `Model ${usage.model}: context limit unknown. Last input ${usage.usedTokens.toLocaleString()} tokens (${usage.source === 'estimate' ? 'estimated' : 'measured'}).`
      : `Next turn estimate: ${projected.toLocaleString()} of ${budget.toLocaleString()} input tokens (${usage.source === 'estimate' ? 'last input estimated' : 'based on last measured input'}${usage.outputTokens == null ? '; last output unknown, shown as a lower bound' : ''}).`
    : error ? `Unable to load context usage${error instanceof Error ? `: ${error.message}` : ''}.`
      : data?.context === null ? 'No context usage recorded for this instance yet.'
        : isLoading || !data ? 'Loading context usage.' : 'No context usage recorded for this instance yet.'

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <Dialog>
          <TooltipTrigger asChild>
            <DialogTrigger asChild>
              <span role="button" tabIndex={0} aria-label={`Instance context: ${percentage === null ? '' : `${percentage} used. `}${detail} Open breakdown`}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    event.currentTarget.click()
                  }
                }}
                className={cn('relative inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                  error ? 'text-destructive' : 'text-primary')}>
                <ContextUsagePie sectors={sectors} />
              </span>
            </DialogTrigger>
          </TooltipTrigger>
          <TooltipContent side="top" align="end" className="max-w-[min(19rem,calc(100vw-2rem))] space-y-2 p-3 text-xs">
            <div className="flex items-center justify-between gap-3 font-semibold">
              <p>Context breakdown</p>
              {percentage !== null && <span className={cn('shrink-0 tabular-nums', utilizationClassName)}>{percentage} used</span>}
            </div>
            <p>{detail}</p>
            {usage && (
              <>
                <ContextUsageLegend usage={usage} remaining={remaining} />
                {breakdown ? <p>Estimated input: {breakdown.estimatedInputTokens.toLocaleString()} tokens</p>
                  : <p>Breakdown unavailable for this measurement.</p>}
                {providerAdjustment && <p>{inputScaleDescription}</p>}
                <p className="text-muted-foreground">{chartDescription}</p>
              </>
            )}
            <p className="text-muted-foreground">Click the pie for more details.</p>
          </TooltipContent>
          <DialogContent size="sm">
            <DialogHeader>
              <DialogTitle>Context breakdown</DialogTitle>
              <DialogDescription>Next-turn context usage and composition for this robot instance.</DialogDescription>
            </DialogHeader>
            <DialogBody className="space-y-4 text-sm">
              <p className="text-muted-foreground">{detail}</p>
              {usage && (
                <>
                  <div className="flex flex-wrap items-center gap-4">
                    <ContextUsagePie sectors={sectors} size={112} />
                    <div className="min-w-0 flex-1 space-y-1 break-words">
                      <p className="font-medium">{usage.model}</p>
                      <p>Input: {usage.usedTokens.toLocaleString()} tokens {usage.source === 'provider' ? '(provider)' : '(estimated)'}</p>
                      <p>Last output: {usage.outputTokens == null ? 'Unknown (provider did not report usage)' : `${usage.outputTokens.toLocaleString()} tokens`}</p>
                      <p className={cn('font-medium', utilizationClassName)}>
                        {percentage === null ? 'Window capacity unverified' : `Window used for next turn: ${percentage}`}
                      </p>
                    </div>
                  </div>
                  <ContextUsageLegend usage={usage} remaining={remaining} />
                  <p className="text-muted-foreground">{chartDescription}</p>
                  {breakdown ? (
                    <>
                      <p>Estimated input total: {breakdown.estimatedInputTokens.toLocaleString()} tokens</p>
                      {providerAdjustment &&
                        <p className="text-muted-foreground">Provider total differs by {(usage.usedTokens - breakdown.estimatedInputTokens).toLocaleString()} tokens. {inputScaleDescription}</p>}
                      <p className="text-muted-foreground">Input sector proportions are estimates of the prompt sent, not provider measurements per category. Instance log messages and tool results embedded in the system prompt are attributed to their historical categories. Skills loaded by a tool appear under tool calls. The draft and the full log archive are excluded.</p>
                    </>
                  ) : <p className="text-muted-foreground">Breakdown unavailable for this measurement. A new model turn is needed after the breakdown storage migration.</p>}
                </>
              )}
            </DialogBody>
          </DialogContent>
        </Dialog>
      </Tooltip>
    </TooltipProvider>
  )
}
