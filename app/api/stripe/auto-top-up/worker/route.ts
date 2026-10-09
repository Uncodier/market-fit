import "server-only"
import Stripe from "stripe"
import { z } from "zod"
import { timingSafeEqual } from "node:crypto"
import { createServiceClient } from "@/lib/supabase/server"
import { processAutoTopUpSite } from "./process"

export const maxDuration = 300
const candidateSchema = z.array(z.object({ site_id: z.string().uuid() })).max(20)

/** Each site serializes in PostgreSQL; stop admission well before the function deadline. */
export async function GET(request: Request) {
  const expected = process.env.CRON_SECRET ? Buffer.from(`Bearer ${process.env.CRON_SECRET}`) : null
  const received = Buffer.from(request.headers.get("authorization") ?? "")
  if (!expected || expected.length !== received.length || !timingSafeEqual(expected, received)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (!process.env.STRIPE_SECRET_KEY) return Response.json({ error: "Stripe unavailable" }, { status: 503 })
  const admissionDeadline = Date.now() + 180_000
  try {
    const service = await createServiceClient(true)
    const { data, error } = await service.rpc("list_credit_auto_top_up_candidates", { p_limit: 20 })
    if (error) throw new Error("Top-up candidates unavailable")
    const candidates = candidateSchema.parse(data)
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2025-05-28.basil", timeout: 10000, maxNetworkRetries: 0 })
    const results: Array<{siteId: string; outcome: string}> = []
    for (const siteId of new Set(candidates.map(row => row.site_id))) {
      if (Date.now() >= admissionDeadline) break
      try { results.push({ siteId, outcome: await processAutoTopUpSite(stripe, siteId) }) }
      catch { results.push({ siteId, outcome: "needs_reconciliation" }) }
    }
    return Response.json({ results, deferred: candidates.length - results.length }, { headers: { "Cache-Control": "no-store" } })
  } catch {
    return Response.json({ error: "Automatic top-up worker unavailable" }, { status: 503 })
  }
}
