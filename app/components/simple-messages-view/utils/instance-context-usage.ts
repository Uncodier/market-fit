export type ContextBreakdown = {
  estimatedInputTokens: number
  instructions: number
  skills: number
  messages: number
  toolCalls: number
  toolDefinitions: number
}

export type ContextUsage = {
  model: string
  usedTokens: number
  outputTokens?: number | null
  availableTokens: number | null
  reservedOutputTokens: number
  source: 'estimate' | 'provider'
  breakdown?: ContextBreakdown | null
}

export const contextCategories = [
  { key: 'instructions', name: 'Instructions and other context', color: '#6366f1' },
  { key: 'skills', name: 'Skills in instructions', color: '#a855f7' },
  { key: 'messages', name: 'Messages and attachments', color: '#06b6d4' },
  { key: 'toolCalls', name: 'Tool calls and results', color: '#f59e0b' },
  { key: 'toolDefinitions', name: 'Tool definitions', color: '#10b981' },
] as const

export const contextInputColor = '#64748b'
export const contextOutputColor = '#ec4899'

export type ContextSector = {
  key: string
  color?: string
  share: number
}

export function getContextUsageSummary(usage?: ContextUsage | null) {
  const input = Math.max(0, usage?.usedTokens || 0)
  const output = Math.max(0, usage?.outputTokens || 0)
  const projected = input + output
  const budget = usage?.availableTokens && usage.availableTokens > usage.reservedOutputTokens
    ? usage.availableTokens - usage.reservedOutputTokens : null
  const remaining = budget === null ? null : Math.max(0, budget - projected)
  const utilization = budget === null ? null : projected / budget
  const percentage = utilization === null ? null : utilization > 0 && utilization < 0.01
    ? '<1%' : `${Math.round(utilization * 100)}%`
  // Unknown limits show composition only; over-capacity totals still fit one pie.
  const total = Math.max(budget || 0, projected)
  const breakdown = usage?.breakdown
  const sectors: ContextSector[] = []

  if (total > 0) {
    if (breakdown && breakdown.estimatedInputTokens > 0) {
      // Category proportions are estimates, scaled to the measured input total.
      for (const { key, color } of contextCategories) {
        sectors.push({ key, color, share: (breakdown[key] / breakdown.estimatedInputTokens) * (input / total) })
      }
    } else {
      sectors.push({ key: 'input', color: contextInputColor, share: input / total })
    }
    sectors.push({ key: 'output', color: contextOutputColor, share: output / total })
    if (remaining !== null) sectors.push({ key: 'remaining', share: remaining / total })
  }

  return { budget, projected, remaining, utilization, percentage, sectors: sectors.filter(({ share }) => share > 0) }
}