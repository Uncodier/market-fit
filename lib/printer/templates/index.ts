import { encodeReceipt } from "./receipt"
import { encodeKitchenTicket } from "./kitchen"
import { encodeKitchenDelta } from "./kitchen-delta"
import { encodeInventoryLabel } from "./inventory-label"
import { encodeTestPrint } from "./test"
import { htmlForJob } from "./html"
import type {
  InventoryLabelPayload,
  KitchenPayload,
  PaperWidthMm,
  PrintJob,
  ReceiptPayload,
  TestPrintPayload,
} from "../core/types"

export function encodeJob(job: PrintJob, paper: PaperWidthMm): Uint8Array {
  switch (job.template) {
    case "receipt":
      return encodeReceipt(job.payload as ReceiptPayload, paper)
    case "kitchen":
      return encodeKitchenTicket(job.payload as KitchenPayload, paper)
    case "kitchen-delta":
      return encodeKitchenDelta(job.payload as KitchenPayload, paper)
    case "inventory-label":
      return encodeInventoryLabel(job.payload as InventoryLabelPayload, paper)
    case "test":
      return encodeTestPrint(job.payload as TestPrintPayload, paper)
    default:
      return encodeTestPrint({ printerName: "Printer" }, paper)
  }
}

export { htmlForJob }
export { thermalHtmlForJob } from "./html-thermal"
