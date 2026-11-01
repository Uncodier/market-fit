import {
  htmlForJob,
  isPrinterReadyOnStation,
  printersForJob,
  printHtml,
  printOnDevice,
  type PrintJob,
  type PrintersSettings,
} from "@/lib/printer"

/** Manual POS jobs ignore automatic-print flags and never fail over from hardware. */
export async function printPosJobManually(
  settings: PrintersSettings,
  job: PrintJob,
): Promise<"printer" | "system"> {
  const configured = printersForJob(settings, "pos", job.template)
  const hardwarePrinter = configured.find(
    (device) => device.transport !== "system" && isPrinterReadyOnStation(device),
  )
  if (hardwarePrinter) {
    // A failed transfer may already have printed part of the report or receipt.
    try {
      await printOnDevice(hardwarePrinter, job, { allowPrompt: false })
    } catch (failure) {
      const detail = failure instanceof Error ? failure.message : "Printer transfer failed."
      throw new Error(`${detail} Output may be partial. Check the printer before retrying.`)
    }
    return "printer"
  }
  if (settings.devices.some((device) => device.modules.pos && device.transport !== "system")) {
    throw new Error(
      "The configured POS printer is not ready on this computer. Open Settings > Printers, enable it and connect it here, then run a test print.",
    )
  }
  const systemPrinter = configured.find(
    (device) => device.transport === "system" && isPrinterReadyOnStation(device),
  )
  if (systemPrinter) {
    await printOnDevice(systemPrinter, job, { allowPrompt: false })
  } else {
    await printHtml(htmlForJob(job, 80))
  }
  return "system"
}