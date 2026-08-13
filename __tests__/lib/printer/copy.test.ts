import { ticketCopy, resolveTicketLocale, ticketHeading } from "../../../lib/printer/core/copy"
import { fulfillmentLabel, paymentMethodLabel } from "../../../lib/printer/core/format"
import { padCenter } from "../../../lib/printer/core/layout"
import { receiptHtml, kitchenHtml, testPrintHtml } from "../../../lib/printer/templates/html"
import { encodeReceipt } from "../../../lib/printer/templates/receipt"
import { encodeKitchenTicket } from "../../../lib/printer/templates/kitchen"
import type { ReceiptPayload } from "../../../lib/printer/core/types"

const receiptEs: ReceiptPayload = {
  locale: "es",
  siteName: "Cafe",
  orderNumber: "ORD-1",
  createdAt: "2026-08-12T12:00:00.000Z",
  fulfillment: "dine_in",
  customerName: "Ana",
  lines: [{ name: "Burger", quantity: 1, unitPrice: 12, subtotal: 12 }],
  subtotal: 12,
  taxTotal: 1,
  total: 13,
  currency: "USD",
  payments: [{ method: "cash", amount: 13, change: 2 }],
}

describe("ticket locale copy", () => {
  it("resolves site locales and falls back to English", () => {
    expect(resolveTicketLocale("es-MX")).toBe("es")
    expect(resolveTicketLocale("ja")).toBe("ja")
    expect(resolveTicketLocale("pt")).toBe("en")
    expect(ticketCopy("es").thankYou).toBe("Gracias")
    expect(ticketCopy("es").stationSynced).toBe("Lista")
    expect(ticketCopy("es").syncLinked).toBe("Vinculada a esta computadora")
    expect(ticketCopy("es").readyToPrint).toBe("Lista para imprimir")
    expect(ticketCopy("fr").receipt).toBe("Reçu")
    expect(ticketCopy("de").kitchen).toBe("Küche")
    expect(ticketCopy("ja").total).toBe("合計")
    expect(ticketHeading("Cocina", "es")).toBe("COCINA")
    expect(ticketHeading("厨房", "ja")).toBe("厨房")
  })

  it("translates fulfillment and payment labels", () => {
    expect(fulfillmentLabel("dine_in", "es")).toBe("Comer aquí")
    expect(fulfillmentLabel("pickup", "fr")).toBe("À emporter")
    expect(paymentMethodLabel("cash", "es")).toBe("Efectivo")
    expect(paymentMethodLabel("card", "de")).toBe("Karte")
  })

  it("renders HTML receipts in the site locale", () => {
    const html = receiptHtml(receiptEs, 58)
    expect(html).toContain('lang="es"')
    expect(html).toContain("Gracias")
    expect(html).toContain("Cliente")
    expect(html).toContain("Comer aquí")
    expect(html).toContain("Efectivo")
    expect(html).toContain("Cambio")
    expect(html).not.toContain("Thank you")
  })

  it("renders kitchen HTML banners in the site locale", () => {
    const html = kitchenHtml(
      {
        locale: "es",
        orderNumber: "ORD-1",
        fulfillment: "pickup",
        tableName: "4",
        lines: [{ key: "1", name: "Burger", quantity: 1 }],
      },
      58,
    )
    expect(html).toContain("Cocina")
    expect(html).toContain("Mesa")
    expect(html).toContain("Recoger")
  })

  it("renders the sync ticket in the site locale", () => {
    const html = testPrintHtml(
      {
        locale: "es",
        printerName: "Cocina",
        stationName: "Caja principal",
        hardwareName: "TM-T20",
      },
      58,
    )
    expect(html).toContain("Lista")
    expect(html).toContain("Vinculada a esta computadora")
    expect(html).toContain("Computadora")
    expect(html).toContain("Caja principal")
    expect(html).toContain("Lista para imprimir")
    expect(html).not.toContain("Linked to this computer")
  })

  it("encodes ESC/POS receipts without throwing for Spanish copy", () => {
    const bytes = encodeReceipt(receiptEs, 58)
    expect(bytes.length).toBeGreaterThan(20)
    const text = Buffer.from(bytes).toString("latin1")
    expect(text).toContain("Gracias")
    expect(text).toContain("Cliente")
  })

  it("prints full-width kitchen banners and tall type instead of double-width", () => {
    const bytes = encodeKitchenTicket(
      {
        locale: "es",
        orderNumber: "ORD-1001",
        fulfillment: "dine_in",
        customerName: "Ana Perez",
        notes: "No onions",
        lines: [{ key: "1", name: "Burger", quantity: 1, modifiers: [{ name: "Cheese", quantity: 1 }] }],
      },
      58,
    )
    const text = Buffer.from(bytes).toString("latin1")
    expect(text).toContain(padCenter(" COCINA ", 16))
    expect(text).toContain(padCenter(" NOTAS ", 16))
    expect(text).toContain("#ORD-1001")
    const arr = Array.from(bytes)
    const hasTall = arr.some((b, i) => b === 0x1d && arr[i + 1] === 0x21 && arr[i + 2] === 0x01)
    const hasBannerSize = arr.some((b, i) => b === 0x1d && arr[i + 1] === 0x21 && arr[i + 2] === 0x11)
    expect(hasTall).toBe(true)
    expect(hasBannerSize).toBe(true)
    const hasRasterBar = arr.some((b, i) => b === 0x1d && arr[i + 1] === 0x76 && arr[i + 2] === 0x30)
    expect(hasRasterBar).toBe(true)
  })
})
