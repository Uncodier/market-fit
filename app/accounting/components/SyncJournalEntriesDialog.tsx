"use client"

import React, { useState, useEffect } from "react"
import { useSite } from "@/app/context/SiteContext"
import { useLocalization } from "@/app/context/LocalizationContext"
import { ensurePolizasForPeriod } from "../ensure"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/app/components/ui/dialog"
import { Button } from "@/app/components/ui/button"
import { Input } from "@/app/components/ui/input"
import { toast } from "sonner"

interface SyncJournalEntriesDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSynced: () => void
}

export function SyncJournalEntriesDialog({ open, onOpenChange, onSynced }: SyncJournalEntriesDialogProps) {
  const { currentSite } = useSite()
  const { t } = useLocalization()

  const [syncFromDate, setSyncFromDate] = useState(() => {
    const d = new Date()
    d.setMonth(d.getMonth() - 1)
    return d.toISOString().split('T')[0]
  })
  const [syncToDate, setSyncToDate] = useState(() => new Date().toISOString().split('T')[0])
  const [syncing, setSyncing] = useState(false)

  async function handleSync() {
    if (!currentSite?.id) return
    setSyncing(true)
    try {
      await ensurePolizasForPeriod(currentSite.id, syncFromDate, syncToDate)
      toast.success(t('accounting.entryCreated') || "Sincronización completada")
      onSynced()
      onOpenChange(false)
    } catch (e: any) {
      toast.error(e.message || t('accounting.errorSaving') || "Failed to sync")
    } finally {
      setSyncing(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{t('accounting.syncEntries') || "Sync Journal Entries"}</DialogTitle>
          <DialogDescription>
            {t('accounting.syncEntriesDesc') || "Automatically generate or update journal entries from sales and expenses in the selected period."}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('accounting.date') || "Date"} (From)</label>
              <Input 
                type="date" 
                value={syncFromDate} 
                onChange={e => setSyncFromDate(e.target.value)} 
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('accounting.date') || "Date"} (To)</label>
              <Input 
                type="date" 
                value={syncToDate} 
                onChange={e => setSyncToDate(e.target.value)} 
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel') || "Cancel"}
          </Button>
          <Button onClick={handleSync} disabled={syncing}>
            {syncing ? (t('common.saving') || "Syncing...") : (t('accounting.sync') || "Sync Data")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
