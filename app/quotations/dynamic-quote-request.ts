import "server-only";

import { createClient as createClientAdmin } from "@supabase/supabase-js";
import {
  computeValidUntil,
  getDynamicPricingConfig,
} from "@/app/catalog/dynamic-pricing";
import { CatalogItem, DynamicQuoteMetadata } from "@/app/types";
import { ensureCatalogItemRequirement } from "./catalog-item-requirements";
import {
  buildDynamicQuoteSystemPrompt,
  buildDynamicQuoteUserMessage,
  extractQuotePriceFromAssistantText,
} from "./dynamic-quote-prompt";
import {
  applyPricedResult,
  createAssistantRemoteInstance,
  createQuoteDeal,
  getSiteOwnerUserId,
  markQuoteFailed,
  postTunneledApi,
  recalculateQuotationTotals,
} from "./dynamic-quote-apply";
import { scheduleAssistantQuoteResolution } from "./dynamic-quote-resolve";
import { ensurePublicAccessTokenForRecord } from "@/app/documents/public-token-store";
import { isPrivateResourceId, requirePrivateCommerceSiteAccess } from "@/app/commerce/private-site-access";
import { dynamicQuoteFieldsSchema, validConfiguredQuoteFields } from "./dynamic-quote-input";

function adminClient() {
  return createClientAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function requestAuthorizedDynamicQuote(params: {
  siteId: string;
  catalogItemId: string;
  leadId: string;
  quantity?: number;
  fieldValues?: Record<string, unknown>;
  quotationId?: string;
  dealId?: string;
}) {
  const access = await requirePrivateCommerceSiteAccess(params?.siteId, ["insert", "update"]);
  if (access.error) return { error: access.error };
  const { supabase } = access;
  if (!isPrivateResourceId(params.catalogItemId) || !isPrivateResourceId(params.leadId) ||
      (params.quotationId !== undefined && !isPrivateResourceId(params.quotationId)) ||
      (params.dealId !== undefined && !isPrivateResourceId(params.dealId)) ||
      (params.quantity !== undefined && (!Number.isFinite(params.quantity) || params.quantity <= 0 || params.quantity > 10000)) ||
      !dynamicQuoteFieldsSchema.safeParse(params.fieldValues || {}).success) {
    return { error: "Invalid quote request" };
  }
  const { data: verifiedLead, error: leadError } = await supabase.from("leads")
    .select("id, buyer_user_id").eq("id", params.leadId).eq("site_id", params.siteId).single();
  if (leadError || !verifiedLead) return { error: "Lead not available" };
  if (params.quotationId) {
    const { data: quote, error } = await supabase.from("quotations")
      .select("id").eq("id", params.quotationId).eq("site_id", params.siteId)
      .eq("lead_id", params.leadId).single();
    if (error || !quote) return { error: "Quotation not available" };
  }
  if (params.dealId) {
    const { data: deal, error } = await supabase.from("deals")
      .select("id").eq("id", params.dealId).eq("site_id", params.siteId).single();
    if (error || !deal) return { error: "Deal not available" };
  }

  return executeVerifiedDynamicQuote(params, supabase, verifiedLead);
}

/** Internal only: callers must verify either staff scope or a new authenticated buyer intake. */
export async function executeVerifiedDynamicQuote(
  params: {
    siteId: string; catalogItemId: string; leadId: string; quantity?: number;
    fieldValues?: Record<string, unknown>; quotationId?: string; dealId?: string;
  },
  supabase: ReturnType<typeof adminClient>,
  verifiedLead: { buyer_user_id: string | null },
) {
  // Robots API is authenticated with SERVICE_API_KEY; billing/context uses site owner.
  const ownerUserId = await getSiteOwnerUserId(supabase, params.siteId);
  if (!ownerUserId) {
    return { error: "Site owner not found" };
  }

  const quantity = Math.max(1, Number(params.quantity) || 1);
  const fieldValues = params.fieldValues || {};

  const { data: catalogItem, error: itemError } = await supabase
    .from("catalog_items")
    .select("*")
    .eq("id", params.catalogItemId)
    .eq("site_id", params.siteId)
    .single();

  if (itemError || !catalogItem) {
    return { error: itemError?.message || "Catalog item not found" };
  }

  const item = catalogItem as CatalogItem;
  if (!item.is_dynamic_price) {
    return { error: "Catalog item is not configured for dynamic pricing" };
  }

  const config = getDynamicPricingConfig(item);
  if (!config) return { error: "Dynamic pricing config missing" };
  if (!validConfiguredQuoteFields(config, fieldValues)) return { error: "Invalid quote fields" };

  let quotationId = params.quotationId;
  let dealId = params.dealId;

  if (!quotationId) {
    if (!dealId) {
      const dealRes = await createQuoteDeal({
        supabase,
        siteId: params.siteId,
        itemName: item.name,
        currency: item.currency || "USD",
        ownerUserId,
      });
      if (dealRes.error || !dealRes.deal) {
        return { error: dealRes.error || "Failed to create deal" };
      }
      dealId = dealRes.deal.id;
    }

    const validUntil = computeValidUntil(new Date(), config.quote_expiration);
    const { data: quotation, error: qError } = await supabase
      .from("quotations")
      .insert([{
        site_id: params.siteId,
        deal_id: dealId,
        lead_id: params.leadId,
        buyer_user_id: verifiedLead.buyer_user_id || null,
        status: "sent",
        currency: item.currency || "USD",
        valid_until: validUntil,
      }])
      .select()
      .single();

    if (qError || !quotation) {
      return { error: qError?.message || "Failed to create quotation" };
    }
    quotationId = quotation.id;
  }

  const accessTokenResult = await ensurePublicAccessTokenForRecord(
    adminClient(),
    "quotations",
    quotationId!
  );
  if (!accessTokenResult.token) {
    return {
      error: accessTokenResult.error || "Failed to secure quote progress",
    };
  }
  const progressAccessToken = accessTokenResult.token;

  const baseMeta: DynamicQuoteMetadata = {
    field_values: fieldValues,
    status: "processing",
    min_price: config.min_price,
    revision_count: config.revision_count,
    requires_authorization: config.requires_authorization,
    requires_advanced_compute: config.requires_advanced_compute,
    quote_expiration: config.quote_expiration,
  };

  const { data: line, error: lineError } = await supabase
    .from("quotation_items")
    .insert([{
      quotation_id: quotationId,
      catalog_item_id: item.id,
      name: item.name,
      quantity,
      unit_price: 0,
      subtotal: 0,
      metadata: { dynamic_quote: baseMeta },
    }])
    .select()
    .single();

  if (lineError || !line) {
    return { error: lineError?.message || "Failed to create quotation item" };
  }

  await recalculateQuotationTotals(quotationId!, supabase);

  const systemPrompt = buildDynamicQuoteSystemPrompt(config);
  const userMessage = buildDynamicQuoteUserMessage({
    item,
    quantity,
    fieldValues,
    quotationId: quotationId!,
    quotationItemId: line.id,
    currency: item.currency || "USD",
    config,
  });

  const expectedResponseFormat = {
    unit_price: "number",
    currency: "string",
    rationale: "string",
  };

  try {
    if (config.requires_advanced_compute) {
      const triad = await ensureCatalogItemRequirement(item.id);
      if (triad.error || !triad.data) {
        await markQuoteFailed(
          supabase,
          line.id,
          baseMeta,
          triad.error || "Failed to ensure catalog item requirement"
        );
        return { error: triad.error || "Failed to ensure catalog item requirement" };
      }

      const promptWithFormat = [systemPrompt, "", userMessage].join("\n");

      await supabase
        .from("requirements")
        .update({
          completion_status: "pending",
          status: "in-progress",
          description: promptWithFormat,
          updated_at: new Date().toISOString(),
        })
        .eq("id", triad.data.requirement_id);

      const robotRes = await postTunneledApi("/api/workflow/promptRobot", {
        instance_id: triad.data.instance_id,
        message: promptWithFormat,
        step_status: "in_progress",
        site_id: params.siteId,
        context: JSON.stringify({
          catalog_item_id: item.id,
          quotation_id: quotationId,
          quotation_item_id: line.id,
          requires_advanced_compute: true,
          expected_response_format: expectedResponseFormat,
        }),
        activity: "robot",
      });

      const nextMeta: DynamicQuoteMetadata = {
        ...baseMeta,
        catalog_item_requirement_id: triad.data.id,
        status: "processing",
      };

      await supabase
        .from("quotation_items")
        .update({ metadata: { dynamic_quote: nextMeta } })
        .eq("id", line.id);

      const immediateText =
        typeof robotRes.data?.message === "string"
          ? robotRes.data.message
          : typeof robotRes.data?.text === "string"
            ? robotRes.data.text
            : null;

      if (immediateText) {
        const extracted = extractQuotePriceFromAssistantText(immediateText);
        if (extracted) {
          const priced = await applyPricedResult({
            supabase,
            quotationId: quotationId!,
            quotationItemId: line.id,
            unitPrice: extracted.unit_price,
            minPrice: config.min_price,
            rationale: extracted.rationale,
            metadata: nextMeta,
            requiresAuthorization: config.requires_authorization,
            quoteExpiration: config.quote_expiration,
          });
          return {
            data: {
              quotationId,
              quotationItemId: line.id,
              progressAccessToken,
              status: priced.metadata.status,
              unitPrice: priced.unitPrice,
              validUntil: priced.validUntil,
            },
          };
        }
      }

      if (!robotRes.success) {
        console.error("promptRobot warning:", robotRes.error);
      }

      return {
        data: {
          quotationId,
          quotationItemId: line.id,
          progressAccessToken,
          status: "processing" as const,
          catalogItemRequirementId: triad.data.id,
        },
      };
    }

    // Pre-create instance, return processing immediately. Background after():
    // (a) realtime subscribe to instance_logs, (b) await assistant response end
    // then fetch all logs and apply unit_price.
    const admin = adminClient();
    const instanceRes = await createAssistantRemoteInstance({
      supabase: admin,
      siteId: params.siteId,
      ownerUserId,
      name: `Quote: ${item.name}`,
    });

    if (instanceRes.error || !instanceRes.instanceId) {
      await markQuoteFailed(
        admin,
        line.id,
        baseMeta,
        instanceRes.error || "Failed to create assistant instance"
      );
      return {
        error: instanceRes.error || "Failed to create assistant instance",
      };
    }

    const instanceId = instanceRes.instanceId;
    const processingMeta: DynamicQuoteMetadata = {
      ...baseMeta,
      status: "processing",
      assistant_instance_id: instanceId,
    };

    const { error: metaError } = await admin
      .from("quotation_items")
      .update({ metadata: { dynamic_quote: processingMeta } })
      .eq("id", line.id);

    if (metaError) {
      console.error(
        "[requestDynamicQuote] failed to persist processing meta:",
        metaError.message
      );
    }

    const kickoff = await scheduleAssistantQuoteResolution({
      instanceId,
      quotationItemId: line.id,
      siteId: params.siteId,
      ownerUserId,
      message: userMessage,
      systemPrompt,
      revisionCount: config.revision_count,
      metadata: processingMeta,
      context: {
        catalog_item_id: item.id,
        quotation_id: quotationId,
        quotation_item_id: line.id,
        fields: fieldValues,
        requires_advanced_compute: false,
        requires_authorization: config.requires_authorization,
        expected_response_format: expectedResponseFormat,
      },
    });

    if (!kickoff.started) {
      await markQuoteFailed(
        admin,
        line.id,
        processingMeta,
        kickoff.error || "Failed to start assistant"
      );
      return { error: kickoff.error || "Failed to start assistant" };
    }

    return {
      data: {
        quotationId,
        quotationItemId: line.id,
        progressAccessToken,
        status: "processing" as const,
        assistantInstanceId: instanceId,
      },
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Dynamic quote failed';
    await markQuoteFailed(
      supabase,
      line.id,
      baseMeta,
      message
    );
    return { error: message };
  }
}

