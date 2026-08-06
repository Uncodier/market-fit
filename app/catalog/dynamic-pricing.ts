import {
  CatalogItem,
  DynamicPricingConfig,
  DynamicQuoteFieldType,
  QuoteExpiration,
} from "@/app/types";

export const DYNAMIC_QUOTE_FIELD_TYPES: {
  value: DynamicQuoteFieldType;
  label: string;
  description: string;
}[] = [
  { value: "text", label: "Text", description: "Single-line text" },
  { value: "number", label: "Number", description: "Numeric value" },
  { value: "phone", label: "Phone", description: "Telephone number" },
  { value: "address", label: "Address", description: "Street address" },
  { value: "email", label: "Email", description: "Email address" },
  { value: "distance", label: "Distance", description: "Numeric distance" },
  { value: "location", label: "Location", description: "Place or city" },
  { value: "date", label: "Date", description: "Calendar date" },
  { value: "select", label: "Select", description: "Dropdown options" },
  { value: "boolean", label: "Yes / No", description: "Toggle" },
];

export function getDynamicQuoteFieldTypeLabel(type: DynamicQuoteFieldType): string {
  return DYNAMIC_QUOTE_FIELD_TYPES.find((t) => t.value === type)?.label || type;
}

export const DEFAULT_QUOTE_EXPIRATION: QuoteExpiration = {
  value: 30,
  unit: "days",
};

export const DEFAULT_DYNAMIC_PRICING: DynamicPricingConfig = {
  agent_prompt: "",
  min_price: undefined,
  revision_count: 1,
  requires_advanced_compute: false,
  requires_authorization: false,
  quote_expiration: DEFAULT_QUOTE_EXPIRATION,
  fields: [],
};

export function getDynamicPricingConfig(
  item: CatalogItem | null | undefined
): DynamicPricingConfig | null {
  if (!item?.is_dynamic_price) return null;
  const config = item.metadata?.dynamic_pricing;
  if (!config) {
    return {
      ...DEFAULT_DYNAMIC_PRICING,
      min_price: item.lowest_sale_price ?? undefined,
    };
  }
  return {
    ...DEFAULT_DYNAMIC_PRICING,
    ...config,
    quote_expiration: config.quote_expiration || DEFAULT_QUOTE_EXPIRATION,
    fields: Array.isArray(config.fields) ? config.fields : [],
    revision_count: Math.max(1, Number(config.revision_count) || 1),
  };
}

export function isDynamicPricedItem(item: CatalogItem | null | undefined): boolean {
  return Boolean(item?.is_dynamic_price);
}

/** True when dynamic pricing is enabled and at least one quote field is configured. */
export function hasDynamicQuoteFields(item: CatalogItem | null | undefined): boolean {
  const config = getDynamicPricingConfig(item);
  return Boolean(config && Array.isArray(config.fields) && config.fields.length > 0);
}

export function quoteExpirationToMs(expiration?: QuoteExpiration | null): number {
  const exp = expiration || DEFAULT_QUOTE_EXPIRATION;
  const value = Math.max(1, Number(exp.value) || 1);
  switch (exp.unit) {
    case "minutes":
      return value * 60 * 1000;
    case "hours":
      return value * 60 * 60 * 1000;
    case "days":
    default:
      return value * 24 * 60 * 60 * 1000;
  }
}

export function computeValidUntil(
  from: Date | string = new Date(),
  expiration?: QuoteExpiration | null
): string {
  const base = typeof from === "string" ? new Date(from) : from;
  return new Date(base.getTime() + quoteExpirationToMs(expiration)).toISOString();
}

export function formatQuoteExpirationLabel(
  expiration?: QuoteExpiration | null,
  t?: (key: string) => string
): string {
  const exp = expiration || DEFAULT_QUOTE_EXPIRATION;
  const value = Math.max(1, Number(exp.value) || 1);
  const unit = exp.unit || "days";
  
  if (t) {
    const isSingular = value === 1;
    const key = isSingular 
      ? `common.time.${unit.replace(/s$/, "")}Singular` 
      : `common.time.${unit}`;
      
    const translatedUnit = t(key) || (isSingular ? unit.replace(/s$/, "") : unit);
    return `${value} ${translatedUnit}`;
  }

  const singular = unit.replace(/s$/, "");
  return `${value} ${value === 1 ? singular : unit}`;
}

export function slugifyFieldKey(label: string): string {
  return (
    label
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "")
      .slice(0, 48) || "field"
  );
}
