"use client"

import { Button } from "@/app/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/app/components/ui/dialog"
import { useLocalization } from "@/app/context/LocalizationContext"
import type { PrinterAidKind } from "@/lib/printer"

export function PrinterFirstAidDialog({
  open,
  onOpenChange,
  aid,
  error,
  reconnecting,
  onReconnect,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  aid?: PrinterAidKind
  error?: string
  reconnecting: boolean
  onReconnect: () => Promise<void>
}) {
  const { t } = useLocalization()
  const bluetooth = aid !== "usb"
  const steps = bluetooth
    ? [
        t("printer.aid.bt.1") || "Keep this Chrome or Edge tab in front.",
        t("printer.aid.bt.2") || "Turn the printer on and wait until it is discoverable.",
        t("printer.aid.bt.3") || "Do not pair it in macOS Bluetooth. Chrome must talk to it directly.",
        t("printer.aid.bt.4") || "If it is Bluetooth 3.0 Classic, plug it in with USB instead.",
        t("printer.aid.bt.5") || "Restart it in BLE 4.0 mode, then tap Reconnect.",
      ]
    : [
        t("printer.aid.usb.1") || "Keep this Chrome or Edge tab in front.",
        t("printer.aid.usb.2") || "Plug the printer in and wait a few seconds.",
        t("printer.aid.usb.3") || "Tap Reconnect and choose the printer port.",
      ]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {t("printer.aid.title") || "Printer needs attention on this station"}
          </DialogTitle>
          <DialogDescription>
            {error ||
              (bluetooth
                ? t("printer.aid.bt.summary") ||
                  "This tab can take orders, but it cannot print until Bluetooth is connected here."
                : t("printer.aid.usb.summary") ||
                  "This tab can take orders, but it cannot print until USB is connected here.")}
          </DialogDescription>
        </DialogHeader>
        <ol className="list-decimal space-y-2 pl-5 text-sm">
          {steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
        <DialogFooter>
          <Button
            type="button"
            onClick={() => {
              void onReconnect()
            }}
            disabled={reconnecting}
          >
            {reconnecting
              ? t("settings.printers.connecting") || "Connecting..."
              : t("printer.aid.reconnect") || "Reconnect and print confirm"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
