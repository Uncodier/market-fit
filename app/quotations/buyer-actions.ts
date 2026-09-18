"use server"

import { createClient } from "@/lib/supabase/server"
import { assertQuotationRejectable } from "@/app/quotations/quote-checkout"

export async function rejectQuotation(quotationId: string) {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) return { error: "Not authenticated" }

  const { data: quote, error: quoteError } = await supabase
    .from("quotations")
    .select("id, status, valid_until, buyer_user_id")
    .eq("id", quotationId)
    .single()

  if (quoteError || !quote) return { error: "Quotation not found" }

  const gate = assertQuotationRejectable(quote, { buyerUserId: user.id })
  if (!gate.ok) return { error: gate.error }

  const { data: updated, error } = await supabase
    .from("quotations")
    .update({ status: "rejected" })
    .eq("id", quotationId)
    .eq("buyer_user_id", user.id)
    .eq("status", quote.status)
    .is("checkout_claim_id", null)
    .select("id")
    .maybeSingle()

  if (error) return { error: error.message }
  if (!updated) return { error: "Quotation is no longer available" }
  return { success: true }
}
