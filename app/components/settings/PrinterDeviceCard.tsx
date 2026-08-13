"use client"

import { useEffect, useMemo, useRef, type ReactNode } from "react"
import { useLocalization } from "@/app/context/LocalizationContext"
import { useSite } from "@/app/context/SiteContext"
import {
  SectionCard,
  SectionCardHeader,
  SectionCardTitle,
  SectionCardDescription,
  SectionCardContent,
  SectionCardFooter,
} from "@/app/components/ui/section-card"
import { ActionFooter } from "../ui/card-footer"
import { Button } from "../ui/button"
import { Input } from "../ui/input"
import { Label } from "../ui/label"
import { Switch } from "../ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select"
import { ChevronDown, ChevronRight, Printer, Trash2 } from "../ui/icons"
import {
  htmlForJob,
  isWebBluetoothSupported,
  isWebSerialSupported,
  ticketBrandFromSite,
  type PrinterDevice,
} from "@/lib/printer"
import { injectQrIntoDocument } from "@/lib/printer/core/inject-qr"
import { samplePayloads } from "./printer-samples"
import { PrinterStationBindPanel, printerStationSummary } from "./PrinterStationBindPanel"

interface PrinterDeviceCardProps {
  device: PrinterDevice
  expanded: boolean
  connecting: boolean
  bound: boolean
  saving: boolean
  onToggle: () => void
  onChange: (patch: Partial<PrinterDevice>) => void
  onConnect: () => void
  onTest: () => void
  onRemove: () => void
  onSave: () => void
}

export function PrinterDeviceCard({
  device,
  expanded,
  connecting,
  bound,
  saving,
  onToggle,
  onChange,
  onConnect,
  onTest,
  onRemove,
  onSave,
}: PrinterDeviceCardProps) {
  const { t } = useLocalization()
  const { currentSite } = useSite()
  const needsPairing = device.transport !== "system"
  const transportSupported =
    device.transport === "usb"
      ? isWebSerialSupported()
      : device.transport === "bluetooth"
        ? isWebBluetoothSupported()
        : true
  const hasFailure = needsPairing && (!transportSupported || !bound)
  const isOn = device.enabled !== false && !hasFailure
  const preview = useMemo(() => {
    const paper = device.paperWidthMm
    const samples = samplePayloads(ticketBrandFromSite(currentSite))
    return {
      receipt: htmlForJob({ id: "p", module: "pos", template: "receipt", payload: samples.receipt }, paper),
      kitchen: htmlForJob({ id: "p", module: "orders", template: "kitchen", payload: samples.kitchen }, paper),
      delta: htmlForJob({ id: "p", module: "orders", template: "kitchen-delta", payload: samples.delta }, paper),
      label: htmlForJob({ id: "p", module: "inventory", template: "inventory-label", payload: samples.label }, paper),
    }
  }, [device.paperWidthMm, currentSite])

  const transportLabel =
    t(`settings.printers.transport.${device.transport}`) ||
    (device.transport === "system" ? "System (print dialog)" : device.transport === "usb" ? "USB (Web Serial)" : "Bluetooth")

  const setModule = (key: keyof PrinterDevice["modules"], value: boolean) => {
    const modules = { ...device.modules, [key]: value }
    const autoPrint = { ...device.autoPrint }
    if (key === "pos" && !value) autoPrint.posReceipt = false
    if (key === "orders" && !value) {
      autoPrint.kitchenTicket = false
      autoPrint.orderDelta = false
    }
    if (key === "inventory" && !value) autoPrint.inventoryLabel = false
    onChange({ modules, autoPrint })
  }

  const moduleSummary = [
    device.modules.pos ? (t("layout.sidebar.pos") || "Point of Sale") : null,
    device.modules.orders ? (t("layout.sidebar.orders") || "Orders") : null,
    device.modules.inventory ? (t("layout.sidebar.inventory") || "Inventory") : null,
  ].filter(Boolean).join(" · ")

  return (
    <SectionCard id={`printer-${device.id}`} >
      <SectionCardHeader className="cursor-pointer hover:bg-muted/50 transition-colors"
        onClick={onToggle}
      >
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <Printer className="h-5 w-5 text-muted-foreground shrink-0" />
            <div className="min-w-0">
              <SectionCardTitle className="truncate">
                {device.name || (t("settings.printers.newName") || "Printer")}
              </SectionCardTitle>
              <p className="text-sm text-muted-foreground truncate mt-1">
                {transportLabel} · {device.paperWidthMm}mm
                {moduleSummary ? ` · ${moduleSummary}` : ""}
              </p>
              {device.transport !== "system" && (
                <p className="text-xs text-muted-foreground truncate mt-0.5">
                  {printerStationSummary(device, t)}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3 ml-4 shrink-0">
            <div
              title={
                hasFailure
                  ? !transportSupported
                    ? (t("settings.printers.fault.unsupported") || "This connection is not supported in this browser")
                    : (t("settings.printers.fault.unpaired") || "Pair this printer on this station to enable it")
                  : (t("settings.printers.enabled") || "Enabled")
              }
              onClick={(e) => e.stopPropagation()}
            >
              <Switch
                checked={isOn}
                disabled={hasFailure}
                onCheckedChange={(enabled) => onChange({ enabled })}
                aria-label={t("settings.printers.enabled") || "Enabled"}
              />
            </div>
            {expanded ? (
              <ChevronDown className="h-5 w-5 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            )}
          </div>
        </div>
      </SectionCardHeader>

      {expanded && (
        <>
      <SectionCardContent className="space-y-4 border-t">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label={t("settings.printers.name") || "Name"}>
            <Input value={device.name} onChange={(e) => onChange({ name: e.target.value })} />
          </Field>
          <Field label={t("settings.printers.transport") || "Connection"}>
            <Select
              value={device.transport}
              onValueChange={(v) =>
                onChange({
                  transport: v as PrinterDevice["transport"],
                  enabled: v === "system" ? device.enabled : false,
                  station: undefined,
                })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="usb">{t("settings.printers.transport.usb") || "USB"}</SelectItem>
                <SelectItem value="bluetooth">{t("settings.printers.transport.bluetooth") || "Bluetooth (BLE 4.0)"}</SelectItem>
                <SelectItem value="system">{t("settings.printers.transport.system") || "System (print dialog)"}</SelectItem>
              </SelectContent>
            </Select>
            {device.transport === "usb" && (
              <p className="text-xs text-muted-foreground">
                {t("settings.printers.usbHint") ||
                  "Best for automatic printing. Plug the printer in, then Connect on this station."}
              </p>
            )}
            {device.transport === "bluetooth" && (
              <p className="text-xs text-muted-foreground">
                {t("settings.printers.btClassicHint") ||
                  "Chrome only sees Bluetooth 4.0 BLE. Restart the printer and do not pair it in macOS. Bluetooth 3.0 needs USB."}
              </p>
            )}
          </Field>
          <Field label={t("settings.printers.paper") || "Paper"}>
            <Select
              value={String(device.paperWidthMm)}
              onValueChange={(v) => onChange({ paperWidthMm: Number(v) as 58 | 80 })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="58">58mm</SelectItem>
                <SelectItem value="80">80mm</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label={t("settings.printers.copies") || "Copies"}>
            <Input
              type="number"
              min={1}
              max={5}
              value={device.copies}
              onChange={(e) => onChange({ copies: Math.max(1, Number(e.target.value) || 1) })}
            />
          </Field>
        </div>

        <div className="space-y-3 pt-4 border-t">
          <div>
            <p className="text-sm font-medium">{t("settings.printers.modules.title") || "Modules"}</p>
            <SectionCardDescription className="mt-1">
              {t("settings.printers.modules.description") || "Choose where this printer is used."}
            </SectionCardDescription>
          </div>
          <SettingToggle
            id={`${device.id}-pos`}
            title={t("layout.sidebar.pos") || "Point of Sale"}
            description={t("settings.printers.modules.posDesc") || "Print receipts from Point of Sale."}
            checked={device.modules.pos}
            onCheckedChange={(pos) => setModule("pos", pos)}
          />
          <SettingToggle
            id={`${device.id}-orders`}
            title={t("layout.sidebar.orders") || "Orders"}
            description={t("settings.printers.modules.ordersDesc") || "Print kitchen tickets and order changes."}
            checked={device.modules.orders}
            onCheckedChange={(orders) => setModule("orders", orders)}
          />
          <SettingToggle
            id={`${device.id}-inventory`}
            title={t("layout.sidebar.inventory") || "Inventory"}
            description={t("settings.printers.modules.inventoryDesc") || "Print inventory labels."}
            checked={device.modules.inventory}
            onCheckedChange={(inventory) => setModule("inventory", inventory)}
          />
        </div>

        <div className="space-y-3 pt-4 border-t">
          <div>
            <p className="text-sm font-medium">{t("settings.printers.auto.title") || "Auto-print"}</p>
            <SectionCardDescription className="mt-1">
              {t("settings.printers.auto.description") || "Print automatically when these events happen."}
            </SectionCardDescription>
          </div>
          {device.modules.pos && (
            <SettingToggle
              id={`${device.id}-auto-receipt`}
              title={t("settings.printers.auto.posReceipt") || "Auto-print POS receipts"}
              description={t("settings.printers.auto.posReceiptDesc") || "Print a receipt after each POS sale."}
              checked={device.autoPrint.posReceipt}
              onCheckedChange={(posReceipt) => onChange({ autoPrint: { ...device.autoPrint, posReceipt } })}
            />
          )}
          {device.modules.orders && (
            <>
              <SettingToggle
                id={`${device.id}-auto-kitchen`}
                title={t("settings.printers.auto.kitchen") || "Auto-print kitchen tickets"}
                description={t("settings.printers.auto.kitchenDesc") || "Print a kitchen ticket when an order is sent."}
                checked={device.autoPrint.kitchenTicket}
                onCheckedChange={(kitchenTicket) => onChange({ autoPrint: { ...device.autoPrint, kitchenTicket } })}
              />
              <SettingToggle
                id={`${device.id}-auto-delta`}
                title={t("settings.printers.auto.delta") || "Auto-print order deltas"}
                description={t("settings.printers.auto.deltaDesc") || "Print only the changes when an order is updated."}
                checked={device.autoPrint.orderDelta}
                onCheckedChange={(orderDelta) => onChange({ autoPrint: { ...device.autoPrint, orderDelta } })}
              />
            </>
          )}
          {device.modules.inventory && (
            <SettingToggle
              id={`${device.id}-auto-label`}
              title={t("settings.printers.auto.label") || "Auto-print inventory labels"}
              description={t("settings.printers.auto.labelDesc") || "Print a label when inventory is labeled."}
              checked={device.autoPrint.inventoryLabel}
              onCheckedChange={(inventoryLabel) => onChange({ autoPrint: { ...device.autoPrint, inventoryLabel } })}
            />
          )}
          {!device.modules.pos && !device.modules.orders && !device.modules.inventory && (
            <p className="text-sm text-muted-foreground">
              {t("settings.printers.auto.empty") || "Turn on a module to configure auto-print."}
            </p>
          )}
        </div>

        {device.transport !== "system" && <PrinterStationBindPanel device={device} />}

        {(device.modules.pos || device.modules.orders || device.modules.inventory) && (
          <div className="space-y-3 pt-4 border-t">
            <p className="text-sm font-medium">{t("settings.printers.preview") || "Preview"}</p>
            <SectionCardDescription>
              {t("settings.printers.previewHint") ||
                "Ticket layout. Thermal printers follow this design as closely as the hardware allows."}
            </SectionCardDescription>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {device.modules.pos && <PreviewFrame title="Receipt" html={preview.receipt} />}
              {device.modules.orders && <PreviewFrame title="Kitchen" html={preview.kitchen} />}
              {device.modules.orders && <PreviewFrame title="Update" html={preview.delta} />}
              {device.modules.inventory && <PreviewFrame title="Label" html={preview.label} />}
            </div>
          </div>
        )}
      </SectionCardContent>

      <ActionFooter>
        <div className="flex items-center justify-between w-full gap-3 flex-wrap">
          <Button
            type="button"
            variant="outline"
            className="text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={onRemove}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            {t("settings.printers.remove") || "Remove printer"}
          </Button>
          <div className="flex items-center gap-2">
            {needsPairing && (
              <Button type="button" variant="outline" onClick={onConnect} disabled={connecting}>
                {connecting
                  ? (t("settings.printers.connecting") || "Connecting...")
                  : bound
                    ? (t("settings.printers.reconnect") || "Reconnect on this computer")
                    : (t("settings.printers.connect") || "Connect on this computer")}
              </Button>
            )}
            <Button type="button" variant="outline" onClick={onTest}>
              {t("settings.printers.test") || "Test print"}
            </Button>
            <Button variant="outline" type="button" size="sm" onClick={onSave} disabled={saving}>
              {saving ? (t("common.saving") || "Saving...") : (t("common.save") || "Save")}
            </Button>
          </div>
        </div>
      </ActionFooter>
        </>
      )}
    </SectionCard>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  )
}

function SettingToggle({
  id,
  title,
  description,
  checked,
  onCheckedChange,
}: {
  id: string
  title: string
  description: string
  checked: boolean
  onCheckedChange: (value: boolean) => void
}) {
  return (
    <div className="rounded-lg border">
      <div className="flex flex-row items-center justify-between p-3">
        <div className="space-y-0.5 pr-4">
          <Label htmlFor={id} className="text-sm cursor-pointer">
            {title}
          </Label>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
        <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} />
      </div>
    </div>
  )
}

function PreviewFrame({ title, html }: { title: string; html: string }) {
  const ref = useRef<HTMLIFrameElement>(null)
  useEffect(() => {
    const iframe = ref.current
    if (!iframe) return
    const onLoad = () => {
      const doc = iframe.contentDocument
      if (!doc) return
      void injectQrIntoDocument(doc, 88).then(() => {
        const height = Math.ceil(doc.documentElement.scrollHeight || doc.body.scrollHeight || 0)
        iframe.style.height = `${Math.min(Math.max(height + 8, 200), 520)}px`
      })
    }
    iframe.addEventListener("load", onLoad)
    if (iframe.contentDocument?.readyState === "complete") onLoad()
    return () => iframe.removeEventListener("load", onLoad)
  }, [html])
  return (
    <div className="rounded-lg border bg-white overflow-hidden">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground px-2 py-1 border-b">{title}</div>
      <iframe ref={ref} title={title} srcDoc={html} className="w-full bg-white" style={{ height: 280, border: 0 }} />
    </div>
  )
}
