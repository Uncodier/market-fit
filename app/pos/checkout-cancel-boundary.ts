import "server-only";

import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/server";
import { requirePosSiteAccess } from "./actions/site-access";
import type { PosCheckoutRecovery } from "./checkout-recovery-types";

const schema = z.object({
  siteId: z.string().uuid(),
  clientMutationId: z.string().min(1).max(128),
  reason: z.string().min(1).max(500).refine(value => value.trim().length > 0),
}).strict();
const outcomeSchema = z.object({
  state: z.enum(["rejected", "not_found", "identity_conflict", "processing", "writes_started", "completed", "review_required"]),
  orderId: z.string().uuid().nullable().optional(),
  saleId: z.string().uuid().nullable().optional(),
});
type CancelResult =
  | { status: 200; body: { data: PosCheckoutRecovery; error?: never } }
  | { status: 400 | 401 | 403 | 409 | 500; body: { data?: never; error: string } };

/** The actor is session-derived; the RPC reauthorizes and serializes cancellation. */
export async function cancelPosCheckout(input: unknown): Promise<CancelResult> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { status: 400, body: { error: "Invalid checkout cancellation request." } };
  try {
    const access = await requirePosSiteAccess(parsed.data.siteId);
    if (access.error || !access.user || !["owner", "admin", "collaborator"].includes(access.role)) {
      return { status: access.error === "Not authenticated" ? 401 : 403,
        body: { error: "Forbidden checkout cancellation." } };
    }
    const client = await createServiceClient(true, { access: "workspace" });
    const { data, error } = await client.rpc("pos_checkout_cancel", {
      p_site_id: parsed.data.siteId, p_mutation_id: parsed.data.clientMutationId,
      p_actor_id: access.user.id, p_reason: parsed.data.reason,
    });
    if (error?.code === "42501") return { status: 403, body: { error: "Forbidden checkout cancellation." } };
    if (error) throw new Error("Cancellation unavailable");
    const outcome = outcomeSchema.parse(data);
    if (outcome.state === "identity_conflict") {
      return { status: 403, body: { error: "Forbidden checkout cancellation." } };
    }
    if (outcome.state !== "rejected") return { status: 409, body: {
      error: "This operation cannot be safely cancelled. Keep the original attempt and check payment status or ask a manager to review it.",
    } };
    return { status: 200, body: { data: {
      state: "rejected", orderId: outcome.orderId, saleId: outcome.saleId,
      message: "Operation cancelled before checkout writes. No order was deleted and no payment was refunded. Reload and review the order before starting a new attempt.",
    } } };
  } catch {
    // A lost RPC response is ambiguous: never claim cancellation failed to commit.
    return { status: 500, body: {
      error: "Unable to confirm checkout cancellation. Keep the original attempt and retry cancellation or check payment status.",
    } };
  }
}