"use server"

import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { getQuotation } from "./actions"

const uuid = z.string().uuid()
const listInput = z.object({
  siteId: uuid,
  status: z.enum(["all", "draft", "sent", "accepted", "rejected", "expired"]).default("all"),
  q: z.string().max(200).default(""),
  page: z.number().int().min(1).max(100000).default(1),
  pageSize: z.number().int().min(1).max(100).default(50),
  sort: z.enum(["newest", "oldest", "updated_at"]).default("newest"),
})

export async function listWorkspaceQuotations(input: {
  siteId: string; status?: string; q?: string; page?: number; pageSize?: number; sort?: string
}) {
  const parsed = listInput.safeParse(input)
  if (!parsed.success) return { error: "Invalid quotation filters" }
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return { error: "Unauthorized" }
  const { siteId, status, q, page, pageSize, sort } = parsed.data
  // The invoker RPC preserves sales RLS and authorizes company proposal access.
  const { data, error } = await supabase.rpc("list_workspace_quotations", {
    p_site: siteId, p_status: status, p_search: q, p_page: page, p_page_size: pageSize, p_sort: sort,
  })
  if (error) return { error: error.code === "42501" ? "Forbidden" : "Unable to load quotations" }
  if (!data || !Array.isArray(data.data)) return { error: "Unable to load quotations" }
  return data
}

export async function getWorkspaceQuotation(siteId: string, id: string) {
  if (!uuid.safeParse(siteId).success || !uuid.safeParse(id).success) return { error: "Invalid quotation" }
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return { error: "Unauthorized" }
  const { data, error } = await supabase.rpc("get_business_procurement_quotation", { p_site: siteId, p_id: id })
  if (error) return { error: error.code === "42501" ? "Forbidden" : "Unable to load quotation" }
  if (data) return { data, error: undefined }
  const sales = await getQuotation(id)
  if (sales.error || !sales.data || sales.data.site_id !== siteId || sales.data.purpose === "procurement") {
    return { error: "Quotation not found" }
  }
  return sales
}