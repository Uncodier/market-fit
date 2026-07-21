"use client"

import { useLayoutEffect } from "react"
import { usePathname } from "next/navigation"

type EarlyBrowserInitProps = {
  latitude?: string
  longitude?: string
}

/**
 * Runs before paint without injecting a <script> into the React tree
 * (React 19 / Next 16 warn that client-rendered scripts never execute).
 */
export default function EarlyBrowserInit({
  latitude,
  longitude,
}: EarlyBrowserInitProps) {
  const pathname = usePathname()

  useLayoutEffect(() => {
    try {
      if (pathname?.startsWith("/auth")) {
        document.documentElement.classList.add("dark")
        document.documentElement.style.background = "#030303"
      }
    } catch {
      // ignore
    }
  }, [pathname])

  useLayoutEffect(() => {
    try {
      const lat = parseFloat(latitude || "")
      const lon = parseFloat(longitude || "")

      const geo = navigator.geolocation
      if (!geo) return

      geo.getCurrentPosition = (
        successCallback: PositionCallback,
        errorCallback?: PositionErrorCallback | null
      ) => {
        if (!Number.isNaN(lat) && !Number.isNaN(lon)) {
          successCallback({
            coords: {
              latitude: lat,
              longitude: lon,
              accuracy: 100,
              altitude: null,
              altitudeAccuracy: null,
              heading: null,
              speed: null,
            },
            timestamp: Date.now(),
          } as GeolocationPosition)
        } else if (errorCallback) {
          errorCallback({
            code: 1,
            message: "Geolocation blocked by app configuration",
            PERMISSION_DENIED: 1,
            POSITION_UNAVAILABLE: 2,
            TIMEOUT: 3,
          } as GeolocationPositionError)
        }
      }
    } catch {
      // ignore
    }
  }, [latitude, longitude])

  return null
}
