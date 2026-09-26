"use client"

import { useEffect, useRef } from "react"
import { toast } from "sonner"
import { apiClient } from "@/app/services/api-client-service"

const DOMAIN_SYNC_DEADLINE_MS = 15 * 60 * 1000
const TERMINAL_DOMAIN_STATUSES = new Set(["verified", "failed"])

interface EmailDomain {
  id?: string
  status?: string
  dnsRecords?: unknown[]
}

export function isSupportedEmailDomainStatus(status: unknown): status is string {
  return status === "pending" || TERMINAL_DOMAIN_STATUSES.has(String(status))
}

interface EmailDomainSyncOptions {
  siteId: string
  channelId: string
  domainId?: string
  status: string
  enabled: boolean
  onDomainChange: (domain: EmailDomain) => void | Promise<void>
  intervalMs?: number
}

export function useZavuEmailDomainSync({
  siteId,
  channelId,
  domainId,
  status,
  enabled,
  onDomainChange,
  intervalMs,
}: EmailDomainSyncOptions) {
  const callbackRef = useRef(onDomainChange)
  callbackRef.current = onDomainChange

  useEffect(() => {
    if (!enabled || !siteId || !channelId || !domainId || status !== "pending") return

    let cancelled = false
    let inFlight = false
    let terminal = false
    let timeoutId: number | null = null
    const deadline = Date.now() + DOMAIN_SYNC_DEADLINE_MS

    const sync = async () => {
      if (cancelled || inFlight || document.visibilityState === "hidden" || !navigator.onLine) return
      inFlight = true
      try {
        const response = await apiClient.get(
          `/api/integrations/zavu/email-domains/${encodeURIComponent(domainId)}` +
          `?siteId=${encodeURIComponent(siteId)}&channelId=${encodeURIComponent(channelId)}`
        )
        if (cancelled || !response.success) return
        const domain = response.data?.domain || response.data
        if (
          !domain ||
          (domain.id && domain.id !== domainId) ||
          domain.status === status ||
          !isSupportedEmailDomainStatus(domain.status)
        ) return
        terminal = TERMINAL_DOMAIN_STATUSES.has(domain.status)
        await callbackRef.current(domain)
        if (cancelled) return
        if (domain.status === "verified") {
          toast.success("Email domain verified")
        } else if (domain.status === "failed") {
          toast.error("Email domain verification failed. Check your DNS records and try again.")
        }
      } finally {
        inFlight = false
      }
    }

    const schedule = () => {
      if (!cancelled && !terminal && Date.now() < deadline) {
        timeoutId = window.setTimeout(run, intervalMs ?? 30_000)
      }
    }
    const run = async () => {
      try {
        await sync()
      } finally {
        schedule()
      }
    }
    const resume = () => {
      if (
        !terminal &&
        document.visibilityState === "visible" &&
        navigator.onLine &&
        !inFlight &&
        Date.now() < deadline
      ) {
        if (timeoutId !== null) window.clearTimeout(timeoutId)
        void run()
      }
    }

    void run()
    document.addEventListener("visibilitychange", resume)
    window.addEventListener("focus", resume)
    window.addEventListener("online", resume)
    return () => {
      cancelled = true
      if (timeoutId !== null) window.clearTimeout(timeoutId)
      document.removeEventListener("visibilitychange", resume)
      window.removeEventListener("focus", resume)
      window.removeEventListener("online", resume)
    }
  }, [channelId, domainId, enabled, intervalMs, siteId, status])
}