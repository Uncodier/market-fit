"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { usePrinterSettings } from "./use-printer"
import { useSite } from "@/app/context/SiteContext"
import {
  PRINTER_BIND_CHANGED_EVENT,
  bluetoothErrorMessage,
  buildStationClaim,
  claimNeedsUpdate,
  getPrinterBind,
  getPrinterWorkstation,
  isClaimedByThisWorkstation,
  printersForModule,
  printerStationStatus,
  probeModulePrinters,
  requestBluetoothPrinter,
  requestUsbPrinter,
  setPrinterBind,
  usbHardwareName,
  withStationClaim,
  type PrinterAidKind,
  type PrinterDevice,
  type PrinterModule,
  type PrintersSettings,
  type PrinterStationState,
  type PrinterStationStatus,
  type WorkstationBind,
} from "@/lib/printer"

export type LivePrinterStatus = PrinterStationStatus & {
  error?: string
  aid?: PrinterAidKind
  reconnect: () => Promise<void>
  confirm: () => Promise<void>
  reconnecting: boolean
}

function usbBind(deviceId: string, info: {
  vendorId?: number
  productId?: number
  kind: "serial" | "webusb"
  serialNumber?: string
  baudRate?: number
}): WorkstationBind {
  return {
    printerId: deviceId,
    workstationId: getPrinterWorkstation().id,
    hardwareName: usbHardwareName(info.vendorId, info.productId),
    usbVendorId: info.vendorId,
    usbProductId: info.productId,
    usbKind: info.kind,
    usbSerialNumber: info.serialNumber,
    baudRate: info.baudRate,
  }
}

export function usePrinterStationStatus(module: PrinterModule): LivePrinterStatus {
  const settings = usePrinterSettings()
  const { currentSite, updateSettings } = useSite()
  const locale = currentSite?.settings?.default_locale || null
  const [tick, setTick] = useState(0)
  const [live, setLive] = useState<PrinterStationState>("checking")
  const [error, setError] = useState<string | undefined>()
  const [aid, setAid] = useState<PrinterAidKind | undefined>()
  const [reconnecting, setReconnecting] = useState(false)
  const probeId = useRef(0)

  const persistPrinters = useCallback(
    async (devices: PrinterDevice[]) => {
      if (!currentSite) return
      await updateSettings(currentSite.id, {
        site_id: currentSite.id,
        ...(currentSite.settings?.id ? { id: currentSite.settings.id } : {}),
        printers: { devices },
      })
    },
    [currentSite, updateSettings],
  )

  const persistOwnedClaims = useCallback(
    async (source: PrintersSettings) => {
      let next = source.devices
      let changed = false
      for (const device of printersForModule(source, module)) {
        const bind = getPrinterBind(device.id)
        if (!bind) continue
        if (device.station && !isClaimedByThisWorkstation(device)) continue
        if (!claimNeedsUpdate(device, bind)) continue
        next = withStationClaim(next, device.id, buildStationClaim(bind))
        changed = true
      }
      if (changed) await persistPrinters(next)
    },
    [module, persistPrinters],
  )

  const base = useMemo(
    () => printerStationStatus(settings, module),
    [settings, module, tick],
  )

  const runProbe = useCallback(
    async (forcePrint = false, override?: PrintersSettings) => {
      const active = override || settings
      if (printerStationStatus(active, module).state === "hidden") {
        setLive("hidden")
        setError(undefined)
        setAid(undefined)
        return { state: "hidden" as const }
      }
      const id = ++probeId.current
      setLive("checking")
      const outcome = await probeModulePrinters(active, module, {
        forcePrint,
        locale,
      })
      if (id !== probeId.current) return outcome
      setLive(outcome.state)
      setError(outcome.error)
      setAid(outcome.aid)
      if (outcome.state === "ready") {
        void persistOwnedClaims(active)
      }
      return outcome
    },
    [settings, module, locale, persistOwnedClaims],
  )

  useEffect(() => {
    void runProbe(false)
  }, [runProbe])

  useEffect(() => {
    const bump = () => setTick((n) => n + 1)
    window.addEventListener(PRINTER_BIND_CHANGED_EVENT, bump)
    window.addEventListener("storage", bump)
    return () => {
      window.removeEventListener(PRINTER_BIND_CHANGED_EVENT, bump)
      window.removeEventListener("storage", bump)
    }
  }, [])

  const reconnect = useCallback(async () => {
    const devices = printersForModule(settings, module).filter(
      (device) => device.transport !== "system",
    )
    setReconnecting(true)
    try {
      let nextDevices = settings.devices
      for (const device of devices) {
        if (device.transport === "usb") {
          const info = await requestUsbPrinter()
          if (info) {
            const bind = usbBind(device.id, info)
            setPrinterBind(bind)
            nextDevices = withStationClaim(nextDevices, device.id, buildStationClaim(bind), {
              enabled: true,
            })
          }
        } else if (device.transport === "bluetooth") {
          const info = await requestBluetoothPrinter()
          const bind: WorkstationBind = {
            printerId: device.id,
            workstationId: getPrinterWorkstation().id,
            hardwareName: info.name,
            bluetoothDeviceId: info.deviceId,
          }
          setPrinterBind(bind)
          nextDevices = withStationClaim(nextDevices, device.id, buildStationClaim(bind), {
            enabled: true,
            ...(info.name && device.name === "Printer" ? { name: info.name } : {}),
          })
        }
      }
      await persistPrinters(nextDevices)
      const outcome = await runProbe(true, { devices: nextDevices })
      if (outcome.state !== "ready") {
        throw new Error(outcome.error || "Printer is not connected on this computer")
      }
    } catch (err) {
      setLive("disconnected")
      setError(bluetoothErrorMessage(err))
      throw err
    } finally {
      setReconnecting(false)
    }
  }, [settings, module, persistPrinters, runProbe])

  const state: PrinterStationState =
    base.state === "hidden" ? "hidden" : live === "checking" ? "checking" : live

  return {
    state,
    configured: base.configured,
    ready: state === "ready" ? Math.max(1, base.ready) : 0,
    error,
    aid,
    reconnect,
    confirm: async () => {
      const outcome = await runProbe(true)
      if (outcome.state !== "ready" && outcome.state !== "hidden") {
        throw new Error(outcome.error || "Printer is not connected on this computer")
      }
    },
    reconnecting,
  }
}
