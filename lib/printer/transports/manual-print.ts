import {
  htmlForJob,
  isPrinterReadyOnStation,
  printersForJob,
  printHtml,
  printOnDevice,
  type PrintJob,
  type PrintersSettings,
} from "@/lib/printer"

/** Manual jobs ignore automatic-print flags and never fail over from hardware. */
export async function printJobManually(
  settings: PrintersSettings,
  job: PrintJob,
): Promise<"printer" | "system"> {
  const configured = printersForJob(settings, job.module, job.template)
  const hardwarePrinters = configured.filter(
    (device) => device.transport !== "system" && isPrinterReadyOnStation(device),
  )
  if (hardwarePrinters.length > 0) {
    // A failed transfer may already have printed part of the report or receipt.
    try {
      // Orders fans out to kitchen stations; POS keeps its single-printer behavior.
      const targets = job.module === "orders" ? hardwarePrinters : hardwarePrinters.slice(0, 1)
      for (const device of targets) {
        await printOnDevice(device, job, { allowPrompt: false })
      }
    } catch (failure) {
      const detail = failure instanceof Error ? failure.message : "Printer transfer failed."
      throw new Error(`${detail} Output may be partial. Check the printer before retrying.`)
    }
    return "printer"
  }
  if (settings.devices.some((device) => device.modules[job.module] && device.transport !== "system")) {
    throw new Error(
      `The configured ${job.module === "pos" ? "POS" : job.module} printer is not ready on this computer. Open Settings > Printers, enable it and connect it here, then run a test print.`,
    )
  }
  const systemPrinters = configured.filter(
    (device) => device.transport === "system" && isPrinterReadyOnStation(device),
  )
  if (systemPrinters.length > 0) {
    const targets = job.module === "orders" ? systemPrinters : systemPrinters.slice(0, 1)
    for (const device of targets) {
      await printOnDevice(device, job, { allowPrompt: false })
    }
  } else {
    await printHtml(htmlForJob(job, 80))
  }
  return "system"
}