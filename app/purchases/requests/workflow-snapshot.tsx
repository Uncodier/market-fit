'use client'

import { useProcurementI18n } from '@/app/purchases/procurement/i18n/use-procurement-i18n'
import { policyFieldLabel, simulationText } from '@/app/purchases/procurement/components/policy-presentation'

const labels: Record<string, string> = {
  title: 'common.title', description: 'common.description', currency: 'common.currency',
  quantity: 'common.quantity', unit: 'common.unit', status: 'common.status',
  source: 'snapshot.source', matchedRuleIds: 'snapshot.matchedRules',
  simulationOnly: 'snapshot.simulationOnly', authorized: 'snapshot.authorized',
  issues: 'snapshot.issues', explanations: 'snapshot.explanations',
  resolvedDeadline: 'snapshot.resolvedDeadline', sourceRuleId: 'snapshot.sourceRule',
  sourceRuleIds: 'snapshot.sourceRule', sourceRuleVersion: 'snapshot.sourceRuleVersion',
  sourceRuleVersions: 'snapshot.sourceRuleVersion', id: 'snapshot.id', site_id: 'snapshot.site',
  requester_id: 'snapshot.requester', created_by: 'snapshot.creator', actor_id: 'snapshot.actor',
  created_at: 'snapshot.createdAt', updated_at: 'common.updated', submitted_at: 'snapshot.submittedAt',
  revision: 'snapshot.revision', policy_revision: 'snapshot.policyRevision',
  revalidation_of_revision: 'snapshot.revalidationRevision', policy_snapshot: 'snapshot.policySnapshot',
  resolved_plan: 'snapshot.resolvedPlan', request_id: 'snapshot.request', stage_id: 'snapshot.stage',
  decision: 'snapshot.decision', reason: 'snapshot.reason', position: 'snapshot.position',
  unit_net_minor: 'request.unitNet', net_amount_minor: 'common.netAmount',
  unit_estimate_minor: 'service.estimate', tax_snapshot: 'request.taxSnapshot',
  tax_ids: 'validation.taxIds', rate: 'snapshot.taxRate', catalog_item_id: 'tender.catalogOptional',
  category_ids: 'snapshot.id', valuation_source: 'snapshot.source', event: 'snapshot.event',
  previous_revision: 'snapshot.previousRevision', new_revision: 'snapshot.newRevision',
  financial_lines: 'snapshot.financialLines',
}
const enumFields = new Set(['status', 'source', 'crossRuleCounting', 'decisionMode', 'execution',
  'rejectionBehavior', 'timeoutAction', 'mode', 'kind', 'classification', 'milestone', 'holder',
  'validity', 'review', 'type', 'event', 'lineMatch', 'operator', 'basis', 'visibility', 'participation',
  'offerOpening', 'anchor', 'calendar', 'allowedActions', 'decisionAuthority', 'decision', 'valuation_source'])

/** Render stored evidence explicitly; never translate saved names, descriptions, reasons or IDs. */
export function WorkflowSnapshot({ value, currency }: { value: unknown; currency?: string }) {
  const i18n = useProcurementI18n()
  const { t, valueLabel, formatNumber, formatMoney, formatDate } = i18n
  const renderValue = (entry: unknown, field = '', inheritedCurrency = currency): React.ReactNode => {
    if (entry === null || entry === undefined) return t('procurement.workflow.snapshot.empty')
    if (typeof entry === 'boolean') return t(`procurement.workflow.snapshot.${entry ? 'yes' : 'no'}`)
    if (typeof entry === 'number') {
      if ((field.endsWith('_minor') || field.endsWith('Minor')) && inheritedCurrency) return formatMoney(entry, inheritedCurrency)
      return field === 'rate' ? `${formatNumber(entry)}%` : formatNumber(entry)
    }
    if (typeof entry === 'string') {
      if (field === 'issues' || field === 'explanations') return simulationText(entry, i18n)
      if (enumFields.has(field)) return valueLabel(entry)
      if (field === 'unit' && ['hours', 'days', 'weeks'].includes(entry)) return valueLabel(entry)
      if ((field.endsWith('_at') || field.endsWith('At') || ['resolvedDeadline', 'effectiveFrom', 'effectiveUntil', 'at'].includes(field)) && Number.isFinite(Date.parse(entry))) return formatDate(entry)
      return entry
    }
    if (Array.isArray(entry)) return entry.length ? <ol className="space-y-2 pl-4 list-decimal">{entry.map((item, index) => <li key={index}>{renderValue(item, field, inheritedCurrency)}</li>)}</ol> : t('procurement.workflow.common.none')
    if (typeof entry !== 'object') return String(entry)
    const record = entry as Record<string, unknown>
    const nextCurrency = typeof record.currency === 'string' ? record.currency : inheritedCurrency
    return <dl className="space-y-2">{Object.entries(record).map(([key, item]) => <div key={key} className="border-l pl-3">
      <dt className="font-medium">{labels[key] ? t(`procurement.workflow.${labels[key]}`) : policyFieldLabel(key, i18n) ?? key}</dt>
      <dd className="break-words text-muted-foreground">{renderValue(item, key, nextCurrency)}</dd>
    </div>)}</dl>
  }
  return <div className="mt-3 text-sm">{renderValue(value)}</div>
}