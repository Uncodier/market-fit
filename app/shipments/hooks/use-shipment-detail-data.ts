"use client"

import { useCallback, type Dispatch, type SetStateAction } from "react"
import useSWR from "swr"
import { getShipment } from "../actions"
import type { ShipmentWithRelations } from "../types"
import { useShipmentsRealtime } from "./useShipmentsRealtime"

export function useShipmentDetailData(id: string) {
  const { data, error, isLoading, mutate } = useSWR<ShipmentWithRelations | null>(
    ["shipment-detail", id], async () => {
      const result = await getShipment(id)
      if (result.error) throw new Error(result.error)
      return result.data || null
    },
  )
  const setShipment: Dispatch<SetStateAction<ShipmentWithRelations | null>> = useCallback((update) => {
    void mutate((current) => typeof update === "function" ? update(current || null) : update, { revalidate: false })
  }, [mutate])
  useShipmentsRealtime(data?.site_id, () => mutate(), id)
  return { shipment: data || null, error, loading: isLoading, setShipment, refresh: mutate }
}