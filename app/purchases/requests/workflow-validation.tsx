'use client'

import type { ZodIssue } from 'zod'
import { useProcurementI18n } from '@/app/purchases/procurement/i18n/use-procurement-i18n'

const fieldKeys: Record<string, string> = {
  title: 'common.title', description: 'common.description', currency: 'common.currency',
  quantity: 'common.quantity', unit: 'common.unit', id: 'validation.referenceId',
  catalog_item_id: 'tender.catalogOptional', unit_estimate_minor: 'service.estimate',
  tax_ids: 'validation.taxIds', request_id: 'tender.approvedRequestOptional',
  visibility: 'tender.visibility', global_visible: 'tender.globalDirectory',
  participation: 'tender.participation', opening_policy: 'tender.openingPolicy',
  participation_deadline: 'tender.closingLocal', opening_at: 'tender.openingLocal',
  unit_net_minor: 'tender.unitEstimateMinor', name: 'replenishment.ruleName',
  location_id: 'replenishment.stockLocation', minimum: 'replenishment.minimumStock',
  target: 'replenishment.targetStock', minimum_order: 'replenishment.minimumPurchase',
  order_multiple: 'replenishment.purchaseMultiple', action: 'replenishment.action',
  enabled: 'replenishment.enabled',
}

/** Keep schema diagnostics canonical in state and localize every issue at display time. */
export function WorkflowValidation({ issues, kind }: { issues: ZodIssue[]; kind: 'request' | 'tender' | 'replenishment' }) {
  const { t, message, formatNumber } = useProcurementI18n()
  const text = (issue: ZodIssue) => {
    if (issue.code === 'too_small' || issue.code === 'too_big') {
      const minimum = issue.code === 'too_small'
      const limit = minimum ? issue.minimum : issue.maximum
      const key = issue.type === 'string' ? minimum ? 'minCharacters' : 'maxCharacters'
        : issue.type === 'array' ? minimum ? 'minItems' : 'maxItems'
        : minimum ? issue.inclusive ? 'minimum' : 'strictMinimum' : issue.inclusive ? 'maximum' : 'strictMaximum'
      return t(`procurement.workflow.validation.${key}`, { limit: formatNumber(Number(limit)) })
    }
    if (issue.code === 'invalid_type') {
      const key = issue.received === 'undefined' ? 'required' : issue.expected === 'integer' ? 'integer' : issue.expected === 'number' ? 'number' : 'choice'
      return t(`procurement.workflow.validation.${key}`)
    }
    if (issue.code === 'invalid_enum_value' || issue.code === 'invalid_literal') return t('procurement.workflow.validation.choice')
    if (issue.code === 'invalid_string') return t(`procurement.workflow.validation.${issue.validation === 'uuid' ? 'identifier' : 'date'}`)
    if (issue.code === 'not_finite') return t('procurement.workflow.validation.number')
    return message(issue.message)
  }
  const pathLabel = (path: ZodIssue['path']) => {
    const parts: string[] = []
    path.forEach((part, index) => {
      if (typeof part === 'number') return
      if (part === 'lines' || part === 'requirements') {
        const number = path[index + 1]
        parts.push(typeof number === 'number'
          ? t(`procurement.workflow.${part === 'lines' ? 'request.line' : 'tender.requirementNumber'}`, { number: formatNumber(number + 1) })
          : t(`procurement.workflow.${part === 'lines' ? 'request.requestLines' : 'tender.structuredRequirements'}`))
      } else {
        const key = part === 'catalog_item_id' && kind === 'replenishment' ? 'replenishment.stockSku' : fieldKeys[part]
        if (key) parts.push(t(`procurement.workflow.${key}`))
      }
    })
    return parts.join(' · ') || t('procurement.workflow.validation.form')
  }
  return issues.length ? <ul role="alert" className="space-y-1 text-sm text-destructive">
    {issues.map((issue, index) => <li key={index}>{pathLabel(issue.path)}: {text(issue)}</li>)}
  </ul> : null
}