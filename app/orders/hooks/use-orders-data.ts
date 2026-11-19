"use client"

import useSWR from "swr"
import { listOrders, updateOrderStatus } from "../actions"
import type { OrderParams } from "../types"

type OrdersData = Awaited<ReturnType<typeof listOrders>>

function withStatus(data: OrdersData | undefined, orderId: string, status: string) {
  if (!data) return data
  return { ...data, data: data.data.map(order => order.id === orderId ? { ...order, status } : order) }
}

export function useOrdersData(params: OrderParams | null) {
  const state = useSWR<OrdersData>(
    params ? { resource: "orders", ...params } : null,
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
    // Keep SWR's mutation open for the complete server write. Reads started before
    // or during it cannot replace optimistic feedback with a pre-write snapshot.
    return state.mutate(async (current) => {
      const result = await updateOrderStatus(params.siteId, orderId, status)
      if (result.error) throw new Error(result.error)
      if (!result.data) throw new Error("Order status could not be confirmed")
      if (!current) return current
      return { ...current, data: current.data.map(order => order.id === orderId ? { ...order, ...result.data } : order) }
    }, {
      optimisticData: (current) => withStatus(current, orderId, status),
      rollbackOnError: true,
      revalidate: true,
    })
  }

  return { ...state, changeStatus }
}