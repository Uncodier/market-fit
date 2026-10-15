export type MarketplaceAction = "accept" | "reject" | "ready" | "cancel" | "request"
export type OperationStatus = "pending" | "confirmed" | "failed" | "unknown" | "unsupported"
export type MarketplaceRecord = Record<string, unknown>

export function asRecord(value: unknown): MarketplaceRecord | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as MarketplaceRecord : null
}

export function marketplaceMetadata(metadata: unknown): MarketplaceRecord | null {
  const root = asRecord(metadata)
  // A malformed marketplace envelope remains provider-owned and read-only.
  if (!root || !("marketplace" in root) || root.marketplace === null) return null
  return asRecord(root.marketplace) || {}
}

export function metadataText(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null
}

export function marketplaceProvider(marketplace: MarketplaceRecord): string {
  const provider = metadataText(marketplace.provider)
  if (provider === "uber_eats") return "Uber Eats"
  if (provider === "rappi") return "Rappi"
  return provider || "Marketplace"
}

export function marketplaceCustomer(metadata: unknown): { name?: string; email?: string; phone?: string } {
  const customer = asRecord(marketplaceMetadata(metadata)?.customer)
  return {
    name: metadataText(customer?.name) || undefined,
    email: metadataText(customer?.email) || undefined,
    phone: metadataText(customer?.phone) || undefined,
  }
}

export function operationStatus(value: unknown): OperationStatus {
  const status = metadataText(asRecord(value)?.status ?? value)
  return status === "pending" || status === "confirmed" || status === "failed" || status === "unsupported"
    ? status : "unknown"
}

export function marketplaceOperation(marketplace: MarketplaceRecord): OperationStatus | null {
  return marketplace.operation == null ? null : operationStatus(marketplace.operation)
}

export function providerAccepted(metadata: unknown): boolean {
  const marketplace = marketplaceMetadata(metadata)
  if (!marketplace) return true
  const state = metadataText(marketplace.state)
  return ["accepted", "ready", "completed"].includes(state || "") && marketplace.sync_status === "confirmed" &&
    marketplace.totals_provisional !== true && !["pending", "unknown"].includes(marketplaceOperation(marketplace) || "")
}

/** Cancellation may stop already printed work, but never authorize preparation. */
export function providerCancellationConfirmed(metadata: unknown): boolean {
  const marketplace = marketplaceMetadata(metadata)
  return marketplace?.state === "cancelled" && marketplace.sync_status === "confirmed" &&
    !["pending", "unknown"].includes(marketplaceOperation(marketplace) || "")
}

export function marketplaceActionAllowed(
  marketplace: MarketplaceRecord,
  action: MarketplaceAction,
  resource: "orders" | "shipments" = "orders",
): boolean {
  if (["pending", "unknown"].includes(marketplaceOperation(marketplace) || "")) return false
  if (marketplace.sync_status !== "confirmed" || marketplace.totals_provisional === true) return false
  if ((action === "accept" || action === "reject") && typeof marketplace.accept_by === "string") {
    const deadline = Date.parse(marketplace.accept_by)
    if (!Number.isFinite(deadline) || deadline <= Date.now()) return false
  }
  if (resource === "shipments" && marketplace.delivery_mode !== "merchant_managed") return false
  const capability = action === "request" ? "request_delivery" : action === "cancel" && resource === "shipments" ? "cancel_delivery" : action
  return asRecord(marketplace.capabilities)?.[capability] === true
}

export function safeTrackingUrl(value: unknown): string | null {
  const text = metadataText(value)
  if (!text) return null
  try {
    const url = new URL(text)
    return url.protocol === "https:" && !url.username && !url.password ? url.href : null
  } catch { return null }
}

export function validateMarketplaceAction(
  action: MarketplaceAction,
  cookingTime: string,
  reason: string,
): string | null {
  if (action === "accept") {
    const minutes = Number(cookingTime)
    if (!Number.isInteger(minutes) || minutes < 1 || minutes > 120) {
      return "Enter a cooking time between 1 and 120 minutes."
    }
  }
  if ((action === "reject" || action === "cancel") && !reason.trim()) return "Enter a reason."
  if (reason.trim().length > 500) return "Use a reason of 500 characters or fewer."
  return null
}

export type MarketplaceActionResult = { status: OperationStatus; message: string }

/** A transport failure is an unknown provider outcome, never a safe automatic retry. */
export async function postMarketplaceAction(
  resource: "orders" | "shipments",
  id: string,
  input: { action: MarketplaceAction; cooking_time_minutes?: number; reason?: string },
): Promise<MarketplaceActionResult> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 25_000)
  try {
    const response = await fetch(`/api/marketplace/${resource}/${encodeURIComponent(id)}/actions`, {
      method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input), signal: controller.signal,
    })
    const payload = asRecord(await response.json())
    const status = payload?.operation != null ? operationStatus(payload.operation)
      : payload?.status != null ? operationStatus(payload.status)
      : !response.ok && response.status < 500 ? "failed" : "unknown"
    return {
      status,
      message: status === "unknown"
        ? "The provider outcome is unknown. Do not repeat this action; refresh to check for confirmation."
        : metadataText(payload?.error) || metadataText(payload?.message) || {
          pending: "Waiting for provider confirmation. No preparation or printing has started.",
          confirmed: "The provider confirmed the action.",
          failed: "The action was not completed.",
          unsupported: "This action is not supported by the provider.",
        }[status],
    }
  } catch {
    return { status: "unknown", message: "The provider outcome is unknown. Do not repeat this action; refresh to check for confirmation." }
  } finally { clearTimeout(timer) }
}