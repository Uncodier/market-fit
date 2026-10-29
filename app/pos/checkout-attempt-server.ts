import "server-only";
import { createHash, randomUUID } from "node:crypto";
import type { CheckoutCartParams } from "@/app/commerce/checkout-types";
import { PosCheckoutRecoveryError, type PosCheckoutRecovery } from "./checkout-recovery-types";
import { posOperationIdentitySchema } from "./operation-schemas";

type Client = { rpc: (name: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: unknown }> };
export type PosCheckoutClaim = { siteId: string; mutationId: string; ownerToken: string };

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value)
    .filter(([key, entry]) => entry !== undefined && key !== "localLeadId")
    .sort(([a], [b]) => a.localeCompare(b)).map(([key, entry]) => [key, canonical(entry)]));
  return value;
}

export function posCheckoutFingerprint(params: CheckoutCartParams): string {
  if (params.posOperationIdentity !== undefined) posOperationIdentitySchema.parse(params.posOperationIdentity);
  return createHash("sha256").update(JSON.stringify(canonical(params))).digest("hex");
}

export async function claimPosCheckout(client: Client, params: CheckoutCartParams, actorId: string): Promise<
  { claim: PosCheckoutClaim; recovery?: never } | { claim?: never; recovery: PosCheckoutRecovery }
> {
  const ownerToken = randomUUID();
  const { data, error } = await client.rpc("pos_checkout_claim", {
    p_site_id: params.siteId, p_mutation_id: params.clientMutationId, p_actor_id: actorId,
    p_order_id: params.existingOrderId || null,
    p_fingerprint: posCheckoutFingerprint(params),
    p_owner_token: ownerToken,
  });
  if (error || !data || typeof data !== "object") {
    throw new Error("Unable to verify checkout admission. No new checkout was started. Check payment status before retrying.");
  }
  const outcome = data as { state: string; result?: PosCheckoutRecovery["result"]; orderId?: string; saleId?: string };
  if (outcome.state === "claimed") return { claim: { siteId: params.siteId, mutationId: params.clientMutationId!, ownerToken } };
  if (outcome.state === "completed" && outcome.result?.success === true) return { recovery: {
    state: "completed", message: "Checkout already completed. No additional payment was collected.",
    orderId: outcome.orderId, saleId: outcome.saleId, result: outcome.result,
  } };
  const state = outcome.state === "rejected" ? "rejected" :
    outcome.state === "processing" ? "processing" : "review_required";
  throw new PosCheckoutRecoveryError({ state, orderId: outcome.orderId, saleId: outcome.saleId,
    message: state === "rejected"
      ? "This attempt was rejected before checkout writes. Review the current order and confirm a new attempt."
      : "This order has an unresolved checkout. Check payment status; do not collect it again.",
  });
}

export async function transitionPosCheckout(client: Client, claim: PosCheckoutClaim, state: string,
  result?: PosCheckoutRecovery["result"]): Promise<void> {
  const { data, error } = await client.rpc("pos_checkout_transition", {
    p_site_id: claim.siteId, p_mutation_id: claim.mutationId, p_owner_token: claim.ownerToken,
    p_state: state, p_order_id: result?.orderId || null, p_sale_id: result?.saleId || null,
    p_result: result || null,
  });
  if (error || data !== true) throw new Error("Checkout outcome could not be saved. Check payment status before retrying.");
}