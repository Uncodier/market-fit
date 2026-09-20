import type { CheckoutSource } from "@/app/commerce/checkout-types"

type SupabaseClient = {
  from: (table: string) => any
}

type CheckoutResult = Record<string, unknown>

export type CheckoutMutationClaim =
  | { state: "claimed"; ownerToken: string }
  | { state: "processing" }
  | { state: "completed"; result: CheckoutResult }
  | { state: "error"; error: string }

export async function claimCheckoutMutation(
  supabase: SupabaseClient,
  params: {
    siteId: string
    clientMutationId: string
    source: CheckoutSource
  }
): Promise<CheckoutMutationClaim> {
  const ownerToken = crypto.randomUUID()
  const { error } = await supabase.from("pos_client_mutations").insert({
    site_id: params.siteId,
    client_mutation_id: params.clientMutationId,
    kind: "checkout",
    sale_id: null,
    order_id: null,
    lead_id: null,
    result: {
      state: "processing",
      ownerToken,
      source: params.source,
    },
  })

  if (!error) return { state: "claimed", ownerToken }
  if (error.code !== "23505") return { state: "error", error: error.message }

  const { data, error: lookupError } = await supabase
    .from("pos_client_mutations")
    .select("result")
    .eq("site_id", params.siteId)
    .eq("client_mutation_id", params.clientMutationId)
    .maybeSingle()

  if (lookupError || !data) {
    return {
      state: "error",
      error: lookupError?.message || "Failed to read checkout claim",
    }
  }

  const result = data.result as CheckoutResult
  return result.state === "completed"
    ? { state: "completed", result }
    : { state: "processing" }
}

export async function completeCheckoutMutation(
  supabase: SupabaseClient,
  params: {
    siteId: string
    clientMutationId: string
    ownerToken: string
    result: CheckoutResult
  }
): Promise<void> {
  const { error } = await supabase
    .from("pos_client_mutations")
    .update({
      sale_id:
        typeof params.result.saleId === "string" ? params.result.saleId : null,
      order_id:
        typeof params.result.orderId === "string" ? params.result.orderId : null,
      result: {
        ...params.result,
        state: "completed",
      },
    })
    .eq("site_id", params.siteId)
    .eq("client_mutation_id", params.clientMutationId)
    .contains("result", { ownerToken: params.ownerToken })

  if (error) throw new Error("Failed to complete checkout idempotency claim")
}

export async function releaseCheckoutMutation(
  supabase: SupabaseClient,
  params: {
    siteId: string
    clientMutationId: string
    ownerToken: string
  }
): Promise<void> {
  await supabase
    .from("pos_client_mutations")
    .delete()
    .eq("site_id", params.siteId)
    .eq("client_mutation_id", params.clientMutationId)
    .contains("result", { ownerToken: params.ownerToken })
}
