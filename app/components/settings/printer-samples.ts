import type { PrintTemplateKind, PrinterDevice, PrinterModule } from "@/lib/printer"
import { ticketBrandFromSite } from "@/lib/printer"

export type PrintFormatOption = {
  template: Exclude<PrintTemplateKind, "test">
  module: PrinterModule
}

export function enabledPrintFormats(device: PrinterDevice): PrintFormatOption[] {
  const formats: PrintFormatOption[] = []
  if (device.modules.pos) formats.push({ template: "receipt", module: "pos" })
  if (device.modules.orders) {
    formats.push({ template: "kitchen", module: "orders" })
    formats.push({ template: "kitchen-delta", module: "orders" })
  }
  if (device.modules.inventory) formats.push({ template: "inventory-label", module: "inventory" })
  return formats
}

export function samplePayloads(brand: ReturnType<typeof ticketBrandFromSite>) {
  const createdAt = new Date().toISOString()
  return {
    receipt: {
      ...brand,
      siteName: brand.siteName || "Makinari",
      orderNumber: "ORD-1001",
      createdAt,
      fulfillment: "dine_in",
      customerName: "Ana Perez",
      locationName: "Main",
      currency: "USD",
      lines: [
        { name: "Burger", quantity: 1, unitPrice: 12, subtotal: 12, modifiers: [{ name: "Cheese", quantity: 1 }] },
        { name: "Fries", quantity: 1, unitPrice: 4, subtotal: 4 },
      ],
      subtotal: 16,
      taxTotal: 1.28,
      total: 17.28,
      payments: [{ method: "cash", amount: 17.28, tendered: 20, change: 2.72 }],
      qrValue: "ORD-1001",
    },
    kitchen: {
      ...brand,
      orderNumber: "ORD-1001",
      createdAt,
      fulfillment: "dine_in",
      customerName: "Ana Perez",
      lines: [{ key: "1", name: "Burger", quantity: 1, modifiers: [{ name: "Cheese", quantity: 1 }] }],
      notes: "No onions",
    },
    delta: {
      ...brand,
      orderNumber: "ORD-1001",
      createdAt,
      fulfillment: "dine_in",
      lines: [],
      delta: {
        kind: "delta" as const,
        adds: [{ key: "2", name: "Fries", quantity: 1 }],
        qtyChanges: [{ key: "1", name: "Burger", from: 1, to: 2 }],
        voids: [{ key: "3", name: "Salad", quantity: 1 }],
      },
    },
    label: {
      ...brand,
      name: "House Blend",
      sku: "COF-001",
      locationName: "Main",
      quantity: 24,
      printedAt: createdAt,
      qrValue: "INV|COF-001|Main|24",
    },
  }
}

export function payloadForFormat(
  template: PrintFormatOption["template"],
  brand: ReturnType<typeof ticketBrandFromSite>,
) {
  const samples = samplePayloads(brand)
  if (template === "receipt") return samples.receipt
  if (template === "kitchen") return samples.kitchen
  if (template === "kitchen-delta") return samples.delta
  return samples.label
}
