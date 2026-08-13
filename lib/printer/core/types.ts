export type PrinterTransport = "usb" | "bluetooth" | "system"
export type PrinterModule = "pos" | "orders" | "inventory"
export type PaperWidthMm = 58 | 80
export type PrintTemplateKind =
  | "receipt"
  | "kitchen"
  | "kitchen-delta"
  | "inventory-label"
  | "test"

export interface PrinterModuleFlags {
  pos: boolean
  orders: boolean
  inventory: boolean
}

export interface PrinterAutoPrint {
  posReceipt: boolean
  kitchenTicket: boolean
  orderDelta: boolean
  inventoryLabel: boolean
}

export interface PrinterStationClaim {
  workstationId: string
  workstationName: string
  hardwareName?: string
  bluetoothDeviceId?: string
  usbVendorId?: number
  usbProductId?: number
  usbKind?: "serial" | "webusb"
  usbSerialNumber?: string
  boundAt?: string
}

export interface PrinterDevice {
  id: string
  name: string
  transport: PrinterTransport
  paperWidthMm: PaperWidthMm
  copies: number
  enabled: boolean
  modules: PrinterModuleFlags
  autoPrint: PrinterAutoPrint
  station?: PrinterStationClaim
}

export interface PrintersSettings {
  devices: PrinterDevice[]
}

export interface KitchenModifier {
  name: string
  quantity: number
}

export interface KitchenLine {
  key: string
  name: string
  quantity: number
  itemId?: string
  catalogItemId?: string | null
  modifiers?: KitchenModifier[]
  notes?: string
}

export interface KitchenQtyChange {
  key: string
  name: string
  from: number
  to: number
  itemId?: string
  modifiers?: KitchenModifier[]
}

export interface KitchenDelta {
  kind: "full" | "delta" | "none"
  adds: KitchenLine[]
  qtyChanges: KitchenQtyChange[]
  voids: KitchenLine[]
}

export interface DeltaLineInput {
  key: string
  name: string
  quantity: number
  catalogItemId?: string | null
  parentKey?: string | null
  isModifier?: boolean
  status?: string | null
  itemId?: string
}

export interface ReceiptLine {
  name: string
  quantity: number
  unitPrice: number
  subtotal: number
  modifiers?: { name: string; quantity: number }[]
}

export interface TicketBrand {
  siteName?: string | null
  logoUrl?: string | null
  address?: string | null
  phone?: string | null
  website?: string | null
  taxId?: string | null
  locale?: string | null
}

export interface ReceiptPayload extends TicketBrand {
  title?: string
  orderNumber?: string | null
  createdAt?: string | null
  customerName?: string | null
  cashierName?: string | null
  fulfillment?: string | null
  locationName?: string | null
  lines: ReceiptLine[]
  subtotal?: number | null
  taxTotal?: number | null
  discountTotal?: number | null
  total?: number | null
  currency?: string | null
  payments?: { method: string; amount: number; tendered?: number; change?: number }[]
  notes?: string | null
  qrValue?: string | null
}

export interface KitchenPayload extends TicketBrand {
  orderNumber?: string | null
  createdAt?: string | null
  fulfillment?: string | null
  customerName?: string | null
  tableName?: string | null
  notes?: string | null
  lines: KitchenLine[]
  delta?: KitchenDelta
}

export interface InventoryLabelPayload extends TicketBrand {
  name: string
  sku?: string | null
  qrValue: string
  locationName?: string | null
  locationCode?: string | null
  quantity?: number | null
  itemId?: string | null
  printedAt?: string | null
}

export interface TestPrintPayload {
  printerName: string
  locale?: string | null
  title?: string | null
  stationName?: string | null
  hardwareName?: string | null
}

export type PrintJobPayload =
  | ReceiptPayload
  | KitchenPayload
  | InventoryLabelPayload
  | TestPrintPayload

export interface PrintJob {
  id: string
  module: PrinterModule
  template: PrintTemplateKind
  payload: PrintJobPayload
  orderId?: string
  sentAt?: string
  copies?: number
}

export interface WorkstationBind {
  printerId: string
  workstationId?: string
  hardwareName?: string
  usbVendorId?: number
  usbProductId?: number
  usbKind?: "serial" | "webusb"
  usbSerialNumber?: string
  baudRate?: number
  bluetoothDeviceId?: string
}

export const DEFAULT_PRINTERS_SETTINGS: PrintersSettings = {
  devices: [],
}

export function emptyPrinterModules(): PrinterModuleFlags {
  return { pos: false, orders: false, inventory: false }
}

export function emptyAutoPrint(): PrinterAutoPrint {
  return {
    posReceipt: false,
    kitchenTicket: false,
    orderDelta: false,
    inventoryLabel: false,
  }
}

export function createPrinterDevice(
  partial?: Partial<PrinterDevice>,
): PrinterDevice {
  const id =
    partial?.id ||
    (typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `printer_${Date.now()}`)
  return {
    id,
    name: partial?.name || "Printer",
    transport: partial?.transport || "system",
    paperWidthMm: partial?.paperWidthMm || 80,
    copies: partial?.copies ?? 1,
    enabled: partial?.enabled ?? true,
    modules: { ...emptyPrinterModules(), ...partial?.modules },
    autoPrint: { ...emptyAutoPrint(), ...partial?.autoPrint },
    ...(partial?.station ? { station: partial.station } : {}),
  }
}

export function normalizePrintersSettings(
  raw: unknown,
): PrintersSettings {
  if (!raw || typeof raw !== "object") return { devices: [] }
  const devices = Array.isArray((raw as PrintersSettings).devices)
    ? (raw as PrintersSettings).devices
    : []
  return {
    devices: devices.map((d) => createPrinterDevice(d)),
  }
}

export function charsPerLine(width: PaperWidthMm): number {
  return width === 58 ? 32 : 48
}
