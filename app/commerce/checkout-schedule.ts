import {
  getNextOpenSlot,
  isBusinessOpen,
  type BusinessHours,
} from "./business-hours"

/** Online channels where store hours gate ASAP checkout. */
const STORE_HOURS_GATED_SOURCES = new Set(["shop", "marketplace"])

/**
 * Resolve `scheduled_for` at checkout.
 * POS (and other staff channels) can sell while the store is closed.
 * Shop/marketplace ASAP orders while closed are queued for the next open slot.
 */
export function resolveCheckoutScheduledFor(params: {
  source: string
  scheduledFor?: string | null
  businessHours?: BusinessHours[] | null
  now?: Date
}): string | undefined {
  const scheduledFor = params.scheduledFor || undefined
  if (!STORE_HOURS_GATED_SOURCES.has(params.source)) {
    return scheduledFor
  }

  const businessHours = params.businessHours || []
  if (businessHours.length === 0) return scheduledFor

  let resolved = scheduledFor
  if (!resolved && !isBusinessOpen(businessHours, params.now)) {
    const nextOpen = getNextOpenSlot(businessHours, params.now)
    if (nextOpen) resolved = nextOpen.at.toISOString()
  }

  if (
    resolved &&
    !isBusinessOpen(businessHours, new Date(resolved), { ignoreForceClosed: true })
  ) {
    throw new Error("The selected scheduled time is outside business hours.")
  }

  return resolved
}
