'use client'

import { useEffect, useState } from 'react'
import { z } from 'zod'
import { demoReplenishmentRules, demoReplenishmentCases } from '@/lib/demo-data/procurement-replenishment'
import { isProcurementDemo } from '../ui/is-demo'
import type { ReplenishmentRule } from './schema'
import { replenishmentPageSize } from './schema'
import { replenishmentDocumentSchema } from './schema'

export type ReplenishmentCase = {
  id: string; rule_id: string; request_id: string | null; status: 'open' | 'closed'
  rule_version: number; observed_quantity: number; quantity: number; action: string
  created_at: string | null; closed_at: string | null; close_reason: string | null
}
export type ReplenishmentRequest = {
  id: string; title: string; status: string; currency: string; net_amount_minor: number | string | null; revision: number
}
export type CheckResult = { status: string; message?: string; request_id?: string | null; quantity?: number; on_hand?: number }
export type RuleDetailData = {
  rule: ReplenishmentRule & { catalog_item_name?: string | null; location_name?: string | null }
  queue: { generation: number; evaluated_generation: number; last_result: CheckResult | null; last_error: string | null; evaluated_at?: string | null } | null
  cases: ReplenishmentCase[]; case_count: number; case_page: number
  requests: ReplenishmentRequest[]; request_count: number; request_page: number; page_size: number
}

const caseSchema = z.object({
  id: z.string(), rule_id: z.string(), request_id: z.string().nullable(), status: z.enum(['open', 'closed']),
  rule_version: z.number().int().positive(), observed_quantity: z.number(), quantity: z.number(), action: z.enum(['alert', 'draft']),
  created_at: z.string().nullable(), closed_at: z.string().nullable(), close_reason: z.string().nullable(),
})
const requestSchema = z.object({
  id: z.string(), title: z.string(), status: z.string(), currency: z.string().regex(/^[A-Z]{3}$/),
  net_amount_minor: z.union([z.number().finite(), z.string().regex(/^-?\d+(\.\d+)?$/)]).nullable(), revision: z.number().int().positive(),
})
const queueSchema = z.object({
  generation: z.number().int().nonnegative(), evaluated_generation: z.number().int().nonnegative(),
  last_error: z.string().nullable(), evaluated_at: z.string().nullable().optional(),
  last_result: z.object({ status: z.string(), message: z.string().optional(), request_id: z.string().nullable().optional(),
    quantity: z.number().optional(), on_hand: z.number().optional() }).nullable(),
}).nullable()
function validDetail(body: RuleDetailData, ruleId: string, casePage: number, requestPage: number) {
  return body?.rule?.id === ruleId && replenishmentDocumentSchema.safeParse({
    name: body.rule.name, catalog_item_id: body.rule.catalog_item_id, location_id: body.rule.location_id,
    minimum: body.rule.minimum, target: body.rule.target, minimum_order: body.rule.minimum_order,
    order_multiple: body.rule.order_multiple, action: body.rule.action, enabled: body.rule.enabled,
  }).success && Number.isSafeInteger(body.rule.version) && body.rule.version > 0
    && z.array(caseSchema).safeParse(body.cases).success && body.cases.every(item => item.rule_id === ruleId)
    && z.array(requestSchema).safeParse(body.requests).success
    && queueSchema.safeParse(body.queue).success
    && Number.isSafeInteger(body.case_count) && body.case_count >= 0
    && Number.isSafeInteger(body.request_count) && body.request_count >= 0
    && body.case_page === casePage && body.request_page === requestPage && body.page_size === replenishmentPageSize
}

function demoDetail(ruleId: string): RuleDetailData | null {
  const rule = demoReplenishmentRules.find(item => item.id === ruleId)
  if (!rule) return null
  const cases = demoReplenishmentCases.filter(item => item.rule_id === ruleId).map(item => ({
    ...item, status: 'open' as const, rule_version: rule.version, created_at: null, closed_at: null, close_reason: null,
  }))
  return { rule, queue: null, cases, case_count: cases.length, case_page: 1, requests: [], request_count: 0, request_page: 1, page_size: replenishmentPageSize }
}

/** Callers key this hook's component by both workspace and rule to discard stale state. */
export function useRuleDetail(siteId: string, ruleId: string) {
  const demo = isProcurementDemo(siteId)
  const [data, setData] = useState<RuleDetailData | null>(() => demo ? demoDetail(ruleId) : null)
  const [loading, setLoading] = useState(!demo)
  const [error, setError] = useState('')
  const [notFound, setNotFound] = useState(demo && !data)
  const [generation, setGeneration] = useState(0)
  const [casePage, setCasePage] = useState(1)
  const [requestPage, setRequestPage] = useState(1)
  const refresh = () => { if (!demo) { setLoading(true); setGeneration(value => value + 1) } }

  useEffect(() => {
    if (demo) return
    const controller = new AbortController()
    fetch(`/api/procurement/replenishment/${encodeURIComponent(ruleId)}?site_id=${encodeURIComponent(siteId)}&case_page=${casePage}&request_page=${requestPage}`, {
      signal: controller.signal, cache: 'no-store',
    }).then(async response => {
      if (response.status === 404) {
        if (!controller.signal.aborted) { setNotFound(true); setData(null); setError('') }
        return
      }
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || 'Unable to load replenishment rule')
      if (!validDetail(body, ruleId, casePage, requestPage)) throw new Error('Unable to verify replenishment detail')
      if (controller.signal.aborted) return
      setData(body); setError(''); setNotFound(false)
      setCasePage(current => Math.min(current, Math.max(1, Math.ceil(body.case_count / replenishmentPageSize))))
      setRequestPage(current => Math.min(current, Math.max(1, Math.ceil(body.request_count / replenishmentPageSize))))
    }).catch(failure => {
      if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : 'Unable to load replenishment rule')
    }).finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [siteId, ruleId, casePage, requestPage, generation, demo])

  return { data, loading, error, notFound, demo, refresh, casePage, requestPage,
    changeCasePage: (page: number) => { if (page !== casePage) { setLoading(true); setCasePage(page) } },
    changeRequestPage: (page: number) => { if (page !== requestPage) { setLoading(true); setRequestPage(page) } } }
}