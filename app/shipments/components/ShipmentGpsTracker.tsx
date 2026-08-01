"use client"

import { useEffect, useRef, useState } from "react"
import { recordShipmentLocation } from "@/app/shipments/actions"
import { useSite } from "@/app/context/SiteContext"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { Badge } from "@/app/components/ui/badge"
import { MapPin } from "@/app/components/ui/icons"

interface ShipmentGpsTrackerProps {
  shipmentId: string
  assignedTo: string | null | undefined
  status: string
}

export function ShipmentGpsTracker({ shipmentId, assignedTo, status }: ShipmentGpsTrackerProps) {
  const { currentSite } = useSite()
  const [active, setActive] = useState(false)
  const watchIdRef = useRef<number | null>(null)
  const lastRecordedRef = useRef<number>(0)
  const deniedToastShown = useRef(false)

  useEffect(() => {
    let isSubscribed = true

    const stopWatch = () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current)
        watchIdRef.current = null
      }
      setActive(false)
    }

    const checkAuthAndStart = async () => {
      const supabase = createClient()
      const { data } = await supabase.auth.getSession()
      const userId = data.session?.user?.id

      if (!userId || userId !== assignedTo || status !== "in_transit" || !currentSite) {
        stopWatch()
        return
      }

      if (!("geolocation" in navigator)) {
        return
      }

      setActive(true)

      if (watchIdRef.current === null) {
        watchIdRef.current = navigator.geolocation.watchPosition(
          (position) => {
            if (!isSubscribed) return

            const now = Date.now()
            if (now - lastRecordedRef.current < 30000) return
            lastRecordedRef.current = now

            recordShipmentLocation(currentSite.id, shipmentId, {
              lat: position.coords.latitude,
              lng: position.coords.longitude,
              accuracy: position.coords.accuracy,
            }).catch((err) => console.error("Failed to record location", err))
          },
          (err) => {
            if (err.code === 1 && !deniedToastShown.current) {
              deniedToastShown.current = true
              toast.error("Location permission denied. Cannot track shipment.")
            }
            stopWatch()
          },
          { enableHighAccuracy: true, maximumAge: 10000, timeout: 10000 }
        )
      }
    }

    checkAuthAndStart()

    return () => {
      isSubscribed = false
      stopWatch()
    }
  }, [shipmentId, assignedTo, status, currentSite])

  if (!active) return null

  return (
    <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 animate-pulse">
      <MapPin className="h-3 w-3 mr-1" />
      GPS Active
    </Badge>
  )
}
