"use client"

import { useEffect, useRef, useState } from 'react'
import { getAllAccounts } from '@/app/accounting/chart'
import type { AccountingAccount } from '@/app/types'
import { getBalanceSheetReport, getPnLReport } from '../reports'
import type { FinanceReportTab, ReportAmounts } from '../report-types'
import { reportErrorMessage } from '../report-errors'

type ReportData = { accounts: Record<string, AccountingAccount>; amounts: ReportAmounts }
type ReportState = { key: string; status: 'loading' | 'ready' | 'error'; data?: ReportData; message?: string }

export function useFinanceReport({ siteId, currency, tab, from, to, asOf }: {
  siteId?: string
  currency: string
  tab: FinanceReportTab
  from: string
  to: string
  asOf: string
}) {
  const [revision, setRevision] = useState(0)
  const [state, setState] = useState<ReportState | null>(null)
  const generation = useRef(0)
  const key = JSON.stringify([siteId, currency, tab, from, to, asOf, revision])
  const enabled = Boolean(siteId && currency)

  useEffect(() => {
    const request = ++generation.current
    if (!siteId || !currency) return
    setState({ key, status: 'loading' })
    async function load() {
      try {
        // Viewing reports must not seed or otherwise mutate the chart of accounts.
        const [chart, amounts] = await Promise.all([
          getAllAccounts(siteId!),
          tab === 'pnl' ? getPnLReport(siteId!, from, to, currency)
            : getBalanceSheetReport(siteId!, asOf, currency),
        ])
        const accounts = Object.fromEntries(chart.map(account => [account.code, account]))
        if (Object.keys(amounts).some(code => !Object.hasOwn(accounts, code))) {
          throw new Error('A journal account is missing from the chart of accounts')
        }
        if (request === generation.current) setState({ key, status: 'ready', data: { accounts, amounts } })
      } catch (error) {
        if (request === generation.current) setState({ key, status: 'error', message: reportErrorMessage(error) })
      }
    }
    void load()
    return () => { generation.current += 1 }
  }, [key, siteId, currency, tab, from, to, asOf])

  // Hide old totals during the render before an effect starts the next request.
  const current = enabled && state?.key === key ? state : null
  return {
    data: current?.status === 'ready' ? current.data : undefined,
    loading: enabled && (!current || current.status === 'loading'),
    error: current?.status === 'error',
    errorMessage: current?.message,
    refresh: () => setRevision(value => value + 1),
  }
}