"use server";

import { computeValidUntil } from "@/app/catalog/dynamic-pricing";
import { DynamicQuoteMetadata } from "@/app/types";
import { getTaxesByCatalogItemIds } from "@/app/catalog/tax-actions";
import { calculateOrderTaxTotal, roundMoney } from "@/app/commerce/taxes";
import { getApiServerUrl } from "./dynamic-quote-api";

export async function getSiteOwnerUserId(
  supabase: any,
  siteId: string
): Promise<string | null> {
  const { data: site } = await supabase
    .from("sites")
    .select("user_id")
    .eq("id", siteId)
    .single();
  return site?.user_id || null;
}

export async function createQuoteDeal(params: {
  supabase: any;
  siteId: string;
  itemName: string;
  currency: string;
  ownerUserId: string;
}) {
  const { data: deal, error } = await params.supabase
    .from("deals")
    .insert({
      name: `Quote: ${params.itemName}`,
      site_id: params.siteId,
      stage: "prospecting",
      status: "open",
      amount: 0,
      currency: params.currency,
    })
    .select()
    .single();

  if (error || !deal) return { error: error?.message || "Failed to create deal" };

  await params.supabase.from("deal_owners").insert({
    deal_id: deal.id,
    user_id: params.ownerUserId,
  });

  return { deal };
}

/** Pre-create an uninstantiated assistant instance so we can fire-and-forget the SSE call. */
export async function createAssistantRemoteInstance(params: {
  supabase: any;
  siteId: string;
  ownerUserId: string;
  name?: string;
}) {
  const { data, error } = await params.supabase
    .from("remote_instances")
    .insert({
      name: params.name || "Assistant Session",
      instance_type: "ubuntu",
      status: "uninstantiated",
      site_id: params.siteId,
      user_id: params.ownerUserId,
      created_by: params.ownerUserId,
      timeout_hours: 1,
    })
    .select("id")
    .single();

  if (error || !data?.id) {
    return { error: error?.message || "Failed to create assistant instance" };
  }
  return { instanceId: data.id as string };
}

export async function recalculateQuotationTotals(quotationId: string, supabase: any) {
  const { data: quotation } = await supabase
    .from("quotations")
    .select("site_id, discount_total")
    .eq("id", quotationId)
    .single();

  const { data: items } = await supabase
    .from("quotation_items")
    .select("catalog_item_id, subtotal")
    .eq("quotation_id", quotationId);

  const subtotal = (items || []).reduce(
    (acc: number, item: any) => acc + (Number(item.subtotal) || 0),
    0
  );

  let taxTotal = 0;
  if (quotation?.site_id) {
    const { data: taxesByItem } = await getTaxesByCatalogItemIds(
      quotation.site_id,
      (items || []).map((item: any) => item.catalog_item_id)
    );
    taxTotal = calculateOrderTaxTotal(
      (items || []).map((item: any) => ({
        catalogItemId: item.catalog_item_id,
        subtotal: Number(item.subtotal) || 0,
      })),
      taxesByItem || {}
    );
  }

  const discountTotal = Number(quotation?.discount_total) || 0;
  const total = roundMoney(Math.max(0, subtotal - discountTotal + taxTotal));

  await supabase
    .from("quotations")
    .update({ subtotal, tax_total: taxTotal, total })
    .eq("id", quotationId);
}

export async function applyPricedResult(params: {
  supabase: any;
  quotationId: string;
  quotationItemId: string;
  unitPrice: number;
  minPrice?: number | null;
  rationale?: string;
  metadata: DynamicQuoteMetadata;
  requiresAuthorization: boolean;
  quoteExpiration: DynamicQuoteMetadata["quote_expiration"];
}) {
  const {
    supabase,
    quotationId,
    quotationItemId,
    unitPrice,
    minPrice,
    rationale,
    metadata,
    requiresAuthorization,
    quoteExpiration,
  } = params;

  const { data: item } = await supabase
    .from("quotation_items")
    .select("quantity")
    .eq("id", quotationItemId)
    .single();

  const quantity = Number(item?.quantity) || 1;
  const floor =
    minPrice !== undefined && minPrice !== null && !Number.isNaN(Number(minPrice))
      ? Number(minPrice)
      : 0;
  const finalPrice = Math.max(unitPrice, floor);
  const pricedAt = new Date().toISOString();
  const validUntil = computeValidUntil(pricedAt, quoteExpiration || undefined);

  const nextMeta: DynamicQuoteMetadata = {
    ...metadata,
    status: requiresAuthorization ? "awaiting_authorization" : "priced",
    priced_at: pricedAt,
    rationale,
    min_price: floor || metadata.min_price,
  };

  const { error: itemUpdateError } = await supabase
    .from("quotation_items")
    .update({
      unit_price: finalPrice,
      subtotal: finalPrice * quantity,
      metadata: { dynamic_quote: nextMeta },
    })
    .eq("id", quotationItemId);

  if (itemUpdateError) {
    throw new Error(itemUpdateError.message || "Failed to update quotation item price");
  }

  const { error: quotationUpdateError } = await supabase
    .from("quotations")
    .update({ valid_until: validUntil, status: "draft" })
    .eq("id", quotationId);

  if (quotationUpdateError) {
    throw new Error(quotationUpdateError.message || "Failed to update quotation");
  }

  await recalculateQuotationTotals(quotationId, supabase);

  return { unitPrice: finalPrice, validUntil, metadata: nextMeta };
}

export async function markQuoteFailed(
  supabase: any,
  quotationItemId: string,
  metadata: DynamicQuoteMetadata,
  error: string
) {
  await supabase
    .from("quotation_items")
    .update({
      metadata: {
        dynamic_quote: {
          ...metadata,
          status: "failed",
          error,
        },
      },
    })
    .eq("id", quotationItemId);
}

/**
 * Server-to-server call to the robots API.
 * Uses SERVICE_API_KEY (x-api-key) — buyer sessions may be anonymous and must not
 * authenticate these routes. The API middleware requires an API key when Origin is absent.
 */
export async function postTunneledApi(
  endpoint: string,
  body: Record<string, unknown>
) {
  const serviceApiKey = process.env.SERVICE_API_KEY?.trim();
  if (!serviceApiKey) {
    return {
      success: false as const,
      error: "SERVICE_API_KEY is not configured",
      data: null,
    };
  }

  const apiBase = getApiServerUrl();
  const url = apiBase ? `${apiBase}${endpoint}` : endpoint;

  console.log("[postTunneledApi] request", {
    endpoint,
    url,
    bodyKeys: Object.keys(body),
    site_id: body.site_id,
    user_id: body.user_id,
  });

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "x-api-key": serviceApiKey,
      },
      body: JSON.stringify(body),
    });
  } catch (err: any) {
    console.error("[postTunneledApi] fetch failed", {
      endpoint,
      url,
      error: err?.message || String(err),
    });
    return {
      success: false as const,
      error: err?.message || "Failed to reach API server",
      data: null,
    };
  }

  const contentType = res.headers.get("content-type") || "";

  // Robots assistant returns an SSE workflow stream; the real answer lands in
  // instance_logs. Do not wait for the stream to end.
  if (contentType.includes("text/event-stream")) {
    const workflowRunId = res.headers.get("X-Workflow-Run-Id");
    try {
      await res.body?.cancel();
    } catch {
      // ignore cancel errors
    }
    console.log("[postTunneledApi] SSE started (not awaiting body)", {
      endpoint,
      status: res.status,
      workflowRunId,
    });
    return {
      success: true as const,
      data: {
        stream: true as const,
        workflow_run_id: workflowRunId,
      },
    };
  }

  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }

  const ok = res.ok && data?.success !== false;
  console.log("[postTunneledApi] response", {
    endpoint,
    status: res.status,
    ok,
    body: data,
    rawPreview: text?.slice(0, 2000),
  });

  if (!ok) {
    return {
      success: false as const,
      error:
        data?.error?.message ||
        data?.message ||
        `API error ${res.status}`,
      data,
    };
  }
  return { success: true as const, data: data?.data ?? data };
}

/**
 * Kick off a robots API call after the server action responds.
 * A bare `void fetch()` inside a Server Action is aborted when the action ends —
 * `after()` keeps the request alive so the assistant can write instance_logs.
 */
export async function startTunneledApi(
  endpoint: string,
  body: Record<string, unknown>
): Promise<{ started: true } | { started: false; error: string }> {
  const serviceApiKey = process.env.SERVICE_API_KEY?.trim();
  if (!serviceApiKey) {
    return { started: false, error: "SERVICE_API_KEY is not configured" };
  }

  const apiBase = getApiServerUrl();
  const url = apiBase ? `${apiBase}${endpoint}` : endpoint;

  console.log("[startTunneledApi] scheduling after()", {
    endpoint,
    url,
    bodyKeys: Object.keys(body),
    site_id: body.site_id,
    user_id: body.user_id,
    instance_id: body.instance_id,
  });

  after(async () => {
    console.log("[startTunneledApi] after() running fetch", {
      endpoint,
      instance_id: body.instance_id,
    });
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "x-api-key": serviceApiKey,
        },
        body: JSON.stringify(body),
      });
      const contentType = res.headers.get("content-type") || "";
      console.log("[startTunneledApi] headers received", {
        endpoint,
        status: res.status,
        contentType,
        workflowRunId: res.headers.get("X-Workflow-Run-Id"),
      });
      // Detach from SSE so we don't hold the connection for the whole workflow.
      if (contentType.includes("text/event-stream")) {
        try {
          await res.body?.cancel();
        } catch {
          // ignore
        }
        return;
      }
      const text = await res.text().catch(() => "");
      if (!res.ok) {
        console.error("[startTunneledApi] non-OK response", {
          endpoint,
          status: res.status,
          preview: text.slice(0, 500),
        });
      }
    } catch (err: any) {
      console.error("[startTunneledApi] fetch error", {
        endpoint,
        error: err?.message || String(err),
      });
    }
  });

  return { started: true };
}
