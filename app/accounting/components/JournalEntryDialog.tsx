"use client"

import React, { useState, useEffect } from "react"
import { useSite } from "@/app/context/SiteContext"
import { useLocalization } from "@/app/context/LocalizationContext"
import { AccountingAccount } from "@/app/types"
import { createManualJournalEntry, updateManualJournalEntry } from "../entries"
import { Dialog, DialogBody, DialogContent, DialogForm, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/app/components/ui/dialog"
import { Button } from "@/app/components/ui/button"
import { Input } from "@/app/components/ui/input"
import { DatePicker } from "@/app/components/ui/date-picker"
import { format } from "date-fns"
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/app/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select"
import { toast } from "sonner"
import { Badge } from "@/app/components/ui/badge"
import { ExternalLink, PlusCircle } from "@/app/components/ui/icons"
import { journalSourceActionKey, journalSourceHref } from "../journal-source"
import { useRouter } from "next/navigation"

interface JournalEntryDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  entry: any | null // null means create new manual
  accounts: AccountingAccount[]
  onSaved: () => void
}

export function JournalEntryDialog({ open, onOpenChange, entry, accounts, onSaved }: JournalEntryDialogProps) {
  const { currentSite } = useSite()
  const { t } = useLocalization()
  const router = useRouter()

  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [memo, setMemo] = useState("")
  const [lines, setLines] = useState<{ id: string; accountCode: string; debit: number; credit: number }[]>([])
  const [saving, setSaving] = useState(false)

  const isReadOnly = entry && entry.source_type !== 'manual'
  const sourceHref = entry ? journalSourceHref(entry) : null
  const sourceAction = journalSourceActionKey(entry?.source_type)

  useEffect(() => {
    if (open) {
      if (entry) {
        setDate(entry.entry_date ? entry.entry_date.split('T')[0] : new Date().toISOString().split('T')[0])
        setMemo(entry.memo || "")
        setLines(
          (entry.journal_lines || []).map((l: any, i: number) => ({
            id: l.id || String(i),
            accountCode: l.account_code,
            debit: Number(l.debit) || 0,
            credit: Number(l.credit) || 0,
          }))
        )
      } else {
        setDate(new Date().toISOString().split('T')[0])
        setMemo("")
        setLines([
          { id: "1", accountCode: "", debit: 0, credit: 0 },
          { id: "2", accountCode: "", debit: 0, credit: 0 },
        ])
      }
    }
  }, [open, entry])

  const totalDebit = lines.reduce((sum, l) => sum + (Number(l.debit) || 0), 0)
  const totalCredit = lines.reduce((sum, l) => sum + (Number(l.credit) || 0), 0)
  
  // Balance check requires difference < 0.01
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01

  const addLine = () => {
    setLines([...lines, { id: crypto.randomUUID(), accountCode: "", debit: 0, credit: 0 }])
  }

  const removeLine = (id: string) => {
    setLines(lines.filter(l => l.id !== id))
  }

  const updateLine = (id: string, field: 'accountCode' | 'debit' | 'credit', value: string | number) => {
    setLines(lines.map(l => {
      if (l.id !== id) return l

      const updated = { ...l, [field]: value }
      
      // If setting debit > 0, clear credit
      if (field === 'debit' && Number(value) > 0) updated.credit = 0
      // If setting credit > 0, clear debit
      if (field === 'credit' && Number(value) > 0) updated.debit = 0

      return updated
    }))
  }

  async function handleSave(e?: React.FormEvent) {
    e?.preventDefault()
    if (!currentSite?.id || isReadOnly) return
    
    // Validations
    if (lines.length < 2) {
      toast.error(t('accounting.errorMinLines') || "At least 2 lines are required")
      return
    }
    
    const hasEmptyAccount = lines.some(l => !l.accountCode)
    if (hasEmptyAccount) {
      toast.error(t('accounting.errorMissingAccount') || "All lines must have an account selected")
      return
    }

    if (!isBalanced) {
      toast.error(t('accounting.errorNotBalanced') || "Total Debits must equal Total Credits")
      return
    }
    
    setSaving(true)
    try {
      const payload = {
        entryDate: date,
        memo,
        currency: currentSite.settings?.currency || 'USD',
        lines: lines.map(l => ({
          accountCode: l.accountCode,
          debit: Number(l.debit) || 0,
          credit: Number(l.credit) || 0
        }))
      }

      if (entry) {
        await updateManualJournalEntry(currentSite.id, entry.id, payload)
        toast.success(t('accounting.entryUpdated') || "Journal entry updated")
      } else {
        await createManualJournalEntry(currentSite.id, payload)
        toast.success(t('accounting.entryCreated') || "Journal entry created")
      }
      onSaved()
      onOpenChange(false)
    } catch (e: any) {
      toast.error(e.message || t('accounting.errorSaving') || "Failed to save entry")
    } finally {
      setSaving(false)
    }
  }

  const formatCurrency = (val: number) => 
    new Intl.NumberFormat('en-US', { style: 'currency', currency: currentSite?.settings?.currency || 'USD' }).format(val)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="xl" busy={saving}>
        <DialogForm onSubmit={handleSave}>
          <DialogHeader>
            <div className="flex items-center gap-3">
              <DialogTitle>
                {entry ? (isReadOnly ? (t('accounting.viewEntry') || "View Journal Entry") : (t('accounting.editEntry') || "Edit Journal Entry")) : (t('accounting.newEntry') || "New Journal Entry")}
              </DialogTitle>
              {entry && (
                <Badge variant="outline" className="capitalize">{entry.source_type}</Badge>
              )}
            </div>
            <DialogDescription>
              {isReadOnly 
                ? (t('accounting.readOnlyDesc') || "This entry was automatically generated and cannot be edited manually.") 
                : (t('accounting.manualEntryDesc') || "Enter the details and lines for this manual journal entry.")}
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="grid gap-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('accounting.date') || "Date"}</label>
              <DatePicker
                date={date ? new Date(`${date}T12:00:00`) : undefined}
                setDate={(next) => setDate(format(next, "yyyy-MM-dd"))}
                className="h-12 w-full"
                disabled={isReadOnly}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('accounting.memo') || "Memo"}</label>
              <Input 
                value={memo} 
                onChange={e => setMemo(e.target.value)}
                placeholder={t('accounting.memoPlaceholder') || "e.g. Monthly rent"}
                disabled={isReadOnly}
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium">{t('accounting.lines') || "Lines"}</h3>
              {!isReadOnly && (
                <Button type="button" size="sm" variant="outline" onClick={addLine}>
                  <PlusCircle className="mr-2 h-4 w-4" />
                  {t('accounting.addLine') || "Add Line"}
                </Button>
              )}
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('accounting.account') || "Account"}</TableHead>
                  <TableHead className="w-[150px] text-right">{t('accounting.debit') || "Debit"}</TableHead>
                  <TableHead className="w-[150px] text-right">{t('accounting.credit') || "Credit"}</TableHead>
                  {!isReadOnly && <TableHead className="w-[50px]"></TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
              {lines.map((line) => (
                <TableRow key={line.id}>
                  <TableCell>
                    {isReadOnly ? (
                      <div className="flex flex-col">
                        <span className="font-medium text-sm">
                          {accounts.find(a => a.code === line.accountCode)?.label || line.accountCode}
                        </span>
                        <span className="text-xs text-muted-foreground font-mono">{line.accountCode}</span>
                      </div>
                    ) : (
                      <Select 
                        value={line.accountCode} 
                        onValueChange={v => updateLine(line.id, 'accountCode', v)}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder={t('accounting.selectAccount') || "Select account..."} />
                        </SelectTrigger>
                        <SelectContent className="max-h-[300px]">
                          {accounts.map(acc => (
                            <SelectItem key={acc.id} value={acc.code}>
                              <div className="flex items-center justify-between w-full gap-4">
                                <span>{acc.label}</span>
                                <span className="text-xs text-muted-foreground font-mono">{acc.code}</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {isReadOnly ? (
                      <div className="font-mono">
                        {line.debit > 0 ? formatCurrency(line.debit) : "-"}
                      </div>
                    ) : (
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={line.debit || ""}
                        onChange={e => updateLine(line.id, 'debit', e.target.value)}
                        className="text-right font-mono"
                        placeholder="0.00"
                      />
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {isReadOnly ? (
                      <div className="font-mono">
                        {line.credit > 0 ? formatCurrency(line.credit) : "-"}
                      </div>
                    ) : (
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={line.credit || ""}
                        onChange={e => updateLine(line.id, 'credit', e.target.value)}
                        className="text-right font-mono"
                        placeholder="0.00"
                      />
                    )}
                  </TableCell>
                  {!isReadOnly && (
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-muted-foreground hover:text-rose-600 h-8 w-8"
                        onClick={() => removeLine(line.id)}
                        disabled={lines.length <= 2}
                      >
                        <span className="text-lg leading-none">&times;</span>
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
            <TableFooter className="bg-muted/30 text-foreground">
              <TableRow className="hover:bg-transparent">
                <TableCell>
                  {!isBalanced && !isReadOnly && (
                    <span className="text-sm font-medium text-rose-600 bg-rose-50 px-2 py-1 rounded">
                      {t('accounting.difference') || "Difference"}: {formatCurrency(Math.abs(totalDebit - totalCredit))}
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <div className="text-xs text-muted-foreground uppercase tracking-wider">{t('accounting.totalDebit') || "Total Debit"}</div>
                  <div className="font-mono font-medium">{formatCurrency(totalDebit)}</div>
                </TableCell>
                <TableCell className="text-right">
                  <div className="text-xs text-muted-foreground uppercase tracking-wider">{t('accounting.totalCredit') || "Total Credit"}</div>
                  <div className="font-mono font-medium">{formatCurrency(totalCredit)}</div>
                </TableCell>
                {!isReadOnly && <TableCell />}
              </TableRow>
            </TableFooter>
            </Table>
          </div>
          </DialogBody>
          <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                {t('common.close') || "Close"}
              </Button>
              {sourceHref ? (
                <Button
                  type="button"
                  variant="outline"
                  className="gap-2"
                  onClick={() => router.push(sourceHref)}
                >
                  <ExternalLink className="h-4 w-4" />
                  {t(sourceAction.key) || sourceAction.fallback}
                </Button>
              ) : null}
              {!isReadOnly && (
                <Button 
                  type="submit"
                  disabled={saving || !isBalanced || lines.length < 2}
                >
                  {saving ? (t('common.saving') || "Saving...") : (t('common.save') || "Save Entry")}
                </Button>
              )}
          </DialogFooter>
        </DialogForm>
      </DialogContent>
    </Dialog>
  )
}
