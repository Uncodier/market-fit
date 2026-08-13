export type {
  PrinterDevice,
  PrintersSettings,
  PrinterTransport,
  PrinterModule,
  PaperWidthMm,
  PrintJob,
  KitchenDelta,
  KitchenLine,
  KitchenPayload,
  ReceiptPayload,
  InventoryLabelPayload,
  WorkstationBind,
  PrinterStationClaim,
  TicketBrand,
} from "./core/types"
export {
  createPrinterDevice,
  normalizePrintersSettings,
  DEFAULT_PRINTERS_SETTINGS,
  charsPerLine,
} from "./core/types"
export { ticketBrandFromSite, buildInventoryTraceValue } from "./core/branding"
export { ticketCopy, resolveTicketLocale } from "./core/copy"
export {
  computeKitchenDelta,
  kitchenDeltaHasWork,
  mapSaleOrderItemToDeltaLine,
  mapSaleOrderItemsToDeltaLines,
  mapProcessedLineToDeltaLine,
} from "./core/order-delta"
export { printerJobQueue, wasPrinted, rememberPrinted, printDedupeKey } from "./core/job-queue"
export { getPrinterBind, setPrinterBind, clearPrinterBind, PRINTER_BIND_CHANGED_EVENT } from "./core/bind-store"
export {
  getPrinterWorkstation,
  setPrinterWorkstationName,
  PRINTER_STATION_CHANGED_EVENT,
} from "./core/workstation"
export {
  buildStationClaim,
  stationOwnsPrinter,
  isClaimedByThisWorkstation,
  claimNeedsUpdate,
  withStationClaim,
  renameClaimsForWorkstation,
  usbHardwareName,
} from "./core/station-claim"
export {
  isPrinterReadyOnStation,
  isTransportSupported,
  printerStationStatus,
  type PrinterStationState,
  type PrinterStationStatus,
} from "./core/station-status"
export {
  probeModulePrinters,
  classifyProbeRows,
  type ProbeOutcome,
  type ProbeRow,
  type PrinterAidKind,
} from "./core/probe"
export { printersForModule, printersForAutoPrint, printersForJob } from "./core/format"
export { htmlForJob, encodeJob, thermalHtmlForJob } from "./templates"
export {
  printJobForSettings,
  printOnDevice,
  shouldAutoPrint,
  autoPrintFlagForJob,
  warmStationPrinters,
} from "./transports/dispatch"
export { isWebSerialSupported, requestUsbPrinter } from "./transports/web-serial"
export { isWebUsbSupported } from "./transports/web-usb"
export {
  isWebBluetoothSupported,
  requestBluetoothPrinter,
  bluetoothErrorMessage,
  warmBluetoothPrinter,
} from "./transports/web-bluetooth"
export { printHtml } from "./transports/browser-print"
export { qrCommandPrefix, wrapText, padLine } from "./core/escpos"
