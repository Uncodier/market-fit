import { CatalogItem, DynamicPricingConfig } from "@/app/types";

/** Canonical JSON shape the quoting agent must return for price extraction. */
export const DYNAMIC_QUOTE_RESPONSE_SCHEMA = `{
  "unit_price": <number>,
  "currency": "<ISO currency code, e.g. USD>",
  "rationale": "<short explanation of how the price was calculated>"
}` as const;

export function buildDynamicQuoteSystemPrompt(config: DynamicPricingConfig): string {
  const agentPrompt = (config.agent_prompt || "").trim();
  const minPrice =
    config.min_price !== undefined && config.min_price !== null
      ? Number(config.min_price)
      : null;

  return [
    "You are a commercial quoting assistant. Calculate a fair unit price for the catalog item based on the seller instructions and the buyer-provided field values.",
    agentPrompt ? `Seller quoting instructions:\n${agentPrompt}` : "",
    minPrice !== null && !Number.isNaN(minPrice)
      ? `Never return a unit_price below the minimum price of ${minPrice}.`
      : "",
    "RESPONSE FORMAT (required):",
    "Your final answer MUST be a single JSON object and nothing else (no markdown fences, no prose outside JSON).",
    "Use exactly this shape:",
    DYNAMIC_QUOTE_RESPONSE_SCHEMA,
    "Rules:",
    "- unit_price must be a finite number >= 0 (and >= minimum when set).",
    "- currency must be a 3-letter ISO code.",
    "- rationale must be a concise string.",
    "- Do not wrap the JSON in ``` fences.",
    "- Do not include extra top-level keys.",
  ]
    .filter(Boolean)
    .join("\n\n");
}

export function buildDynamicQuoteUserMessage(params: {
  item: CatalogItem;
  quantity: number;
  fieldValues: Record<string, unknown>;
  quotationId: string;
  quotationItemId: string;
  currency?: string;
  config: DynamicPricingConfig;
}): string {
  const {
    item,
    quantity,
    fieldValues,
    quotationId,
    quotationItemId,
    currency,
    config,
  } = params;

  const payload = {
    task: "calculate_dynamic_quote",
    catalog_item: {
      id: item.id,
      name: item.name,
      description: item.description || null,
      kind: item.kind,
      currency: currency || item.currency || "USD",
      min_price: config.min_price ?? item.lowest_sale_price ?? null,
    },
    quantity,
    field_values: fieldValues,
    quotation_id: quotationId,
    quotation_item_id: quotationItemId,
    requires_advanced_compute: Boolean(config.requires_advanced_compute),
    expected_response_format: {
      unit_price: "number",
      currency: "string",
      rationale: "string",
    },
  };

  return [
    "Calculate the quote for this request.",
    "Return ONLY the JSON object described in the system prompt so the unit_price can be extracted automatically.",
    JSON.stringify(payload, null, 2),
  ].join("\n\n");
}

export function extractQuotePriceFromAssistantText(
  text: string
): { unit_price: number; currency?: string; rationale?: string } | null {
  if (!text || typeof text !== "string") return null;

  // Normalize smart quotes / fancy dashes that break JSON.parse
  const trimmed = text
    .trim()
    .replace(/[\u201C\u201D\u201E\u201F\u2033\u2036]/g, '"')
    .replace(/[\u2018\u2019\u201A\u201B\u2032\u2035]/g, "'");

  // Prefer fenced JSON if present
  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidates = [
    fenceMatch?.[1]?.trim(),
    trimmed,
    // last JSON-looking object in the text
    (() => {
      const start = trimmed.lastIndexOf("{");
      const end = trimmed.lastIndexOf("}");
      if (start >= 0 && end > start) return trimmed.slice(start, end + 1);
      return null;
    })(),
  ].filter(Boolean) as string[];

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      const unitPrice = Number(parsed?.unit_price ?? parsed?.unitPrice);
      if (!Number.isFinite(unitPrice) || unitPrice < 0) continue;
      return {
        unit_price: unitPrice,
        currency:
          typeof parsed.currency === "string" ? parsed.currency : undefined,
        rationale:
          typeof parsed.rationale === "string" ? parsed.rationale : undefined,
      };
    } catch {
      // try next candidate
    }
  }

  // Last resort: regex unit_price from messy assistant text
  const priceMatch = trimmed.match(/"unit_price"\s*:\s*([0-9]+(?:\.[0-9]+)?)/i);
  if (priceMatch) {
    const unitPrice = Number(priceMatch[1]);
    if (Number.isFinite(unitPrice) && unitPrice >= 0) {
      return { unit_price: unitPrice };
    }
  }

  return null;
}
