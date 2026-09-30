/** @jest-environment node */

import { createClient } from "@supabase/supabase-js"
import type Stripe from "stripe"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import {
  claimStripeWebhookDelivery,
  completeStripeWebhookDelivery,
  failStripeWebhookDelivery,
} from "@/app/api/stripe/webhook/webhook-delivery"

// The legacy live suite called retired RPCs and deleted broadly by prefix.
// Exercise the current delivery boundary through an isolated PostgREST transport.
function transport() {
  type Row = { status: "processing" | "processed" | "failed"; token: string; attempts: number }
  const rows = new Map<string, Row>()
  const fetchMock = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const operation = new URL(String(input)).pathname.split("/").pop()
    const body = JSON.parse(String(init?.body)) as Record<string, string>
    const id = body.p_event_id
    const row = rows.get(id)
    let data: unknown
    if (operation === "claim_stripe_webhook_event") {
      if (row?.status === "processed" || row?.status === "processing") {
        data = { outcome: row.status === "processed" ? "processed" : "in_progress", attempt_count: row.attempts, was_retry: true }
      } else {
        const next: Row = { status: "processing", token: body.p_claim_token, attempts: (row?.attempts || 0) + 1 }
        rows.set(id, next)
        data = { outcome: "claimed", claim_token: next.token, attempt_count: next.attempts, was_retry: Boolean(row) }
      }
    } else {
      const owned = row?.status === "processing" && row.token === body.p_claim_token
      if (owned && row) row.status = operation === "complete_stripe_webhook_event" ? "processed" : "failed"
      data = owned
    }
    return new Response(JSON.stringify(data), { status: 200, headers: { "Content-Type": "application/json" } })
  })
  const client = createClient("https://example.test", "test-public-key", {
    global: { fetch: fetchMock }, auth: { persistSession: false, autoRefreshToken: false },
  })
  return { client, rows, fetchMock }
}

const event: Stripe.Event = {
  id: "evt_contract", object: "event", type: "checkout.session.completed",
  api_version: "2025-05-28.basil", livemode: false, created: 1_789_000_000,
  pending_webhooks: 1, request: null,
  data: { object: { id: "cs_contract", object: "checkout.session" } as Stripe.Checkout.Session },
}

describe("Stripe webhook idempotency contract", () => {
  it("claims once, completes with ownership, and rejects replay processing", async () => {
    const { client, rows } = transport()
    const claim = await claimStripeWebhookDelivery(client, event)
    expect(claim.outcome).toBe("claimed")
    if (claim.outcome !== "claimed") throw new Error("Expected the first claim")
    await completeStripeWebhookDelivery(client, event.id, claim.claimToken)
    expect(rows.get(event.id)?.status).toBe("processed")
    await expect(claimStripeWebhookDelivery(client, event)).resolves.toMatchObject({ outcome: "processed", attemptCount: 1 })
  })

  it("allows only one concurrent delivery to own an event", async () => {
    const { client } = transport()
    const claims = await Promise.all([claimStripeWebhookDelivery(client, event), claimStripeWebhookDelivery(client, event)])
    expect(claims.filter(claim => claim.outcome === "claimed")).toHaveLength(1)
    expect(claims.filter(claim => claim.outcome === "in_progress")).toHaveLength(1)
  })

  it("retries failed events with a new owner and increased attempt count", async () => {
    const { client } = transport()
    const first = await claimStripeWebhookDelivery(client, event)
    if (first.outcome !== "claimed") throw new Error("Expected the first claim")
    await failStripeWebhookDelivery(client, event.id, first.claimToken, new Error("Temporary failure"))
    const retry = await claimStripeWebhookDelivery(client, event)
    expect(retry).toMatchObject({ outcome: "claimed", attemptCount: 2, wasRetry: true })
    if (retry.outcome !== "claimed") throw new Error("Expected a retry claim")
    expect(retry.claimToken).not.toBe(first.claimToken)
    await expect(completeStripeWebhookDelivery(client, event.id, first.claimToken)).rejects.toThrow("not owned")
    await completeStripeWebhookDelivery(client, event.id, retry.claimToken)
  })

  it("does not mark another delivery as failed", async () => {
    const { client, rows } = transport()
    await claimStripeWebhookDelivery(client, event)
    await expect(failStripeWebhookDelivery(client, event.id, "stale-token", "Failed"))
      .rejects.toThrow("not owned")
    expect(rows.get(event.id)?.status).toBe("processing")
  })

  it("keeps database replay uniqueness, bounded leases, and processed-only retention", () => {
    const migration = readFileSync(join(process.cwd(), "supabase/migrations/20260917210100_stripe_webhook_delivery_claims.sql"), "utf8")
    expect(migration).toContain("CREATE UNIQUE INDEX IF NOT EXISTS webhook_events_stripe_event_id_key")
    expect(migration).toContain("FOR UPDATE")
    expect(migration).toContain("interval '10 minutes'")
    expect(migration).toContain("AND status = 'processed'")
    expect(migration).toContain("AND claim_token = p_claim_token")
  })
})
