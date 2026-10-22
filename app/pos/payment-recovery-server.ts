import "server-only";
import type { PosCheckoutRecovery } from "./checkout-recovery-types";

export type PaymentRecoveryRequest = {
  siteId: string; clientMutationId: string; existingOrderId?: string;
  registerSessionId?: string;
  payments: { paymentId: string; method: string; amount: number; tendered?: number; change?: number }[];
};
type Attempt = { actor_id: string; state: string; result: PosCheckoutRecovery["result"]; order_id: string; sale_id: string };
type Mutation = { kind: string; sale_id: string; order_id: string; result: PosCheckoutRecovery["result"] };
type Receipt = { id: string; site_id: string; sale_id: string; session_id: string; actor_id: string;
  method: string; amount: string | number; tendered: string | number; change: string | number };
type Query = PromiseLike<{ data: unknown; error: unknown }> & {
  select: (columns: string) => Query; eq: (column: string, value: unknown) => Query;
  in: (column: string, values: string[]) => Query;
  maybeSingle: () => PromiseLike<{ data: unknown; error: unknown }>;
};
type Client = { from: (table: string) => Query };

/** Read evidence only. A missing receipt is not proof that a legacy request never ran. */
export async function inspectPosPayment(client: Client, request: PaymentRecoveryRequest, actorId: string): Promise<PosCheckoutRecovery> {
  const attemptRead = await client.from("pos_checkout_attempts").select("actor_id,state,result,order_id,sale_id")
    .eq("site_id", request.siteId).eq("client_mutation_id", request.clientMutationId).maybeSingle();
  if (attemptRead.error) throw new Error("Unable to read checkout status. No operation was changed.");
  const attempt = attemptRead.data as Attempt | null;
  if (attempt && attempt.actor_id !== actorId) throw new Error("This checkout belongs to another cashier.");
  const linked = { orderId: attempt?.order_id, saleId: attempt?.sale_id };
  if (attempt?.state === "completed" && attempt.result?.success === true) return {
    state: "completed", message: "Checkout confirmed. No additional payment was collected.", ...linked, result: attempt.result,
  };
  // In-flight admission must not be retired, even when no receipt is visible yet.
  if (attempt?.state === "processing") return {
    state: "processing", message: "Checkout is unresolved or still processing. Keep its original payment IDs.", ...linked,
  };
  if (attempt?.state === "rejected") return {
    state: "rejected", message: "Rejected before checkout writes. Reload and review the order before confirming a new attempt.", ...linked,
  };
  const mutationRead = await client.from("pos_client_mutations").select("kind,sale_id,order_id,result")
    .eq("site_id", request.siteId).eq("client_mutation_id", request.clientMutationId).maybeSingle();
  if (mutationRead.error) throw new Error("Unable to read the original checkout result. No operation was changed.");
  const mutation = mutationRead.data as Mutation | null;
  const legacyResult = !attempt && mutation?.kind === "checkout" && mutation.result?.success === true && mutation.sale_id && mutation.order_id
    ? { state: "completed" as const, message: "Original checkout result recovered. No additional payment was collected.",
      orderId: mutation.order_id, saleId: mutation.sale_id,
      result: { ...mutation.result, success: true, saleId: mutation.sale_id, orderId: mutation.order_id },
    } : null;
  if (!request.payments.length && legacyResult) return legacyResult;
  if (request.payments.length) {
    const receiptRead = await client.from("pos_register_receipts")
      .select("id,site_id,sale_id,session_id,actor_id,method,amount,tendered,change")
      .eq("site_id", request.siteId).in("id", request.payments.map((p) => p.paymentId));
    if (receiptRead.error) throw new Error("Unable to verify register receipts. No operation was changed.");
    const receipts = (receiptRead.data || []) as Receipt[];
    const valid = receipts.length === request.payments.length && request.payments.every((p) => receipts.some((r) =>
      r.id === p.paymentId && r.actor_id === actorId && r.session_id === request.registerSessionId &&
      r.method === p.method && Number(r.amount) === p.amount &&
      Number(r.tendered) === (p.tendered ?? p.amount) && Number(r.change) === (p.change ?? 0)));
    if (valid && new Set(receipts.map((r) => r.sale_id)).size === 1) {
      const saleId = receipts[0].sale_id;
      const ordersRead = await client.from("sale_orders").select("id")
        .eq("site_id", request.siteId).eq("sale_id", saleId);
      if (ordersRead.error) throw new Error("Unable to verify the receipt's order. No operation was changed.");
      const orders = (ordersRead.data || []) as { id: string }[];
      if (orders.length === 1 && (!request.existingOrderId || orders[0].id === request.existingOrderId)) {
        if (legacyResult && legacyResult.saleId === saleId && legacyResult.orderId === orders[0].id) return legacyResult;
        return {
        state: "payment_recorded", orderId: orders[0].id, saleId,
        message: "Payment recorded. Do not collect it again. Checkout finalization still requires review; other orders can continue.",
        };
      }
    }
  }
  return { state: attempt?.state === "writes_started" ? "processing" : attempt ? "review_required" : "not_found", ...linked,
    message: "Payment outcome is not confirmed. Preserve this attempt and review it before collecting again.",
  };
}