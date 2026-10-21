import "server-only";

import { createClient } from "@/lib/supabase/server";
import { isPrivateResourceId, requirePrivateCommerceSiteAccess } from "@/app/commerce/private-site-access";
import type { PermissionCommand } from "@/lib/permissions/types";
import type { DynamicQuoteMetadata } from '@/app/types'

type QuoteParent = { id: string; site_id: string; lead_id?: string | null }
type QuoteAccessRow = QuoteParent & {
  metadata?: { dynamic_quote?: DynamicQuoteMetadata; [key: string]: unknown }
  quotation?: QuoteParent | QuoteParent[] | null
  quotation_id: string
  catalog_item_id: string
  quantity?: number
}

/** Read the parent through RLS, then verify the private mutation's site scope. */
export async function requireDynamicQuoteAccess(
  id: string,
  kind: "quotation" | "item",
  commands: PermissionCommand[] = ["update"],
) {
  if (!isPrivateResourceId(id)) return { error: "Invalid quotation" } as const;
  const supabase = await createClient(true);
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user || user.is_anonymous) return { error: "Not authenticated" } as const;
  const { data, error } = await supabase
    .from(kind === "item" ? "quotation_items" : "quotations")
    .select(kind === "item" ? "*, quotation:quotations(id, site_id, lead_id)" : "id, site_id, lead_id")
    .eq("id", id).single();
  if (error || !data) return { error: "Quotation not available" } as const;
  const row = data as QuoteAccessRow;
  const quotation = kind === "item"
    ? (Array.isArray(row.quotation) ? row.quotation[0] : row.quotation) : row;
  if (!quotation?.site_id) return { error: "Quotation not available" } as const;
  const access = await requirePrivateCommerceSiteAccess(quotation.site_id, commands);
  if (access.error) return { error: access.error } as const;
  return { supabase, item: row, quotation } as const;
}