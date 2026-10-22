"use server"

import { createClient } from "@/lib/supabase/server"
import { issueBuyerIdentityToken } from "@/app/commerce/buyer-identity-token"

export async function getBuyerIdentityQr() {
  const supabase = await createClient(true)
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return { error: "Sign in to display your account QR." }
  try {
    return issueBuyerIdentityToken(user.id)
  } catch {
    return { error: "Account QR is temporarily unavailable." }
  }
}