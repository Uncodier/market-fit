"use server";

import { DynamicQuoteMetadata } from "@/app/types";
import { extractQuotePriceFromAssistantText } from "./dynamic-quote-prompt";
import { applyPricedResult, recalculateQuotationTotals } from "./dynamic-quote-apply";
import { requireDynamicQuoteAccess } from "./dynamic-quote-access";
import { requestAuthorizedDynamicQuote } from "./dynamic-quote-request";

export async function requestDynamicQuote(params: Parameters<typeof requestAuthorizedDynamicQuote>[0]) {
  return requestAuthorizedDynamicQuote(params);
}

export async function retryDynamicQuoteItem(quotationItemId: string) {
  const access = await requireDynamicQuoteAccess(quotationItemId, "item", ["delete", "insert", "update"]);
  if (access.error) return { error: access.error };
  const { supabase, item, quotation } = access;

  const meta = (item.metadata?.dynamic_quote || {}) as DynamicQuoteMetadata;
  if (!quotation?.site_id || !quotation?.lead_id) {
    return { error: "Quotation context missing" };
  }

  await supabase.from("quotation_items").delete().eq("id", quotationItemId);
  await recalculateQuotationTotals(quotation.id, supabase);

  return requestDynamicQuote({
    siteId: quotation.site_id,
    catalogItemId: item.catalog_item_id,
    leadId: quotation.lead_id,
    quantity: item.quantity,
    fieldValues: meta.field_values || {},
    quotationId: quotation.id,
  });
}

export async function authorizeDynamicQuote(quotationId: string) {
  const access = await requireDynamicQuoteAccess(quotationId, "quotation");
  if (access.error) return { error: access.error };
  const { supabase } = access;
  const { data: items, error } = await supabase
    .from("quotation_items")
    .select("id, metadata")
    .eq("quotation_id", quotationId);

  if (error) return { error: error.message };

  for (const item of items || []) {
    const dq = item.metadata?.dynamic_quote as DynamicQuoteMetadata | undefined;
    if (!dq) continue;
    if (dq.status === "awaiting_authorization" || dq.status === "priced") {
      await supabase
        .from("quotation_items")
        .update({
          metadata: {
            ...item.metadata,
            dynamic_quote: {
              ...dq,
              status: "priced",
              requires_authorization: false,
            },
          },
        })
        .eq("id", item.id);
    }
  }

  return { data: { quotationId, authorized: true } };
}

export async function applyDynamicQuoteFromText(params: {
  quotationItemId: string;
  assistantText: string;
}) {
  const access = await requireDynamicQuoteAccess(params?.quotationItemId, "item");
  if (access.error) return { error: access.error };
  const { supabase, item } = access;
  if (typeof params.assistantText !== "string" || params.assistantText.length > 100_000) {
    return { error: "Invalid quote text" };
  }

  const meta = (item.metadata?.dynamic_quote || {}) as DynamicQuoteMetadata;
  const extracted = extractQuotePriceFromAssistantText(params.assistantText);
  if (!extracted) {
    return {
      error:
        "Could not extract unit_price. Expected JSON: { unit_price, currency, rationale }",
    };
  }

  const priced = await applyPricedResult({
    supabase,
    quotationId: item.quotation_id,
    quotationItemId: item.id,
    unitPrice: extracted.unit_price,
    minPrice: meta.min_price,
    rationale: extracted.rationale,
    metadata: meta,
    requiresAuthorization: Boolean(meta.requires_authorization),
    quoteExpiration: meta.quote_expiration,
  });

  return { data: priced };
}
