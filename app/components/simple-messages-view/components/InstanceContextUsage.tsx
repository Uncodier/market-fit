import useSWR from 'swr'
import { cn } from '@/lib/utils'
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/app/components/ui/dialog'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/app/components/ui/tooltip'

type Breakdown = {
  estimatedInputTokens: number
  instructions: number
  skills: number
  messages: number
  toolCalls: number
  toolDefinitions: number
}
type ContextUsage = {
  model: string
  usedTokens: number
  outputTokens?: number
  availableTokens: number | null
  reservedOutputTokens: number
  source: 'estimate' | 'provider'
  breakdown?: Breakdown | null
}

const categories = [
  { key: 'instructions', name: 'Instructions and other context', color: '#6366f1' },
  { key: 'skills', name: 'Skills in instructions', color: '#a855f7' },
  { key: 'messages', name: 'Messages and attachments', color: '#06b6d4' },
  { key: 'toolCalls', name: 'Tool calls and results', color: '#f59e0b' },
  { key: 'toolDefinitions', name: 'Tool definitions', color: '#10b981' },
] as const

function BreakdownPie({ breakdown, size = 40 }: { breakdown: Breakdown | null; size?: number }) {
  const total = breakdown?.estimatedInputTokens || 0
  let offset = 0
  return (
    <svg data-testid="instance-context-pie" aria-hidden="true" viewBox="0 0 40 40" width={size} height={size} className="shrink-0">
      <circle cx="20" cy="20" r="17" fill="currentColor" className="text-muted" />
      {total > 0 && categories.map(({ key, color }) => {
        const value = breakdown?.[key] || 0
        if (!value) return null
        const start = offset / total * Math.PI * 2
        offset += value
        const end = offset / total * Math.PI * 2
        if (value === total) return <circle key={key} cx="20" cy="20" r="17" fill={color} />
        const x = (a: number) => (20 + 17 * Math.sin(a)).toFixed(3)
        const y = (a: number) => (20 - 17 * Math.cos(a)).toFixed(3)
        return <path key={key} data-testid={`context-sector-${key}`} fill={color}
          d={`M 20 20 L ${x(start)} ${y(start)} A 17 17 0 ${value / total > 0.5 ? 1 : 0} 1 ${x(end)} ${y(end)} Z`} />
      })}
    </svg>
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
  const budget = usage?.availableTokens && usage.availableTokens > usage.reservedOutputTokens
    ? usage.availableTokens - usage.reservedOutputTokens : null
  const projected = usage ? Math.max(0, usage.usedTokens + (usage.outputTokens || 0)) : 0
  const utilization = budget === null ? null : Math.min(1, projected / budget)
  const percentage = utilization === null ? null : utilization > 0 && utilization < 0.01
    ? '<1%' : `${Math.round(utilization * 100)}%`
  const detail = usage
    ? budget === null
      ? `Model ${usage.model}: context limit unknown. Last input ${usage.usedTokens.toLocaleString()} tokens (${usage.source === 'estimate' ? 'estimated' : 'measured'}).`
      : `Next turn estimate: ${projected.toLocaleString()} of ${budget.toLocaleString()} input tokens (${usage.source === 'estimate' ? 'last input estimated' : 'based on last measured input'}).`
    : error ? `Unable to load context usage${error instanceof Error ? `: ${error.message}` : ''}.`
      : data?.context === null ? 'No context usage recorded for this instance yet.'
        : isLoading || !data ? 'Loading context usage.' : 'No context usage recorded for this instance yet.'

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <Dialog>
          <TooltipTrigger asChild>
            <DialogTrigger asChild>
              <span role="button" tabIndex={0} aria-label={`Instance context: ${detail} Open breakdown`}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    event.currentTarget.click()
                  }
                }}
                className={cn('relative inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                  error ? 'text-destructive' : 'text-primary')}>
                <BreakdownPie breakdown={breakdown} size={32} />
                {utilization !== null && utilization > 0 && (
                  <svg data-testid="context-usage-ring" aria-hidden="true" viewBox="0 0 40 40" className="absolute inset-0 h-full w-full -rotate-90">
                    <circle cx="20" cy="20" r="18" fill="none" stroke="currentColor" strokeWidth="3"
                      strokeDasharray={`${Math.max(utilization * 113.1, 2)} 113.1`}
                      className={utilization >= 0.9 ? 'text-destructive' : utilization >= 0.7 ? 'text-amber-600' : 'text-primary'} />
                  </svg>
                )}
              </span>
            </DialogTrigger>
          </TooltipTrigger>
          <TooltipContent side="top" align="end" className="max-w-[min(19rem,calc(100vw-2rem))] space-y-2 p-3 text-xs">
            <p className="font-semibold">Context breakdown</p>
            <p>{detail}</p>
            {usage && (
              breakdown ? (
                <>
                  <ul className="space-y-1" aria-label="Estimated input token breakdown">
                    {categories.map(({ key, name, color }) => (
                      <li key={key} className="flex items-center justify-between gap-3">
                        <span className="flex items-center gap-1.5"><span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: color }} />{name}</span>
                        <span className="tabular-nums">{breakdown[key].toLocaleString()}</span>
                      </li>
                    ))}
                  </ul>
                  <p>Estimated input: {breakdown.estimatedInputTokens.toLocaleString()} tokens</p>
                </>
              ) : <p>Breakdown unavailable for this measurement.</p>
            )}
            <p className="text-muted-foreground">Click the pie for more details.</p>
          </TooltipContent>
          <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>Context breakdown</DialogTitle>
          <DialogDescription>Last model request for this robot instance.</DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-4 text-sm">
          <p className="text-muted-foreground">{detail}</p>
          {usage && (
            <>
              <div className="flex items-center gap-4">
                <BreakdownPie breakdown={breakdown} size={112} />
                <div className="space-y-1">
                  <p className="font-medium">{usage.model}</p>
                  <p>Input: {usage.usedTokens.toLocaleString()} tokens {usage.source === 'provider' ? '(provider)' : '(estimated)'}</p>
                  <p>Last output: {(usage.outputTokens || 0).toLocaleString()} tokens</p>
                  <p>{percentage === null ? 'Window capacity unverified' : `Window used for next turn: ${percentage}`}</p>
                </div>
              </div>
              {breakdown ? (
                <>
                  <ul className="space-y-2" aria-label="Estimated input token breakdown">
                    {categories.map(({ key, name, color }) => (
                      <li key={key} className="flex items-center justify-between gap-3">
                        <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />{name}</span>
                        <span className="tabular-nums">{breakdown[key].toLocaleString()}</span>
                      </li>
                    ))}
                  </ul>
                  <p>Estimated input total: {breakdown.estimatedInputTokens.toLocaleString()} tokens</p>
                  {usage.source === 'provider' && breakdown.estimatedInputTokens !== usage.usedTokens &&
                    <p className="text-muted-foreground">Provider total differs by {(usage.usedTokens - breakdown.estimatedInputTokens).toLocaleString()} tokens. Provider tokens cannot be assigned reliably to individual sectors.</p>}
                  <p className="text-muted-foreground">Sector sizes are estimates of the prompt sent, not provider measurements per category. Skills loaded by a tool appear under tool calls; other context is grouped with instructions. The draft and the full log archive are excluded.</p>
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
