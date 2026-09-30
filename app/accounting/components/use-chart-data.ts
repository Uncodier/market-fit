"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { format } from "date-fns"
import type { AccountingAccount } from "@/app/types"
import { getAllAccounts, getOpeningEntry } from "../chart"
import { amountCents, type OpeningBalances } from "./journal-form"

export type OpeningSnapshot = {
  date: string
  balances: OpeningBalances
  currency: string
  expectedHash: string | null
}

type ChartState = {
  siteId: string
  version: number
  status: "loading" | "ready" | "error"
  error: string | null
  accounts: AccountingAccount[]
  opening: OpeningSnapshot | null
}

export function useChartData(siteId: string, currency: string) {
  const request = useRef(0)
  const [state, setState] = useState<ChartState>({
    siteId, version: 0, status: "loading", error: null, accounts: [], opening: null,
  })
  const reload = useCallback(async () => {
    const version = ++request.current
    setState({ siteId, version, status: "loading", error: null, accounts: [], opening: null })
    if (!siteId) return
    try {
      const [accounts, entry] = await Promise.all([getAllAccounts(siteId), getOpeningEntry(siteId)])
      if (version !== request.current) return
      const balances: OpeningBalances = {}
      for (const line of entry?.journal_lines || []) {
        const existing = balances[line.account_code] || { debit: 0, credit: 0 }
        const debit = amountCents(line.debit)
        const credit = amountCents(line.credit)
        if (debit === null || credit === null) throw new Error("Opening data contains invalid amounts.")
        balances[line.account_code] = {
          debit: ((amountCents(existing.debit) ?? 0) + debit) / 100,
          credit: ((amountCents(existing.credit) ?? 0) + credit) / 100,
        }
      }
      setState({
        siteId, version, status: "ready", error: null, accounts,
        opening: {
          date: entry?.entry_date?.slice(0, 10) || format(new Date(), "yyyy-MM-dd"),
          balances, currency: entry?.currency || currency,
          expectedHash: entry?.source_hash ?? null,
        },
      })
    } catch (error) {
      if (version !== request.current) return
      setState({
        siteId, version, status: "error", accounts: [], opening: null,
        error: error instanceof Error ? error.message : "Failed to load accounting data.",
      })
    }
  }, [siteId, currency])

  useEffect(() => {
    void reload()
    return () => { request.current++ }
  }, [reload])

  return { ...state, ready: state.siteId === siteId && state.status === "ready", reload }
}