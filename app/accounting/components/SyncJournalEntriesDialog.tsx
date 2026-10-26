"use client"

import React, { useRef, useState } from "react"
import { format, subMonths } from "date-fns"
import { useSite } from "@/app/context/SiteContext"
import { useLocalization } from "@/app/context/LocalizationContext"
import { preparePeriodSync, syncPeriodBatch } from "../ensure"
import { SYNC_BATCH_SIZE, withSyncDeadline, type SyncProgress } from "../sync-progress"
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
  const running = useRef(false)
  const [progress, setProgress] = useState<SyncProgress | null>(null)
  const [syncError, setSyncError] = useState<string | null>(null)

  async function handleSync() {
    if (!currentSite?.id || running.current) return
    if (syncFromDate > syncToDate) {
      toast.error(t('accounting.invalidDateRange') || "The start date must be before the end date")
      return
    }
    setSyncing(true)
    running.current = true
    setProgress(null)
    setSyncError(null)
    try {
      const fromDate = format(syncFromDate, "yyyy-MM-dd")
      const toDate = format(syncToDate, "yyyy-MM-dd")
      const sources = await withSyncDeadline(preparePeriodSync(currentSite.id, fromDate, toDate))
      let processed = 0
      let failed = 0
      setProgress({ processed, failed, total: sources.length })
      for (let offset = 0; offset < sources.length; offset += SYNC_BATCH_SIZE) {
        const result = await withSyncDeadline(syncPeriodBatch(currentSite.id, sources.slice(offset, offset + SYNC_BATCH_SIZE)))
        processed += result.processed
        failed += result.failed
        setProgress({ processed, failed, total: sources.length })
      }
      if (failed) throw new Error(`${failed} of ${sources.length} sources could not be synchronized. Existing entries were preserved; review source data and retry.`)
      toast.success(t('accounting.syncCompleted') || "Sync completed")
      onSynced(fromDate, toDate)
      onOpenChange(false)
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : (t('accounting.errorSaving') || "Failed to sync")
      setSyncError(message)
      toast.error(message)
    } finally {
      setSyncing(false)
      running.current = false
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!running.current) onOpenChange(next) }}>
      <DialogContent size="md" busy={syncing} showClose={!syncing}>
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
                disabled={syncing}
                setDate={setSyncFromDate}
                placeholder={t('accounting.selectDate') || "Select date"}
                className="h-12 w-full"
              />
            </div>
            <div className="grid gap-2">
              <Label>{t('accounting.to') || "To"}</Label>
              <DatePicker
                date={syncToDate}
                disabled={syncing}
                setDate={setSyncToDate}
                placeholder={t('accounting.selectDate') || "Select date"}
                className="h-12 w-full"
              />
            </div>
          </div>
          {syncing && <p role="status" aria-live="polite" className="text-sm text-muted-foreground">
            {progress ? `${t('accounting.syncProgress') || 'Documents processed'}: ${progress.processed} / ${progress.total}` : (t('accounting.syncPreparing') || 'Finding documents to synchronize...')}
          </p>}
          {syncError && <p role="alert" className="text-sm text-destructive">{syncError}</p>}
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={syncing} onClick={() => onOpenChange(false)}>
              {t('common.cancel') || "Cancel"}
            </Button>
            <Button type="submit" disabled={syncing}>
              {syncing ? (t('accounting.syncing') || "Syncing...") : (t('accounting.sync') || "Sync Data")}
            </Button>
          </DialogFooter>
        </DialogForm>
      </DialogContent>
    </Dialog>
  )
}
