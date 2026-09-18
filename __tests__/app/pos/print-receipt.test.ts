import {
  htmlForJob,
  isPrinterReadyOnStation,
  kitchenDeltaHasWork,
  printersForJob,
  printHtml,
  printJobForSettings,
  printOnDevice,
  shouldAutoPrint,
} from "@/lib/printer"
import {
  printAfterPosCheckout,
  printPosReceiptManually,
  receiptFromPosCart,
} from "@/app/pos/print-after-checkout"
import { receiptHtml } from "@/lib/printer/templates/html"
import { encodeReceipt } from "@/lib/printer/templates/receipt"
import { encodeKitchenTicket } from "@/lib/printer/templates/kitchen"

jest.mock("@/app/printer/actions", () => ({
  markKitchenItemsPrinted: jest.fn(),
}))

jest.mock("@/lib/printer", () => ({
  htmlForJob: jest.fn(() => "<html>receipt</html>"),
  isPrinterReadyOnStation: jest.fn(),
  kitchenDeltaHasWork: jest.fn(),
  printersForJob: jest.fn(),
  printHtml: jest.fn(),
  printJobForSettings: jest.fn(),
  printOnDevice: jest.fn(),
  rememberPrinted: jest.fn(),
  shouldAutoPrint: jest.fn(),
}))

const usbPrinter = {
  id: "receipt-printer",
  name: "Receipt printer",
  transport: "usb" as const,
  paperWidthMm: 80 as const,
  copies: 1,
  enabled: true,
  modules: { pos: true, orders: false, inventory: false },
  autoPrint: {
    posReceipt: false,
    kitchenTicket: false,
    orderDelta: false,
    inventoryLabel: false,
  },
}

const receipt = {
  lines: [{ name: "Coffee", quantity: 1, unitPrice: 3, subtotal: 3 }],
  total: 3,
  currency: "USD",
}

describe("manual POS receipt printing", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.mocked(printersForJob).mockReturnValue([usbPrinter])
    jest.mocked(isPrinterReadyOnStation).mockReturnValue(true)
  })

  it("uses the synchronized hardware printer when available", async () => {
    await expect(
      printPosReceiptManually({
        settings: { devices: [usbPrinter] },
        receipt,
      }),
    ).resolves.toBe("printer")

    expect(printOnDevice).toHaveBeenCalledWith(
      usbPrinter,
      expect.objectContaining({ module: "pos", template: "receipt" }),
      { allowPrompt: false },
    )
    expect(printHtml).not.toHaveBeenCalled()
  })

  it("opens system print when the synchronized printer cannot be reached", async () => {
    jest.mocked(printOnDevice).mockRejectedValueOnce(new Error("USB unavailable"))

    await expect(
      printPosReceiptManually({
        settings: { devices: [usbPrinter] },
        receipt,
      }),
    ).resolves.toBe("system")

    expect(htmlForJob).toHaveBeenCalledWith(
      expect.objectContaining({ module: "pos", template: "receipt" }),
      80,
    )
    expect(printHtml).toHaveBeenCalledWith("<html>receipt</html>")
  })

  it("includes the employee who requested the order in receipt summaries", () => {
    const payload = receiptFromPosCart({
      cart: [
        {
          id: "coffee",
          name: "Coffee",
          cartQty: 1,
          cartPrice: 3,
        } as any,
      ],
      total: 3,
      requestedByName: "Alex Seller",
    })

    expect(payload.requestedByName).toBe("Alex Seller")
    expect(receiptHtml(payload, 80)).toContain("Requested by")
    expect(receiptHtml(payload, 80)).toContain("Alex Seller")
    expect(Buffer.from(encodeReceipt(payload, 80)).toString("utf8")).toContain(
      "Alex Seller",
    )
  })

  it("includes the requestor in the printed kitchen ticket", async () => {
    jest.mocked(kitchenDeltaHasWork).mockReturnValue(true)
    jest.mocked(shouldAutoPrint).mockReturnValue(true)
    jest.mocked(printJobForSettings).mockResolvedValue(true)

    await printAfterPosCheckout({
      settings: { devices: [usbPrinter] },
      siteId: "site-1",
      intent: "send",
      orderId: "order-1",
      kitchenDelta: {
        kind: "full",
        adds: [],
        qtyChanges: [],
        voids: [],
      },
      receipt: {
        ...receipt,
        requestedByName: "Alex Seller",
      },
    })

    expect(printJobForSettings).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        template: "kitchen",
        payload: expect.objectContaining({
          requestedByName: "Alex Seller",
        }),
      }),
      expect.anything(),
    )
    expect(
      Buffer.from(
        encodeKitchenTicket(
          {
            lines: [],
            requestedByName: "Alex Seller",
          },
          80,
        ),
      ).toString("utf8"),
    ).toContain("Alex Seller")
  })
})
