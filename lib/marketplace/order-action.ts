import { MarketplaceProviderError, type ProviderActionResult } from "./providers/types"
import { actionAllowed } from "./policy"
import { MarketplaceRequestError, type MarketplaceActionInput } from "./request"

export type MarketplaceOperationStatus = "confirmed" | "failed" | "unknown"
export interface MarketplaceActionClaim {
  action_id: string
  acquired: boolean
  status?: "pending" | MarketplaceOperationStatus
}
export interface OrderActionDependencies {
  claim(input: MarketplaceActionInput): Promise<MarketplaceActionClaim>
  perform(input: MarketplaceActionInput): Promise<ProviderActionResult>
  finish(actionId: string, status: MarketplaceOperationStatus, input: MarketplaceActionInput): Promise<MarketplaceOperationStatus | void>
}

export interface OrderActionOutcome {
  success: boolean
  operation: { status: "pending" | MarketplaceOperationStatus; action: MarketplaceActionInput["action"] }
  error?: string
}

/** A network timeout or an uncommitted confirmation never authorizes a second dispatch. */
export async function executeMarketplaceOrderAction(
  metadata: Record<string, unknown>,
  input: MarketplaceActionInput,
  dependencies: OrderActionDependencies,
): Promise<OrderActionOutcome> {
  if (!actionAllowed(metadata, input.action)) {
    throw new MarketplaceRequestError("This action is not available for the current provider state", 409)
  }
  const claim = await dependencies.claim(input)
  if (!claim.acquired) {
    const status = claim.status || "unknown"
    return {
      success: status === "confirmed",
      operation: { status, action: input.action },
      ...(status !== "confirmed" ? { error: "An existing provider operation must be reconciled before retrying" } : {}),
    }
  }
  let status: MarketplaceOperationStatus = "unknown"
  try {
    const result = await dependencies.perform(input)
    if (result.acknowledged !== true || result.action !== input.action) {
      throw new MarketplaceProviderError("invalid_response", "Unexpected action response")
    }
    status = "confirmed"
  } catch (error) {
    // Explicit 4xx and unsupported actions are definitive rejection, unlike 5xx/timeouts.
    if (error instanceof MarketplaceProviderError && (
      error.code === "unsupported_operation" || error.code === "invalid_config" ||
      (error.code === "http_error" && error.http_status != null && error.http_status >= 400 && error.http_status < 500 && error.http_status !== 408)
    )) {
      status = "failed"
    }
  }
  try {
    const persisted = await dependencies.finish(claim.action_id, status, input)
    if (persisted) status = persisted
  } catch {
    // A provider success with a failed local commit stays locked by its durable claim.
    return {
      success: false, operation: { status: "unknown", action: input.action },
      error: "Provider result could not be committed. Do not repeat the action until reconciled.",
    }
  }
  return {
    success: status === "confirmed", operation: { status, action: input.action },
    ...(status === "failed" ? { error: "The provider rejected this operation" } : {}),
    ...(status === "unknown" ? { error: "Provider result is uncertain. Do not repeat the action until reconciled." } : {}),
  }
}