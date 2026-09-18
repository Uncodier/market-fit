import {
  claimStripeWebhookDelivery,
  completeStripeWebhookDelivery,
  failStripeWebhookDelivery,
} from "@/app/api/stripe/webhook/webhook-delivery"

const event = {
  id: "evt_live",
  type: "checkout.session.completed",
  livemode: true,
  created: 1_789_000_000,
  api_version: "2025-05-28.basil",
} as any

describe("Stripe webhook delivery claims", () => {
  it("atomically claims an event before processing", async () => {
    const rpc = jest.fn(async (_name: string, args: Record<string, unknown>) => ({
      data: {
        outcome: "claimed",
        claim_token: args.p_claim_token,
        attempt_count: 1,
        was_retry: false,
      },
      error: null,
    }))

    const claim = await claimStripeWebhookDelivery({ rpc } as any, event)

    expect(claim).toEqual(expect.objectContaining({
      outcome: "claimed",
      attemptCount: 1,
      wasRetry: false,
      claimToken: expect.any(String),
    }))
    expect(rpc).toHaveBeenCalledWith("claim_stripe_webhook_event", {
      p_event_id: event.id,
      p_event_type: event.type,
      p_event_data: {
        livemode: true,
        created: event.created,
        api_version: event.api_version,
      },
      p_claim_token: expect.any(String),
    })
  })

  it("does not claim processed or concurrently processing events", async () => {
    const processedRpc = jest.fn().mockResolvedValue({
      data: {
        outcome: "processed",
        attempt_count: 2,
        was_retry: true,
      },
      error: null,
    })
    await expect(claimStripeWebhookDelivery(
      { rpc: processedRpc } as any,
      event,
    )).resolves.toEqual({
      outcome: "processed",
      attemptCount: 2,
      wasRetry: true,
    })

    const busyRpc = jest.fn().mockResolvedValue({
      data: {
        outcome: "in_progress",
        attempt_count: 1,
        was_retry: true,
      },
      error: null,
    })
    await expect(claimStripeWebhookDelivery(
      { rpc: busyRpc } as any,
      event,
    )).resolves.toEqual({
      outcome: "in_progress",
      attemptCount: 1,
      wasRetry: true,
    })
  })

  it("fails closed when the claim cannot be verified", async () => {
    const databaseError = jest.fn().mockResolvedValue({
      data: null,
      error: { message: "database unavailable" },
    })
    await expect(claimStripeWebhookDelivery(
      { rpc: databaseError } as any,
      event,
    )).rejects.toThrow("database unavailable")

    const malformed = jest.fn().mockResolvedValue({
      data: { outcome: "claimed", attempt_count: 1 },
      error: null,
    })
    await expect(claimStripeWebhookDelivery(
      { rpc: malformed } as any,
      event,
    )).rejects.toThrow("claim token did not match")
  })

  it("requires ownership when completing or failing a delivery", async () => {
    const rpc = jest.fn()
      .mockResolvedValueOnce({ data: true, error: null })
      .mockResolvedValueOnce({ data: true, error: null })
      .mockResolvedValueOnce({ data: false, error: null })
    const supabase = { rpc } as any

    await expect(completeStripeWebhookDelivery(
      supabase,
      event.id,
      "claim-1",
    )).resolves.toBeUndefined()
    await expect(failStripeWebhookDelivery(
      supabase,
      event.id,
      "claim-2",
      new Error("processing failed"),
    )).resolves.toBeUndefined()
    await expect(completeStripeWebhookDelivery(
      supabase,
      event.id,
      "stale-claim",
    )).rejects.toThrow("not owned")

    expect(rpc).toHaveBeenNthCalledWith(2, "fail_stripe_webhook_event", {
      p_event_id: event.id,
      p_claim_token: "claim-2",
      p_error_message: "processing failed",
    })
  })
})
