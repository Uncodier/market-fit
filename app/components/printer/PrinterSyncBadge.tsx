"use client"

import { useEffect, useRef, useState } from "react"
import { Button } from "@/app/components/ui/button"
import { AlertTriangle, CheckCircle2, Loader2, Printer } from "@/app/components/ui/icons"
import { useLocalization } from "@/app/context/LocalizationContext"
import { usePrinterStationStatus } from "@/lib/printer/hooks/use-printer-station-status"
import type { PrinterModule } from "@/lib/printer"
import { cn } from "@/lib/utils"
import { PrinterFirstAidDialog } from "./PrinterFirstAidDialog"
import { toast } from "sonner"

export function PrinterSyncBadge({ module }: { module: PrinterModule }) {
  const { t } = useLocalization()
  const status = usePrinterStationStatus(module)
  const [aidOpen, setAidOpen] = useState(false)
  const shownAid = useRef(false)
  const needsAid = status.state === "disconnected" || status.state === "unpaired"

  useEffect(() => {
    if (needsAid && !shownAid.current) {
      shownAid.current = true
      setAidOpen(true)
    }
    if (status.state === "ready") {
      shownAid.current = false
      setAidOpen(false)
    }
  }, [needsAid, status.state])

  if (status.state === "hidden") return null

  const label =
    status.state === "checking"
      ? t("printer.sync.checking") || "Checking printer"
      : status.state === "ready"
        ? t("printer.sync.ready") || "Printer ready"
        : status.state === "disconnected"
          ? t("printer.sync.disconnected") || "Printer disconnected"
          : status.state === "unpaired"
            ? t("printer.sync.unpaired") || "Printer unpaired"
            : t("printer.sync.unavailable") || "Printer unavailable"

  const hint =
    status.state === "checking"
      ? t("printer.sync.checkingHint") || "Confirming this station can print"
      : status.state === "ready"
        ? t("printer.sync.readyHint") || "This station printed a sync confirm"
        : status.error ||
          (status.state === "unpaired"
            ? t("printer.sync.unpairedHint") || "Connect this printer on this station"
            : t("printer.sync.unavailableHint") || "USB and Bluetooth printing need Chrome or Edge")

  const tone =
    status.state === "ready"
      ? "text-emerald-800 bg-emerald-100 dark:text-emerald-200 dark:bg-emerald-950/50"
      : status.state === "checking"
        ? "text-blue-800 bg-blue-100 dark:text-blue-200 dark:bg-blue-950/50"
        : status.state === "disconnected" || status.state === "unsupported"
          ? "text-red-800 bg-red-100 dark:text-red-200 dark:bg-red-950/50"
          : "text-amber-800 bg-amber-100 dark:text-amber-200 dark:bg-amber-950/50"

  const Icon =
    status.state === "checking"
      ? Loader2
      : status.state === "ready"
        ? CheckCircle2
        : status.state === "unpaired"
          ? Printer
          : AlertTriangle

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => {
          if (needsAid || status.state === "unsupported") {
            setAidOpen(true)
            return
          }
          void status.confirm().then(() => {
            toast.success(t("printer.sync.confirmed") || "Printer sync confirm sent")
          }).catch((err) => {
            toast.error(err instanceof Error ? err.message : "Could not confirm printer")
          })
        }}
        className={cn("h-8 gap-1.5 rounded-full px-3 text-xs font-medium", tone)}
        title={hint}
      >
        <Icon className={cn("h-3.5 w-3.5", status.state === "checking" && "animate-spin")} />
        {label}
      </Button>
      <PrinterFirstAidDialog
        open={aidOpen && status.state !== "checking" && status.state !== "hidden"}
        onOpenChange={setAidOpen}
        aid={status.aid}
        error={status.error}
        reconnecting={status.reconnecting}
        onReconnect={async () => {
          try {
            await status.reconnect()
            toast.success(t("printer.sync.confirmed") || "Printer sync confirm sent")
            setAidOpen(false)
          } catch (err) {
            toast.error(err instanceof Error ? err.message : "Could not reconnect printer")
          }
        }}
      />
    </>
  )
}
