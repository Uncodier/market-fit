import { randomUUID } from "node:crypto"
import type { SupabaseClient } from "@supabase/supabase-js"
import type Stripe from "stripe"

type WebhookRpcClient = Pick<SupabaseClient, "rpc">

export type StripeWebhookDeliveryClaim =
  | {
      outcome: "claimed"
      claimToken: string
      attemptCount: number
      wasRetry: boolean
    }
  | {
      outcome: "processed" | "in_progress"
      claimToken?: undefined
      attemptCount: number
      wasRetry: boolean
    }

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

export async function claimStripeWebhookDelivery(
  supabase: WebhookRpcClient,
  event: Stripe.Event,
): Promise<StripeWebhookDeliveryClaim> {
  const claimToken = randomUUID()
  const { data, error } = await supabase.rpc("claim_stripe_webhook_event", {
    p_event_id: event.id,
    p_event_type: event.type,
    p_event_data: {
      livemode: event.livemode,
      created: event.created,
      api_version: event.api_version,
    },
    p_claim_token: claimToken,
  })

  if (error) {
    throw new Error(`Failed to claim Stripe webhook event: ${error.message}`)
  }

  const result = record(data)
  const outcome = result?.outcome
  const attemptCount = Number(result?.attempt_count)
  if (
    (outcome !== "claimed" &&
      outcome !== "processed" &&
      outcome !== "in_progress") ||
    !Number.isSafeInteger(attemptCount) ||
    attemptCount < 1
  ) {
    throw new Error("Stripe webhook claim returned an invalid response")
  }

  const wasRetry = result?.was_retry === true
  if (outcome === "claimed") {
    if (result?.claim_token !== claimToken) {
      throw new Error("Stripe webhook claim token did not match")
    }
    return { outcome, claimToken, attemptCount, wasRetry }
  }

  return { outcome, attemptCount, wasRetry }
}

export async function completeStripeWebhookDelivery(
  supabase: WebhookRpcClient,
  eventId: string,
  claimToken: string,
): Promise<void> {
  const { data, error } = await supabase.rpc("complete_stripe_webhook_event", {
    p_event_id: eventId,
    p_claim_token: claimToken,
  })

  if (error) {
    throw new Error(`Failed to complete Stripe webhook event: ${error.message}`)
  }
  if (data !== true) {
    throw new Error("Stripe webhook event was not owned by this delivery")
  }
}

export async function failStripeWebhookDelivery(
  supabase: WebhookRpcClient,
  eventId: string,
  claimToken: string,
  processingError: unknown,
): Promise<void> {
  const message =
    processingError instanceof Error
      ? processingError.message
      : String(processingError)
  const { data, error } = await supabase.rpc("fail_stripe_webhook_event", {
    p_event_id: eventId,
    p_claim_token: claimToken,
    p_error_message: message,
  })

  if (error) {
    throw new Error(`Failed to record Stripe webhook failure: ${error.message}`)
  }
  if (data !== true) {
    throw new Error("Stripe webhook failure was not owned by this delivery")
  }
}
