"use client"

import { useEffect, useRef } from "react"
import { toast } from "sonner"
import { useLocalization } from "@/app/context/LocalizationContext"
import { shouldCheckVersion } from "./version-check-policy"

const POLL_INTERVAL_MS = 5 * 60 * 1000
const TOAST_ID = "app-version-update"
const CLIENT_BUILD_ID = process.env.NEXT_PUBLIC_BUILD_ID
const STORAGE_KEY = "mf:version-check:last"

function resolveVersionUrl(): string {
  const isWww =
    typeof window !== "undefined" && window.location.hostname === "www.makinari.com"
  return isWww ? "https://app.makinari.com/api/version" : "/api/version"
}

async function fetchServerBuildId(): Promise<string | null> {
  try {
    const response = await fetch(resolveVersionUrl(), { cache: "no-cache" })
    if (response.status === 304) return CLIENT_BUILD_ID || null
    if (!response.ok) return null
    const data = (await response.json()) as { version?: unknown }
    return typeof data.version === "string" && data.version ? data.version : null
  } catch {
    return null
  }
}

export function useVersionCheck(): void {
  const hasNotifiedRef = useRef(false)
  const { t } = useLocalization()
  const tRef = useRef(t)
  tRef.current = t

  useEffect(() => {
    if (process.env.NODE_ENV === "development") return
    if (!CLIENT_BUILD_ID) return

    const notifyIfStale = async () => {
      if (hasNotifiedRef.current) return
      
      const now = Date.now()
      const lastCheckStr = localStorage.getItem(STORAGE_KEY)
      const lastCheck = lastCheckStr ? parseInt(lastCheckStr, 10) : null
      
      const visible = document.visibilityState === "visible"
      
      if (!shouldCheckVersion({ now, lastCheck, visible })) return
      
      localStorage.setItem(STORAGE_KEY, now.toString())

      const serverBuildId = await fetchServerBuildId()
      if (!serverBuildId || serverBuildId === CLIENT_BUILD_ID) return

      hasNotifiedRef.current = true
      toast.info(tRef.current("version.newAvailable"), {
        id: TOAST_ID,
        description: tRef.current("version.reloadDescription"),
        duration: Infinity,
        action: {
          label: tRef.current("version.reload"),
          onClick: () => window.location.reload(),
        },
      })
    }

    void notifyIfStale()

    const intervalId = window.setInterval(() => {
      void notifyIfStale()
    }, POLL_INTERVAL_MS)

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void notifyIfStale()
      }
    }

    document.addEventListener("visibilitychange", onVisibilityChange)

    return () => {
      window.clearInterval(intervalId)
      document.removeEventListener("visibilitychange", onVisibilityChange)
    }
  }, [])
}
