"use client"

import { useCallback, useMemo, useState } from "react"
import { useSite } from "@/app/context/SiteContext"
import {
  clearPrinterBind,
  createPrinterDevice,
  getPrinterBind,
  isWebBluetoothSupported,
  isWebSerialSupported,
  normalizePrintersSettings,
  printOnDevice,
  printJobForSettings,
  printerJobQueue,
  requestBluetoothPrinter,
  requestUsbPrinter,
  setPrinterBind,
  type PrintJob,
  type PrinterDevice,
  type PrintersSettings,
} from "@/lib/printer"

function newJobId() {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `job_${Date.now()}`
}

export function usePrinter() {
  const { currentSite } = useSite()
  const settings = useMemo(
    () => normalizePrintersSettings(currentSite?.settings?.printers),
    [currentSite?.settings?.printers],
  )
  const [busy, setBusy] = useState(false)

  const printJob = useCallback(
    async (job: Omit<PrintJob, "id"> & { id?: string }) => {
      const full: PrintJob = { ...job, id: job.id || newJobId() }
      setBusy(true)
      try {
        await printJobForSettings(settings, full)
      } finally {
        setBusy(false)
      }
    },
    [settings],
  )

  const printOn = useCallback(async (device: PrinterDevice, job: Omit<PrintJob, "id"> & { id?: string }) => {
    const full: PrintJob = { ...job, id: job.id || newJobId() }
    setBusy(true)
    try {
      await printOnDevice(device, full)
    } finally {
      setBusy(false)
    }
  }, [])

  const enqueue = useCallback((job: Omit<PrintJob, "id"> & { id?: string }) => {
    const full: PrintJob = { ...job, id: job.id || newJobId() }
    printerJobQueue.setHandler(async (queued) => {
      await printJobForSettings(settings, queued)
    })
    return printerJobQueue.enqueue(full)
  }, [settings])

  return {
    settings,
    busy,
    printJob,
    printOn,
    enqueue,
    isWebSerialSupported: isWebSerialSupported(),
    isWebBluetoothSupported: isWebBluetoothSupported(),
    getPrinterBind,
    setPrinterBind,
    clearPrinterBind,
    requestUsbPrinter,
    requestBluetoothPrinter,
    createPrinterDevice,
  }
}

export function usePrinterSettings(): PrintersSettings {
  const { currentSite } = useSite()
  return useMemo(
    () => normalizePrintersSettings(currentSite?.settings?.printers),
    [currentSite?.settings?.printers],
  )
}
