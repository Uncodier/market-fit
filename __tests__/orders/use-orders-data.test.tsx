import type { ReactNode } from "react"
import { act, renderHook, waitFor } from "@testing-library/react"
import { SWRConfig } from "swr"
import { listOrders, updateOrderStatus } from "@/app/orders/actions"
import { useOrdersData } from "@/app/orders/hooks/use-orders-data"
import type { OrderWithRelations, OrdersResult } from "@/app/orders/types"

jest.mock("@/app/orders/actions", () => ({ listOrders: jest.fn(), updateOrderStatus: jest.fn() }))

const params = { siteId: "site", status: "all", page: 1 }
const order: OrderWithRelations = {
  id: "order", site_id: "site", sale_id: "sale", order_number: "ORD-1", status: "pending",
  notes: "Saved", items: [], subtotal: 20, tax_total: 0, discount_total: 0, total: 20,
  currency: "USD", created_at: "2026-11-18T12:00:00Z", updated_at: "2026-11-18T12:00:00Z",
  sale_order_items: [],
}
const orders = (status = "pending"): OrdersResult => ({ data: [{ ...order, status }], count: 1 })

function wrapper({ children }: { children: ReactNode }) {
  return <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0,
    shouldRetryOnError: false, revalidateOnFocus: false }}>{children}</SWRConfig>
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => { resolve = done })
  return { promise, resolve }
}

beforeEach(() => {
  jest.resetAllMocks()
  jest.mocked(listOrders).mockResolvedValue(orders())
})

it("requires fresh data for initial loads and explicit/realtime reloads", async () => {
  const { result } = renderHook(() => useOrdersData(params), { wrapper })
  await waitFor(() => expect(result.current.data?.data[0].status).toBe("pending"))
  jest.mocked(listOrders).mockResolvedValue(orders("in_progress"))
  await act(async () => { await result.current.mutate() })
  expect(result.current.data?.data[0].status).toBe("in_progress")
  expect(listOrders).toHaveBeenCalledTimes(2)
  for (const args of jest.mocked(listOrders).mock.calls) expect(args).toEqual([params, { fresh: true }])
})

it("does not admit a status mutation before orders have loaded", async () => {
  const read = deferred<Awaited<ReturnType<typeof listOrders>>>()
  jest.mocked(listOrders).mockReturnValue(read.promise)
  const { result } = renderHook(() => useOrdersData(params), { wrapper })
  await expect(result.current.changeStatus("order", "completed")).rejects.toThrow("Orders are not loaded")
  expect(updateOrderStatus).not.toHaveBeenCalled()
  await act(async () => { read.resolve(orders()) })
})

it("does not let a realtime read revert an optimistic status while the server write is pending", async () => {
  const write = deferred<Awaited<ReturnType<typeof updateOrderStatus>>>()
  jest.mocked(updateOrderStatus).mockReturnValue(write.promise)
  const { result } = renderHook(() => useOrdersData(params), { wrapper })
  await waitFor(() => expect(result.current.data?.data[0].status).toBe("pending"))
  let changing!: Promise<unknown>
  act(() => { changing = result.current.changeStatus("order", "in_progress") })
  expect(result.current.data?.data[0].status).toBe("in_progress")
  await act(async () => { await result.current.mutate() })
  expect(result.current.data?.data[0].status).toBe("in_progress")
  jest.mocked(listOrders).mockResolvedValue(orders("in_progress"))
  await act(async () => {
    write.resolve({ data: { ...order, status: "in_progress" } })
    await changing
  })
  await waitFor(() => expect(listOrders).toHaveBeenCalledTimes(3))
  expect(result.current.data?.data[0].status).toBe("in_progress")
  expect(updateOrderStatus).toHaveBeenCalledWith("site", "order", "in_progress")
})

it("serializes rapid changes to two orders so one completion cannot supersede the other", async () => {
  const write = deferred<Awaited<ReturnType<typeof updateOrderStatus>>>()
  const secondOrder = { ...order, id: "second" }
  jest.mocked(listOrders).mockResolvedValue({ data: [order, secondOrder], count: 2 })
  jest.mocked(updateOrderStatus).mockReturnValueOnce(write.promise)
    .mockResolvedValueOnce({ data: { ...secondOrder, status: "completed" } })
  const { result } = renderHook(() => useOrdersData(params), { wrapper })
  await waitFor(() => expect(result.current.data?.count).toBe(2))
  let first!: Promise<unknown>, second!: Promise<unknown>
  act(() => {
    first = result.current.changeStatus("order", "completed")
    second = result.current.changeStatus("second", "completed")
  })
  expect(updateOrderStatus).toHaveBeenCalledTimes(1)
  expect(result.current.data?.data[0].status).toBe("completed")
  jest.mocked(listOrders).mockResolvedValue({ data: [order, secondOrder].map(row => ({ ...row, status: "completed" })), count: 2 })
  await act(async () => {
    write.resolve({ data: { ...order, status: "completed" } })
    await Promise.all([first, second])
  })
  await waitFor(() => expect(result.current.data?.data.map(row => row.status)).toEqual(["completed", "completed"]))
  expect(updateOrderStatus).toHaveBeenNthCalledWith(2, "site", "second", "completed")
})

it("keeps queued changes bound to their original site and never writes the new site's cache", async () => {
  const write = deferred<Awaited<ReturnType<typeof updateOrderStatus>>>()
  const secondOrder = { ...order, id: "second" }
  jest.mocked(listOrders).mockImplementation(async request => request.siteId === "site"
    ? { data: [order, secondOrder], count: 2 } : { data: [], count: 0 })
  jest.mocked(updateOrderStatus).mockReturnValueOnce(write.promise)
    .mockResolvedValueOnce({ data: { ...secondOrder, status: "completed" } })
  const { result, rerender } = renderHook(({ siteId }) => useOrdersData({ siteId }), {
    wrapper, initialProps: { siteId: "site" },
  })
  await waitFor(() => expect(result.current.data?.count).toBe(2))
  let first!: Promise<unknown>, second!: Promise<unknown>
  act(() => {
    first = result.current.changeStatus("order", "completed")
    second = result.current.changeStatus("second", "completed")
  })
  rerender({ siteId: "other" })
  await waitFor(() => expect(result.current.data?.count).toBe(0))
  await act(async () => {
    write.resolve({ data: { ...order, status: "completed" } })
    await Promise.all([first, second])
  })
  expect(updateOrderStatus).toHaveBeenNthCalledWith(2, "site", "second", "completed")
  expect(result.current.data?.data).toEqual([])
})

it("discards a read started before the mutation even when it resolves after the write", async () => {
  const read = deferred<Awaited<ReturnType<typeof listOrders>>>()
  jest.mocked(updateOrderStatus).mockResolvedValue({ data: { ...order, status: "completed" } })
  const { result } = renderHook(() => useOrdersData(params), { wrapper })
  await waitFor(() => expect(result.current.data?.data[0].status).toBe("pending"))
  jest.mocked(listOrders).mockReturnValueOnce(read.promise).mockResolvedValue(orders("completed"))
  let refreshing!: Promise<unknown>
  act(() => { refreshing = result.current.mutate() })
  await waitFor(() => expect(listOrders).toHaveBeenCalledTimes(2))
  await act(async () => { await result.current.changeStatus("order", "completed") })
  await waitFor(() => expect(listOrders).toHaveBeenCalledTimes(3))
  await act(async () => { read.resolve(orders()); await refreshing })
  expect(result.current.data?.data[0].status).toBe("completed")
})

it("rolls back a rejected write and revalidates the authoritative status", async () => {
  jest.mocked(updateOrderStatus).mockResolvedValue({ error: "Forbidden" })
  const { result } = renderHook(() => useOrdersData(params), { wrapper })
  await waitFor(() => expect(result.current.data?.data[0].status).toBe("pending"))
  await act(async () => {
    await expect(result.current.changeStatus("order", "completed")).rejects.toThrow("Forbidden")
  })
  expect(result.current.data?.data[0].status).toBe("pending")
})

it("does not fetch without a ready scope or publish a previous site's late read", async () => {
  const read = deferred<Awaited<ReturnType<typeof listOrders>>>()
  const { result, rerender } = renderHook(({ siteId }) => useOrdersData(siteId ? { siteId } : null), {
    wrapper, initialProps: { siteId: "" },
  })
  expect(listOrders).not.toHaveBeenCalled()
  jest.mocked(listOrders).mockReturnValueOnce(read.promise).mockResolvedValue({ data: [], count: 0 })
  rerender({ siteId: "site" })
  await waitFor(() => expect(listOrders).toHaveBeenCalledTimes(1))
  rerender({ siteId: "other" })
  await waitFor(() => expect(result.current.data?.count).toBe(0))
  await act(async () => { read.resolve(orders()) })
  expect(result.current.data?.data).toEqual([])
})