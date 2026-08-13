"use client"

import { useFormContext } from "react-hook-form"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { type SiteFormValues } from "./form-schema"
import { Button } from "../ui/button"
import { EmptyCard } from "../ui/empty-card"
import { Input } from "../ui/input"
import { Label } from "../ui/label"
import { PlusCircle, Printer } from "../ui/icons"
import { useLocalization } from "@/app/context/LocalizationContext"
import { useSite } from "@/app/context/SiteContext"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog"
import {
  bluetoothErrorMessage,
  buildStationClaim,
  createPrinterDevice,
  getPrinterBind,
  getPrinterWorkstation,
  isWebBluetoothSupported,
  isWebSerialSupported,
  isWebUsbSupported,
  printOnDevice,
  renameClaimsForWorkstation,
  requestBluetoothPrinter,
  requestUsbPrinter,
  setPrinterBind,
  setPrinterWorkstationName,
  stationOwnsPrinter,
  ticketBrandFromSite,
  usbHardwareName,
  withStationClaim,
  clearPrinterBind,
  type PrinterDevice,
  type WorkstationBind,
} from "@/lib/printer"
import { PrinterDeviceCard } from "./PrinterDeviceCard"
import { enabledPrintFormats, payloadForFormat, type PrintFormatOption } from "./printer-samples"

interface PrintersSectionProps {
  active: boolean
  onSave?: (data: SiteFormValues) => void
}

export function PrintersSection({ active, onSave }: PrintersSectionProps) {
  const { t } = useLocalization()
  const { currentSite } = useSite()
  const form = useFormContext<SiteFormValues>()
  const [saving, setSaving] = useState(false)
  const [connectingId, setConnectingId] = useState<string | null>(null)
  const [bindTick, setBindTick] = useState(0)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [testDevice, setTestDevice] = useState<PrinterDevice | null>(null)
  const [testing, setTesting] = useState(false)
  const [stationName, setStationName] = useState(() => getPrinterWorkstation().name)
  const devices = (form.watch("printers.devices") || []) as PrinterDevice[]

  const setDevices = (next: PrinterDevice[]) => {
    form.setValue("printers.devices", next as SiteFormValues["printers"] extends { devices: infer D } ? D : any, {
      shouldDirty: true,
      shouldValidate: true,
    })
  }

  const persistDevices = async (next: PrinterDevice[]) => {
    setDevices(next)
    if (!onSave) return
    setSaving(true)
    try {
      const values = form.getValues()
      await onSave({ ...values, printers: { devices: next } })
    } finally {
      setSaving(false)
    }
  }

  const commitStationName = () => {
    const station = setPrinterWorkstationName(stationName)
    setStationName(station.name)
    const next = renameClaimsForWorkstation(devices, station.id, station.name)
    const renamed = next.some((device, i) => device.station?.workstationName !== devices[i]?.station?.workstationName)
    if (renamed) void persistDevices(next)
    else setDevices(next)
  }

  const applyConnected = async (
    device: PrinterDevice,
    bind: WorkstationBind,
    extra?: Partial<PrinterDevice>,
  ) => {
    setPrinterBind(bind)
    const next = withStationClaim(devices, device.id, buildStationClaim(bind), {
      enabled: true,
      ...extra,
    })
    setBindTick((n) => n + 1)
    await persistDevices(next)
  }

  const addPrinter = () => {
    const next = createPrinterDevice({
      name: t("settings.printers.newName") || "Printer",
      transport: "usb",
      paperWidthMm: 58,
      modules: { pos: true, orders: true, inventory: false },
      autoPrint: { posReceipt: true, kitchenTicket: true, orderDelta: true, inventoryLabel: false },
    })
    setDevices([...devices, next])
    setExpandedId(next.id)
  }

  const updateDevice = (id: string, patch: Partial<PrinterDevice>) => {
    if (patch.transport) {
      clearPrinterBind(id)
      setBindTick((n) => n + 1)
    }
    setDevices(devices.map((d) => (d.id === id ? { ...d, ...patch } : d)))
  }

  const handleSave = async () => {
    if (!onSave) return
    setSaving(true)
    try {
      await onSave(form.getValues())
    } finally {
      setSaving(false)
    }
  }

  const removeDevice = (id: string) => {
    setDevices(devices.filter((d) => d.id !== id))
    if (expandedId === id) setExpandedId(null)
  }

  useEffect(() => {
    if (!active) return
    window.dispatchEvent(
      new CustomEvent("printersUpdated", {
        detail: devices.map((device) => ({
          id: `printer-${device.id}`,
          title: device.name || t("settings.printers.newName") || "Printer",
        })),
      }),
    )
  }, [active, devices, t])

  const connectDevice = async (device: PrinterDevice) => {
    setConnectingId(device.id)
    try {
      if (device.transport === "usb") {
        if (!isWebSerialSupported() && !isWebUsbSupported()) {
          toast.error(t("settings.printers.usbUnsupported") || "USB printing needs Chrome or Edge")
          return
        }
        const info = await requestUsbPrinter()
        if (info) {
          await applyConnected(device, {
            printerId: device.id,
            workstationId: getPrinterWorkstation().id,
            hardwareName: usbHardwareName(info.vendorId, info.productId),
            usbVendorId: info.vendorId,
            usbProductId: info.productId,
            usbKind: info.kind,
            usbSerialNumber: info.serialNumber,
            baudRate: info.baudRate,
          })
          toast.success(t("settings.printers.connected") || "Printer saved on this computer")
        }
      } else if (device.transport === "bluetooth") {
        if (!isWebBluetoothSupported()) {
          toast.error(t("settings.printers.btUnsupported") || "Bluetooth printing needs Chrome or Edge")
          return
        }
        const info = await requestBluetoothPrinter()
        await applyConnected(
          device,
          {
            printerId: device.id,
            workstationId: getPrinterWorkstation().id,
            hardwareName: info.name,
            bluetoothDeviceId: info.deviceId,
          },
          info.name && device.name === "Printer" ? { name: info.name } : undefined,
        )
        toast.success(t("settings.printers.connected") || "Printer saved on this computer")
      } else {
        toast.message(t("settings.printers.systemHint") || "System printers are chosen in the print dialog")
      }
    } catch (err: any) {
      const mapped = bluetoothErrorMessage(err)
      toast.error(
        mapped.includes("Bluetooth Classic")
          ? (t("settings.printers.btClassicError") || mapped)
          : mapped || err?.message || "Could not connect printer",
      )
    } finally {
      setConnectingId(null)
    }
  }

  const formatLabel = (template: PrintFormatOption["template"]) => {
    if (template === "receipt") return t("settings.printers.format.receipt") || "Receipt"
    if (template === "kitchen") return t("settings.printers.format.kitchen") || "Kitchen ticket"
    if (template === "kitchen-delta") return t("settings.printers.format.delta") || "Order update"
    return t("settings.printers.format.label") || "Inventory label"
  }

  const runTestPrint = async (device: PrinterDevice, format: PrintFormatOption) => {
    setTesting(true)
    try {
      await printOnDevice(device, {
        id: `test-${device.id}-${format.template}`,
        module: format.module,
        template: format.template,
        payload: payloadForFormat(format.template, ticketBrandFromSite(currentSite)),
      })
      toast.success(t("settings.printers.testSent") || "Test print sent")
      setTestDevice(null)
    } catch (err: any) {
      const mapped = bluetoothErrorMessage(err)
      toast.error(
        mapped.includes("Bluetooth Classic")
          ? (t("settings.printers.btClassicError") || mapped)
          : mapped || err?.message || "Test print failed",
      )
    } finally {
      setTesting(false)
    }
  }

  const requestTestPrint = (device: PrinterDevice) => {
    const formats = enabledPrintFormats(device)
    if (formats.length === 0) {
      toast.error(t("settings.printers.testNeedModule") || "Turn on a module to test a print format.")
      return
    }
    if (formats.length === 1) {
      void runTestPrint(device, formats[0])
      return
    }
    setTestDevice(device)
  }

  if (!active) return null

  return (
    <div id="printers" className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-2xl font-semibold">{t("settings.printers.title") || "Printers"}</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {t("settings.printers.description") ||
              "Register thermal printers for this site. Connect on this computer to save the device on the printer."}
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" className="shrink-0 whitespace-nowrap" onClick={addPrinter}>
          <PlusCircle className="mr-2 h-4 w-4" />
          {t("settings.printers.add") || "Add printer"}
        </Button>
      </div>

      <div className="max-w-sm space-y-2">
        <Label htmlFor="printer-station-name">
          {t("settings.printers.stationName") || "This computer"}
        </Label>
        <Input
          id="printer-station-name"
          value={stationName}
          onChange={(e) => setStationName(e.target.value)}
          onBlur={commitStationName}
          placeholder={t("settings.printers.stationNamePlaceholder") || "Front counter"}
        />
        <p className="text-xs text-muted-foreground">
          {t("settings.printers.stationNameHint") ||
            "Saved on each printer you connect here, so other computers can see which station owns it."}
        </p>
      </div>

      {devices.length === 0 ? (
        <EmptyCard
          icon={<Printer className="h-10 w-10" />}
          title={t("settings.printers.emptyTitle") || "No printers yet"}
          description={t("settings.printers.emptyDescription") || "Add a receipt, kitchen, or label printer."}
          variant="fancy"
          actionButton={
            <Button type="button" variant="outline" onClick={addPrinter}>
              <PlusCircle className="mr-2 h-4 w-4" />
              {t("settings.printers.add") || "Add printer"}
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4">
        {devices.map((device) => (
          <PrinterDeviceCard
            key={device.id}
            device={device}
            expanded={expandedId === device.id}
            connecting={connectingId === device.id}
            bound={bindTick >= 0 && stationOwnsPrinter(device, getPrinterBind(device.id))}
            saving={saving}
            onToggle={() => setExpandedId(expandedId === device.id ? null : device.id)}
            onChange={(patch) => updateDevice(device.id, patch)}
            onConnect={() => connectDevice(device)}
            onTest={() => requestTestPrint(device)}
            onRemove={() => removeDevice(device.id)}
            onSave={handleSave}
          />
        ))}
        </div>
      )}

      <Dialog open={Boolean(testDevice)} onOpenChange={(open) => !open && !testing && setTestDevice(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("settings.printers.test") || "Test print"}</DialogTitle>
            <DialogDescription>
              {t("settings.printers.testWhich") || "Which format do you want to print?"}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            {(testDevice ? enabledPrintFormats(testDevice) : []).map((format) => (
              <Button
                key={format.template}
                type="button"
                variant="outline"
                className="justify-start"
                disabled={testing}
                onClick={() => testDevice && void runTestPrint(testDevice, format)}
              >
                {formatLabel(format.template)}
              </Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
