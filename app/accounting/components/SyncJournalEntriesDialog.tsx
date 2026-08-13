"use client"

import React, { useState } from "react"
import { format, subMonths } from "date-fns"
import { useSite } from "@/app/context/SiteContext"
import { useLocalization } from "@/app/context/LocalizationContext"
import { ensurePolizasForPeriod } from "../ensure"
import { Dialog, DialogBody, DialogContent, DialogForm, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/app/components/ui/dialog"
import { Button } from "@/app/components/ui/button"
import { Label } from "@/app/components/ui/label"
import { DatePicker } from "@/app/components/ui/date-picker"
import { toast } from "sonner"

interface SyncJournalEntriesDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSynced: (fromDate: string, toDate: string) => void
}

export function SyncJournalEntriesDialog({ open, onOpenChange, onSynced }: SyncJournalEntriesDialogProps) {
  const { currentSite } = useSite()
  const { t } = useLocalization()

  const [syncFromDate, setSyncFromDate] = useState(() => subMonths(new Date(), 1))
  const [syncToDate, setSyncToDate] = useState(() => new Date())
  const [syncing, setSyncing] = useState(false)

  async function handleSync() {
    if (!currentSite?.id) return
    if (syncFromDate > syncToDate) {
      toast.error(t('accounting.invalidDateRange') || "The start date must be before the end date")
      return
    }
    setSyncing(true)
    try {
      const fromDate = format(syncFromDate, "yyyy-MM-dd")
      const toDate = format(syncToDate, "yyyy-MM-dd")
      await ensurePolizasForPeriod(currentSite.id, fromDate, toDate)
      toast.success(t('accounting.entryCreated') || "Sync completed")
      onSynced(fromDate, toDate)
      onOpenChange(false)
    } catch (e: any) {
      toast.error(e.message || t('accounting.errorSaving') || "Failed to sync")
    } finally {
      setSyncing(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md" busy={syncing}>
        <DialogForm onSubmit={(e) => { e.preventDefault(); void handleSync() }}>
          <DialogHeader>
            <DialogTitle>{t('accounting.syncEntries') || "Sync Journal Entries"}</DialogTitle>
            <DialogDescription>
              {t('accounting.syncEntriesDesc') || "Automatically generate or update journal entries from sales, purchases, and expenses in the selected period."}
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="grid gap-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>{t('accounting.from') || "From"}</Label>
              <DatePicker
                date={syncFromDate}
                setDate={setSyncFromDate}
                placeholder={t('accounting.selectDate') || "Select date"}
                className="h-12 w-full"
              />
            </div>
            <div className="grid gap-2">
              <Label>{t('accounting.to') || "To"}</Label>
              <DatePicker
                date={syncToDate}
                setDate={setSyncToDate}
                placeholder={t('accounting.selectDate') || "Select date"}
                className="h-12 w-full"
              />
            </div>
          </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t('common.cancel') || "Cancel"}
            </Button>
            <Button type="submit" disabled={syncing}>
              {syncing ? (t('common.saving') || "Syncing...") : (t('accounting.sync') || "Sync Data")}
            </Button>
          </DialogFooter>
        </DialogForm>
      </DialogContent>
    </Dialog>
  )
}
