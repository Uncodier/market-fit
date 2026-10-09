import React from "react"
import { act, renderHook, waitFor } from "@testing-library/react"
import { SWRConfig } from "swr"
import { getOrder } from "@/app/orders/actions"
import { useOrdersRealtime } from "@/app/orders/hooks/useOrdersRealtime"
import { useOrderDetailData } from "@/app/orders/hooks/use-order-detail-data"
import type { OrderWithRelations } from "@/app/orders/types"

jest.mock("@/app/orders/actions", () => ({ getOrder: jest.fn() }))
jest.mock("@/app/orders/hooks/useOrdersRealtime", () => ({ useOrdersRealtime: jest.fn() }))

function wrapper({ children }: { children: React.ReactNode }) {
  return <SWRConfig value={{ provider: () => new Map(), shouldRetryOnError: false }}>{children}</SWRConfig>
}

function order(items: { id: string; name: string; status: string }[] = []): OrderWithRelations {
  return { id: "order-1", site_id: "site-1", notes: "Saved notes", sale_order_items: items } as OrderWithRelations
}

describe("live order detail data", () => {
  beforeEach(() => jest.clearAllMocks())

  it("reloads removed order lines on realtime changes without navigating away", async () => {
    jest.mocked(getOrder)
      .mockResolvedValueOnce({ data: order([{ id: "line-1", name: "Coffee", status: "new" }]) })
      .mockResolvedValueOnce({ data: order([]) })
    const { result } = renderHook(() => useOrderDetailData("order-1"), { wrapper })
    await waitFor(() => expect(result.current.order?.sale_order_items).toHaveLength(1))

    const subscription = jest.mocked(useOrdersRealtime).mock.calls.find(([siteId]) => siteId === "site-1")!
    expect(subscription[2]).toEqual({ orderId: "order-1", playAlarm: false })
    act(() => subscription[1]())
    await waitFor(() => expect(result.current.order?.sale_order_items).toEqual([]))
    expect(getOrder).toHaveBeenCalledTimes(2)
  })

  it("keeps local optimistic changes in the same cache and accepts subsequent server updates", async () => {
    jest.mocked(getOrder)
      .mockResolvedValueOnce({ data: order([{ id: "line-1", name: "Coffee", status: "new" }]) })
      .mockResolvedValueOnce({ data: order([{ id: "line-1", name: "Coffee", status: "cancelled" }]) })
    const { result } = renderHook(() => useOrderDetailData("order-1"), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    act(() => result.current.setOrder((previous) => previous ? { ...previous, notes: "Updated notes" } : null))
    await waitFor(() => expect(result.current.order?.notes).toBe("Updated notes"))
    expect(getOrder).toHaveBeenCalledTimes(1)

    const subscription = jest.mocked(useOrdersRealtime).mock.calls.find(([siteId]) => siteId === "site-1")!
    act(() => subscription[1]())
    await waitFor(() => expect(result.current.order?.sale_order_items?.[0].status).toBe("cancelled"))
  })

  it("does not display the previous order while the route changes", async () => {
    jest.mocked(getOrder)
      .mockResolvedValueOnce({ data: order() })
      .mockResolvedValueOnce({ data: { ...order(), id: "order-2" } })
    const { result, rerender } = renderHook(({ id }) => useOrderDetailData(id), {
      wrapper, initialProps: { id: "order-1" },
    })
    await waitFor(() => expect(result.current.order?.id).toBe("order-1"))
    rerender({ id: "order-2" })
    expect(result.current.order).toBeNull()
    await waitFor(() => expect(result.current.order?.id).toBe("order-2"))
  })
})