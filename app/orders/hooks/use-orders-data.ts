"use client"

import { useRef } from "react"
import useSWR, { useSWRConfig } from "swr"
import { listOrders, updateOrderStatus } from "../actions"
import type { OrderParams } from "../types"

type OrdersData = Awaited<ReturnType<typeof listOrders>>

function withStatus(data: OrdersData, orderId: string, status: string) {
  return { ...data, data: data.data.map(order => order.id === orderId ? { ...order, status } : order) }
}

export function useOrdersData(params: OrderParams | null) {
  const { mutate } = useSWRConfig()
  const writeQueue = useRef<Promise<unknown> | null>(null)
  const key = params ? { resource: "orders", ...params } : null
  const state = useSWR<OrdersData>(
    key,
    async ({ resource, ...request }: OrderParams & { resource: string }) => {
      void resource
      const result = await listOrders(request, { fresh: true })
      if (result.error) throw new Error(result.error)
      return result
    },
    { shouldRetryOnError: (error: Error) => !["Forbidden", "Not authenticated"].includes(error.message) },
  )

  const changeStatus = async (orderId: string, status: string) => {
    if (!params) throw new Error("No active order scope")
    const baseline = state.data
    if (!baseline) throw new Error("Orders are not loaded")
    // Keep SWR's mutation open for the complete server write. Reads started before
    // or during it cannot replace optimistic feedback with a pre-write snapshot.
    const write = () => mutate<OrdersData>(key, async (current) => {
      const result = await updateOrderStatus(params.siteId, orderId, status)
      if (result.error) throw new Error(result.error)
      if (!result.data) throw new Error("Order status could not be confirmed")
      if (!current) return current
      return { ...current, data: current.data.map(order => order.id === orderId ? { ...order, ...result.data } : order) }
    }, {
      optimisticData: (current) => withStatus(current || baseline, orderId, status),
      rollbackOnError: true,
      revalidate: true,
    })
    // SWR mutations of the same list key supersede each other. Serialize status
    // writes, and retain the clicked scope's key even if navigation changes it.
    const operation = writeQueue.current
      ? writeQueue.current.catch(() => undefined).then(write)
      : write()
    writeQueue.current = operation
    const release = () => {
      if (writeQueue.current === operation) writeQueue.current = null
    }
    void operation.then(release, release)
    return operation
  }

  return { ...state, changeStatus }
}