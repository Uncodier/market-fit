"use client"

import { useCallback, type Dispatch, type SetStateAction } from "react"
import useSWR from "swr"
import { getOrder } from "../actions"
import type { OrderWithRelations } from "../types"
import { useOrdersRealtime } from "./useOrdersRealtime"

export function useOrderDetailData(orderId: string) {
  const { data, error, isLoading, mutate } = useSWR<OrderWithRelations | null>(
    ["order-detail", orderId],
    async () => {
      const result = await getOrder(orderId)
      if (result.error) throw new Error(result.error)
      return result.data || null
    },
    { dedupingInterval: 0 },
  )

  const setOrder: Dispatch<SetStateAction<OrderWithRelations | null>> = useCallback(
    (update) => {
      void mutate(
        (current) => typeof update === "function" ? update(current || null) : update,
        { revalidate: false },
      )
    },
    [mutate],
  )

  useOrdersRealtime(data?.site_id, () => {
    void mutate()
  }, { orderId, playAlarm: false })

  return { order: data || null, error, loading: isLoading, setOrder }
}