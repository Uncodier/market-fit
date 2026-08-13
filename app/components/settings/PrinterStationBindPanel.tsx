"use client"

import { useState } from "react"
import { useLocalization } from "@/app/context/LocalizationContext"
import { ChevronDown, ChevronRight } from "../ui/icons"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "../ui/collapsible"
import { isClaimedByThisWorkstation, type PrinterDevice } from "@/lib/printer"

function formatBoundAt(value?: string) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleString()
}

function usbLabel(device: PrinterDevice) {
  const claim = device.station
  if (claim?.usbVendorId == null && claim?.usbProductId == null) return null
  const vid = claim?.usbVendorId != null ? claim.usbVendorId.toString(16).padStart(4, "0") : "----"
  const pid = claim?.usbProductId != null ? claim.usbProductId.toString(16).padStart(4, "0") : "----"
  return `${vid}:${pid}`
}

export function printerStationSummary(device: PrinterDevice, t: (key: string) => string) {
  const claim = device.station
  if (!claim?.workstationId) {
    return t("settings.printers.station.unpaired") || "Not paired to a computer"
  }
  if (isClaimedByThisWorkstation(device)) {
    const name = claim.workstationName || t("settings.printers.station.thisComputer") || "This computer"
    const hardware = claim.hardwareName ? ` · ${claim.hardwareName}` : ""
    return `${name}${hardware}`
  }
  return `${t("settings.printers.station.otherComputer") || "Paired on"} ${claim.workstationName}`
}

export function PrinterStationBindPanel({ device }: { device: PrinterDevice }) {
  const { t } = useLocalization()
  const [open, setOpen] = useState(false)
  const claim = device.station
  const elsewhere = Boolean(claim?.workstationId) && !isClaimedByThisWorkstation(device)
  const usb = usbLabel(device)
  const boundAt = formatBoundAt(claim?.boundAt)

  return (
    <div className="space-y-3 pt-4 border-t">
      <Collapsible open={open} onOpenChange={setOpen}>
        <div className="rounded-lg border overflow-hidden">
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="flex w-full items-center justify-between gap-3 p-3 text-left hover:bg-muted/50 transition-colors"
            >
              <div className="space-y-0.5 pr-4 min-w-0">
                <p className="text-sm font-medium">
                  {t("settings.printers.station.title") || "Paired device"}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {printerStationSummary(device, t)}
                </p>
              </div>
              {open ? (
                <ChevronDown className="h-5 w-5 text-muted-foreground shrink-0" />
              ) : (
                <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
              )}
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="border-t px-3 py-3 space-y-3">
              <p className="text-xs text-muted-foreground">
                {t("settings.printers.station.description") ||
                  "Pairing is saved on this printer so the site knows which computer owns it."}
              </p>
              <div className="space-y-2">
                <Row
                  label={t("settings.printers.station.computer") || "Computer"}
                  value={
                    claim?.workstationName ||
                    (t("settings.printers.station.unpaired") || "Not paired to a computer")
                  }
                />
                {claim?.hardwareName ? (
                  <Row label={t("settings.printers.station.hardware") || "Device"} value={claim.hardwareName} />
                ) : null}
                {claim?.bluetoothDeviceId ? (
                  <Row
                    label={t("settings.printers.station.deviceId") || "Bluetooth id"}
                    value={claim.bluetoothDeviceId}
                  />
                ) : null}
                {usb ? (
                  <Row label={t("settings.printers.station.usbIds") || "USB id"} value={usb} />
                ) : null}
                {boundAt ? (
                  <Row label={t("settings.printers.station.boundAt") || "Paired"} value={boundAt} />
                ) : null}
              </div>
              {elsewhere ? (
                <p className="text-xs text-muted-foreground">
                  {t("settings.printers.station.moveHint") ||
                    "This printer is saved on another computer. Connect here to move it to this one."}
                </p>
              ) : null}
            </div>
          </CollapsibleContent>
        </div>
      </Collapsible>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-xs text-muted-foreground shrink-0">{label}</span>
      <span className="text-sm font-medium text-right break-all">{value}</span>
    </div>
  )
}
