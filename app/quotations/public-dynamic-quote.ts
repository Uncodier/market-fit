"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { applyStorefrontAvailability } from "@/app/catalog/storefront-availability";
import { getDynamicPricingConfig } from "@/app/catalog/dynamic-pricing";
import { executeVerifiedDynamicQuote } from "./dynamic-quote-request";
import { dynamicQuoteFieldsSchema, validConfiguredQuoteFields } from "./dynamic-quote-input";

const inputSchema = z.object({
  siteId: z.string().uuid(),
  catalogItemId: z.string().uuid(),
  quantity: z.number().finite().positive().max(10000).optional(),
  fieldValues: dynamicQuoteFieldsSchema.optional(),
}).strict();

/** Public listing intake, not access to any existing private quote or buyer record. */
export async function requestPublicDynamicQuote(input: {
  siteId: string; catalogItemId: string; quantity?: number; fieldValues?: Record<string, unknown>;
}) {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Invalid quote request" };
  }
  const supabase = await createClient(true);
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user || user.is_anonymous || !user.email || !user.email_confirmed_at) {
    return { error: "Sign in with a verified email to request a quote" };
  }
  const { siteId, catalogItemId, quantity, fieldValues } = parsed.data;
  const admin = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { data: item, error: itemError } = await applyStorefrontAvailability(admin.from("catalog_items")
    .select("*, site:sites!inner(id, user_id)")
    .eq("id", catalogItemId).eq("site_id", siteId)
    .eq("status", "active").eq("is_dynamic_price", true).eq("is_purchasable", true)
    .is("site.archived_at", null)).single();
  if (itemError || !item) return { error: "Quote is not available for this product" };
  const site = Array.isArray(item.site) ? item.site[0] : item.site;
  const config = getDynamicPricingConfig(item);
  if (!site?.user_id || !config) return { error: "Quote is not available for this product" };
  if (!validConfiguredQuoteFields(config, fieldValues || {})) return { error: "Invalid quote fields" };
  // Durable advanced robots share private seller context; never grant buyer access to it.
  if (config.requires_advanced_compute) return { error: "Contact the seller to request this quote" };

  const { data: existing, error: leadError } = await admin.from("leads")
    .select("id").eq("site_id", siteId).eq("buyer_user_id", user.id).limit(1).maybeSingle();
  if (leadError) return { error: "Unable to request quote" };
  let leadId = existing?.id;
  if (!leadId) {
    // Never claim a seller's existing email-only lead. Identity comes exclusively from Auth.
    const { data: lead, error } = await admin.from("leads").insert([{
      site_id: siteId, user_id: site.user_id, buyer_user_id: user.id,
      email: user.email.toLowerCase(), name: user.email, status: "new", origin: "inbound",
    }]).select("id").single();
    if (error || !lead) return { error: "Unable to request quote" };
    leadId = lead.id;
  }
  const result = await executeVerifiedDynamicQuote(
    { siteId, catalogItemId, leadId, quantity, fieldValues }, admin, { buyer_user_id: user.id },
  );
  if (!result.data) return { error: "Unable to request quote" };
  return { data: {
    quotationId: result.data.quotationId,
    quotationItemId: result.data.quotationItemId,
    progressAccessToken: result.data.progressAccessToken,
    status: result.data.status,
    unitPrice: "unitPrice" in result.data ? result.data.unitPrice : undefined,
    validUntil: "validUntil" in result.data ? result.data.validUntil : undefined,
  } };
}