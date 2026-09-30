"use client"

import React, { useEffect, useRef, useState } from "react"
import { format } from "date-fns"
import type { AccountingAccount } from "@/app/types"
import { saveOpeningEntry } from "../chart"
import { toast } from "sonner"
import { Button } from "@/app/components/ui/button"
import { Input } from "@/app/components/ui/input"
import { DatePicker } from "@/app/components/ui/date-picker"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/app/components/ui/table"
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogForm, DialogHeader, DialogTitle } from "@/app/components/ui/dialog"
import { SaveIcon } from "@/app/components/ui/icons"
import { OpeningBalances, openingDraft, validateJournalDraft } from "./journal-form"
import type { OpeningSnapshot } from "./use-chart-data"

export function OpeningBalancesDialog({ siteId, accounts, opening, ready, open, onOpenChange, onSaved }: {
  siteId: string; accounts: AccountingAccount[]; opening: OpeningSnapshot; ready: boolean
  open: boolean; onOpenChange: (open: boolean) => void; onSaved: () => void
}) {
  const [date, setDate] = useState(opening.date)
  const [balances, setBalances] = useState<OpeningBalances>(opening.balances)
  const [saving, setSaving] = useState(false)
  const mounted = useRef(true)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  const draft = openingDraft(balances)
  const existing = Object.entries(opening.balances).map(([accountCode, amounts]) => ({ id: accountCode, accountCode, ...amounts }))
  const validationError = validateJournalDraft(date, "Opening balances", opening.currency, draft.lines, accounts, existing)
  const editable = ready && !saving
  const visibleAccounts = accounts.filter((account) => account.active || opening.balances[account.code] || account.code === "3000")
  const money = (amount: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: opening.currency }).format(amount)

  function update(code: string, field: "debit" | "credit", value: string) {
    if (!editable || code === "3000") return
    setBalances((previous) => ({ ...previous, [code]: { ...(previous[code] || { debit: 0, credit: 0 }), [field]: value } }))
  }

  async function save(event: React.FormEvent) {
    event.preventDefault()
    if (!editable || !siteId) return
    if (validationError) { toast.error(validationError); return }
    setSaving(true)
    try {
      const payload = Object.fromEntries(draft.lines.map((line) => [line.accountCode, { debit: Number(line.debit), credit: Number(line.credit) }]))
      await saveOpeningEntry(siteId, date, payload, opening.currency, opening.expectedHash)
      if (!mounted.current) return
      toast.success("Opening balances saved")
      onOpenChange(false)
      onSaved()
    } catch (error) {
      if (mounted.current) toast.error(error instanceof Error ? error.message : "Failed to save opening balances")
    } finally {
      if (mounted.current) setSaving(false)
    }
  }

  return (
    <Dialog open={open && ready} onOpenChange={(next) => { if (!saving) onOpenChange(next) }}>
      <DialogContent size="xl" busy={saving}>
        <DialogForm onSubmit={save}>
          <DialogHeader>
            <DialogTitle>Opening Balances</DialogTitle>
            <DialogDescription>Set initial balances. Retained Earnings (3000) automatically balances the entry and cannot be edited.</DialogDescription>
          </DialogHeader>
          <DialogBody className="grid gap-4">
            <div className="flex items-center gap-4 rounded-lg bg-muted/30 p-4">
              <span className="text-sm font-semibold">Opening Date</span>
              <DatePicker date={date ? new Date(`${date}T12:00:00`) : undefined} setDate={(next) => { if (editable) setDate(format(next, "yyyy-MM-dd")) }} disabled={!editable} />
              <span className="text-sm">Currency: {opening.currency}</span>
            </div>
            <Table>
              <TableHeader><TableRow><TableHead>Code</TableHead><TableHead>Name</TableHead><TableHead className="text-right">Debit</TableHead><TableHead className="text-right">Credit</TableHead></TableRow></TableHeader>
              <TableBody>
                {visibleAccounts.map((account) => {
                  const automatic = account.code === "3000"
                  const amounts = automatic ? draft.equity : balances[account.code]
                  return (
                    <TableRow key={account.code}>
                      <TableCell className="font-mono text-xs">{account.code}</TableCell>
                      <TableCell>{account.label}{!account.active ? " (Inactive)" : ""}{automatic ? " (Automatic)" : ""}</TableCell>
                      {(["debit", "credit"] as const).map((field) => (
                        <TableCell key={field}>
                          <Input type="number" min="0" step="0.01" className="text-right font-mono" aria-label={`${account.code} ${field}`} value={amounts?.[field] || ""} readOnly={automatic} disabled={!editable} onChange={(event) => update(account.code, field, event.target.value)} />
                        </TableCell>
                      ))}
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
            {validationError ? <p role="status" className="text-sm text-muted-foreground">{validationError}</p> : null}
          </DialogBody>
          <DialogFooter className="sm:justify-between">
            <div className="text-sm font-mono"><div>Total Debits: {money(draft.totals.debit / 100)}</div><div>Total Credits: {money(draft.totals.credit / 100)}</div></div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" disabled={!editable} onClick={() => { if (editable) setBalances({}) }}>Clear amounts</Button>
              <Button type="button" variant="outline" disabled={saving} onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" disabled={!editable || Boolean(validationError)} className="gap-2"><SaveIcon className="h-4 w-4" />{saving ? "Saving..." : "Save"}</Button>
            </div>
          </DialogFooter>
        </DialogForm>
      </DialogContent>
    </Dialog>
  )
}