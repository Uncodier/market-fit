import { act, renderHook } from "@testing-library/react"
import { getOrder } from "@/app/orders/actions"
import { createPrinterDevice, type PrintersSettings } from "@/lib/printer/core/types"
import { printerJobQueue } from "@/lib/printer/core/job-queue"
import { usePrinterRealtime } from "@/lib/printer/hooks/use-printer-realtime"

jest.mock("@/app/orders/actions", () => ({ getOrder: jest.fn() }))
jest.mock("@/app/printer/actions", () => ({ markKitchenItemsPrinted: jest.fn() }))
jest.mock("@/lib/printer/core/job-queue", () => ({
  printerJobQueue: { setHandler: jest.fn(), enqueue: jest.fn() },
  wasPrinted: jest.fn(() => false),
}))

const device = createPrinterDevice({
  id: "kitchen", transport: "system",
  modules: { orders: true, pos: false, inventory: false },
  autoPrint: { kitchenTicket: false, orderDelta: false, posReceipt: false, inventoryLabel: false },
})
const item = { id: "item-1", catalog_item_id: "meal", item_name: "Meal", quantity: 1, status: "pending" }

async function orderEvent() {
  await act(async () => {
    window.dispatchEvent(new CustomEvent("printer:order-event", {
      detail: { table: "sale_orders", eventType: "UPDATE", new: { id: "order-1" } },
    }))
    await jest.advanceTimersByTimeAsync(400)
  })
}

beforeEach(() => {
  jest.clearAllMocks()
  jest.useFakeTimers()
  sessionStorage.clear()
  jest.mocked(getOrder).mockResolvedValue({ data: {
    id: "order-1", order_number: "123", created_at: new Date().toISOString(),
    sale_order_items: [item],
  } } as never)
})
afterEach(() => jest.useRealTimers())

it("does not load or enqueue orders when both automatic toggles are off", async () => {
  renderHook(() => usePrinterRealtime("site-1", { devices: [device] }))
  await orderEvent()
  expect(getOrder).not.toHaveBeenCalled()
  expect(printerJobQueue.enqueue).not.toHaveBeenCalled()
})

it("enqueues a full ticket only when kitchen automatic printing is enabled", async () => {
  const enabled = { ...device, autoPrint: { ...device.autoPrint, kitchenTicket: true } }
  const { rerender } = renderHook(({ settings }: { settings: PrintersSettings }) =>
    usePrinterRealtime("site-1", settings), { initialProps: { settings: { devices: [enabled] } } })
  await orderEvent()
  expect(printerJobQueue.enqueue).toHaveBeenCalledWith(expect.objectContaining({ template: "kitchen" }))
  jest.mocked(getOrder).mockClear()
  jest.mocked(printerJobQueue.enqueue).mockClear()
  rerender({ settings: { devices: [device] } })
  await orderEvent()
  expect(getOrder).not.toHaveBeenCalled()
  expect(printerJobQueue.enqueue).not.toHaveBeenCalled()
})

it("keeps order updates independent from full ticket printing", async () => {
  const enabled = { ...device, autoPrint: { ...device.autoPrint, orderDelta: true } }
  renderHook(() => usePrinterRealtime("site-1", { devices: [enabled] }))
  await orderEvent()
  expect(printerJobQueue.enqueue).not.toHaveBeenCalled()
  jest.mocked(getOrder).mockResolvedValue({ data: {
    id: "order-1", created_at: new Date().toISOString(), sale_order_items: [{ ...item, quantity: 2 }],
  } } as never)
  await orderEvent()
  expect(printerJobQueue.enqueue).toHaveBeenCalledWith(expect.objectContaining({ template: "kitchen-delta" }))
})

it.each(["disable", "unmount", "switch site"] as const)(
  "discards an in-flight order after %s", async (change) => {
    let resolveOrder!: (value: Awaited<ReturnType<typeof getOrder>>) => void
    jest.mocked(getOrder).mockReturnValue(new Promise(resolve => { resolveOrder = resolve }))
    const enabled = { ...device, autoPrint: { ...device.autoPrint, kitchenTicket: true } }
    const { rerender, unmount } = renderHook(
      ({ siteId, settings }: { siteId: string; settings: PrintersSettings }) =>
        usePrinterRealtime(siteId, settings),
      { initialProps: { siteId: "site-1", settings: { devices: [enabled] } } },
    )
    await orderEvent()
    expect(getOrder).toHaveBeenCalledTimes(1)
    if (change === "unmount") unmount()
    else rerender({
      siteId: change === "switch site" ? "site-2" : "site-1",
      settings: { devices: [change === "disable" ? device : enabled] },
    })
    await act(async () => {
      resolveOrder({ data: {
        id: "order-1", created_at: new Date().toISOString(), sale_order_items: [item],
      } } as never)
    })
    expect(printerJobQueue.enqueue).not.toHaveBeenCalled()
    expect(sessionStorage.getItem("makinari-kitchen-snap:order-1")).toBeNull()
  },
)