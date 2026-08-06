"use server";

import { createClient as createClientAdmin } from "@supabase/supabase-js";
import { DynamicQuoteMetadata } from "@/app/types";
import { extractQuotePriceFromAssistantText } from "./dynamic-quote-prompt";
import { fetchTunneledInstanceLogs } from "./dynamic-quote-api";
import { applyPricedResult } from "./dynamic-quote-apply";

function adminClient() {
  return createClientAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Find the assistant instance created for this quote via the user_action log. */
export async function findAssistantInstanceForQuote(params: {
  siteId: string;
  quotationItemId: string;
  attempts?: number;
}): Promise<string | null> {
  const admin = adminClient();
  const attempts = params.attempts ?? 8;

  for (let i = 0; i < attempts; i++) {
    const { data, error } = await admin
      .from("instance_logs")
      .select("instance_id, created_at")
      .eq("site_id", params.siteId)
      .eq("log_type", "user_action")
      .ilike("message", `%${params.quotationItemId}%`)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("[dynamic-quote-sync] find instance error:", error.message);
    }
    if (data?.instance_id) {
      console.error("[dynamic-quote-sync] found instance", {
        quotationItemId: params.quotationItemId,
        instanceId: data.instance_id,
      });
      return data.instance_id;
    }
    await sleep(400);
  }

  return null;
}

function tryExtractFromRows(
  rows: { id: string; message?: string | null }[] | null | undefined
) {
  for (const row of rows || []) {
    if (typeof row.message !== "string" || !row.message.trim()) continue;
    const extracted = extractQuotePriceFromAssistantText(row.message);
    if (extracted) {
      return { id: row.id, message: row.message, extracted };
    }
  }
  return null;
}

/** Fetch all instance_logs (tunneled SERVICE_API_KEY) and extract unit_price JSON. */
export async function findPricedAgentLog(
  instanceId: string,
  _quotationItemId?: string
): Promise<{
  id: string;
  message: string;
  extracted: { unit_price: number; currency?: string; rationale?: string };
} | null> {
  // Must go through the API tunnel — shop buyers have no RLS access to instance_logs.
  const tunneled = await fetchTunneledInstanceLogs(instanceId, 100);
  if (tunneled.error) {
    console.error("[dynamic-quote-sync] tunneled logs error:", tunneled.error);
  }

  const fromTunneled = tryExtractFromRows(tunneled.logs);
  if (fromTunneled) return fromTunneled;

  console.error("[dynamic-quote-sync] no extractable price in tunneled logs", {
    instanceId,
    logCount: tunneled.logs.length,
    sampleTypes: tunneled.logs.slice(0, 8).map((r) => r.log_type),
    samplePreviews: tunneled.logs
      .slice(0, 5)
      .map((r) => String(r.message || "").slice(0, 160)),
  });

  return null;
}

/**
 * Poll instance_logs for the assistant JSON quote and apply it to the quotation item.
 * Uses service role for DB writes so shop buyers (incl. anonymous) can still get priced.
 */
export async function syncDynamicQuoteFromInstanceLogs(quotationItemId: string) {
  const admin = adminClient();

  const { data: item, error } = await admin
    .from("quotation_items")
    .select("*, quotation:quotations(id, site_id)")
    .eq("id", quotationItemId)
    .single();

  if (error || !item) {
    return { error: error?.message || "Quotation item not found" };
  }

  const meta = (item.metadata?.dynamic_quote || {}) as DynamicQuoteMetadata;
  const currentPrice = Number(item.unit_price) || 0;
  const markedDone =
    meta.status === "priced" || meta.status === "awaiting_authorization";

  // Only short-circuit when we actually have a usable price on the line.
  if (markedDone && currentPrice > 0) {
    return {
      data: {
        status: meta.status,
        unitPrice: currentPrice,
        alreadyResolved: true,
        assistantInstanceId: meta.assistant_instance_id || null,
      },
    };
  }
  if (meta.status === "failed") {
    return { data: { status: "failed" as const, error: meta.error } };
  }

  const siteId = (item.quotation as { site_id?: string } | null)?.site_id;
  if (!siteId) return { error: "Quotation site missing" };

  let instanceId = meta.assistant_instance_id || null;
  if (!instanceId) {
    instanceId = await findAssistantInstanceForQuote({
      siteId,
      quotationItemId,
      attempts: 3,
    });
    if (instanceId) {
      const { error: metaErr } = await admin
        .from("quotation_items")
        .update({
          metadata: {
            ...item.metadata,
            dynamic_quote: { ...meta, assistant_instance_id: instanceId },
          },
        })
        .eq("id", quotationItemId);
      if (metaErr) {
        console.error(
          "[dynamic-quote-sync] failed to persist instance id:",
          metaErr.message
        );
      }
    }
  }

  if (!instanceId) {
    console.error("[dynamic-quote-sync] no assistant_instance_id yet", {
      quotationItemId,
    });
    return { data: { status: "processing" as const } };
  }

  const pricedLog = await findPricedAgentLog(instanceId, quotationItemId);

  if (!pricedLog) {
    return {
      data: {
        status: "processing" as const,
        assistantInstanceId: instanceId,
      },
    };
  }

  console.error("[dynamic-quote-sync] priced JSON found", {
    quotationItemId,
    instanceId,
    logId: pricedLog.id,
    unitPrice: pricedLog.extracted.unit_price,
  });

  try {
    const priced = await applyPricedResult({
      supabase: admin,
      quotationId: item.quotation_id,
      quotationItemId: item.id,
      unitPrice: pricedLog.extracted.unit_price,
      minPrice: meta.min_price,
      rationale: pricedLog.extracted.rationale,
      metadata: {
        ...meta,
        assistant_instance_id: instanceId,
        assistant_log_ids: [...(meta.assistant_log_ids || []), pricedLog.id],
      },
      requiresAuthorization: Boolean(meta.requires_authorization),
      quoteExpiration: meta.quote_expiration,
    });

    console.error("[dynamic-quote-sync] applied price", {
      quotationItemId,
      unitPrice: priced.unitPrice,
      status: priced.metadata.status,
    });

    return {
      data: {
        status: priced.metadata.status,
        unitPrice: priced.unitPrice,
        validUntil: priced.validUntil,
        assistantInstanceId: instanceId,
      },
    };
  } catch (err: any) {
    console.error(
      "[dynamic-quote-sync] applyPricedResult failed:",
      err?.message || err
    );
    return {
      error: err?.message || "Failed to apply quote price",
      data: {
        status: "processing" as const,
        assistantInstanceId: instanceId,
      },
    };
  }
}
