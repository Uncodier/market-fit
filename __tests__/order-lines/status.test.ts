import {
  isOrderLineActionStatus,
  nextOrderLineStatus,
  orderLineStatusLabel,
  orderLineStatusesForFilter,
} from "@/app/order-lines/status"
import {
  formatOrderLineDuration,
  isPendingOrderLine,
  isProductionOrderLine,
  shouldTickOrderLineClock,
} from "@/app/order-lines/waiting-time"

describe("order line statuses", () => {
  it("groups active waiting statuses in the Pending filter", () => {
    expect(orderLineStatusesForFilter("pending")).toEqual(["new", "pending"])
    expect(orderLineStatusesForFilter("preparing")).toEqual([
      "preparing",
      "in_progress",
    ])
    expect(orderLineStatusesForFilter("completed")).toEqual([
      "completed",
      "ready",
    ])
  })

  it("uses the existing stored statuses for operational labels", () => {
    expect(orderLineStatusLabel("new")).toBe("Pending")
    expect(orderLineStatusLabel("preparing")).toBe("In Progress")
    expect(orderLineStatusLabel("completed")).toBe("Ready")
    expect(orderLineStatusLabel("returned")).toBe("Returned")
    expect(orderLineStatusLabel("cancelled")).toBe("Cancelled")
  })

  it("only accepts statuses exposed by the quick actions", () => {
    expect(isOrderLineActionStatus("preparing")).toBe(true)
    expect(isOrderLineActionStatus("completed")).toBe(true)
    expect(isOrderLineActionStatus("returned")).toBe(true)
    expect(isOrderLineActionStatus("cancelled")).toBe(true)
    expect(isOrderLineActionStatus("new")).toBe(false)
    expect(isOrderLineActionStatus("arbitrary")).toBe(false)
  })

  it("only exposes the next operational status", () => {
    expect(nextOrderLineStatus("new")).toBe("preparing")
    expect(nextOrderLineStatus("preparing")).toBe("completed")
    expect(nextOrderLineStatus("completed")).toBe("returned")
    expect(nextOrderLineStatus("returned")).toBeNull()
    expect(nextOrderLineStatus("cancelled")).toBeNull()
  })
})

describe("order line waiting time", () => {
  const now = Date.parse("2026-09-21T18:00:00.000Z")

  it("prioritizes seconds, minutes, hours, and days by duration", () => {
    expect(
      formatOrderLineDuration("2026-09-21T17:59:42.000Z", now),
    ).toBe("18s")
    expect(
      formatOrderLineDuration("2026-09-21T17:41:48.000Z", now),
    ).toBe("18m 12s")
    expect(
      formatOrderLineDuration("2026-09-21T17:42:00.000Z", now),
    ).toBe("18m")
    expect(
      formatOrderLineDuration("2026-09-21T15:48:00.000Z", now),
    ).toBe("2h 12m")
    expect(
      formatOrderLineDuration("2026-09-19T15:00:00.000Z", now),
    ).toBe("2d 3h")
  })

  it("only starts the waiting timer for pending line states", () => {
    expect(isPendingOrderLine("draft")).toBe(false)
    expect(isPendingOrderLine("new")).toBe(true)
    expect(isPendingOrderLine("pending")).toBe(true)
    expect(isPendingOrderLine("preparing")).toBe(false)
    expect(isProductionOrderLine("new")).toBe(true)
    expect(isProductionOrderLine("preparing")).toBe(true)
    expect(isProductionOrderLine("completed")).toBe(false)
  })

  it("stops every clock when the parent order is completed", () => {
    expect(
      shouldTickOrderLineClock({
        lineStatus: "preparing",
        orderStatus: "completed",
      }),
    ).toBe(false)
    expect(
      shouldTickOrderLineClock({
        lineStatus: "completed",
        orderStatus: "completed",
        shipmentStatus: "in_transit",
      }),
    ).toBe(false)
  })
})
