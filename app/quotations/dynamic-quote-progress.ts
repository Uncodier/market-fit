"use server";

import { createClient as createClientAdmin } from "@supabase/supabase-js";
import { DynamicQuoteMetadata } from "@/app/types";
import { syncDynamicQuoteFromInstanceLogs } from "./dynamic-quote-sync";
import { isValidQuotationPublicToken } from "@/app/quotations/public-token";
import { isPublicAccessTokenActive } from "@/app/documents/public-token";

export type DynamicQuoteProgressLog = {
  id: string;
  logType: "thinking" | "tool_call" | "agent_action" | "status";
  text: string;
  createdAt: string;
};

function adminClient() {
  return createClientAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/**
 * Single poll for PDP: sync price from agent_action logs + return live progress feed.
 */
export async function pollDynamicQuoteProgress(
  quotationItemId: string,
  progressAccessToken: string
) {
  if (typeof quotationItemId !== "string" || !/^[a-zA-Z0-9_-]{1,128}$/.test(quotationItemId) ||
      !isValidQuotationPublicToken(progressAccessToken)) {
    return { error: "Quote progress is not available" };
  }

  const admin = adminClient();
  const { data: item, error } = await admin
    .from("quotation_items")
    .select(`
      id,
      metadata,
      quotation:quotations(
        site_id,
        public_access_token,
        public_access_token_expires_at,
        public_access_token_revoked_at
      )
    `)
    .eq("id", quotationItemId)
    .single();

  if (error || !item) {
    return { error: "Quote progress is not available" };
  }

  const quotation = (Array.isArray(item.quotation)
    ? item.quotation[0]
    : item.quotation) as {
    site_id?: string;
    public_access_token?: string | null;
    public_access_token_expires_at?: string | null;
    public_access_token_revoked_at?: string | null;
  } | null;
  if (
    quotation?.public_access_token !== progressAccessToken ||
    !isPublicAccessTokenActive(quotation)
  ) {
    return { error: "Quote progress is not available" };
  }

  const meta = item.metadata?.dynamic_quote as DynamicQuoteMetadata | undefined;
  if (!meta || !quotation.site_id) return { error: "Quote progress is not available" };

  const synced = await syncDynamicQuoteFromInstanceLogs(quotationItemId);
  if (synced.error && !synced.data) return { error: "Quote progress is not available" };

  // Never serialize raw logs, assistant identifiers, metadata, or provider errors.
  const allowedStatuses = ["processing", "priced", "awaiting_authorization", "failed"];
  const status = allowedStatuses.includes(synced.data?.status || "")
    ? synced.data!.status : "processing";
  const unitPrice = synced.data?.unitPrice;
  const validUntil = synced.data && "validUntil" in synced.data ? synced.data.validUntil : null;
  const logs: DynamicQuoteProgressLog[] = [{
    id: `quote-${status}`,
    logType: "status",
    text: status === "failed" ? "Quote calculation failed" :
      status === "processing" ? "Calculating your quote…" : "Quote calculated",
    createdAt: new Date().toISOString(),
  }];
  return {
    data: {
      status,
      unitPrice: typeof unitPrice === "number" && Number.isFinite(unitPrice) ? unitPrice : null,
      validUntil: typeof validUntil === "string" ? validUntil : null,
      logs,
    },
  };
}
