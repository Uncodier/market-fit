"use client"

import { useRef, useState } from "react"
import { useOptionalPermissions } from "@/app/context/PermissionContext"
import {
  marketplaceActionAllowed, marketplaceMetadata, postMarketplaceAction, validateMarketplaceAction,
  type MarketplaceAction, type MarketplaceActionResult,
} from "@/lib/marketplace/presentation"

export function useMarketplaceAction({ resource, id, metadata, onRefresh }: {
  resource: "orders" | "shipments"; id: string; metadata: unknown; onRefresh: () => Promise<unknown> | void
}) {
  const permissions = useOptionalPermissions()
  const marketplace = marketplaceMetadata(metadata)
  const [action, setAction] = useState<MarketplaceAction | null>(null)
  const [cookingTime, setCookingTime] = useState("20")
  const [reason, setReason] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<MarketplaceActionResult | null>(null)
  const lock = useRef(false)
  const snapshot = JSON.stringify([marketplace?.state, marketplace?.sync_status, marketplace?.operation])
  // A refetch returning the same state must not unlock an ambiguous operation.
  const [unresolvedMetadata, setUnresolvedMetadata] = useState<string | null>(null)
  const blocked = unresolvedMetadata !== null && unresolvedMetadata === snapshot
  const allowed = (candidate: MarketplaceAction) => Boolean(
    marketplace && permissions?.capabilities && permissions.can("update") &&
    !busy && !blocked && marketplaceActionAllowed(marketplace, candidate, resource),
  )
  const choose = (candidate: MarketplaceAction) => {
    if (!allowed(candidate)) return
    setAction(candidate); setReason(""); setError(null); setResult(null)
  }
  const submit = async () => {
    if (!action || !allowed(action) || lock.current) return
    const invalid = validateMarketplaceAction(action, cookingTime, reason)
    if (invalid) { setError(invalid); return }
    lock.current = true
    setBusy(true); setError(null)
    try {
      const response = await postMarketplaceAction(resource, id, {
        action, ...(action === "accept" ? { cooking_time_minutes: Number(cookingTime) } : {}),
        ...(reason.trim() ? { reason: reason.trim() } : {}),
      })
      setResult(response)
      if (["unknown", "pending", "confirmed"].includes(response.status)) setUnresolvedMetadata(snapshot)
      if (response.status === "confirmed" || response.status === "pending") setAction(null)
      try { await onRefresh() } catch { /* Outcome remains visible when refetch fails. */ }
    } finally { setBusy(false); lock.current = false }
  }
  return {
    action, cookingTime, setCookingTime, reason, setReason, busy, error, result, allowed, choose, submit,
    close: () => { if (!busy) setAction(null) },
  }
}