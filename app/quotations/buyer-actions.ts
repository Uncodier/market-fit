"use server"

import { createClient } from "@/lib/supabase/server"
import { assertQuotationRejectable } from "@/app/quotations/quote-checkout"

export async function rejectQuotation(quotationId: string) {
  const supabase = await createClient()

  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session?.user) return { error: "Not authenticated" }

  const { data: quote, error: quoteError } = await supabase
    .from("quotations")
    .select("id, status, valid_until, buyer_user_id")
    .eq("id", quotationId)
    .single()

  if (quoteError || !quote) return { error: "Quotation not found" }

  const gate = assertQuotationRejectable(quote, { buyerUserId: session.user.id })
  if (!gate.ok) return { error: gate.error }

  const { error } = await supabase
    .from("quotations")
    .update({ status: "rejected" })
    .eq("id", quotationId)

  if (error) return { error: error.message }
  return { success: true }
}
