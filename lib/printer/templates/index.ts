import { encodeReceipt } from "./receipt"
import { encodePackingSlip } from "./packing-slip"
import { encodeRegisterReport } from "./register-report"
import { encodeKitchenTicket } from "./kitchen"
import { encodeKitchenDelta } from "./kitchen-delta"
import { encodeInventoryLabel } from "./inventory-label"
import { encodeTestPrint } from "./test"
import { htmlForJob } from "./html"
import type {
  InventoryLabelPayload,
  PackingSlipPayload,
  KitchenPayload,
  PaperWidthMm,
  PrintJob,
  ReceiptPayload,
  RegisterReportPayload,
  TestPrintPayload,
} from "../core/types"

export function encodeJob(job: PrintJob, paper: PaperWidthMm): Uint8Array {
  switch (job.template) {
    case "packing-slip":
      return encodePackingSlip(job.payload as PackingSlipPayload, paper)
    case "register-report":
      return encodeRegisterReport(job.payload as RegisterReportPayload, paper)
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
